# Solo Leveling Gym

A single-user training tracker wrapped in the game system from the manhwa
_Solo Leveling_. Real workout data drives every number on screen — nothing is
mocked, and nothing can be bought.

> **Status:** Foundation and the core training engine are done (stats, e1RM,
> progressive overload, fatigue). Persistence, UI, and the quest system are next.

## The one rule

> **Every number on screen must trace back to something actually done.**

Stats are derived from logged sets, never awarded and never purchasable. This
single constraint drives most of the design:

| Kind of number  | Examples                                 | Rule                                                                                                           |
| --------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Measured**    | 6 stats, e1RM, volume, PRs, shadow grade | Derived purely from workout logs. Nothing may modify them — not items, not skills, not gold.                   |
| **Progression** | EXP, level, rank, gold                   | Derived from activity, and may be multiplied by bonuses **earned through training**. Never by anything bought. |
| **Adjustment**  | Fatigue, penalty debuffs                 | Game-layer mechanics applied at the read layer, never overwriting measured values.                             |

A consequence worth stating plainly: stats go **down** when you stop training.
That is what detraining does in reality, and it is what makes the numbers mean
something.

## Architecture

Dependencies flow in one direction only:

```
app/ (routes)  →  server/  →  app-services/  →  core/
                                   ↓              ↑
                                ports/  ←────  infra/
```

`core/` is pure domain logic: no framework, no I/O, no `Date.now()`, no
`Math.random()`, no `process.env`. Everything impure crosses a port.

This is enforced by ESLint (`import/no-restricted-paths` and
`no-restricted-syntax`), not by convention — CI fails on violation. An
architecture that isn't machine-checked rots within months.

```
src/
  core/        Pure domain. Every game rule lives here, and only here.
    shared/      Result, branded units, domain events, TrainingDay
  ports/       Interfaces only (ClockPort, RngPort)
  infra/       Port implementations — DB, clock, RNG, config
  server/      Composition root, PIN auth guard, server actions
  ui/          Components and client state
  app/         Next.js routes
```

### Why `ClockPort` exists

The app is full of time-dependent rules: quest reset at midnight, quest expiry,
Penalty Zone duration, shadow decay after N days. With a real clock, testing
"23:59 versus 00:01" means changing the system clock — so nobody tests it, so
the most important logic in the app goes unverified.

### Why `TrainingDay` exists

The hunter is at UTC+7; the server runs UTC. Any stray `new Date().getDate()`
would attribute **every session logged after 19:00 local time to the next day**,
breaking streaks and triggering penalties unfairly. `TrainingDay` is the only
place in the codebase permitted to derive a calendar day from an instant, and it
takes the timezone offset as an explicit argument.

## Getting started

Requires Node 24 (see `.nvmrc`) and pnpm.

```bash
pnpm install
cp .env.example .env   # then fill in HUNTER_PIN and SESSION_SECRET
pnpm db:migrate
pnpm dev
```

Generate a session secret with `openssl rand -hex 32`.

## Scripts

| Command              | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `pnpm dev`           | Development server                                   |
| `pnpm verify`        | Format, lint, types, tests — run this before pushing |
| `pnpm test`          | Unit tests                                           |
| `pnpm test:coverage` | Tests with enforced coverage thresholds              |
| `pnpm test:e2e`      | Playwright end-to-end tests                          |
| `pnpm format`        | Apply Prettier                                       |
| `pnpm db:generate`   | Generate a migration from schema changes             |
| `pnpm db:migrate`    | Apply migrations                                     |

## Access model

Reads are public — the deployed site shows real training data to anyone with the
link, by design. Writes require a PIN, held in an HMAC-signed httpOnly cookie.

Because reads are public, be aware the deployed app exposes your full training
history: lifts, dates, and missed sessions included.

## Tech

Next.js 15 · React 19 · TypeScript (strict, `noUncheckedIndexedAccess`) ·
Turso/libSQL · Drizzle · Zod · Tailwind · Vitest · Playwright

## Credit

Setting and terminology from _Solo Leveling_ by Chugong. This is a personal,
non-commercial project and is not affiliated with the rights holders.
