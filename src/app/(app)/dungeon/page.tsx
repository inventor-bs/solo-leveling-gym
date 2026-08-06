import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import DungeonClient from "@/ui/components/dungeon/DungeonClient";

export default async function DungeonPage() {
  await redirectOwnerIfPenalised();
  return <DungeonClient />;
}
