import { LockedFeature } from "@/ui/components/primitives/LockedFeature";

export default function InventoryPage() {
  return (
    <LockedFeature
      title="INVENTORY"
      unlocksAt="Unlocks once items can drop — Phase 5."
    />
  );
}
