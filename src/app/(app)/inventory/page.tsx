import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import { getContainer } from "@/server/container";
import { getInventoryView } from "@/app-services/inventory-view";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";

export default async function InventoryPage() {
  await redirectOwnerIfPenalised();
  const slots = await getInventoryView(getContainer());

  return (
    <div className="relative min-h-screen p-6 md:p-8">
      <div className="relative z-10 max-w-2xl mx-auto space-y-6">
        <div>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">
            ◈ SYSTEM — INVENTORY
          </p>
          <h1 className="font-cinzel text-3xl font-black text-white tracking-wide">
            Equipment
          </h1>
          <p className="font-mono text-xs text-slate-500 mt-1">
            Nothing here is for sale. Every piece drops from a cleared dungeon.
          </p>
        </div>

        {slots.map((slot) => (
          <SystemPanel key={slot.slot} header={slot.slot.toUpperCase()}>
            <div className="p-4 space-y-1">
              <div className="flex justify-between font-mono text-sm">
                <span
                  className={
                    slot.grade === null ? "text-slate-500" : "text-white"
                  }
                >
                  {slot.name}
                </span>
                <span className="text-monarch-light">
                  {slot.grade === null
                    ? "— empty —"
                    : `${slot.grade} · +${slot.bonusPercent}%`}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-500">{slot.effect}</p>
              {slot.droppedDay && (
                <p className="font-mono text-xs text-system-blue/50">
                  Dropped {slot.droppedDay}
                </p>
              )}
            </div>
          </SystemPanel>
        ))}
      </div>
    </div>
  );
}
