import Link from "next/link";
import { redirect } from "next/navigation";
import { getContainer } from "@/server/container";
import { hasWriteAccess } from "@/server/auth/guard";
import { Sidebar } from "@/ui/components/layout/Sidebar";
import { rankForLevel } from "@/core/hunter/progression";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hunter = await getContainer().hunters.get();

  if (!hunter) {
    const owner = await hasWriteAccess();
    if (owner) {
      redirect("/onboarding");
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-mono text-sm text-system-blue/60">
            [ The System has not yet chosen a Hunter. ]
          </p>
          <Link
            href="/login"
            className="font-mono text-xs text-slate-600 hover:text-slate-400"
          >
            Hunter access →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        hunterName={hunter.name}
        level={hunter.level}
        rank={rankForLevel(hunter.level)}
        currentExp={hunter.exp}
        gold={hunter.gold}
      />
      <main className="flex-1 ml-0 md:ml-64 relative">{children}</main>
    </div>
  );
}
