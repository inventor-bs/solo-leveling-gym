import { SystemPanel } from "./SystemPanel";

export function LockedFeature({
  title,
  unlocksAt,
}: {
  title: string;
  unlocksAt: string;
}) {
  return (
    <div className="relative min-h-screen p-6 md:p-8 flex items-center justify-center">
      <SystemPanel header="SYSTEM" className="max-w-md">
        <div className="p-8 text-center space-y-3">
          <p className="font-cinzel text-xl text-white">{title}</p>
          <p className="font-mono text-sm text-system-blue/60">
            [This function has not been unlocked yet.]
          </p>
          <p className="font-mono text-xs text-slate-500">{unlocksAt}</p>
        </div>
      </SystemPanel>
    </div>
  );
}
