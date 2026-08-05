# Solo Leveling Gym — Design Spec

**Ngày:** 2026-08-05
**Trạng thái:** Đã duyệt, sẵn sàng lập kế hoạch triển khai

---

## 1. Tổng quan

Web app theo dõi tập luyện cá nhân, đóng gói bằng hệ thống game của truyện _Solo Leveling_. Một người dùng duy nhất (chủ sở hữu), deploy công khai để bất kỳ ai cũng xem được hành trình tập luyện thật.

**Hai mục tiêu, cùng trọng số:**

1. **Công cụ cá nhân** — thứ chủ sở hữu thật sự dùng để tập đều đặn
2. **Portfolio** — thứ đáng show, chạy bằng dữ liệu thật chứ không phải mock

**Bối cảnh người dùng:** Tập tạ + chạy bộ. Chưa từng log tập luyện bao giờ. Rào cản lớn nhất tự nhận là **lười**. Mọi quyết định thiết kế trong tài liệu này đều bị chi phối bởi hai sự thật đó.

### 1.1 Hiện trạng

Next.js 15 + React 19 + Tailwind + Zustand + framer-motion. 9 trang UI đã dựng, toàn bộ dữ liệu là mock hardcode trong `src/store/useAppStore.ts`. Không có backend, không có persistence, không có logic thật. Đây là lớp vỏ giao diện chưa có máy bên dưới — phần lớn UI sẽ được giữ lại, toàn bộ dữ liệu sẽ được thay bằng engine thật.

### 1.2 Nguyên tắc bao trùm

> **Mọi con số hiển thị phải bắt nguồn từ một việc người dùng đã thật sự làm.**

Đây là ranh giới đạo đức của cả sản phẩm. Stat không được cộng tay, không mua được bằng gold, không tăng bằng item, không do AI kê ra. Vi phạm nguyên tắc này ở bất cứ đâu thì mọi con số khác cũng mất giá trị.

### 1.3 Phân loại con số — bắt buộc đọc trước khi implement

Có **ba loại số** trong app, và chúng tuân luật khác nhau. Nhầm lẫn giữa chúng là nguồn mâu thuẫn thiết kế lớn nhất.

| Loại           | Ví dụ                                               | Luật                                                                                                                                                                |
| -------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Đo lường**   | 6 stat, e1RM, volume, PR, shadow grade, Army Rank   | **Suy ra thuần tuý từ `set_log` / `run_log`.** Không gì được sửa đổi: không item, không skill, không gold, không class. Đây là tấm gương phản chiếu sự thật.        |
| **Tiến trình** | EXP, level, rank, gold                              | Suy ra từ hoạt động, **nhưng được phép nhân bởi hệ số kiếm được bằng tập luyện** (buff shadow, skill, title, class). Không bao giờ được nhân bởi thứ mua bằng gold. |
| **Điều chỉnh** | Fatigue, penalty −15% stat, trần fatigue của Tanker | Cơ chế tầng game. Áp lên **lớp hiển thị**, không ghi đè giá trị đo lường gốc.                                                                                       |

Hệ quả implement quan trọng: `stat` lưu trong DB luôn là **giá trị đo lường gốc**. Penalty −15% và mọi modifier khác được áp ở tầng đọc:

```
statHiển thị = statĐoLường × Π(modifiers đang hoạt động)
```

Nghĩa là thoát Penalty Zone không cần "hoàn lại" gì cả — chỉ cần gỡ modifier. Và không có đường nào để một hiệu ứng tạm thời làm hỏng dữ liệu gốc.

---

## 2. Quyết định đã chốt

| Chủ đề           | Quyết định                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| Người dùng       | 1 người. Đọc công khai, ghi cần PIN.                                                             |
| Lưu trữ          | DB trên server (Turso/libSQL). **Không** localStorage — deploy công khai phải hiện dữ liệu thật. |
| Chương trình tập | Upper/Lower 4 buổi + 2 buổi chạy Zone 2                                                          |
| Cách log         | Plan-first, 1 chạm mỗi set, mức tạ tự đề xuất                                                    |
| Stat             | **Suy ra từ dữ liệu thật.** Bỏ `statPoints` thủ công.                                            |
| Hình phạt        | Nghiêm khắc nhưng **chuộc lại được** (Penalty Zone có lối ra)                                    |
| Tầng AI          | Gemini free tier **+** template engine làm nền. Không LLM kê mức tạ.                             |
| Ngôn ngữ System  | Tiếng Anh (UI cũng tiếng Anh)                                                                    |
| Phạm vi          | Đủ 9 trang, **mở khoá dần theo level**                                                           |
| Tích hợp         | Không Strava/Apple Health ở v1. Chạy bộ nhập tay 2 số.                                           |

---

## 3. Kiến trúc

### 3.1 Stack

| Thành phần | Chọn                         | Lý do                                                          |
| ---------- | ---------------------------- | -------------------------------------------------------------- |
| Framework  | Next.js 15 (giữ)             | App Router, Server Actions, Vercel Cron                        |
| DB         | Turso (libSQL)               | SQLite edge. Local dev = một file. Free tier dư xa.            |
| ORM        | Drizzle                      | Type-safe, schema bằng TypeScript, migration qua `drizzle-kit` |
| Mutation   | Server Actions               | Không cần dựng REST riêng                                      |
| Auth       | PIN → cookie httpOnly        | Đọc công khai, ghi gác PIN                                     |
| LLM        | Gemini 2.5 Flash (free tier) | ~250 req/ngày; app cần ~6–8                                    |
| Deploy     | Vercel                       | Cron có sẵn cho reset Daily Quest                              |
| Test       | Vitest + Playwright          | Unit dày ở `core/`, E2E mỏng                                   |

### 3.2 Luật phụ thuộc

```
app/ (routes)  →  server/  →  app-services/  →  core/
                                    ↓              ↑
                                 ports/  ←────  infra/
```

**`core/` không được import bất cứ thứ gì ngoài chính nó.** Không React, không Drizzle, không `next/*`, không `Date.now()`, không `Math.random()`. Mọi hiệu ứng phụ đi qua `ports/`.

Ép bằng `eslint-plugin-import` với `no-restricted-paths`. CI đỏ nếu vi phạm. Kiến trúc không được máy kiểm tra sẽ mục trong vài tháng.

### 3.3 Cấu trúc thư mục

```
src/
  core/                        # Domain thuần. Zero I/O.
    shared/
      result.ts                # Result<T, E>
      units.ts                 # Branded types: Kg, Reps, Exp, Gold, Epoch
      events.ts                # Union type domain events
    hunter/{progression,stats,fatigue}.ts
    training/{overload,volume,pr}.ts
    quest/{daily-quest,penalty,training-day}.ts
    shadow/rank-up.ts
    economy/{pricing,effects}.ts
    skill/unlock-tree.ts
    narrative/arc.ts           # Tuyến truyện Kiến Trúc Sư

  ports/
    clock.port.ts
    rng.port.ts
    system-voice.port.ts
    repositories.port.ts

  app-services/                # 1 file = 1 use case
    log-set.ts
    complete-session.ts
    roll-daily-quest.ts
    resolve-penalty.ts
    purchase-item.ts
    refresh-system-voice.ts
    ...

  infra/
    db/{schema,migrations,repositories,client}.ts
    system-voice/{gemini,template,resilient}.adapter.ts
    clock/system-clock.ts
    rng/seeded-rng.ts
    config/env.ts              # validate env lúc boot, sai là chết ngay

  server/
    actions/                   # Mỏng: auth → zod → app-service → DTO
    auth/{pin,session}.ts
    container.ts               # Composition root

  ui/{components,hooks,stores}/  # Zustand chỉ giữ state UI
  app/                           # Next routes
```

### 3.4 Lý do từng ranh giới tồn tại

Mỗi tầng dưới đây được thêm vì nó chặn một lỗi cụ thể, không phải vì "đúng chuẩn".

**`ClockPort`** — App đầy logic phụ thuộc thời gian: reset 00:00, quest hết hạn 18h, Penalty Zone, shadow suy yếu sau 7 ngày. Nếu `core/` gọi thẳng `new Date()` thì không thể test "23:59 so với 00:01" mà không đổi giờ hệ thống — nghĩa là sẽ không ai test, nghĩa là logic quan trọng nhất không được kiểm chứng.

**`core/quest/training-day.ts`** — Người dùng ở UTC+7, Vercel chạy UTC. Bất kỳ chỗ nào gọi `new Date().getDate()` sẽ khiến **mọi buổi tập log sau 19:00 giờ VN bị ghi sang ngày hôm sau** → streak vỡ, Daily Quest tính trượt oan, Penalty Zone kích hoạt sai.

_Luật:_ DB lưu **UTC epoch, luôn luôn**. Khái niệm "ngày tập" chỉ tồn tại trong đúng một hàm, nhận timezone làm tham số tường minh. Không nơi nào khác được tự suy ra ngày.

**`RngPort`** — Hidden quest, loot drop, Emergency Quest đều có xác suất. Seeded RNG cho phép test phân phối một cách tất định.

**Domain events** — Một cái tap ✓ kéo theo: cộng EXP → có thể lên level → có thể lên rank → cộng EXP shadow → có thể lên grade → kiểm tra PR → mở title → cập nhật quest → trả gold → cộng fatigue → có thể sinh System message.

Nhét chuỗi đó vào `logSet()` sẽ tạo ra một hàm 400 dòng không ai dám sửa. Thay vào đó `core/` **trả về** events:

```ts
logSet(...) → Result<{ state: HunterState, events: DomainEvent[] }>
```

`app-services/log-set.ts` ghi tất cả trong **một transaction**, rồi đẩy events sang UI để chạy animation. Mỗi handler độc lập. **Đây là thứ cho phép build đủ 9 trang mà không sụp** — hệ thống mới chỉ là thêm handler.

**Idempotency** — Sóng phòng gym yếu, người dùng tap lại. Mỗi mutation mang `clientActionId` (UUID sinh ở client); bảng `processed_action` có unique index; lần hai trả kết quả lần một, không ghi gì thêm.

**Branded types** — `type Kg = number & { __brand: 'Kg' }`. Chặn `computeVolume(reps, weight)` gọi nhầm thứ tự — lỗi mà TypeScript thường im lặng cho qua vì cả hai đều là `number`.

**LLM là input không tin cậy** — Text từ Gemini đi thẳng vào UI. Adapter phải validate, giới hạn, khử injection, và fail sang template. Chi tiết ở §10.4.

### 3.5 Chiến lược test

| Tầng             | Công cụ                   | Mật độ    | Nội dung                                                                         |
| ---------------- | ------------------------- | --------- | -------------------------------------------------------------------------------- |
| `core/`          | Vitest                    | **Dày**   | Mọi luật chơi. Không I/O, chạy mili-giây.                                        |
| `app-services/`  | Vitest + SQLite in-memory | Vừa       | Transaction, idempotency, ráp ports                                              |
| `server/actions` | Vitest                    | Mỏng      | Gác PIN, validate đầu vào                                                        |
| E2E              | Playwright                | 3–4 luồng | Log xong buổi tập · trượt quest → Penalty Zone · thoát Penalty Zone · onboarding |

### 3.6 Cố ý KHÔNG làm

App một người dùng, một ghi chép mỗi lần. Những thứ sau là nghi thức rỗng ở quy mô này:

- Không CQRS, không event sourcing — domain event là giá trị trả về trong tiến trình
- Không DI framework — `container.ts` là hàm thuần ráp object
- Không repository cho từng entity — gộp theo bounded context: `TrainingRepo`, `HunterRepo`, `EconomyRepo`
- Không message queue, không worker — Vercel Cron là đủ
- Không GraphQL, không REST layer — Server Actions đã là RPC có kiểu
- Không microservice, không Docker

---

## 4. Mô hình dữ liệu

### 4.1 Bảng

**Cốt lõi**

- `hunter` — 1 dòng: tên, level, exp, gold, rank, title, class, 6 stat, fatigue, `reasonForHunting`, `timezone`
- `exercise` — danh mục: tên, nhóm cơ, compound/isolation, đơn vị
- `program` / `program_day` — Upper A · Lower A · Upper B · Lower B → bài + set/rep range

**Dữ liệu người dùng tạo ra**

- `session` — ngày, program_day, giờ bắt đầu/kết thúc, trạng thái, rank
- `set_log` — **bảng trung tâm**: session, exercise, thứ tự set, reps, kg, completed, isPR
- `run_log` — ngày, km, phút
- `daily_quest` — ngày, mục tiêu (json), trạng thái
- `penalty` — bắt đầu, kết thúc, lý do, biến thể (§6.4)
- `stat_snapshot` — ảnh chụp stat hằng ngày, phục vụ biểu đồ

**Hệ thống game**

- `shadow` — 9 dòng: nhóm cơ, level, exp, grade, lần tập cuối
- `item` / `inventory` — định nghĩa và số lượng
- `skill` / `unlocked_skill` / `equipped_skill`
- `title` / `unlocked_title`
- `wager` — cược tuần: số gold, hợp đồng, kết quả
- `narrative_fragment` — mảnh truyện đã mở
- `system_message` — text, ngữ cảnh, `source: 'llm' | 'template'`
- `processed_action` — idempotency

### 4.2 `set_log` là gốc của mọi thứ

Stat, shadow level, PR, biểu đồ, gợi ý mức tạ, câu nói của System — **tất cả đều là truy vấn trên bảng này**. Lưu ở mức chi tiết nhất: mỗi set một dòng, không gộp. Sai ở đây thì sửa rất đau.

### 4.3 Quyền riêng tư

Deploy công khai + đọc tự do nghĩa là **bất kỳ ai có link đều xem được toàn bộ dữ liệu tập**. Đó đúng là mục tiêu portfolio. Nhưng schema phải có cờ `private` cho từng loại dữ liệu **ngay từ đầu** — thêm cân nặng cơ thể hay ảnh tiến độ sau này sẽ rẻ hơn nhiều so với vá lại.

---

## 5. Engine tập luyện

### 5.1 Chương trình

Upper/Lower 4 buổi + 2 buổi chạy. Mỗi nhóm cơ 2 lần/tuần — ngưỡng có bằng chứng mạnh nhất cho phì đại cơ. Chọn Upper/Lower thay vì PPL 6 ngày vì phải chừa chỗ cho chạy bộ và vì volume thấp hơn mà **hoàn thành được** thắng volume cao mà bỏ dở.

| Dungeon              | Bài                                                                                              | Set × Rep range                                           |
| -------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **Upper A** (nặng)   | Bench Press · Barbell Row · Overhead Press · Lat Pulldown · DB Curl · Triceps Pushdown           | 4×6-8 · 4×6-8 · 3×8-10 · 3×10-12 · 3×12-15 · 3×12-15      |
| **Lower A** (squat)  | Back Squat · Romanian Deadlift · Leg Press · Leg Curl · Calf Raise · Plank                       | 4×6-8 · 3×8-10 · 3×10-12 · 3×12-15 · 4×15-20 · 3×45s      |
| **Upper B** (volume) | Incline DB Press · Seated Cable Row · Lateral Raise · Face Pull · Cable Fly · Hammer Curl        | 4×10-12 · 4×10-12 · 3×15-20 · 3×15-20 · 3×12-15 · 3×12-15 |
| **Lower B** (hinge)  | Deadlift · Front Squat · Bulgarian Split Squat · Leg Extension · Seated Calf · Hanging Leg Raise | 3×5-6 · 3×8-10 · 3×10-12 · 3×15-20 · 4×15-20 · 3×12-15    |

**Lịch tuần:** T2 Upper A · T3 chạy Z2 · T4 Lower A · T5 chạy Z2 · T6 Upper B · T7 Lower B · CN nghỉ

**Luật chống interference** (tạ + chạy cùng chương trình):

1. Không chạy nặng ngày sau squat/deadlift nặng — lịch trên đã tránh sẵn
2. Nếu cùng buổi: **tạ trước, chạy sau**
3. Phần lớn cardio giữ ở Zone 2; cách nhau 3–6 giờ giữa hai buổi giảm interference đáng kể

### 5.2 Cơ chế log

Màn hình dungeon chỉ hiển thị **set kế tiếp**:

```
BENCH PRESS          Set 2 / 4
        80 kg × 6                ← tự điền từ buổi trước
  [ −2.5 ]  ✓ CLEAR  [ +2.5 ]
  Set 1  ✓ 80×7
       Rest 2:00  ▓▓▓▓▓░░░░
```

- `✓ CLEAR` — reps mặc định = cận dưới của range. **Trường hợp thường gặp tốn đúng một chạm.**
- Vuốt lên để chỉnh reps; hai nút ± chỉnh tạ
- Rest timer tự chạy sau mỗi set
- Set cuối của bài compound chính = **BOSS**, EXP ×1.5
- Ghi lạc quan (optimistic); mất mạng thì set vào hàng đợi IndexedDB, tự đẩy khi có sóng

### 5.3 Progressive overload — double progression

```
Với mỗi bài, xét buổi gần nhất:
  • TẤT CẢ set đạt cận TRÊN
      → +2.5kg (isolation & upper) | +5kg (squat, deadlift, leg press)
      → reps về cận DƯỚI
  • Đạt cận dưới, chưa tới cận trên
      → giữ tạ, mục tiêu +1 rep
  • 2 buổi LIÊN TIẾP không đạt cận dưới
      → DELOAD 10%
```

Thuật toán tường minh, không LLM, test được. Người dùng **không bao giờ phải tự quyết định hôm nay đẩy bao nhiêu** — mỗi quyết định phải tự đưa ra là một cái cớ để không đi tập.

Deload được The System đóng khung là **rút lui chiến thuật**, không phải thất bại.

### 5.4 Suy ra 6 stat

| Stat     | Nguồn                                                   |
| -------- | ------------------------------------------------------- |
| **STR**  | Tổng e1RM của bench, squat, deadlift, OHP, row          |
| **AGI**  | Pace + tổng km 4 tuần gần nhất                          |
| **VIT**  | Tổng volume load + số buổi hoàn tất                     |
| **PER**  | % set hoàn thành đúng kế hoạch                          |
| **INT**  | Tuân thủ chương trình + side quest (ngủ, nước, protein) |
| **LUCK** | Streak + số hidden quest — **ảnh hưởng tỉ lệ rơi item** |

e1RM theo công thức Epley: `1RM = kg × (1 + reps/30)`.

**Stat sẽ tụt nếu ngừng tập.** Đó là detraining ngoài đời. Một thanh STR đi xuống có sức nặng tâm lý mà thông báo "bạn đã mất streak" không có.

Level-up không cho stat — cho **Ability Point**, tiêu ở cây skill (§9). Tách bạch: _stat là tấm gương phản chiếu sự thật, skill là chỗ người dùng được chọn._

### 5.5 Fatigue

- Mỗi buổi cộng fatigue theo volume load so với trung bình 4 tuần
- Giảm dần mỗi ngày; ngủ đủ thì giảm nhanh hơn
- **> 70** — The System cảnh báo
- **> 85** — EXP nhận giảm 50%, xuất hiện **Rest Quest bắt buộc**

Đây là cơ chế duy nhất trong app **thưởng cho việc nghỉ**. Không có nó, app gamified nào cũng đẩy người dùng tới overtraining, và chấn thương là cách chắc chắn nhất để bỏ tập hai tháng.

### 5.6 Rank của dungeon

Tính từ volume load dự kiến so với trung bình gần đây: `<0.5×` E · `0.5–0.8×` D · `0.8–1.1×` C · `1.1–1.4×` B · `>1.4×` A.

Buổi nặng nhất tuần tự nhiên thành gate rank cao. Khi người dùng khoẻ lên, buổi từng là B tụt xuống C — đúng cảm giác của truyện.

---

## 6. Quest & Penalty Zone

### 6.1 Daily Quest

Bài tay không + chạy, làm được ở nhà. **Nguyên tắc: hình phạt chỉ công bằng nếu luôn có cách tránh được** — nếu Daily Quest đòi tới phòng gym thì hôm gym đóng cửa là bị phạt oan, và phạt oan giết niềm tin vào hệ thống nhanh nhất.

Quy mô lớn theo rank:

| Rank  | Hít đất | Gập bụng | Squat   | Chạy      |
| ----- | ------- | -------- | ------- | --------- |
| E     | 20      | 20       | 20      | 1 km      |
| D     | 30      | 30       | 30      | 2 km      |
| C     | 45      | 45       | 45      | 3 km      |
| B     | 60      | 60       | 60      | 5 km      |
| A     | 80      | 80       | 80      | 7 km      |
| **S** | **100** | **100**  | **100** | **10 km** |

Con số kinh điển của Jin-Woo là **đích đến cuối**, không phải vạch xuất phát. Bắt người chưa từng log làm 100/100/100 + 10km ngày đầu là cầm chắc trượt → Penalty Zone → gỡ app.

Reset 00:00 ICT, hết hạn 23:59:59 cùng ngày. Vercel Cron 17:00 UTC.

### 6.2 Sáu loại quest

| Loại                 | Nguồn                                            | Trượt                                       |
| -------------------- | ------------------------------------------------ | ------------------------------------------- |
| **Daily Quest**      | Tự sinh mỗi ngày                                 | **→ Penalty Zone**                          |
| **Dungeon Quest**    | Buổi tạ theo lịch                                | → Dungeon Break (§6.5)                      |
| **Side Quest**       | Ngủ 7h, nước 2.5L, protein, bước chân            | Không phạt                                  |
| **Hidden Quest**     | Điều kiện ẩn: 5 ngày liên tiếp, PR, tập trước 7h | Chỉ hiện khi đã hoàn thành. LUCK tăng tỉ lệ |
| **Emergency Quest**  | Ngẫu nhiên, hiếm, giới hạn giờ                   | Thưởng lớn. **Tắt được.**                   |
| **Job Change Quest** | Level 40                                         | §9.5                                        |

Chỉ Daily Quest dẫn tới Penalty Zone. Nếu ngủ thiếu 30 phút cũng bị phạt thì hình phạt mất hết ý nghĩa.

### 6.3 Penalty Zone

**Kích hoạt:** 23:59:59 ICT mà Daily Quest chưa xong.

| Mất gì | Chi tiết                                                   |
| ------ | ---------------------------------------------------------- |
| EXP    | −10% EXP hiện tại. **Vĩnh viễn.** Không bao giờ tụt level. |
| Stat   | −15% toàn bộ. **Tạm thời** — hồi khi thoát.                |
| Khoá   | Mọi trang trừ Penalty Zone                                 |

**Thoát:** hoàn thành Survival Quest = **1.5×** Daily Quest hôm đó.

### 6.4 Biến thể Penalty Zone

Nghiên cứu cho thấy động lực dựa trên nỗi sợ **sụp đổ khi nỗi sợ hết mới lạ**. Lần thứ tư bị phạt, sa mạc rết chỉ còn là việc vặt.

Nên Penalty Zone **đổi mỗi lần**:

| Lần | Bối cảnh            | Giọng System      |
| --- | ------------------- | ----------------- |
| 1   | Sa mạc rết khổng lồ | Lạnh, nêu sự kiện |
| 2   | Hang băng           | Mất kiên nhẫn     |
| 3   | Đầm lầy tối         | Khinh miệt        |
| 4+  | Xoay vòng           | Lạnh nhạt dần     |

Cùng cơ chế, khác trải nghiệm. Chi phí gần bằng 0 vì SystemVoice đã có sẵn.

### 6.5 Dungeon Break

Bỏ một buổi tạ → gate **vỡ** → volume buổi đó **dồn sang buổi kế tiếp**, có trần **+40%**.

Đúng lore (gate không clear kịp thì quái tràn ra), đúng huấn luyện (bỏ tập thì phải bù), và tạo hậu quả **cảm nhận được ở thân thể** thay vì một con số EXP bị trừ.

### 6.6 Chống vòng xoáy tử thần

Ba cơ chế bắt buộc. Vòng xoáy trừng phạt là cách app dạng này tự sát.

1. **Không phạt chồng phạt.** Đang trong Penalty Zone thì Daily Quest **ngừng chấm**. Kẹt 5 ngày cũng chỉ nợ một Survival Quest.

2. **Leo thang có trần.** Mỗi ngày kẹt lại, Survival Quest nặng thêm 10%, **chặn ở 2×**. Qua ngày thứ 7, thay vì nặng thêm, The System **im lặng** — không message mới, giao diện xám. Bị hệ thống bỏ rơi là hình phạt nặng hơn mọi con số.

3. **Reawakening Test — van an toàn.** Nghỉ ≥ **14 ngày**, mở app không phải bức tường nợ:

   > `[The System has detected a dormant Hunter.]`
   > `A Reawakening Test is available.`

   Một buổi tập. Hoàn thành → xoá sạch penalty, stat tính lại theo thể trạng **hiện tại** (thấp hơn — vì thực tế đã yếu đi), level giữ nguyên.

   Lấy thẳng từ nguyên tác, và xử lý đúng tình huống đã giết mọi habit tracker: người dùng quay lại sau một tháng, thấy đống đổ nát, xoá app. Ở đây, quay lại được kể như một chương truyện.

### 6.7 Streak

Đếm ngày liên tiếp hoàn thành Daily Quest. Nuôi **LUCK** → tăng tỉ lệ Hidden Quest và tỉ lệ rơi item. Vào Penalty Zone thì reset.

Streak là **đầu vào của hệ thống khác**, không phải con số để ngắm.

---

## 7. Shadow Army

### 7.1 Ánh xạ

| Shadow      | Nhóm cơ         | Nguyên tác                      |
| ----------- | --------------- | ------------------------------- |
| **Igris**   | Chest           | Elite Knight — shadow đầu tiên  |
| **Tank**    | Back            | Beast                           |
| **Iron**    | Legs (Quads)    | Elite Knight, rìu               |
| **Beru**    | Posterior Chain | Ant King → Marshal              |
| **Greed**   | Shoulders       | Elite                           |
| **Jima**    | Arms            | High Orc Warrior                |
| **Tusk**    | Core            | Shaman                          |
| **Kaisel**  | Cardio          | Shadow Dragon                   |
| **Bellion** | _Toàn quân_     | Grand Marshal. Mở ở **S-Rank**. |

### 7.2 ARISE

Bắt đầu **chỉ với Igris**. Mỗi shadow còn lại được rút khi lập **PR đầu tiên** trên một bài thuộc nhóm cơ đó.

Toàn màn hình tối, chỉ còn `[ ARISE ]`, rồi hạt bóng tụ lại.

Tám khoảnh khắc, mỗi cái gắn với một lần thật sự nâng được thứ trước đó chưa nâng nổi. Tháng đầu của người mới là chuỗi PR liên tục, nên nhịp mở khoá dày đúng lúc cần lý do quay lại nhất.

### 7.3 Mạnh lên và yếu đi

**EXP shadow = volume load nhóm cơ đó.** Không nguồn nào khác, không đường tắt.

Grade: Normal → Elite → Knight → Marshal → Commander → Grand Marshal (thang log).

**Suy yếu:** không tập nhóm cơ đó **7 ngày** → mất 2% EXP/ngày, tối đa tụt một grade. Icon xám, có vết nứt.

> `Iron has weakened. 11 days without training.`

Khó phớt lờ hơn một ô trống trong lịch. Không phải bỏ tập chân — **đang để một thuộc hạ chết mòn**.

### 7.4 Tác dụng thật

| Cơ chế        | Tác dụng                                      |
| ------------- | --------------------------------------------- |
| Buff riêng    | Mỗi grade → +5% EXP cho bài thuộc nhóm cơ đó  |
| **Army Rank** | Tổng grade → mở tầng hàng trong Store         |
| Mở skill      | Shadow đạt Marshal → mở nhánh skill tương ứng |
| **Cân đối**   | Army Rank tính theo shadow **yếu nhất**       |

Cơ chế cuối khiến **tập cân đối là con đường tối ưu về mặt game**, không phải lời khuyên đạo đức.

---

## 8. Kinh tế

### 8.1 Luật

> **Gold mua được lợi thế ở tầng game. Không bao giờ mua được sự miễn trừ khỏi thực tế.**

Bộ lọc cụ thể, theo phân loại ở §1.3: **gold không bao giờ được chạm vào số Đo lường, và không bao giờ được nhân số Tiến trình.**

Bị loại theo luật này:

- Item cộng stat, item thăng grade shadow → chạm vào số **Đo lường**
- Item tăng EXP → nhân số **Tiến trình** bằng tiền, trong khi hệ số nhân chỉ được phép kiếm bằng tập luyện

Lưu ý phân biệt: buff +5% EXP của shadow (§7.4), skill Vital Strike (§9.2) và title (§12.2) **được phép** nhân EXP — vì chúng kiếm được bằng tập luyện, không mua được bằng gold.

### 8.2 Thu nhập

| Nguồn             | Gold              |
| ----------------- | ----------------- |
| Daily Quest       | 50                |
| Clear dungeon     | 30–120 (rank E→A) |
| **PR mới**        | 150               |
| Hidden Quest      | 200–500           |
| Lên level         | 100 × level       |
| **Tuần hoàn hảo** | 500               |

Tuần tập đều: **~1.200–1.500 G**. Đây là gốc định giá.

### 8.3 Phân bổ sink

| Loại                | Tỉ trọng | Vai trò                                           |
| ------------------- | -------- | ------------------------------------------------- |
| Mở nội dung khó hơn | ~35%     | Trụ chính — tiêu tiền để giành quyền được khổ hơn |
| Mở chương trình mới | ~30%     | Chống chán, đúng khoa học huấn luyện              |
| Cosmetic            | ~20%     | Sink vô hạn, phục vụ portfolio                    |
| Đặt cược            | ~10%     | Đòn bẩy hành vi                                   |
| Giảm nhẹ hình phạt  | ~5%      | Van an toàn, có trần                              |

### 8.4 Nội dung khó hơn

| Item                | Giá        | Nội dung                                                         |
| ------------------- | ---------- | ---------------------------------------------------------------- |
| Instant Dungeon Key | 800        | Buổi tập ngoài lịch, EXP đầy đủ                                  |
| **Red Gate**        | 2.500      | 1.5× volume, hết giờ là thất bại. Thưởng ×4 + đồ epic đảm bảo    |
| **Boss Raid**       | 4.000      | Ngày thử PR chính thức. Phá kỷ lục → thưởng lớn + cutscene ARISE |
| Demon Castle Floor  | 1.500/tầng | Chuỗi leo tầng, mỗi tầng khó hơn                                 |

Red Gate: bấm vào là cam kết, bỏ dở thì mất gold. Chính điều đó tạo sức nặng.

### 8.5 Chương trình mới

| Mở khoá                               | Giá        | Yêu cầu      |
| ------------------------------------- | ---------- | ------------ |
| Bài tập mới cho một nhóm cơ           | 400        | Army Rank D+ |
| **Push/Pull/Legs 6 ngày**             | 3.000      | Level 20     |
| **5/3/1**                             | 5.000      | Level 30     |
| **Arnold Split**                      | 6.000      | Level 35     |
| Kiểu dungeon: AMRAP / EMOM / Drop-set | 1.200/kiểu | Level 15     |

Gác biến hoá **sau** cam kết — đúng điều khoa học huấn luyện khuyên (người mới đổi chương trình liên tục thì không tiến bộ). App ép làm đúng bằng logic của game, không bằng lời khuyên.

### 8.6 Đặt cược

```
[ SYSTEM WAGER ]
Stake 500 G on this week's contract:
4 dungeons + 2 runs + 7 daily quests.
Success → 1,500 G (×3)    Failure → 500 G lost
```

Mất mát tác động mạnh hơn phần thưởng cùng độ lớn. Và **chính hành động quyết định có cược hay không đã buộc người dùng nhìn thẳng vào tuần sắp tới** — thứ người lười né tránh.

Giới hạn: 1 cược/tuần, tối đa 50% gold đang có.

### 8.7 Cosmetic

Theme UI (E-Rank xám → System blue → Monarch tím → Shadow Sovereign đen-vàng) · giọng System · skin & hiệu ứng hạt cho shadow · khung title · layout dashboard.

Không thúc đẩy tập, nhưng giải quyết lạm phát và **là chính thứ khách xem portfolio nhìn thấy**.

### 8.8 Giảm nhẹ — có trần

Đúng hai món. Mỗi item giảm nhẹ hình phạt là một cái răng bị nhổ khỏi §6.

- **Hourglass of Grace** (1.000, tối đa 1 lần/tuần) — giãn deadline Daily Quest 4 giờ. **Giãn, không xoá** — nếu huỷ được hình phạt thì Penalty Zone chỉ còn là thuế gold.
- **Shadow Feed** (600) — một shadow +3 ngày trước khi suy yếu

### 8.9 Trang bị

3 ô: **Weapon / Armor / Accessory**. Mỗi món là modifier bị động ở tầng game (VD: _Knight Killer_ +10% EXP bài Back; _Shadow Compression Gear_ fatigue tích chậm 15%).

**Không mua được bằng gold.** Chỉ **rơi ra** khi clear dungeon, tỉ lệ theo rank dungeon và **LUCK**. LUCK đến từ streak → _tập đều → LUCK cao → đồ tốt hơn._ Vòng lặp khép kín, không đường tắt bằng tiền.

Grade: common → uncommon → rare → epic → legendary.

### 8.10 Rủi ro cân bằng đã biết

Kinh tế một người chơi không có áp lực khan hiếm tự nhiên — nó trượt về lạm phát hoặc nghèo mãi. Con số trên là **ước lượng trên giấy**, chưa kiểm chứng được trước khi dùng thật.

Giảm thiểu:

1. **Toàn bộ giá và tỉ lệ rơi nằm trong `core/economy/pricing.ts`** — hằng số, một file
2. **Gold sink cuối** — cosmetic tầng III giá cao không giới hạn, để gold thừa có chỗ tiêu mà không phá cân bằng

---

## 9. Skills & Job Change

### 9.1 Ability Point

1 AP/level. +5 AP mỗi lần lên rank. **Không mua được bằng gold.**

### 9.2 Nhánh BODY

| Skill                 | AP  | Tác dụng                             |
| --------------------- | --- | ------------------------------------ |
| Tenacity              | 3   | Penalty chỉ mất 5% EXP thay vì 10%   |
| Advanced Regeneration | 4   | Fatigue tiêu tan nhanh hơn 25%       |
| Iron Body             | 5   | Shadow suy yếu sau 10 ngày thay vì 7 |
| Vital Strike          | 6   | Set BOSS ×2 EXP thay vì ×1.5         |

### 9.3 Nhánh SHADOW

| Skill               | AP  | Tác dụng                                                   |
| ------------------- | --- | ---------------------------------------------------------- |
| Shadow Preservation | 3   | Suy yếu 1%/ngày thay vì 2%                                 |
| Army Discipline     | 5   | Army Rank tính theo shadow **trung bình** thay vì yếu nhất |
| Shadow Extraction+  | 6   | PR trên bài phụ cũng rút được shadow                       |
| Legion              | 8   | Mọi shadow +10% EXP                                        |

### 9.4 Nhánh SOVEREIGN

| Skill               | AP  | Tác dụng                                                    |
| ------------------- | --- | ----------------------------------------------------------- |
| Bloodlust           | 4   | Dungeon rank B+: +50% gold                                  |
| Stealth             | 4   | Hidden Quest dày hơn                                        |
| Ruler's Authority   | 7   | Đổi một mục trong Daily Quest hôm nay                       |
| **Shadow Exchange** | 8   | Hoán đổi hai buổi trong tuần, không mất streak — 1 lần/tuần |
| **Shadow Storage**  | 10  | **Gửi** buổi tập thừa vào kho, rút ra bù cho hôm lỡ         |

**Shadow Storage** không xoá bỏ kỷ luật — nó cho phép **trả trước**. Muốn có buổi để cất thì phải tập dư đã. Thưởng cho người dồn sức lúc rảnh, đúng cách người đi làm sống.

### 9.5 Ô skill

Bắt đầu **3 ô**. Skill phải nằm trong ô mới có hiệu lực. Mở thêm bằng **Rune Stone** (3.000 G) — tối đa 8 ô.

Gold mua **chỗ chứa**, AP mua **sức mạnh**. Kinh tế nối với skill mà không để tiền mua sức mạnh trực tiếp.

### 9.6 Job Change Quest — Level 40

```
JOB CHANGE QUEST
▸ 3 consecutive dungeons at 1.2× normal volume
▸ No Daily Quest failures
▸ Window: 7 days
Failure: retry available at Level 45.
```

Trượt không mất gì — chỉ đợi tới Lv45. Cột mốc nên khó, không nên tàn nhẫn.

### 9.7 Class

**Người dùng không tự chọn từ menu.** The System đọc 40 level dữ liệu và đề nghị class họ _đã thật sự trở thành_.

| Class                 | Điều kiện                   | Đặc quyền                                                       |
| --------------------- | --------------------------- | --------------------------------------------------------------- |
| **Berserker**         | STR nổi trội                | Compound +25% EXP · mở 5/3/1 miễn phí                           |
| **Assassin**          | AGI nổi trội                | Fatigue hồi nhanh 40% · quest chạy ×2 gold                      |
| **Tanker**            | VIT nổi trội                | Trần fatigue +25 · giảm nhẹ penalty                             |
| **Fighter**           | Cân bằng                    | +10% mọi thứ · thêm 1 ô skill                                   |
| **🔒 Shadow Monarch** | **Cả 8 shadow đạt Knight+** | Bellion thức tỉnh · nhánh Sovereign giảm nửa AP · theme Monarch |

Shadow Monarch **không hiện trong danh sách** cho tới khi đủ điều kiện. Điều kiện của nó là tập đều cả tám nhóm cơ trong 40 level.

Đúng nguyên tác (class không ai biết tồn tại) và đúng huấn luyện (con đường khó nhất là con đường của người tập tử tế nhất). Người đi tắt bằng cách chỉ đẩy ngực sẽ ra Berserker và **không bao giờ biết mình đã bỏ lỡ gì** — cho tới khi nhìn thấy dòng khoá đó.

### 9.8 Second Awakening

**Vấn đề:** cả 8 shadow đạt Knight ở Level 40 có thể không đạt được với tiến độ thực tế. Nếu vậy, Shadow Monarch trở thành class không bao giờ tới được — một lỗi thiết kế, không phải một thử thách.

**Xử lý:** class **không cố định vĩnh viễn**. Khi nào đủ điều kiện Shadow Monarch — dù ở Level 40, 60 hay 90 — một quest mới tự xuất hiện:

```
[ A second awakening has been detected. ]
```

Hoàn thành → đổi class, giữ toàn bộ tiến trình. Nguyên tác có khái niệm **double awakening** (hunter thức tỉnh lần hai ở tầng sức mạnh mới), nên điều này hợp lore.

Ngưỡng "cả 8 shadow đạt Knight" là **hằng số cần tinh chỉnh** sau khi có dữ liệu thật, đặt trong `core/skill/unlock-tree.ts`. Mục tiêu nhắm tới: khoảng 12–18 tháng tập đều.

---

## 10. System Voice

### 10.1 LLM không bao giờ nằm trên đường đi của người dùng

Gemini Flash mất 1–2 giây. Vừa phá kỷ lục bench, đứng thở dốc — hai giây spinner là đủ giết khoảnh khắc.

| Nhóm                                        | Sinh lúc nào                      | Độ trễ |
| ------------------------------------------- | --------------------------------- | ------ |
| Theo lịch (briefing, chronicle chủ nhật)    | Cron 00:00 ICT → DB               | 0 ms   |
| Theo sự kiện (PR, ARISE, level up, penalty) | **Sinh sẵn thành pool lúc reset** | 0 ms   |
| Trượt pool                                  | Rơi về template                   | 0 ms   |

Lúc reset, cron sinh sẵn ~6 message: briefing + các phản ứng khả dĩ hôm nay. **Không có trạng thái loading nào trong toàn app.**

Tổng ~6–8 request/ngày trên hạn mức ~250 — dùng ~3%.

### 10.2 Context

Một `SystemContext` duy nhất; **LLM và template engine ăn chung object này**:

```ts
type SystemContext = {
  hunter:  { name, level, rank, title, class, streak, fatigue, reasonForHunting }
  today:   { questType, programDay, mainLift, suggestedWeight }
  recent:  { sessionsLast7d, missedDays, penaltyCount30d }
  trends:  { liftsUp[], liftsDown[], currentPRs[] }
  shadows: { weakest: {name, muscle, daysSince}, armyRank }
  narrative: { arcStage, unlockedFragments }
  history: { last5Messages }   // chống lặp
}
```

`history` hay bị quên. Không có nó, LLM nhắc lại đúng một quan sát ba ngày liền và ảo giác về giọng nói sống động tan biến.

### 10.3 Luật giọng

- Ngôi thứ hai, luôn gọi **"Hunter"**
- **Không bao giờ động viên mềm.** Không "you can do it", không "great job"
- Nêu **sự thật** trước, rồi ra **yêu cầu**. Không giải thích, không xin phép
- Tối đa **3 câu / 45 từ**
- Không emoji; tối đa một dấu chấm than
- **Bắt buộc dùng số thật từ context.** Không bao giờ bịa dữ liệu

Mẫu mong muốn:

> `Bench press: 82.5 kg. Three weeks ago: 75 kg.`
> `Igris has grown. Iron has not — eleven days.`
> `Today you will not skip legs again.`

### 10.4 Cổng kiểm duyệt

Text từ Gemini là **input không tin cậy** đi thẳng vào UI. Trượt cổng nào cũng rơi về template:

1. **Zod schema** — `{ body, severity, title? }`
2. **Giới hạn độ dài** — cắt cứng
3. **Khử injection** — strip HTML/markdown; không dùng `dangerouslySetInnerHTML`
4. **Chốt chặn ảo giác** — trích mọi số trong output, đối chiếu với số có trong context. Có số không tồn tại → **loại**

Cổng 4 rẻ mà hiệu quả: nó chặn The System nói bạn deadlift 140 kg khi bạn chưa từng chạm 100. Một câu bịa đủ để bạn ngừng tin mọi câu sau đó.

### 10.5 Template engine — lớp nền, không phải phương án dự phòng

```
[OPENING] + [OBSERVATION] + [DEMAND]
```

`OBSERVATION` **không phải câu viết sẵn** — dựng từ `SystemContext` theo thứ tự ưu tiên:

```
1. Đang trong Penalty Zone
2. Shadow suy yếu    → "{name} has weakened. {n} days."
3. Lift đang tụt     → "{lift} has fallen {n} kg from your peak."
4. Streak đang có    → "{n} consecutive days."
5. PR gần đây        → "{lift}: {kg} kg. A new record."
6. Mặc định
```

10 opening × 6 nhánh observation (bơm số thật) × 12 demand → hàng nghìn tổ hợp, **luôn nói đúng chuyện đang xảy ra**.

Khi Gemini hỏng, quota hết, hay chạy test — app không đứng hình.

### 10.6 Vận hành

```
Gemini →(timeout 3s | lỗi | trượt cổng)→ Template
```

- **Bộ đếm quota** trong DB, hạn mức tự đặt 50/ngày (1/5 hạn mức thật)
- **Circuit breaker**: 3 lỗi liên tiếp → template mode tới hết ngày
- `system_message.source` cho biết chất lượng đến từ đâu
- Đổi provider = một adapter mới sau `SystemVoicePort` (Groq, Cerebras, Ollama)

### 10.7 Giọng mua được

Item **Voice of the Ruler** (4.000 G) đổi cả system prompt lẫn bộ template:

| Giọng               | Chất                    |
| ------------------- | ----------------------- |
| **Cold** (mặc định) | Vô cảm, chỉ nêu sự kiện |
| **Mocking**         | Khinh miệt, thách thức  |
| **Ancient**         | Trang trọng, cổ ngữ     |
| **Merciless**       | Ngắn, tàn nhẫn          |

Cosmetic **thật sự thay đổi trải nghiệm hằng ngày**, và gần như miễn phí về kỹ thuật.

---

## 11. Onboarding & tuyến truyện

Phần này trả lời trực tiếp các phát hiện nghiên cứu ở §14.1.

### 11.1 Double Dungeon — lần mở app đầu tiên

80% người dùng bỏ app fitness trong 2 tuần; cửa sổ mới lạ là 3–7 ngày. Lần mở đầu quyết định tất cả.

Jin-Woo không bắt đầu như người được chọn — anh ta là **"Hunter yếu nhất nhân loại"**. Double Dungeon giết gần hết đội, anh ta chết, và được hồi sinh như một **Player**.

Buổi đầu tiên được kể đúng như vậy. Không tutorial, không "chào mừng". Vào với tư cách E-Rank, tay không. App đo: hít đất tối đa, squat tối đa, chạy 1 km. Kiệt sức. Rồi:

```
   [ You have died. ]
   ...
   [ Conditions for becoming a Player
     have been met.  Will you accept? ]
```

Không app fitness nào bắt đầu bằng cách nói với bạn rằng bạn yếu. Đó chính xác là điều làm nó đáng nhớ — và đó là fantasy thật của Solo Leveling: **không phải mạnh sẵn, mà là trở nên mạnh từ con số không.**

Tiện thể thu luôn baseline thật để tính stat ban đầu.

### 11.2 Reason for Hunting

Ngay sau Double Dungeon, The System hỏi đúng một câu; người dùng gõ câu trả lời thật:

```
   [ Why do you seek strength, Hunter? ]
   > ___________________________
```

Lưu vào `hunter.reasonForHunting`. Được trả lại **nguyên văn** vào những lúc chính xác nhất — ngày thứ 11 chưa tập, đêm trong Penalty Zone, lần thứ ba định bỏ:

> `Eleven days ago you wrote:`
> `"{lý do}"`
> `Was that a lie, Hunter?`

Đây là trái tim của truyện (Jin-Woo lên level vì mẹ và em gái, không vì thích mạnh) và đồng thời **vá lỗ hổng lớn nhất về động lực**: SDT chỉ ra động lực bền vững nhất đến từ việc nối hành vi với **giá trị người dùng tự nhận là của mình**. Gold và EXP là động lực ngoại sinh và sẽ mòn. Câu tự gõ ra thì không.

Chi phí: một ô text và một trường DB. Tỉ lệ giá trị/chi phí cao nhất trong toàn bộ spec.

### 11.3 Tuyến truyện Kiến Trúc Sư

Trong truyện, The System **không phải công cụ hỗ trợ**. Nó là chương trình do Kiến Trúc Sư (Kandiaru) tạo ra để tìm **vật chứa** cho sức mạnh của Shadow Monarch Ashborn — và Ashborn đã nói dối Kiến Trúc Sư về mục đích thật. Jin-Woo tưởng mình đang chơi một trò chơi; thật ra anh ta **đang được sát hạch**.

Áp vào app: **một tuyến truyện có kết thúc, ~15 mảnh, mở dần theo cột mốc.**

Từ Lv1, The System nói năng như phần mềm bình thường. Rải rác có những dòng lệch tông — nó biết thứ nó không nên biết, nhắc tới "người trước đó", bảo trì vào lúc kỳ lạ. Trông như bug. Đến khoảng S-Rank:

> `You believed this was about your body.`
> `It was never about your body.`
> `A vessel was required. You have been evaluated.`

**Đây là đòn phản công trực tiếp vào suy tàn mới lạ** — điểm chết số 1 của thể loại này. Level không có kết thúc; câu chuyện thì có, và đó là thứ khiến người dùng quay lại ở tháng thứ tám. _Zombies, Run!_ sống bằng đúng cơ chế này.

Chi phí thấp: SystemVoice đã dựng, đây chỉ là ~15 đoạn text gác sau cột mốc. Lưu ở `narrative_fragment`, logic ở `core/narrative/arc.ts`.

### 11.4 Mốc ngày 7 và ngày 14

Hai vách rơi đã biết. Mỗi mốc phải có một sự kiện được thiết kế riêng:

- **Ngày 7** — Hidden Quest đầu tiên tự kích hoạt, kèm mảnh truyện đầu tiên. Đây là sự kiện **theo ngày**, không theo level, nên luôn đến đúng hẹn.
- **Ngày 14** — mảnh truyện thứ hai, cũng theo ngày.

Ngoài ra, các ngưỡng level ở §11.5 (Chronicle Lv5, Store Lv10) được **hiệu chỉnh hằng số** sao cho người tập đều thường chạm tới quanh ngày 7 và ngày 14 — để hai mốc đó có cả sự kiện truyện lẫn một lần mở khoá.

Đây là chỉnh ngưỡng, **không phải** ép level lên theo lịch: level và rank vẫn là số suy ra từ hoạt động thật (§1.3). Tập không đều thì mở khoá đến muộn, và đó là đúng.

### 11.5 Mở khoá tính năng dần

Nghiên cứu 2025 cho thấy độ giàu tính năng gamification có tác động **hình chữ S**: vượt ngưỡng "vừa đủ" thì lợi ích giảm rồi thành âm.

Giải pháp: **build đủ 9 trang, mở dần theo level.**

| Trang                              | Mở ở                  |
| ---------------------------------- | --------------------- |
| Dashboard, Quests, Dungeon, Status | Từ đầu                |
| Shadow Army                        | Sau ARISE đầu tiên    |
| Chronicle                          | Level 5               |
| Store                              | Level 10              |
| Inventory                          | Level 15              |
| Skills                             | Sau Job Change (Lv40) |

Trang chưa mở hiển thị đúng ngôn ngữ của The System:

```
[This function has not been unlocked yet.]
```

Codebase đầy đủ; tại bất kỳ thời điểm nào người dùng chỉ thấy một tập tính năng vừa đủ; mỗi lần mở khoá là một sự kiện.

### 11.6 Van tự chủ

Nghiên cứu: gamification mang tính **áp đặt** cho thấy liên hệ **yếu hơn** với hoạt động bền vững. The System là giọng ra lệnh — đó là toàn bộ thẩm mỹ của nó.

Giữ thẩm mỹ, nhưng chừa van:

- **Sửa buổi tập hôm nay** (đổi bài, bớt set) mà **không** bị tính là thất bại
- **Tắt Emergency Quest**
- **Đổi chương trình** (khi đã mở khoá)
- **Đổi giọng System**

The System ra lệnh, nhưng người dùng vẫn là người quyết định — như trong truyện, Jin-Woo luôn có quyền từ chối quest.

---

## 12. Các trang

### 12.1 Dashboard — hành động trước, số liệu sau

6 giờ sáng, mắt còn nhắm. Câu hỏi duy nhất: **hôm nay phải làm gì?**

```
◈ SYSTEM                        B-RANK ⬢
"Iron has weakened. Eleven days.
 Today you will not skip legs again."

┌───────────────────────────────────┐
│   LOWER A — B-RANK GATE           │
│   Squat 4×6 · RDL 3×8 · +4        │
│        ▸ ENTER DUNGEON            │
└───────────────────────────────────┘

DAILY QUEST     ▓▓▓▓▓▓░░░░  3/4
Lv 28  ▓▓▓▓▓▓▓░░░ 6,200/8,500
🔥 12 ngày    Fatigue ▓▓▓░░ 41
⚠ Iron · 11 ngày
```

**Một nút chính.** Mọi thứ khác là thông tin liếc qua. Với người lười, mỗi lựa chọn phải đưa ra trước khi bắt đầu là một cái cớ để không bắt đầu.

Code hiện tại đặt stat và EXP lên đầu — đảo lại, stat để dành cho Status.

### 12.2 Status

Radar chart 6 stat (recharts đã có) · bảng e1RM từng bài kèm xu hướng 4 tuần · PR và ngày lập · title đang đeo + kho title · class, fatigue, Army Rank.

**Title** — buff bị động nhỏ, đeo một cái mỗi lúc:

| Title              | Điều kiện                | Buff                     |
| ------------------ | ------------------------ | ------------------------ |
| _Unyielding_       | Streak 30 ngày           | −20% mất EXP khi penalty |
| _Monarch of Dawn_  | 10 buổi trước 7h sáng    | +15% gold buổi sáng      |
| _One Who Returned_ | Thoát Penalty Zone 5 lần | +10% EXP sau khi thoát   |
| _Wolf's Nemesis_   | Clear 20 dungeon A-Rank  | +25% tỉ lệ rơi đồ        |

### 12.3 Chronicle

**Heatmap kiên trì** — 365 ô kiểu contribution graph. Đậm theo volume, đỏ cho ngày Penalty Zone. Đây là hình ảnh đứng đầu trang portfolio.

**Dòng thời gian sự kiện:**

```
2026-08-05   ⚔ ARISE — Iron has answered your call
2026-08-02   ▲ RANK UP — D → C
2026-07-28   ✦ PR — Bench Press 82.5 kg
2026-07-19   ⚠ PENALTY ZONE — Daily Quest failed
```

**Chương hằng tuần** — mỗi chủ nhật SystemVoice viết một đoạn về tuần vừa qua. Sau một năm: 52 chương.

**Biểu đồ:** volume theo tuần · e1RM theo thời gian · phân bổ volume theo nhóm cơ.

### 12.4 Shadow Army

9 ô: icon, tên, grade, thanh EXP, ngày tập cuối. Xám và nứt nếu suy yếu, bóng mờ nếu chưa rút. Bấm vào → biểu đồ volume nhóm cơ đó, PR hiện tại, các bài đang nuôi nó.

**Không có input mới nào** — 100% dẫn xuất từ `set_log`.

### 12.5 Quests · Dungeon · Store · Inventory · Skills

Theo §6, §5.2, §8, §8.9, §9.

---

## 13. Thứ tự build

| Phase | Nội dung                                                                     | Kết quả                   |
| ----- | ---------------------------------------------------------------------------- | ------------------------- |
| **0** | DB, schema, PIN, container, eslint boundaries, CI                            | Nền                       |
| **1** | **Engine** + Double Dungeon onboarding + Reason for Hunting + template voice | **Dùng thật được từ đây** |
| **2** | Daily Quest, cron, Penalty Zone + biến thể, Dungeon Break, streak            | Vòng lặp hoàn chỉnh       |
| **3** | Shadow Army, ARISE, Status đầy đủ, mốc ngày 7/14                             | Phần cảm xúc              |
| **4** | Gemini voice, Chronicle, heatmap, tuyến truyện                               | Phần linh hồn             |
| **5** | Gold, Store, Inventory, drop, wager                                          | Kinh tế                   |
| **6** | Skills, Ability Point, Job Change, Class                                     | Chiều sâu                 |
| **7** | Cosmetic, theme, giọng, deploy, seed                                         | Hoàn thiện                |

### 13.1 Vì sao thứ tự này quan trọng

**Phase 1 xong là bắt đầu log buổi tập thật — ngay lập tức, dù còn 6 phase nữa.**

Đến Phase 4 sẽ làm Chronicle với heatmap 365 ô và biểu đồ e1RM. Nếu tới lúc đó mới bắt đầu tập, heatmap trống trơn và biểu đồ có một điểm.

> **Dữ liệu là thứ duy nhất trong dự án này không thể build sau — nó chỉ có thể được tích luỹ.**

Mọi phase khác chờ được. Cái này thì không. Nếu Phase 1 xong trong 2 tuần, thì lúc Chronicle lên sóng đã có 2–3 tháng lịch sử thật. Chất lượng trang portfolio được quyết định ở tuần thứ hai, không phải tháng thứ tư.

Onboarding (Double Dungeon + Reason for Hunting) nằm ở Phase 1 chứ không phải cuối, vì nó thu baseline stat và câu trả lời mà mọi phase sau sẽ dùng.

### 13.2 Ghi chú về lập kế hoạch

Spec này bao phủ toàn bộ sản phẩm và **quá lớn cho một implementation plan duy nhất**. Mỗi phase nên có kế hoạch riêng.

Kế hoạch đầu tiên nên gộp **Phase 0 + Phase 1** — chúng dính chặt với nhau (schema phải xong mới log được), và điểm kết thúc là mốc quan trọng nhất trong dự án: **ngày đầu tiên log được buổi tập thật**.

Các phase sau lập kế hoạch khi tới, dựa trên những gì học được từ việc dùng thật — đặc biệt là Phase 5 (kinh tế), nơi các hằng số cân bằng cần dữ liệu thật mới chỉnh đúng được.

---

## 14. Rủi ro & điểm chưa chắc chắn

### 14.1 Nghiên cứu người dùng phản bác design

Ba phát hiện chống lại thiết kế này, cùng cách giảm thiểu:

| Phát hiện                                                             | Đe doạ phần nào          | Giảm thiểu                                      |
| --------------------------------------------------------------------- | ------------------------ | ----------------------------------------------- |
| "App dựa vào nỗi sợ mất mát thì động lực sụp đổ khi nỗi sợ hết vui"   | Penalty Zone (§6.3)      | Biến thể + giọng đổi dần (§6.4)                 |
| Độ giàu tính năng có tác động hình chữ S — vượt ngưỡng thì lợi ích âm | Phạm vi 9 trang          | Mở khoá dần theo level (§11.5)                  |
| Gamification áp đặt → hoạt động bền vững yếu hơn                      | Toàn bộ giọng The System | Van tự chủ (§11.6) + Reason for Hunting (§11.2) |

Về phát hiện thứ ba: SDT đo các app **áp gamification lên người dùng không yêu cầu**. Ở đây người dùng tự thiết kế hệ thống cho chính mình — quyền tự chủ ở mức tối đa, và bản thân fandom **là** động lực nội tại. Nhưng van tự chủ vẫn cần có.

### 14.2 Không có tầng xã hội

Người ta có khả năng giữ mục tiêu **cao gấp đôi khi có người khác biết**. App này không có cộng đồng — đó là điểm yếu thật.

Giảm thiểu một phần: web deploy công khai **chính là** tầng giám sát. Người khác xem được hành trình mà không cần xây mạng xã hội.

Không giả vờ có cộng đồng bằng leaderboard giả hay bot. Trong truyện Jin-Woo là **Player duy nhất** — sự cô độc là thẩm mỹ, không phải giới hạn kỹ thuật.

### 14.3 Cân bằng kinh tế chưa kiểm chứng

Xem §8.10. Đây là phần ít chắc chắn nhất trong spec. Toàn bộ hằng số tập trung một file để chỉnh nhanh sau khi có dữ liệu thật.

### 14.4 Rủi ro nguồn dữ liệu tự khai

Mọi số liệu do người dùng tự nhập. Không có cách nào xác minh. Với app một người dùng cho chính mình thì đây không phải lỗ hổng bảo mật — nhưng có nghĩa **stat chỉ trung thực bằng đúng độ trung thực của người nhập**. Design không cố chống gian lận; nó dựa vào việc gian lận với chính mình là vô nghĩa.

### 14.5 Phụ thuộc free tier

Hạn mức Gemini có thể đổi. Giảm thiểu: template engine là lớp nền luôn chạy được (§10.5); circuit breaker; `SystemVoicePort` cho phép đổi provider bằng một adapter.

---

## 15. Ngoài phạm vi

Cân nhắc và **loại**:

| Hạng mục                                               | Lý do                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Auth nhiều người dùng, guild, leaderboard, feed        | 1 người dùng theo thiết kế                                                             |
| Tích hợp Strava / Apple Health                         | OAuth + webhook + rate limit; không quyết định app sống hay chết. Cân nhắc lại sau v1. |
| Mana stone / essence stone                             | Tiền tệ thứ hai = bội thực tính năng                                                   |
| Demon's Castle 100 tầng (bản đầy đủ)                   | Chỉ giữ dạng item mua theo tầng (§8.4)                                                 |
| Tuyến Rulers vs Monarchs                               | Quá xa so với vòng lặp cốt lõi                                                         |
| Item tăng EXP, item thăng grade shadow, item cộng stat | Vi phạm luật §8.1                                                                      |
| AI kê chương trình / mức tạ (Hướng C ở câu hỏi 5)      | Chỗ duy nhất trong app có thể gây chấn thương thật                                     |
| Chống gian lận                                         | Vô nghĩa với app cá nhân                                                               |
| Sync đa thiết bị ngoài DB dùng chung                   | DB server đã giải quyết                                                                |

---

## Phụ lục A — Nguồn tham khảo

**Solo Leveling lore**

- [Penalty Zone — Solo Leveling Wiki](https://solo-leveling.fandom.com/wiki/Penalty_Zone)
- [Quests — Solo Leveling Wiki](https://solo-leveling.fandom.com/wiki/Quests)
- [Job Change Quest — Solo Leveling Wiki](https://solo-leveling.fandom.com/wiki/Job_Change_Quest)
- [System (Solo Leveling) — Heroism Wiki](<https://heroism.fandom.com/wiki/System_(Solo_Leveling)>)
- [Why does the System exist in Solo Leveling? — Sportskeeda](https://www.sportskeeda.com/anime/why-system-exist-solo-leveling-explained)
- [How Weak Is Jin-Woo as an E-Rank Hunter? — GameRant](https://gamerant.com/solo-leveling-how-weak-is-jin-woo-e-rank-hunter/)
- [Solo Leveling Stat System Guide](https://sololeveling.wiki/power-system-and-abilities/solo-leveling-stat-system)

**Khoa học huấn luyện**

- [Concurrent Training and the Interference Effect — Barbell Medicine](https://www.barbellmedicine.com/blog/concurrent-training-and-the-interference-effect/)
- [Training Frequency for Hypertrophy — Weightology](https://weightology.net/the-members-area/evidence-based-guides/training-frequency-for-hypertrophy-the-evidence-based-bible/)
- [PPL vs Upper Lower: Data Analysis — Arvo](https://arvo.guru/blog/ppl-vs-upper-lower-data)
- [Hybrid Training Guide — Tailored Coaching Method](https://tailoredcoachingmethod.com/hybrid-athlete-training-guide/)

**Gamification & giữ chân người dùng**

- [Is more always better? An S-shaped impact of gamification feature richness on exercise adherence — Frontiers in Psychology, 2025](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1671543/full)
- [Advancing Gamification Research with Self-Determination Theory — TechTrends](https://link.springer.com/article/10.1007/s11528-024-00968-9)
- [Gamification 101: Why Your Fitness App Is Losing Users — Mindster](https://mindster.com/mindster-blogs/fitness-app-user-retention/)
- [Why Fitness Apps Lose Users — Imaginovation](https://imaginovation.net/blog/why-fitness-apps-lose-users-ai-ar-gamification-fix/)

**Free LLM tier**

- [Gemini API Free Tier Rate Limits 2026](https://aipromptshub.co/blog/gemini-api-free-tier-rate-limits)
- [Free LLM APIs in 2026: 13 Providers Compared](https://klymentiev.com/blog/free-llm-api)
