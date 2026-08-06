import Link from "next/link";
import {
  ACTION_ERROR_MESSAGE,
  type ActionError,
} from "@/server/actions/action-result";

/** Renders a failed action as something the hunter can act on. */
export function ActionErrorNotice({ error }: { error: ActionError }) {
  return (
    <div className="border border-danger/40 bg-danger/5 rounded p-3 space-y-2">
      <p className="font-mono text-xs text-danger">
        {ACTION_ERROR_MESSAGE[error]}
      </p>
      {error === "unauthorized" && (
        <Link
          href="/login"
          className="inline-block font-mono text-xs text-system-blue hover:underline"
        >
          Sign in →
        </Link>
      )}
    </div>
  );
}
