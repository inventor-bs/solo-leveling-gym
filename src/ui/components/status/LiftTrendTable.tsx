import type { LiftTrendEntry } from "@/app-services/lift-trends";

function delta(entry: LiftTrendEntry) {
  if (entry.deltaKg === null) return <span className="text-slate-600">—</span>;
  if (entry.deltaKg > 0) {
    return <span className="text-success">▲ {entry.deltaKg}</span>;
  }
  if (entry.deltaKg < 0) {
    return <span className="text-danger">▼ {Math.abs(entry.deltaKg)}</span>;
  }
  return <span className="text-slate-400">= 0</span>;
}

export function LiftTrendTable({ lifts }: { lifts: LiftTrendEntry[] }) {
  if (lifts.length === 0) {
    return (
      <p className="p-4 font-mono text-sm text-slate-400">
        No lifts recorded yet. Clear a dungeon and this fills itself in.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs">
        <thead>
          <tr className="text-system-blue/60 text-left">
            <th className="px-4 py-2 font-normal">Lift</th>
            <th className="px-4 py-2 font-normal">e1RM</th>
            <th className="px-4 py-2 font-normal">4-week</th>
            <th className="px-4 py-2 font-normal">PR</th>
            <th className="px-4 py-2 font-normal">Set on</th>
          </tr>
        </thead>
        <tbody>
          {lifts.map((lift) => (
            <tr key={lift.exerciseId} className="border-t border-slate-800">
              <td className="px-4 py-2 text-slate-300">{lift.name}</td>
              <td className="px-4 py-2 text-white">
                {lift.currentE1rm === null ? "—" : `${lift.currentE1rm} kg`}
              </td>
              <td className="px-4 py-2">{delta(lift)}</td>
              <td className="px-4 py-2 text-gold">{lift.bestE1rm} kg</td>
              <td className="px-4 py-2 text-slate-500">
                {lift.bestDay ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
