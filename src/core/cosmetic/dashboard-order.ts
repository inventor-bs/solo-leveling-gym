/**
 * Turns whatever is in storage into an order the Dashboard can render.
 *
 * `defaults` is both the canonical order and the set of ids that currently
 * exist, so there is only one list to keep in step when a panel is added or
 * removed. Four properties hold for every input:
 *
 *   - unparseable, non-array or absent input yields the defaults, never a throw
 *   - an id that is no longer a real panel is dropped
 *   - a repeated id keeps its first position
 *   - a valid id the stored order omits is appended in default order
 *
 * Together those mean an order saved today still renders after the
 * Dashboard is restructured, and a corrupted row degrades to the default
 * layout instead of taking down the home page.
 */
export function normalizeDashboardOrder(
  stored: string | null | undefined,
  defaults: readonly string[],
): string[] {
  const valid = new Set(defaults);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of parseIdArray(stored)) {
    if (!valid.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  for (const id of defaults) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  return ordered;
}

function parseIdArray(stored: string | null | undefined): string[] {
  if (stored === null || stored === undefined || stored === "") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter((value): value is string => typeof value === "string");
}
