import { describe, it, expect, vi, afterEach } from "vitest";
import { createGeminiVoice } from "./gemini-voice";
import { VoiceGenerationError } from "@/ports/system-voice.port";

const request = {
  kind: "briefing" as const,
  systemPrompt: "rules",
  userPrompt: "facts",
};

function respondWith(text: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text }] } }],
      }),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createGeminiVoice", () => {
  it("REGRESSION: returns null when no API key is configured", () => {
    expect(createGeminiVoice(undefined)).toBeNull();
    expect(createGeminiVoice("")).toBeNull();
  });

  it("returns a port when a key is configured", () => {
    expect(createGeminiVoice("key")).not.toBeNull();
  });

  it("parses a well-formed response into a draft", async () => {
    respondWith('{"body":"Hunter. Continue.","severity":"info","title":null}');
    const voice = createGeminiVoice("key")!;
    expect(await voice.generate(request)).toEqual({
      body: "Hunter. Continue.",
      severity: "info",
      title: null,
    });
  });

  it("defaults a missing title to null rather than failing", async () => {
    respondWith('{"body":"Hunter. Continue.","severity":"warning"}');
    const voice = createGeminiVoice("key")!;
    expect((await voice.generate(request)).title).toBeNull();
  });

  it("rejects a response whose JSON does not match the contract", async () => {
    respondWith('{"body":"Hunter.","severity":"urgent"}');
    const voice = createGeminiVoice("key")!;
    await expect(voice.generate(request)).rejects.toBeInstanceOf(
      VoiceGenerationError,
    );
  });

  it("rejects a response that is not JSON at all", async () => {
    respondWith("Hunter. Continue.");
    const voice = createGeminiVoice("key")!;
    await expect(voice.generate(request)).rejects.toBeInstanceOf(
      VoiceGenerationError,
    );
  });

  it("rejects a non-2xx status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })),
    );
    const voice = createGeminiVoice("key")!;
    await expect(voice.generate(request)).rejects.toBeInstanceOf(
      VoiceGenerationError,
    );
  });

  it("REGRESSION: turns a transport failure into a VoiceGenerationError, never a raw throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const voice = createGeminiVoice("key")!;
    await expect(voice.generate(request)).rejects.toBeInstanceOf(
      VoiceGenerationError,
    );
  });

  it("REGRESSION: never puts the API key in the error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })),
    );
    const voice = createGeminiVoice("super-secret-key")!;
    await expect(voice.generate(request)).rejects.toThrow(
      expect.not.stringContaining("super-secret-key") as never,
    );
  });

  it("REGRESSION: sends the API key via the x-goog-api-key header, never in the URL", async () => {
    respondWith('{"body":"Hunter. Continue.","severity":"info","title":null}');
    const voice = createGeminiVoice("my-test-key")!;
    await voice.generate(request);

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).not.toContain("my-test-key");
    expect(String(url)).not.toContain("key=");
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("my-test-key");
  });
});
