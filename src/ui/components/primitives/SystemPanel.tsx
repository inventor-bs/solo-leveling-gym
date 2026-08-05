import clsx from "clsx";
import { ReactNode } from "react";

interface SystemPanelProps {
  children: ReactNode;
  className?: string;
  glowColor?: "blue" | "purple" | "gold" | "danger";
  corners?: boolean;
  header?: string;
}

const GLOW = {
  blue: "border-system-blue/30 shadow-system",
  purple: "border-monarch-purple/40 shadow-purple",
  gold: "border-gold/30 shadow-gold",
  danger: "border-danger/40 shadow-danger",
};

export function SystemPanel({
  children,
  className,
  glowColor = "blue",
  corners = true,
  header,
}: SystemPanelProps) {
  return (
    <div
      className={clsx(
        "system-panel rounded-lg border",
        GLOW[glowColor],
        className,
      )}
    >
      {corners && (
        <>
          {/* Corner decorations */}
          <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-system-blue/70 rounded-tl" />
          <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-system-blue/70 rounded-tr" />
          <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-system-blue/70 rounded-bl" />
          <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-system-blue/70 rounded-br" />
        </>
      )}
      <div className="system-panel-inner">
        {header && (
          <div className="px-4 py-2 border-b border-system-blue/20">
            <h3 className="font-mono text-xs text-system-blue tracking-widest uppercase">
              {header}
            </h3>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
