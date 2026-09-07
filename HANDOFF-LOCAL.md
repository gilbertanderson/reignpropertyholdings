# Picking this up in Cowork or Cursor

`HANDOFF.md` is the full project record, written from a **remote Claude Code
session** — a sandbox with no route to the live site, no browser, and no way to
run an OAuth flow. Several items are parked there as "needs the owner" purely
because of those limits.

**This file is about what changes when you open the project somewhere normal.**
Read `HANDOFF.md` for what the project *is*; read this for what you can now do
that the remote session could not.

Start with `CLAUDE.md` either way — it carries the standing rules, and the first
one (stop and write a handoff before context runs out) is why this file exists.

---

## 1. What is different in a local environment

| Capability | Remote session | Cowork / Cursor |
| --- | --- | --- |
| Load `reignpropertyholdings.com` | ✗ egress-blocked (403 CONNECT) | ✓ |
| Load `*.pages.dev` / `*.workers.dev` previews | ✗ blocked | ✓ |
| Cloudflare dashboard | ✗ | ✓ signed in already |
| OAuth an MCP server | ✗ non-interactive | ✓ |
| `wrangler` against the real account | ✗ no credentials | ✓ after `wrangler login` |
| Read Workers **build logs** | ✗ dashboard-only | ✓ |

Everything in `HANDOFF.md` section 3 ("Needs the owner, not an agent") was
written against the left column. Most of it stops being blocked in the right one.

---

## 2. Setup, once

```bash
git clone https://github.com/gilbertanderson/reignpropertyholdings
cd reignpropertyholdings
npm install
npm test                      # expect 52 passing across 5 suites

cp .dev.vars.example .dev.vars   # gitignored; fill in real values
npx wrangler pages dev public    # local site WITH Functions on :8788
```

`.dev.vars.example` documents every variable the site reads. `wrangler pages dev`
is the only way to exercise `/api/*` locally — opening the HTML files directly
gives you a site with no Functions, so availability, contact and status all
silently do nothing.

**Connect the Cloudflare MCP servers.** `.mcp.json` already declares five of
them; they just need authorising. In Cursor the Cloudflare plugin is the
path — Builds, Bindings and Observability were authenticated 2026-09-06.

- *Cursor* — Settings → MCP / the Cloudflare plugin
- *Claude Code locally* — `/mcp` in-session to trigger the OAuth flow
- *claude.ai (incl. Cowork)* — Settings → Connectors → add custom connector

`builds` reads Workers Builds logs (item 3.2 is done). `bindings` is D1/KV/R2
only — it cannot list Pages Function secrets. Use `GET /api/status` for those.

---

## 3. Do these first

### 3.1 Set the four `STAYS_ICAL_*` variables — highest value

The availability calendar shipped in #36 and is **live but invisible**: with no
feed configured, `/api/availability` returns `available: null` and the calendar
deliberately renders nothing rather than drawing an all-open grid from missing
data. This is the single change that makes a merged feature visible to visitors.

Re-export fresh `.ics` URLs (the previous ones were pasted into a chat and
should be considered burned):

| Variable | Listing | Where |
| --- | --- | --- |
| `STAYS_ICAL_1332_AIRBNB` | 1332 Tricou — *NOLA Jazz House*, `rooms/832710289760465793` | Airbnb → Calendar → Availability settings → Calendar sync → Export |
| `STAYS_ICAL_1332_VRBO` | 1332 Tricou — `vrbo.com/5063788` | VRBO → Calendar → Import/Export |
| `STAYS_ICAL_1334_AIRBNB` | 1334 Tricou — *Mardi Gras Mamba House*, `rooms/700851692178654878` | Airbnb, as above |
| `STAYS_ICAL_1334_VRBO` | 1334 Tricou — `vrbo.com/5063799` | VRBO, as above |

Check the listing id in each URL against the row before saving — crossing 1332
and 1334 is the easy mistake and produces a calendar that is wrong rather than
broken, which is worse.

Then either paste them into **Workers & Pages → reignpropertyholdings →
Settings → Environment variables → Production**, encrypting each, or:

```bash
npm run cf:secrets:push:dry-run   # preview
npm run cf:secrets:push           # apply, reading .dev.vars
```

**Redeploy afterwards.** Pages environment variables only take effect on a new
deployment; existing ones keep the old empty values. Deployments → latest → ⋯ →
Retry deployment. Skipping this leaves everything looking configured while the
calendar stays blank.

Verify at `/api/status` — booleans only, never values:

```json
"stays": { "1332-tricou-st": true, "1334-tricou-st": true }
```

Then open a Tricou property page and scroll to **Furnished stays**.

### 3.2 Wrangler / `main` build failures — settled 2026-09-06

Both logs were read via the Cloudflare Builds MCP. Causes, not guesses:

- **#31** (pin wrangler to 3.90.0): `Missing entry-point`. wrangler 3.90.0
  cannot read `wrangler.jsonc` (JSON/JSONC starts at 3.91.0), so it never
  saw the assets-only config. `deploy.yml` now pins `wrangler-action` **up**
  to 4.127.1 to match the lockfile. Do not pin back down.
- **#9** (add `main: ./dist/worker/index.js`): that file was missing because
  Workers Builds `buildCommand` is empty. Do not re-add `main` unless the
  build command runs `npm run build` first.

Neither Worker serves the live domain (HANDOFF.md §3a). The remaining call
is whether to disconnect the Workers git integration.

### 3.3 The remaining dashboard items

Now trivially checkable rather than blocked: the Cloudflare Web Analytics token
(`CLOUDFLARE_WEB_ANALYTICS_TOKEN` — `functions/_middleware.js` injects it at
request time or strips the beacon), SendGrid sender verification for
`admin@reignpropertyholdings.com` (submit the contact form once and see whether
it arrives), the TurboTenant embed owner id (Account → Settings → Advanced), and
which `TURBOTENANT_*` overrides are set. See `HANDOFF.md` §3.

---

## 4. Rules that do not relax locally

More access is not permission to guess. These come from `CLAUDE.md`:

- **Never publish an unverified fact about a property.** Rents, parking counts,
  square footage, listing ids and deep links go on a live rental listing. A
  TurboTenant *rent estimate* is market research, not an asking rent — one for
  1332 Tricou exists (avg $1,641) and must not fill the empty `offers` block.
  Both the owner's Gmail and Drive were searched; no asking rent exists in
  either. Leave the gap.
- **Secrets stay in the dashboard.** `STAYS_ICAL_*` and `SENDGRID_API_KEY` carry
  access tokens. `.dev.vars` is gitignored and must stay that way.
- **30-night minimum is a compliance floor, not a default.** New Orleans
  restricts short-term rentals in residential areas. Nothing in the UI may imply
  nightly booking — which is why the calendar shipped as a display grid rather
  than a Lodgify-style checkout flow.
- **Verify before asserting.** The recurring failure in this repo has been
  trusting a stale mental model over a fresh look: a clone 27 commits behind
  produced a confident, wrong claim about what the owner was seeing. Fetch
  `origin/main` first, and re-test environment limits rather than reciting them.

---

## 5. Before you push

```bash
npm test                          # all 5 suites; add new ones to the test script
npx wrangler pages dev public     # exercise /api/* by hand
```

There is no linter or formatter configured. `.github/workflows/checks.yml` runs
`npm test` on pull requests, deliberately separate from `deploy.yml` so a content
rule blocks a PR rather than a deployment.

Worth knowing about the test suite: every assertion in `test/calendar.test.mjs`
passed while the calendar rendered as an empty box, because the first paint never
called `draw()`. Only opening it in a browser caught that. Unit tests here cover
date math, not rendering — check visual changes visually.
