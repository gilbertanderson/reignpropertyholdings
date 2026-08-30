# Handoff — reignpropertyholdings.com

Rewritten 2026-08-30. Picks up at commit `bb96adf` on `main`, working tree clean.
Supersedes the 2026-08-24 version, which was 27 commits behind and described a
backlog that is now largely done.

This document exists so the next agent can continue without re-deriving
anything. Section 1 matters most: it closes off a direction that looks obvious
but is a dead end, and doing so cost a lot of verification effort.

---

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

Blocked on dashboard access; no agent can resolve these from the repo.

1. **Cloudflare Web Analytics token.** All 9 pages still ship the literal
   `REPLACE_WITH_CLOUDFLARE_ANALYTICS_TOKEN`, so the site has never recorded a
   visit. This is now the most valuable outstanding item: apply links carry
   `utm_*` tags, making applications traceable leaving the site, but there is
   no data on anything happening on it.
2. **`STAYS_ICAL_*` feed URLs** (`_1332_VRBO`, `_1332_AIRBNB`, `_1334_VRBO`,
   `_1334_AIRBNB`) in Cloudflare Pages. The availability line is wired up
   everywhere and renders nothing until these exist. They carry booking
   calendar tokens — dashboard only, never committed.
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
   property schema has no `offers` block — see section 4.

## 3a. One unresolved question

`/apply/<slug>` was reported landing on the contact form for 1334 and 508,
which should redirect to TurboTenant. **Never reproduced.** The redirects are
correct locally on every check, and the Actions deploy log confirms the Pages
project uploads a Functions bundle on every push.

The outstanding diagnostic, which needs a browser outside the agent sandbox
(the egress proxy blocks the domain and every `*.cloudflare.com` host):

| URL | Meaning |
|---|---|
| `reignpropertyholdings.pages.dev/apply/1334-tricou-st` | the Pages project directly |
| `reignpropertyholdings.com/apply/1334-tricou-st` | whatever serves the domain |

If they disagree, the apex is served by something other than Pages — see the
Worker item in section 4.

## 4. Prioritized backlog

Everything the 2026-08-24 list had under High is done, along with most of
Medium and Low. What remains:

### Real and open

- **The Worker deploy drops every Function.** `package.json` compiles the
  Pages Functions to `./dist/worker`, and `wrangler.jsonc` has no `main`
  pointing at it, so a Worker deploy serves static assets only. Measured with
  `wrangler dev`: `/` returns 200 while `/apply/*`, `/portal` and `/api/*`
  return **404**. Latent if Pages serves the domain, live if the Worker does
  (section 3a).
  Adding `main` fixes it locally but **turned both Workers Builds checks red**
  — and that is not the historical branch flakiness, since #8's own branch head
  was green. Cause undetermined between (a) `dist/worker/index.js` missing at
  deploy time, i.e. the configured build command does not run `npm run build`,
  and (b) bundling a Worker validating `compatibility_date: 2026-08-29`, which
  an assets-only deploy skips and which a local workerd rejected as too new.
  The build log is dashboard-only. Do not re-add `main` blind.
- **Two deploy paths run on every push.** Actions runs `wrangler pages deploy`;
  Workers Builds runs `versions upload`/`deploy`. Both ship the same site to
  different places. Recommendation is to keep Pages and disconnect the Workers
  git integration, which also retires the historically red check — but it is
  the owner's call.
- **Wrangler version split.** `wrangler-action` installs **3.90.0**;
  `package.json` declares **^4.127.1**. Two majors build this site depending on
  path.
- **Property schema has no `offers`.** Needs rent figures (section 3.6).
  `url` and `potentialAction` are already there.
- **Three footer links, one destination.** Resident Portal, Pay Rent and
  Maintenance Request all land on `rental.turbotenant.com/` root, because
  `PORTAL_URL_FALLBACK` is the renter site root. Deep links would need to come
  from the dashboard. Left alone deliberately: collapsing visitor-facing nav
  links is a content decision.
- **No env templating.** No `.dev.vars.example`, so `wrangler pages dev` starts
  with everything unset and a newcomer has to read `stays.js` to learn the
  variable names.

### Fixed since the last handoff

`utm_*` attribution on apply redirects · `/apply/start` no longer a mislabeled
dead end · HEAD returns 302 rather than 405 on both redirect routes ·
`LISTINGS[].page` wired into the contact fallback with a back-link ·
`url` + `potentialAction` in property schema · 508 retyped from `Apartment` to
`SingleFamilyResidence` · `404.html` · `robots.txt` disallows the redirect
endpoints · responsive WebP images · minimum-two-tags rule with CI ·
stale `TURBOTENANT_APPLY_URL_508_AVENUE_E` comment.

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
- **`npm test`** runs the iCal and tag suites. Neither has dependencies, so CI
  needs no install step.
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
