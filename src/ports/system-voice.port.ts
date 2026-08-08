import type {
  VoiceMessageKind,
  VoiceSeverity,
} from "@/core/system-voice/types";

/** Everything an adapter needs in order to produce one message. */
export type VoiceRequest = {
  readonly kind: VoiceMessageKind;
  /** The voice rules and the required output format. */
  readonly systemPrompt: string;
  /** The facts, and the single instruction for this message. */
  readonly userPrompt: string;
};

/**
 * What an adapter returns after parsing its provider's response.
 *
 * Still UNTRUSTED. The adapter has proven the shape is right; nothing has
 * yet proven the content obeys the voice rules or that its numbers are
 * real. That is the moderation gate's job.
 */
export type VoiceDraft = {
  readonly body: string;
  readonly severity: VoiceSeverity;
  readonly title: string | null;
};

/** Every adapter failure — network, timeout, HTTP status, bad shape. */
export class VoiceGenerationError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "VoiceGenerationError";
  }
}

/**
 * One method, one provider. Swapping providers is a new file behind this
 * interface and one line in the container — no caller changes, because no
 * caller knows which provider it is talking to.
 *
 * Implementations must reject rather than hang: the caller runs inside the
 * daily reset, and a request with no ceiling would hold the cron open.
 */
export interface SystemVoicePort {
  generate(request: VoiceRequest): Promise<VoiceDraft>;
}
