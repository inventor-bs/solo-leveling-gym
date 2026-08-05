import type { ClockPort } from "@/ports/clock.port";
import type { RngPort } from "@/ports/rng.port";
import { systemClock } from "@/infra/clock/system-clock";
import { seededRng } from "@/infra/rng/seeded-rng";
import { getDb, type Db } from "@/infra/db/client";
import { HunterRepo } from "@/infra/db/repositories/hunter.repo";
import { IdempotencyRepo } from "@/infra/db/repositories/idempotency.repo";
import { getEnv } from "@/infra/config/env";

export type Container = {
  db: Db;
  clock: ClockPort;
  rng: RngPort;
  hunters: HunterRepo;
  idempotency: IdempotencyRepo;
  tzOffsetMinutes: number;
};

type ContainerSeed = {
  db?: Db;
  clock?: ClockPort;
  rng?: RngPort;
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
    hunters: new HunterRepo(db),
    idempotency: new IdempotencyRepo(db),
    tzOffsetMinutes: seed.tzOffsetMinutes ?? getEnv().HUNTER_TZ_OFFSET_MINUTES,
  };
}

let cached: Container | null = null;

/** Production container. Lazily initialized, same pattern as getEnv()/getDb(). */
export function getContainer(): Container {
  if (cached === null) {
    cached = buildContainer();
  }
  return cached;
}
