# Handoff — reignpropertyholdings.com

Rewritten 2026-08-30. Picks up at commit `bb96adf` on `main`, working tree clean.
Supersedes the 2026-08-24 version, which was 27 commits behind and described a
backlog that is now largely done.

This document exists so the next agent can continue without re-deriving
anything. Section 1 matters most: it closes off a direction that looks obvious
but is a dead end, and doing so cost a lot of verification effort.

---

> **Working locally (Cowork, Cursor, or Claude Code on your machine)?** Read
> `HANDOFF-LOCAL.md` first. Much of section 3 below is blocked only by this
> sandbox's lack of network and browser access, and stops being blocked there.

## Action items

Owner dashboard work. Nothing below is blocked on an agent. Set secrets on
the **Pages** project `reignpropertyholdings` (not either Worker), then
redeploy — existing deployments keep the old empty values. Confirm with
`GET /api/status` (booleans only). Listing-to-variable mapping for the
iCal feeds is in `HANDOFF-LOCAL.md` §3.1.

- [x] Merge #38 (wrangler-action pinned to 4.127.1)
- [ ] Confirm the Pages deploy log for #38 installed `wrangler@4.127.1`, not `3.90.0`
- [ ] Set `SENDGRID_API_KEY` (do this first — the contact form 500s before SendGrid is called)
- [ ] Redeploy, then submit the contact form once to confirm `admin@reignpropertyholdings.com` is a verified SendGrid sender
- [ ] Set `STAYS_ICAL_1332_AIRBNB`, `STAYS_ICAL_1332_VRBO`, `STAYS_ICAL_1334_AIRBNB`, `STAYS_ICAL_1334_VRBO` — re-export fresh `.ics` URLs; check listing ids so 1332 and 1334 are not swapped
- [ ] Set `CLOUDFLARE_WEB_ANALYTICS_TOKEN`
- [ ] Redeploy after the iCal and analytics vars; confirm `/api/status` shows `contact: true`, both `stays` true, `analytics: true`
- [ ] Copy the TurboTenant embed owner id (Account → Settings → Advanced). Do not guess — a wrong hash route renders empty
- [ ] Asking rents for the property schema `offers` block, if they exist. Do not use the TurboTenant rent *estimate*
- [ ] Decide: disconnect the Workers git integration (`reignpropertyholdings` and `reignpropertyholdingsllc`). They do not serve the domain
- [ ] Decide: leave Resident Portal / Pay Rent / Maintenance Request on the TurboTenant root, or replace with dashboard deep links

## 1. The headline finding: TurboTenant has no public API and no MCP server

The owner has TurboTenant **Premium** and asked to "use API or MCP to implement as much
integration as possible." That specific thing is not buildable. Premium is a *product* tier
for landlords; it does not grant API keys, developer access, or webhooks.

Evidence, strongest first:

- Pipedream's TurboTenant integration request
  ([issue #19942](https://github.com/PipedreamHQ/pipedream/issues/19942)) is labeled
  **`blocked-on-they-don't-have-an-api`**. Pipedream builds integrations professionally
  against public APIs; that label is close to authoritative.
- No Zapier app. No Make.com app. No outbound webhooks. No iCal feed. No RSS/JSON listing
  feed. No public developer docs host. Each was checked and came back negative.
- The partner integrations you may read about — Sure (renters insurance), REI Hub
  (accounting), Snappt (income verification) — are negotiated business deals on private
  APIs. They are not self-serve.
- "API: Yes" on GetApp / SoftwareFinder / SourceForge is a generic feature checkbox. It is
  not reliable and should not be treated as evidence.

**Do not write code against a TurboTenant REST endpoint.** There is a real failure mode
here where a model generates confident, plausible-looking calls to hosts like
`api.turbotenant.com/v1/listings` that do not exist. If you find yourself inventing an
endpoint shape, stop.

There is also an internal GraphQL endpoint behind TurboTenant's own listing pages. It was
found during research. **Do not build on it** — it is unsupported, unauthenticated for your
use, and using it would likely breach their ToS. Same for the third-party Apify TurboTenant
scraper.

### Lease status on this site (508 Avenue E)

The card/detail **"Leased" / "Available"** line is **not** live TurboTenant sync. It reads
`functions/_shared/turbotenant.js` (`available` flag) via `GET /api/listings`, with an
optional Pages override `TURBOTENANT_AVAILABLE_508_AVENUE_E` (`true`/`false`). Redeploy
after changing the env var. Flip the checked-in flag or the env when the unit reopens.

---

## 2. What IS real and buildable

Four surfaces survived adversarial fact-checking (each was assigned a skeptic told to
refute it; these are the ones that could not be refuted).

### 2a. Embed Property List — the best fit for this site
TurboTenant has an official, documented embed. Dashboard path:
**Account → Settings → Advanced → "Embed Your Property List"**, which generates an HTML
snippet you paste into your own page. It renders every property currently marketing online
and auto-updates when listings change.

Verified live: `https://rental.turbotenant.com/embedpropertylist.html` returns HTTP 200 with
`<body data-app="embed">`, a distinct React entry point from the normal listing app
(`data-app="main"`).

Two things to know before using it:

- **It is a hash route, not a query parameter.** The shipped bundle builds its router with
  `createHashHistory` and route `/:id`. The real shape is
  `embedpropertylist.html#/<ownerId>`. A query-string guess renders the empty state
  silently rather than erroring — which is exactly how you'd waste an hour.
- **The account id must be copied from the dashboard.** It was deliberately not guessed.
  You cannot derive it.

Caveats worth respecting: TurboTenant's own help article says browsers "are limiting or
blocking certain iframe functionality for security reasons" and that they are "exploring
alternative solutions." Also `rental.turbotenant.com/robots.txt` is `Disallow: /` except
`/p/` and `/properties/`, so embedded content will **not** help SEO. Treat the embed as
progressive enhancement — keep the hand-written `property-*.html` pages as the durable,
indexable layer.

### 2b. Per-listing public share URLs — already wired
`rental.turbotenant.com/p/<slug>/<uuid>`. This is what `functions/_shared/turbotenant.js`
already redirects to. Nothing to do.

### 2c. Lead notification emails → email-parsing bridge
The most practical automation hook that exists. TurboTenant emails you on new leads;
services with prebuilt TurboTenant templates (e.g. Mailparser) can parse those into
structured data. This is the realistic substitute for webhooks.

### 2d. CSV exports
Payments (Charges and Deposits) and Rent Roll export as CSV. Useful for reporting; not a
website surface.

Other real-but-lower-value surfaces found: shareable pre-screener link, Showing Scheduling
booking link, per-property Marketing Call Forwarding number (Pro tier), syndication to ~26
partner sites (one-way, outbound). Notable negative: **Zillow/Trulia/HotPads are NOT in the
syndication set.**

---

## 3. Needs the owner, not an agent

Blocked on dashboard access. **This was verified, not assumed** — see the
access matrix in section 3b before spending another cycle routing around it.

1. **Cloudflare Web Analytics token.** Middleware injects
   `CLOUDFLARE_WEB_ANALYTICS_TOKEN` at request time (or strips the beacon when
   unset). Push via `npm run cf:secrets:push` after copying
   `.dev.vars.example` → `.dev.vars`, or set in the Pages dashboard. Confirm
   with `GET /api/status` (`analytics: true`).
2. **`STAYS_ICAL_*` feed URLs** (`_1332_VRBO`, `_1332_AIRBNB`, `_1334_VRBO`,
   `_1334_AIRBNB`) in Cloudflare Pages. The availability line is wired up
   everywhere and renders nothing until these exist. They carry booking
   calendar tokens — dashboard only, never committed.
   All four values were collected and verified 2026-08-31 (each checked
   against the listing/room id already recorded in `stays.js` — two VRBO
   links sent along the way did not match either listing and were
   discarded). Owner was walking through the Cloudflare dashboard to save
   them as this was written; **confirm with `/api/status` (`stays`) and the
   `/api/availability?slug=…` URLs below before assuming they're set.**
3. **SendGrid sender verification for `admin@`.** The contact Function sends
   `from: admin@reignpropertyholdings.com`. If that identity is unverified,
   every submission fails. Unconfirmed either way; submitting the form once
   settles it.
4. **TurboTenant embed account id** (section 2a), from Account → Settings →
   Advanced. Cannot be derived, and a guessed URL renders an empty state
   silently.
5. **Which `TURBOTENANT_*` env vars are set.** Nothing in the repo records
   this. All three listings have checked-in URLs, so the site works without
   them; a variable would only override.
6. **Rent figures.** No price appears anywhere in the repo, which is why the
   property schema has no `offers` block — see section 4. The owner's mailbox
   was searched 2026-08-31 and contains **no asking rent** for any of the three
   properties — only a TurboTenant *rent estimate* for 1332 Tricou (2025-12-07:
   avg $1,641, range $1,200–$2,400, from 11 comparable 2bd/1.5ba rentals within
   2 miles). That is a market comp generated for pricing research, **not** an
   asking rent, and must not be published as one. Treat this avenue as closed.

## 3a. Resolved: the domain is served by Pages

`/apply/<slug>` was reported landing on the contact form for 1334 and 508 in
an earlier session, which should redirect to TurboTenant, and was never
reproduced — the redirects were correct locally on every check. What was
missing was proof of which Cloudflare service actually answers the domain.

**Settled 2026-08-31** from the zone's exported DNS records (owner pulled
these from the dashboard):

```
reignpropertyholdings.com.  CNAME  reignpropertyholdings.pages.dev.  ; cf_tags=cf-proxied:true
```

The apex CNAMEs straight to the Pages project. The domain overview's "No
Workers connected" card was accurate, not a red herring: neither
`reignpropertyholdings` nor `reignpropertyholdingsllc` (the two Workers
services behind the perpetually flaky "Workers Builds" checks) is wired to
the domain at all. Nothing routes real traffic through them.

Two things follow:

- **The original report was never explained and most likely never happened
  as described** — perhaps a cached page. There is no code path by which it
  could have been the Worker-drops-Functions defect below, since that Worker
  was never in the traffic path.
- **The "Workers Builds" checks are cosmetic.** They build and deploy two
  services nothing points at. Disconnecting that git integration (section 4)
  would retire a check that has never reflected the live site's health.

## 3b. Access matrix — what an agent here can actually reach

Tested 2026-08-31, after the owner asked whether the blocked items could be obtained
without them. Four paths were executed, not assumed. Recorded so this is not re-derived
every session.

| Path | Result |
| --- | --- |
| Cloudflare MCP (the 5 servers in `.mcp.json`, added PR #9) | **Cursor plugin authenticated 2026-09-06** (Builds, Bindings, Observability). Builds can read Workers Builds logs. Bindings is D1/KV/R2 only — it cannot list Pages Function secrets; use `GET /api/status` for those. |
| Container egress (`curl`) | **Blocked.** `reignpropertyholdings.com` and `*.pages.dev` return `CONNECT tunnel failed, response 403`. No per-host allowlist an agent can widen. |
| Server-side fetch (`WebFetch`) | **Blocked separately.** Returns `EGRESS_BLOCKED` for the domain — a different code path from `curl`, same answer. |
| Gmail MCP | **Live.** Searched for rent figures, the analytics token, SendGrid verification and the TurboTenant embed id; only the rent estimate in item 6 was found. |
| Google Drive MCP | **Live**, searched independently. `fullText contains 'Tricou'` returns zero files; `'Marrero'` returns only resumes, a 2020 `Act of Sale.pdf` and unrelated PDFs. The one signed lease in the account is a 2018 apartment lease with the owner as *resident*, not a lease for these properties. Confirms Gmail's result. |

**The unlock.** The Cursor Cloudflare plugin is now authenticated (Builds /
Bindings / Observability). That closed the wrangler-log item in section 4.
It does **not** expose Pages Function secrets — Bindings is D1/KV/R2 — so
items 1–5 still need values set in the Pages dashboard (or `.dev.vars` +
`npm run cf:secrets:push`). Confirm they landed with `GET /api/status`.

## 4. Prioritized backlog

Everything the 2026-08-24 list had under High is done, along with most of
Medium and Low. What remains:

### Real and open

- **The Worker deploy drops every Function — confirmed latent, not live**
  (section 3a: the domain CNAMEs to the Pages project, not to either Worker
  service). Still worth fixing since it means those two services 404 on
  every `/apply/*`, `/portal` and `/api/*` request if anyone or anything ever
  does point traffic at them, but it is no longer urgent.
  `package.json` compiles the Pages Functions to `./dist/worker`, and
  `wrangler.jsonc` has no `main` pointing at it. Adding `main` (#9, commit
  `dacfa84`) turned both Workers Builds checks red. **Log confirmed
  2026-09-06** (build `11bff9ef-cd57-44e6-9944-e2c746a5bc66`, wrangler
  4.127.1): `The entry-point file at "dist/worker/index.js" was not found.`
  Workers Builds `buildCommand` is empty; `deployCommand` is
  `npx wrangler versions upload`. Do not re-add `main` unless that build
  command runs `npm run build` first. The `compatibility_date` guess was
  not the cause.
- **Two deploy paths run on every push.** Actions runs `wrangler pages deploy`;
  Workers Builds runs `npx wrangler versions upload` (no build step). Both
  ship the same site to different places. Green Workers Builds on current
  tip upload `public/` as assets and produce a ~0.31 KiB assets-only Worker
  — no Functions. Recommendation is to keep Pages and disconnect the Workers
  git integration, which also retires the historically red check — but it is
  the owner's call.
- ~~**Wrangler version split.**~~ *Closed 2026-09-06.* `deploy.yml` now pins
  `wrangler-action` to **4.127.1**, matching `package-lock.json`. The
  implicit default was 3.90.0.
  **#31 log** (build `71240eaf-39ea-4589-8873-798b51ff71de`, wrangler
  3.90.0): `Missing entry-point`. wrangler JSON/JSONC support starts at
  **3.91.0**; 3.90.0 never read `wrangler.jsonc`, so it never saw the
  assets-only config and demanded `main`. That is why main's tip stayed
  green (lockfile wrangler 4.127.1) while the pin-down PR went red. Do
  not pin back to 3.90.0.
- **Property schema has no `offers`.** Needs rent figures (section 3.6).
  `url` and `potentialAction` are already there.
- **Three footer links, one destination.** Resident Portal, Pay Rent and
  Maintenance Request all land on `rental.turbotenant.com/` root, because
  `PORTAL_URL_FALLBACK` is the renter site root. Deep links would need to come
  from the dashboard. Left alone deliberately: collapsing visitor-facing nav
  links is a content decision.

### Fixed since the last handoff

`utm_*` attribution on apply redirects · `/apply/start` no longer a mislabeled
dead end · HEAD returns 302 rather than 405 on both redirect routes ·
`LISTINGS[].page` wired into the contact fallback with a back-link ·
`url` + `potentialAction` in property schema · 508 retyped from `Apartment` to
`SingleFamilyResidence` · `404.html` · `robots.txt` disallows the redirect
endpoints · responsive WebP images · minimum-two-tags rule with CI ·
stale `TURBOTENANT_APPLY_URL_508_AVENUE_E` comment · `.dev.vars.example`
documenting every variable for local `wrangler pages dev`.

## 4a. Availability calendar — shipped

A month-grid calendar now renders on both Tricou detail pages, drawn by
`public/js/calendar.js` from the same `/api/availability` response that already
feeds the one-line availability sentence. `main.js` publishes its per-slug fetch
promises on `window.__staysAvailability` so the page hits the endpoint once, not
twice.

Deliberately a **display** calendar, not a booking engine. The stays carry a
30-night floor because New Orleans restricts short-term rentals in residential
areas (see `functions/_shared/stays.js`), so days are not selectable and the
reservation still happens on Airbnb or VRBO. A Lodgify-style nightly checkout
flow would misrepresent what is on offer.

Behaviour worth knowing:

- Hidden entirely when `/api/availability` returns `available: null` — no feed
  configured, every feed unreachable, or not a stay listing. An all-open grid
  built from missing data would be worse than no calendar.
- Booked days are struck through as well as tinted, so the state does not rely
  on colour alone.
- Pages two months at a time up to a 12-month horizon, matching the API's
  365-day cap on busy ranges.
- `test/calendar.test.mjs` covers the date math: DTEND exclusivity, leap
  February, month rollover, malformed-range rejection.

**Still gated on the `STAYS_ICAL_*` variables** (section 3.2). Until those are
set in Cloudflare Pages the calendar renders nothing at all — the code is live
but invisible.

## 5. Furnished stays (Airbnb / VRBO) — shipped

Both Tricou units are listed on VRBO and Airbnb for **30+ night stays** (New Orleans
restricts residential short-term rentals). Long-term leasing is still the goal; the stays
fill gaps between leases. Do not let site copy imply nightly or weekly stays.

| Unit | VRBO | Airbnb |
|---|---|---|
| 1332 Tricou St (2BR/2BA) | [5063788](https://www.vrbo.com/5063788) | [832710289760465793](https://www.airbnb.com/rooms/832710289760465793) ("NOLA Jazz House") |
| 1334 Tricou St (2BR/1BA) | [5063799](https://www.vrbo.com/5063799) | [700851692178654878](https://www.airbnb.com/rooms/700851692178654878) ("Mardi Gras Mamba House") |

Both units now link both platforms. 1332's Airbnb page had 404'd while the listing was
snoozed, so it was deliberately left unlinked; it went public again on 2026-08-25 and is
now wired up (commit `f857254`). If a listing is snoozed again the page will 404 — set
`airbnb: null` for it rather than shipping a button to a dead page.

**No Airbnb/VRBO API is involved and none is needed.** Availability comes from each
platform's iCal export, proxied by `functions/api/availability.js` (required: neither
platform sends CORS headers). Feed URLs carry calendar access tokens — env vars only,
never committed. `.dev.vars` is gitignored as of this work; it was not before.

Still outstanding here:
- `STAYS_ICAL_*` env vars in Cloudflare Pages (only `1332_AIRBNB` has been tested locally).
- Confirm 30 nights is the correct published floor — Airbnb doesn't expose the minimum-stay
  setting to an unauthenticated fetch, so it could not be verified independently.
- ~~Confirm room `832710289760465793` is 1332.~~ **Confirmed 2026-08-25**: the page is
  public again and reports 2BR/**2**BA ("NOLA Jazz House"), matching 1332. Bathroom count
  is what separates it from 1334 (2BR/1BA).

## 6. Conventions worth knowing

- **Every property card carries at least two tags**, enforced by
  `test/tags.test.mjs` via the `Checks` workflow on every PR. A tag must be
  supported by that property's own detail page — do not tag a home with
  something its page never claims.
- **Images are responsive WebP.** Photos are `<picture>` elements with a WebP
  `srcset` and the untouched JPEG as fallback. Regenerate with
  `npm install --no-save sharp && node scripts/optimize-images.mjs`. sharp is
  deliberately not a dependency: Workers Builds runs `npm install`, and
  platform binaries on every deploy is a bad trade for a task that runs only
  when photos change. **Never upscale** — the script skips widths above a
  source's natural size, and earlier work established that an upscaled file
  looks worse than the smaller native one.
- **The gallery hero is a `<picture>`.** A matching `<source>` outranks the
  `<img>` src, so the swap handler in `main.js` must update both. Setting `src`
  alone silently leaves the old photo on screen.
- **`npm test`** runs the iCal, tag, analytics, and env-status suites. Neither
  has dependencies beyond node, so CI needs no install step.
- **Availability degrades to nothing.** With no feed configured the line stays
  hidden rather than rendering an empty box or a false "available now". Keep
  that property in any change to it.

## 7. Provenance

Section 1–2 findings came from a multi-agent research workflow where every claimed surface
was handed to a skeptic agent instructed to refute it, defaulting to "not real" when
uncertain. 4 surfaces survived; 8 were refuted. The run was cut short by a session limit —
10 of 18 agents died, including the final synthesis step, so sections 2 and 4 were assembled
by hand from the surviving agent output rather than from a generated summary. Raw per-agent
results, if you want to dig:

```
~/.claude/projects/-Users-gilbertanderson-Development/7a56dec6-ca24-4e17-9e09-7e356403d896/subagents/workflows/wf_ba53c9ca-b7f/journal.jsonl
```
