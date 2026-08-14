"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Reorder } from "framer-motion";
import { saveDashboardOrderAction } from "@/server/actions/cosmetic.actions";
import type { ActionError } from "@/server/actions/action-result";
import { ActionErrorNotice } from "@/ui/components/primitives/ActionErrorNotice";

/**
 * Orders panels that were rendered on the server.
 *
 * `panels` is a map of already-rendered nodes, not a render function: a
 * closure cannot cross the server/client boundary, and passing one would
 * take the whole page down for every visitor. This component chooses an
 * order and nothing else.
 *
 * Without the unlock it renders the panels in their given order with no
 * button, no handle and no hint — the Dashboard looks exactly as it did.
 */
export function ReorderablePanels({
  order,
  panels,
  editable,
}: {
  order: string[];
  panels: Record<string, ReactNode>;
  editable: boolean;
}) {
  const present = order.filter((id) => panels[id] !== undefined);
  const [items, setItems] = useState<string[]>(present);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editable) {
    return (
      <div className="space-y-6">
        {present.map((id) => (
          <div key={id}>{panels[id]}</div>
        ))}
      </div>
    );
  }

  function toggle() {
    if (!editing) {
      setEditing(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveDashboardOrderAction({ order: items });
      if (!result.ok) setError(result.error);
      setEditing(false);
    });
  }

  return (
    <div className="space-y-6">
      <button
        onClick={toggle}
        disabled={pending}
        className="font-mono text-xs tracking-widest border rounded px-3 py-1
          border-system-blue/40 text-system-blue hover:bg-system-blue/10 disabled:opacity-40"
      >
        {editing ? (pending ? "SAVING..." : "DONE") : "REARRANGE"}
      </button>
      {error && <ActionErrorNotice error={error} />}
      <Reorder.Group
        as="div"
        axis="y"
        values={items}
        onReorder={setItems}
        className="space-y-6"
      >
        {items.map((id) => (
          <Reorder.Item
            as="div"
            key={id}
            value={id}
            dragListener={editing}
            className={editing ? "cursor-grab active:cursor-grabbing" : ""}
          >
            {panels[id]}
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}
