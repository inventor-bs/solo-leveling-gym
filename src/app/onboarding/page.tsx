"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboardingAction } from "@/server/actions/onboarding.actions";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";

type Step = "death" | "baseline" | "reason";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("death");
  const [name, setName] = useState("");
  const [pushups, setPushups] = useState("");
  const [squats, setSquats] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboardingAction({
        name: name.trim() || "Hunter",
        reasonForHunting: reason.trim(),
      });
      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <SystemPanel header="SYSTEM — DOUBLE DUNGEON" className="w-full max-w-lg">
        <div className="p-8 space-y-6">
          {step === "death" && (
            <div className="space-y-4 text-center">
              <p className="font-mono text-sm text-slate-400">
                [ You have died. ]
              </p>
              <p className="font-mono text-sm text-system-blue">
                [ Conditions for becoming a Player have been met. ]
              </p>
              <button
                onClick={() => setStep("baseline")}
                className="mt-4 bg-system-blue/10 border border-system-blue/40 text-system-blue
                  font-mono text-sm tracking-widest px-6 py-2 rounded hover:bg-system-blue/20"
              >
                ACCEPT
              </button>
            </div>
          )}

          {step === "baseline" && (
            <div className="space-y-4">
              <p className="font-mono text-xs text-system-blue/60 tracking-widest">
                ◈ BASELINE MEASUREMENT
              </p>
              <label className="block">
                <span className="font-mono text-xs text-slate-400">
                  Hunter name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full bg-shadow-dark border border-system-blue/30 rounded px-3 py-2 font-mono text-white"
                />
              </label>
              <label className="block">
                <span className="font-mono text-xs text-slate-400">
                  Max push-ups, one set
                </span>
                <input
                  type="number"
                  value={pushups}
                  onChange={(e) => setPushups(e.target.value)}
                  className="mt-1 w-full bg-shadow-dark border border-system-blue/30 rounded px-3 py-2 font-mono text-white"
                />
              </label>
              <label className="block">
                <span className="font-mono text-xs text-slate-400">
                  Max bodyweight squats, one set
                </span>
                <input
                  type="number"
                  value={squats}
                  onChange={(e) => setSquats(e.target.value)}
                  className="mt-1 w-full bg-shadow-dark border border-system-blue/30 rounded px-3 py-2 font-mono text-white"
                />
              </label>
              <button
                onClick={() => setStep("reason")}
                disabled={name.trim().length === 0}
                className="w-full bg-system-blue/10 border border-system-blue/40 text-system-blue
                  font-mono text-sm tracking-widest py-2 rounded hover:bg-system-blue/20 disabled:opacity-40"
              >
                CONTINUE
              </button>
            </div>
          )}

          {step === "reason" && (
            <div className="space-y-4">
              <p className="font-mono text-sm text-system-blue">
                [ Why do you seek strength, Hunter? ]
              </p>
              <label className="block">
                <span className="sr-only">Reason for hunting</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full bg-shadow-dark border border-system-blue/30 rounded px-3 py-2 font-mono text-white"
                  autoFocus
                />
              </label>
              {error && (
                <p className="font-mono text-xs text-danger">
                  {error === "already-onboarded"
                    ? "A Hunter has already been chosen."
                    : "Something went wrong."}
                </p>
              )}
              <button
                onClick={submit}
                disabled={pending || reason.trim().length === 0}
                className="w-full bg-system-blue/10 border border-system-blue/40 text-system-blue
                  font-mono text-sm tracking-widest py-2 rounded hover:bg-system-blue/20 disabled:opacity-40"
              >
                {pending ? "ARISING..." : "ARISE"}
              </button>
            </div>
          )}
        </div>
      </SystemPanel>
    </div>
  );
}
