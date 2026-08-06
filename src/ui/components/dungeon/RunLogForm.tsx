"use client";

import { useState, useTransition } from "react";
import { logRunAction } from "@/server/actions/training.actions";

export function RunLogForm({ day }: { day: string }) {
  const [km, setKm] = useState("");
  const [minutes, setMinutes] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const distanceKm = Number(km);
    const durationSec = Number(minutes) * 60;
    if (!(distanceKm > 0) || !(durationSec > 0)) return;
    startTransition(async () => {
      await logRunAction({ day, distanceKm, durationSec });
      setDone(true);
    });
  }

  if (done) {
    return (
      <p className="font-mono text-sm text-success">
        ✓ Run logged. {km} km in {minutes} min.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3 font-mono text-sm">
      <input
        type="number"
        placeholder="km"
        value={km}
        onChange={(e) => setKm(e.target.value)}
        className="w-20 bg-shadow-dark border border-system-blue/30 rounded px-2 py-1 text-white"
      />
      <input
        type="number"
        placeholder="min"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        className="w-20 bg-shadow-dark border border-system-blue/30 rounded px-2 py-1 text-white"
      />
      <button
        onClick={submit}
        disabled={pending}
        className="flex-1 bg-system-blue/10 border border-system-blue/40 text-system-blue rounded py-1 hover:bg-system-blue/20 disabled:opacity-40"
      >
        {pending ? "LOGGING..." : "LOG RUN"}
      </button>
    </div>
  );
}
