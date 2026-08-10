import { randomUUID } from "node:crypto";
import type { ClockPort } from "@/ports/clock.port";
import type { RngPort } from "@/ports/rng.port";
import { systemClock } from "@/infra/clock/system-clock";
import { seededRng } from "@/infra/rng/seeded-rng";
import { getDb, type Db } from "@/infra/db/client";
import { HunterRepo } from "@/infra/db/repositories/hunter.repo";
import { IdempotencyRepo } from "@/infra/db/repositories/idempotency.repo";
import { ExerciseRepo } from "@/infra/db/repositories/exercise.repo";
import { ProgramRepo } from "@/infra/db/repositories/program.repo";
import { TrainingRepo } from "@/infra/db/repositories/training.repo";
import { QuestRepo } from "@/infra/db/repositories/quest.repo";
import { PenaltyRepo } from "@/infra/db/repositories/penalty.repo";
import { ShadowRepo } from "@/infra/db/repositories/shadow.repo";
import { TitleRepo } from "@/infra/db/repositories/title.repo";
import { EventLogRepo } from "@/infra/db/repositories/event-log.repo";
import { StoreRepo } from "@/infra/db/repositories/store.repo";
import { EquipmentRepo } from "@/infra/db/repositories/equipment.repo";
import { WagerRepo } from "@/infra/db/repositories/wager.repo";
import { MitigationRepo } from "@/infra/db/repositories/mitigation.repo";
import { SkillRepo } from "@/infra/db/repositories/skill.repo";
import { NarrativeRepo } from "@/infra/db/repositories/narrative.repo";
import { HiddenQuestRepo } from "@/infra/db/repositories/hidden-quest.repo";
import { SystemMessageRepo } from "@/infra/db/repositories/system-message.repo";
import { VoiceQuotaRepo } from "@/infra/db/repositories/voice-quota.repo";
import { getEnv } from "@/infra/config/env";
import type { SystemVoicePort } from "@/ports/system-voice.port";
import { createGeminiVoice } from "@/infra/system-voice/gemini-voice";

export type Container = {
  db: Db;
  clock: ClockPort;
  rng: RngPort;
  newId: () => string;
  hunters: HunterRepo;
  idempotency: IdempotencyRepo;
  exercises: ExerciseRepo;
  programs: ProgramRepo;
  training: TrainingRepo;
  quests: QuestRepo;
  penalties: PenaltyRepo;
  shadows: ShadowRepo;
  titles: TitleRepo;
  events: EventLogRepo;
  store: StoreRepo;
  equipment: EquipmentRepo;
  wagers: WagerRepo;
  mitigation: MitigationRepo;
  skills: SkillRepo;
  narrative: NarrativeRepo;
  hiddenQuests: HiddenQuestRepo;
  systemMessages: SystemMessageRepo;
  voiceQuota: VoiceQuotaRepo;
  /** Null whenever no provider is configured — the supported default. */
  voice: SystemVoicePort | null;
  tzOffsetMinutes: number;
};

type ContainerSeed = {
  db?: Db;
  clock?: ClockPort;
  rng?: RngPort;
  newId?: () => string;
  voice?: SystemVoicePort | null;
  tzOffsetMinutes?: number;
};

/**
 * The ONLY place dependencies are wired together. No DI framework —
 * a single-user app doesn't need one.
 *
 * Tests pass in db/clock/rng/tzOffsetMinutes so they never touch env.
 * Production calls this with no arguments and pulls everything from env.
 */
export function buildContainer(seed: ContainerSeed = {}): Container {
  const db = seed.db ?? getDb();
  return {
    db,
    clock: seed.clock ?? systemClock,
    rng: seed.rng ?? seededRng(Date.now() >>> 0),
    newId: seed.newId ?? (() => randomUUID()),
    hunters: new HunterRepo(db),
    idempotency: new IdempotencyRepo(db),
    exercises: new ExerciseRepo(db),
    programs: new ProgramRepo(db),
    training: new TrainingRepo(db),
    quests: new QuestRepo(db),
    penalties: new PenaltyRepo(db),
    shadows: new ShadowRepo(db),
    titles: new TitleRepo(db),
    events: new EventLogRepo(db),
    store: new StoreRepo(db),
    equipment: new EquipmentRepo(db),
    wagers: new WagerRepo(db),
    mitigation: new MitigationRepo(db),
    skills: new SkillRepo(db),
    narrative: new NarrativeRepo(db),
    hiddenQuests: new HiddenQuestRepo(db),
    systemMessages: new SystemMessageRepo(db),
    voiceQuota: new VoiceQuotaRepo(db),
    // Defaults to null rather than reading env, so a test that passes no
    // seed lands on the no-provider path — the one that must never break.
    voice: seed.voice ?? null,
    tzOffsetMinutes: seed.tzOffsetMinutes ?? getEnv().HUNTER_TZ_OFFSET_MINUTES,
  };
}

let cached: Container | null = null;

/** Production container. Lazily initialized, same pattern as getEnv()/getDb(). */
export function getContainer(): Container {
  if (cached === null) {
    cached = buildContainer({
      voice: createGeminiVoice(getEnv().GEMINI_API_KEY),
    });
  }
  return cached;
}
