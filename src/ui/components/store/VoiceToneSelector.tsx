"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { equipVoiceToneAction } from "@/server/actions/cosmetic.actions";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

/**
 * Four buttons, three ids: the COLD button sends null, because Cold is the
 * absence of a chosen tone rather than a tone with a name.
 *
 * The action is imported and called, not received as a prop, so nothing
 * crosses the server/client boundary that cannot be serialized.
 */
export function VoiceToneSelector({
  options,
  activeToneId,
}: {
  options: { id: string | null; name: string }[];
  activeToneId: string | null;
}) {
  const [active, setActive] = useState<string | null>(activeToneId);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function equip(toneId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await equipVoiceToneAction({ toneId });
      if (result.ok) {
        setActive(result.value.voiceTone);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id ?? "cold"}
            onClick={() => equip(option.id)}
            disabled={pending}
            className={`font-mono text-xs tracking-widest border rounded px-3 py-1 disabled:opacity-40 ${
              active === option.id
                ? "border-gold/50 text-gold"
                : "border-system-blue/40 text-system-blue hover:bg-system-blue/10"
            }`}
          >
            {option.name.toUpperCase()}
          </button>
        ))}
      </div>
      {/* Said out loud rather than discovered: the day's briefing was
          written at the reset and is deliberately never rewritten. */}
      <p className="font-mono text-xs text-slate-600">
        New tone applies to template messages now, and to the System&apos;s
        daily briefing from the next reset.
      </p>
      {error && <ActionErrorNotice error={error} />}
    </div>
  );
}
