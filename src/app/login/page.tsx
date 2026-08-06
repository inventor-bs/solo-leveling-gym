"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/server/actions/auth.actions";
import { SystemPanel } from "@/ui/components/primitives/SystemPanel";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("pin", pin);
      const result = await loginAction(fd);
      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(true);
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <SystemPanel header="SYSTEM AUTHENTICATION" className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="font-mono text-xs text-system-blue/60 tracking-widest">
            ◈ Enter the Hunter&apos;s PIN
          </p>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-shadow-dark border border-system-blue/30 rounded px-3 py-2
              font-mono text-white tracking-widest focus:outline-none focus:border-system-blue"
            autoFocus
          />
          {error && (
            <p className="font-mono text-xs text-danger">Incorrect PIN.</p>
          )}
          <button
            type="submit"
            disabled={pending || pin.length === 0}
            className="w-full bg-system-blue/10 border border-system-blue/40 text-system-blue
              font-mono text-sm tracking-widest py-2 rounded hover:bg-system-blue/20
              disabled:opacity-40 transition-colors"
          >
            {pending ? "VERIFYING..." : "AUTHENTICATE"}
          </button>
        </form>
      </SystemPanel>
    </div>
  );
}
