import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import { getContainer } from "@/server/container";
import {
  DUNGEON_TYPE_UNLOCK_IDS,
  dungeonTypeUnlockKey,
} from "@/core/economy/unlocks";
import DungeonClient from "@/ui/components/dungeon/DungeonClient";

export default async function DungeonPage({
  searchParams,
}: {
  searchParams: Promise<{ programDayId?: string }>;
}) {
  await redirectOwnerIfPenalised();
  const { programDayId } = await searchParams;
  const container = getContainer();

  // Read server-side, the same way the dashboard already reads a program
  // day's exercises to render today's gate — so the picker below can list
  // exercises before a session (and its plan) exists at all.
  const program = programDayId
    ? await container.programs.byId(programDayId)
    : null;
  const exercises =
    program?.exercises.map(({ exercise }) => ({
      exerciseId: exercise.id,
      name: exercise.name,
      muscle: exercise.muscle,
    })) ?? [];

  const unlockedKeys = new Set(await container.store.unlockedKeys());
  const unlockedDungeonTypes = DUNGEON_TYPE_UNLOCK_IDS.filter((id) =>
    unlockedKeys.has(dungeonTypeUnlockKey(id)),
  );

  return (
    <DungeonClient
      exercises={exercises}
      unlockedDungeonTypes={unlockedDungeonTypes}
    />
  );
}
