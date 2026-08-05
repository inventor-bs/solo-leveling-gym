# Deployment

Target: **Vercel** (app) + **Turso** (database). Both free tiers are far more
than a single-user app needs.

Everything below is one-time setup. After it, `git push origin main` deploys.

---

## Prerequisites

Already installed on this machine:

- Turso CLI at `~/.turso/turso` (v1.0.31)
- Vercel CLI at `~/Library/pnpm/bin/vercel` (v58.5.1)

Neither is on your `PATH` in non-interactive shells. Either open a new terminal
(both installers updated `~/.zshrc`), or prefix with the full path.

---

## Step 1 — Turso database

Log in. This opens a browser; GitHub sign-in is the quickest route.

```bash
turso auth login
```

Create the database. Turso has no Singapore region; `aws-ap-northeast-1`
(Tokyo) is the closest to Vietnam and is also the default.

```bash
turso db create solo-leveling-gym --location aws-ap-northeast-1
```

**Region pairing matters more than it looks.** The latency that counts is not
browser → Vercel, it is **Vercel function → Turso**, because every server-rendered
page read hits the DB. A function in Washington DC (Vercel's default) talking to
a DB in Tokyo pays a cross-Pacific round trip on every request.

`vercel.json` therefore pins functions to `hnd1` (Tokyo), matching the DB region.
On the Hobby plan a single region is allowed; if a deploy is ever rejected over
this, removing the `regions` key is the fix.

Collect the two values the app needs:

```bash
turso db show solo-leveling-gym --url
turso db tokens create solo-leveling-gym
```

Keep both. The first is `TURSO_DATABASE_URL`, the second `TURSO_AUTH_TOKEN`.
The token is a credential — do not commit it or paste it into a chat.

---

## Step 2 — Generate a session secret

```bash
openssl rand -hex 32
```

This becomes `SESSION_SECRET`. It signs the auth cookie; if it leaks, anyone can
forge write access. Use a **different** value from your local `.env`.

---

## Step 3 — Vercel project

```bash
vercel login
vercel link
```

Accept the defaults when linking — the repo name matches the project name.

Vercel auto-detects Next.js and pnpm. It will use the `vercel-build` script from
`package.json`, which runs migrations before building:

```
pnpm db:migrate && next build
```

---

## Step 4 — Environment variables

Five variables, all needed in **Production**, **Preview**, and **Development**.

| Variable                   | Value                                          |
| -------------------------- | ---------------------------------------------- |
| `TURSO_DATABASE_URL`       | from Step 1                                    |
| `TURSO_AUTH_TOKEN`         | from Step 1                                    |
| `SESSION_SECRET`           | from Step 2                                    |
| `HUNTER_PIN`               | your own PIN, 4+ characters                    |
| `HUNTER_TZ_OFFSET_MINUTES` | `420`                                          |
| `GEMINI_API_KEY`           | leave unset until Phase 4 — optional by design |

Set them through the dashboard (Project → Settings → Environment Variables), or
on the CLI:

```bash
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add SESSION_SECRET production
vercel env add HUNTER_PIN production
vercel env add HUNTER_TZ_OFFSET_MINUTES production
```

`src/infra/config/env.ts` validates all of these at first use and fails with the
specific missing variable named — a misconfigured deploy dies loudly at startup
rather than mysteriously at request time.

---

## Step 5 — Deploy

```bash
vercel --prod
```

After the first manual deploy, Vercel's GitHub integration takes over: pushes to
`main` deploy to production, and pull requests get preview deployments.

---

## Verifying a deploy

```bash
# Tables exist in production
turso db shell solo-leveling-gym "select name from sqlite_master where type='table'"

# Expected: __drizzle_migrations, hunter, processed_action
```

Then open the deployment URL. At this stage the pages still render prototype
data from the Zustand store — the training engine lands in Phase 1. What you are
verifying now is that **the pipeline works**: migrations run, env validation
passes, the build succeeds.

---

## What is deliberately not set up yet

- **Cron for the daily quest reset** — needed from Phase 2. It will be a
  `vercel.json` `crons` entry hitting a route at 17:00 UTC (00:00 ICT).
- **`GEMINI_API_KEY`** — Phase 4. The System Voice falls back to the template
  engine without it, so its absence is not an error.

---

## Cost

Both free tiers, indefinitely:

- **Turso free**: 500 databases, 9 GB storage, 1 billion row reads/month. A
  single-user training log uses a rounding error of this.
- **Vercel Hobby**: sufficient for one personal project. Note Hobby is for
  non-commercial use.

---

## Troubleshooting

**Build fails with `Invalid environment variables`** — a variable is missing or
malformed in Vercel. The error names it. Check it is set for the environment
being built (Production and Preview are separate).

**Build fails during `pnpm db:migrate`** — usually a wrong `TURSO_AUTH_TOKEN`,
or a token created for a different database. Regenerate with
`turso db tokens create solo-leveling-gym`.

**Deploy succeeds but writes are rejected** — expected until you enter the PIN.
Reads are public by design; writes require the `HUNTER_PIN` cookie.
