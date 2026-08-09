"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

/**
 * One purchase button. The caller supplies the action so this component
 * knows nothing about what is being bought — and every failure renders as
 * the action's own message rather than disappearing into a thrown error.
 */
export function BuyButton({
  label,
  disabled,
  onBuy,
}: {
  label: string;
  disabled: boolean;
  onBuy: () => Promise<{ ok: true } | { ok: false; error: ActionError }>;
}) {
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2">
      {error && <ActionErrorNotice error={error} />}
      <button
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await onBuy();
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
        className="w-full bg-gold/10 border border-gold/40 text-gold font-mono text-xs
          tracking-widest py-2 rounded hover:bg-gold/20 disabled:opacity-30 transition-colors"
      >
        {pending ? "..." : label}
      </button>
    </div>
  );
}
