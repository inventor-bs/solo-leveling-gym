import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { hunter, HUNTER_ID, type HunterRow } from "../schema/hunter";

export type CreateHunterInput = {
  name: string;
  createdAt: number;
  tzOffsetMinutes?: number;
};

export type HunterPatch = Partial<Omit<HunterRow, "id" | "createdAt">>;

export class HunterRepo {
  constructor(private readonly db: Db) {}

  async get(): Promise<HunterRow | null> {
    const rows = await this.db
      .select()
      .from(hunter)
      .where(eq(hunter.id, HUNTER_ID))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: CreateHunterInput): Promise<HunterRow> {
    await this.db.insert(hunter).values({
      id: HUNTER_ID,
      name: input.name,
      createdAt: input.createdAt,
      tzOffsetMinutes: input.tzOffsetMinutes ?? 420,
    });
    const created = await this.get();
    if (!created) {
      throw new Error("HunterRepo.create: không đọc lại được sau khi ghi");
    }
    return created;
  }

  async update(patch: HunterPatch): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.db.update(hunter).set(patch).where(eq(hunter.id, HUNTER_ID));
  }
}
