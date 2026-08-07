import type { ShadowViewEntry } from "@/app-services/shadow-view";

export function ShadowCard({ shadow }: { shadow: ShadowViewEntry }) {
  if (!shadow.extracted) {
    return (
      <div className="rounded-lg border border-slate-800 bg-shadow-dark p-4 text-center opacity-40">
        <div className="text-2xl mb-1">?</div>
        <p className="font-mono text-xs text-slate-500">{shadow.name}</p>
        <p className="font-mono text-xs text-slate-600">Not yet extracted</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-4 text-center ${
        shadow.weakened
          ? "border-danger/40 bg-danger/5 grayscale"
          : "border-system-blue/30 bg-shadow-dark"
      }`}
    >
      <div className="text-2xl mb-1">◈</div>
      <p className="font-cinzel text-sm text-white font-bold">{shadow.name}</p>
      {shadow.grade !== null && (
        <p className="font-mono text-xs text-system-blue/70">{shadow.grade}</p>
      )}
      {shadow.weakened && (
        <p className="font-mono text-xs text-danger mt-1">
          {shadow.daysSinceTrained} days without training
        </p>
      )}
    </div>
  );
}
