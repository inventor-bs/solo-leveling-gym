import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import { getContainer } from "@/server/container";
import { getQuestView } from "@/app-services/quest-view";
import { getHiddenQuestView } from "@/app-services/hidden-quest-view";
import { getSystemMessage } from "@/app-services/system-voice-view";
import { addDays, parseTrainingDay } from "@/core/shared/training-day";
import { getStoreView } from "@/app-services/store-view";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { LockedFeature } from "@/ui/components/primitives/LockedFeature";
import { QuestTracker } from "@/ui/components/quests/QuestTracker";
import { HiddenQuestCard } from "@/ui/components/quests/HiddenQuestCard";
import { WagerForm } from "@/ui/components/store/WagerForm";

export default async function QuestsPage() {
  await redirectOwnerIfPenalised();
  const container = getContainer();
  const view = await getQuestView(container);
  const hiddenQuests = await getHiddenQuestView(container);
  const message = await getSystemMessage(container, "quest");
  if (!view.ok) {
    return (
      <LockedFeature
        title="QUEST LOG"
        unlocksAt="No Hunter has been registered yet."
      />
    );
  }

  const q = view.value;

  const store = await getStoreView(container);

  // An Hourglass bought yesterday moves that day's judgment to 04:00 today,
  // and those extra hours are only usable if yesterday's quest is still
  // reachable. Without this panel the item would be unspendable in practice.
  const yesterday = addDays(parseTrainingDay(view.value.day), -1);
  const graceRow = await container.mitigation.graceForDay(yesterday);
  const yesterdayQuest = graceRow
    ? await container.quests.byDay(yesterday)
    : null;
  const graceWindowOpen =
    yesterdayQuest !== null && yesterdayQuest.status === "active";
  const yesterdayRunDone = graceWindowOpen
    ? await container.training.kmOnDay(yesterday)
    : 0;

  return (
    <div className="relative min-h-screen p-6 md:p-8">
      <div className="relative z-10 max-w-2xl mx-auto space-y-6">
        <div>
          <p className="font-mono text-xs text-system-blue/60 tracking-widest mb-1">
            ◈ SYSTEM — DAILY QUEST
          </p>
          <h1 className="font-cinzel text-3xl font-black text-white tracking-wide">
            {q.complete ? "Quest Cleared" : "Daily Quest"}
          </h1>
          <p className="font-mono text-xs text-slate-500 mt-1">
            {q.day} · {q.rank}-rank load · {q.percent}% complete
          </p>
        </div>

        <SystemPanel glowColor={q.complete ? "purple" : "blue"}>
          <p className="p-4 font-mono text-sm text-slate-300 leading-relaxed">
            {message === null || message.body === "" ? "[ ... ]" : message.body}
          </p>
        </SystemPanel>

        <SystemPanel header="REQUIREMENTS">
          <div className="p-4">
            <QuestTracker
              day={q.day}
              runDone={q.progress.runKm}
              runTarget={q.targets.runKm}
              requirements={[
                {
                  key: "pushups",
                  label: "Push-ups",
                  done: q.progress.pushups,
                  target: q.targets.pushups,
                },
                {
                  key: "situps",
                  label: "Sit-ups",
                  done: q.progress.situps,
                  target: q.targets.situps,
                },
                {
                  key: "squats",
                  label: "Squats",
                  done: q.progress.squats,
                  target: q.targets.squats,
                },
              ]}
            />
          </div>
        </SystemPanel>

        <SystemPanel header="STREAK">
          <p className="p-4 font-mono text-sm text-warning">
            {q.streak === 0
              ? "No active streak."
              : `${q.streak} consecutive day${q.streak === 1 ? "" : "s"}.`}
          </p>
        </SystemPanel>

        {graceWindowOpen && yesterdayQuest && (
          <SystemPanel header="GRACE WINDOW" glowColor="gold">
            <div className="p-4 space-y-3">
              <p className="font-mono text-xs text-warning">
                Yesterday ({yesterday}) is judged at 04:00 instead of midnight.
                Finish it and it counts.
              </p>
              <QuestTracker
                day={yesterday}
                runDone={yesterdayRunDone}
                runTarget={yesterdayQuest.targetRunKm}
                requirements={[
                  {
                    key: "pushups",
                    label: "Push-ups",
                    done: yesterdayQuest.progressPushups,
                    target: yesterdayQuest.targetPushups,
                  },
                  {
                    key: "situps",
                    label: "Sit-ups",
                    done: yesterdayQuest.progressSitups,
                    target: yesterdayQuest.targetSitups,
                  },
                  {
                    key: "squats",
                    label: "Squats",
                    done: yesterdayQuest.progressSquats,
                    target: yesterdayQuest.targetSquats,
                  },
                ]}
              />
            </div>
          </SystemPanel>
        )}

        {store &&
          (store.wager.available || store.wager.placedStake !== null) && (
            <SystemPanel header="WEEKLY WAGER">
              <div className="p-4">
                {store.wager.placedStake !== null ? (
                  <p className="font-mono text-sm text-gold">
                    {store.wager.placedStake} G staked on this week. Judged next
                    Monday.
                  </p>
                ) : (
                  <WagerForm maxStake={store.wager.maxStake} />
                )}
              </div>
            </SystemPanel>
          )}

        {hiddenQuests.map((h) => (
          <HiddenQuestCard
            key={h.id}
            name={h.name}
            revealLine={h.revealLine}
            goldAwarded={h.goldAwarded}
            revealedDay={h.revealedDay}
          />
        ))}
      </div>
    </div>
  );
}
