import clsx from "clsx";

/**
 * The three frames follow the game's own colour ladder: System blue,
 * Monarch violet, then gold on black.
 */
const FRAME_STYLE: Record<string, string> = {
  system:
    "border-system-blue/60 text-system-blue shadow-[0_0_10px_rgba(0,212,255,0.35)]",
  monarch:
    "border-monarch-purple/60 text-monarch-light shadow-[0_0_10px_rgba(123,47,190,0.4)]",
  sovereign:
    "border-gold/60 bg-shadow-dark text-gold shadow-[0_0_12px_rgba(255,215,0,0.35)]",
};

/**
 * The single place a worn title is rendered.
 *
 * The frame decorates the TITLE, not a page, so a future HUD that shows the
 * worn title picks the frame up simply by rendering this. With no title
 * worn there is nothing to decorate and the frame is invisible — which is
 * why buying or wearing one before earning a title is allowed rather than
 * blocked.
 */
export function TitleBadge({
  name,
  frameId,
}: {
  name: string | null;
  frameId: string | null;
}) {
  if (name === null) return <span className="text-white">—</span>;

  const frame = frameId === null ? null : (FRAME_STYLE[frameId] ?? null);
  if (frame === null) return <span className="text-white">{name}</span>;

  return (
    <span className={clsx("inline-block rounded border px-2 py-0.5", frame)}>
      {name}
    </span>
  );
}
