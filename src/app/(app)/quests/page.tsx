import { redirectOwnerIfPenalised } from "@/server/penalty-guard";
import { getContainer } from "@/server/container";
import { getQuestView } from "@/app-services/quest-view";
import { getHiddenQuestView } from "@/app-services/hidden-quest-view";
import { getSystemMessage } from "@/app-services/system-voice-view";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";
import { LockedFeature } from "@/ui/components/primitives/LockedFeature";
import { QuestTracker } from "@/ui/components/quests/QuestTracker";
import { HiddenQuestCard } from "@/ui/components/quests/HiddenQuestCard";

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
