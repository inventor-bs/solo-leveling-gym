import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import {
  systemMessage,
  systemMessageId,
  type SystemMessageRow,
} from "../schema/voice";
import type { VoiceSeverity } from "@/core/system-voice/types";

export type InsertSystemMessageInput = {
  day: string;
  kind: string;
  body: string;
  severity: VoiceSeverity;
  source: string;
  createdAt: number;
};

export class SystemMessageRepo {
  constructor(private readonly db: Db) {}

  async byDayAndKind(
    day: string,
    kind: string,
  ): Promise<SystemMessageRow | null> {
    const rows = await this.db
      .select()
      .from(systemMessage)
      .where(and(eq(systemMessage.day, day), eq(systemMessage.kind, kind)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Fills a slot, or leaves an already-filled one alone. The reset can be
   * retried; the day's briefing must not change under a reader who has
   * already seen it.
   */
  async insert(input: InsertSystemMessageInput): Promise<void> {
    await this.db
      .insert(systemMessage)
      .values({ id: systemMessageId(input.day, input.kind), ...input })
      .onConflictDoNothing({ target: systemMessage.id });
  }

  /** Newest first — what the voice has recently said, so it stops repeating. */
  async recentBodies(limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ body: systemMessage.body })
      .from(systemMessage)
      .orderBy(desc(systemMessage.createdAt))
      .limit(limit);
    return rows.map((r) => r.body);
  }
}
