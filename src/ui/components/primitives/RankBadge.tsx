import clsx from "clsx";

type Rank = "E" | "D" | "C" | "B" | "A" | "S" | "National" | "Monarch";

const RANK_STYLE: Record<Rank, { color: string; glow: string; bg: string }> = {
  E: {
    color: "text-rank-e",
    glow: "shadow-[0_0_8px_rgba(156,163,175,0.5)]",
    bg: "bg-rank-e/10",
  },
  D: {
    color: "text-rank-d",
    glow: "shadow-[0_0_8px_rgba(74,222,128,0.5)]",
    bg: "bg-rank-d/10",
  },
  C: {
    color: "text-rank-c",
    glow: "shadow-[0_0_8px_rgba(96,165,250,0.5)]",
    bg: "bg-rank-c/10",
  },
  B: {
    color: "text-rank-b",
    glow: "shadow-[0_0_8px_rgba(167,139,250,0.5)]",
    bg: "bg-rank-b/10",
  },
  A: {
    color: "text-rank-a",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.5)]",
    bg: "bg-rank-a/10",
  },
  S: {
    color: "text-rank-s",
    glow: "shadow-[0_0_12px_rgba(255,107,53,0.6)]",
    bg: "bg-rank-s/10",
  },
  National: {
    color: "text-rank-national",
    glow: "shadow-[0_0_12px_rgba(255,51,102,0.6)]",
    bg: "bg-danger/10",
  },
  Monarch: {
    color: "text-monarch-purple",
    glow: "shadow-[0_0_16px_rgba(123,47,190,0.7)]",
    bg: "bg-monarch-purple/10",
  },
};

export function RankBadge({
  rank,
  size = "md",
}: {
  rank: Rank;
  size?: "sm" | "md" | "lg";
}) {
  const s = RANK_STYLE[rank];
  const sz = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-lg px-4 py-2",
  }[size];
  return (
    <span
      className={clsx(
        "font-mono font-bold border rounded tracking-widest",
        sz,
        s.color,
        s.glow,
        s.bg,
        rank === "S" && "animate-glow-pulse",
        rank === "Monarch" && "animate-float",
      )}
    >
      {rank === "National" ? "NATIONAL" : rank}-RANK
    </span>
  );
}
