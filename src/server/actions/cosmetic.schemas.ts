import { z } from "zod";

/**
 * Unlike the id-shaped schemas in cosmetic.actions.ts, this one enumerates
 * the tones. The union is closed by design — there is no fifth voice and no
 * user-authored one, because free text reaching a system prompt is an open
 * injection path — so there is no growing catalog here to keep in step.
 * null is the Cold voice and is always accepted.
 *
 * Lives outside cosmetic.actions.ts (which starts with "use server") because
 * a "use server" file may only export async functions — exporting this
 * schema object from there fails the production build. Exported so a test
 * can bind this enum to VOICE_TONE_CATALOG and catch the two ever drifting
 * apart.
 */
export const equipVoiceToneSchema = z.object({
  toneId: z.enum(["mocking", "ancient", "merciless"]).nullable(),
});
