export function PenaltyBanner({ setting }: { setting: string }) {
  return (
    <div className="border-b border-danger/40 bg-danger/10 px-4 py-2 text-center">
      <p className="font-mono text-xs text-danger">
        ◈ This Hunter is currently in the Penalty Zone — {setting}.
      </p>
    </div>
  );
}
