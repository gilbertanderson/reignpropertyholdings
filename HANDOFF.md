# Handoff — reignpropertyholdings.com

Written 2026-08-24. Picks up at commit `9ca6e66` on `main`, working tree clean.

This document exists so the next agent can continue without re-deriving anything. The
research section matters most: it closes off a direction that looks obvious but is a dead
end, and doing so cost a lot of verification effort.

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

These are blocked on dashboard access and cannot be resolved from the repo:

1. The **embed snippet / account id** (section 2a) — must be copied from Account → Settings → Advanced.
2. **Which `TURBOTENANT_*` env vars are actually set** in the Cloudflare Pages dashboard.
   Nothing in the repo records them, so several items in section 4 are written assuming unset.
3. The **Cloudflare Web Analytics token** — every page still ships the literal placeholder
   `REPLACE_WITH_CLOUDFLARE_ANALYTICS_TOKEN` (verified: all 8 pages).
4. Whether **SendGrid sender verification** has been completed for the contact form.

---

## 4. Prioritized backlog

Verification status is marked because it matters: items I confirmed myself are safe to act
on directly; items reported by a research subagent should be re-checked first. One audit
claim ("sitemap.xml is a broken build artifact") **did not reproduce** — the sitemap is
valid with 8 well-formed URLs. Treat unverified items with that in mind.

### High value

- ~~**[VERIFIED] Photo-count badges are wrong.**~~ *Fixed in `4a8fedd`.* `properties.html` and `index.html` claim
  "5 photos" for 1332 and 1334, but each gallery renders only 4 thumbnails. Two images ship
  but are referenced by nothing: `public/images/properties/1332-tricou/kitchen-dining.jpg`
  (1600x1099) and `public/images/properties/1334-tricou/living-room.jpg` (1600x1200).
  **Preferred fix: add them as 5th thumbnails** so the badge becomes true, rather than
  downgrading the badge to 4. Gallery markup pattern is at
  `public/property-1332-tricou-st.html:99-113`.
- ~~**[VERIFIED] Ownership copy contradicts the rest of the site.**~~ *Fixed in `4a8fedd`.* Both Tricou pages say
  "owned and managed by Reign Property Holdings" (3 occurrences each — meta description, og,
  twitter). Site-wide line is "owned by RPH, **managed by StrikeWorks**"
  (`about.html:125`, `index.html:132`, `properties.html:76`).
- **[UNVERIFIED] No lead attribution on apply redirects.** `redirect()` in
  `functions/_shared/turbotenant.js` forwards the URL verbatim — no `utm_source`/`utm_medium`
  /`utm_campaign`, no originating slug. Applications landing in TurboTenant cannot be traced
  back to the website or to which page produced them. This is the single best
  measurement win available and is purely local work.
- **[UNVERIFIED] `/apply/start` is a dead end.** It resolves only through
  `env.TURBOTENANT_APPLY_URL`, which is set nowhere in the repo, and there is no checked-in
  fallback constant (compare `PORTAL_URL_FALLBACK`). It currently 302s to the contact form.
- ~~**[UNVERIFIED] `available:false` is invisible in the HTML.**~~ *Fixed in `4a8fedd` —
  confirmed true, and 1332's CTAs now reflect it.* 1332 renders normal "Apply"
  buttons on `index.html`, `properties.html`, and `apply.html` that all silently bounce to
  the contact form. No `unavailable`/`coming-soon` badge class exists in `style.css`.

### Medium

- **[UNVERIFIED] Portal fallback is not a portal.** `PORTAL_URL_FALLBACK` is
  `https://rental.turbotenant.com/` — the renter site root. The three distinct footer links
  (Resident Portal, Pay Rent, Maintenance Request) all land on the same generic page.
- **[UNVERIFIED] `LISTINGS[].page` is a dead field** — defined but read by nothing, so the
  contact fallback drops visitors on a bare form with no link back to the home they wanted.
- **[UNVERIFIED] Redirect routes export only `onRequestGet`** — HEAD gets a 405, which
  breaks link checkers and some crawlers.
- **[UNVERIFIED] Property JSON-LD has no application signal** — no `url`, no `Offer` with
  price/availability, no `potentialAction` pointing at `/apply/<slug>`.
- **[UNVERIFIED] README route table is wrong** — claims `/apply` is the account-wide
  application; it actually serves static `apply.html`. Omits `/apply/508-avenue-e` and
  `/apply/start`.
- **[UNVERIFIED] Stale env comment** in `functions/_shared/turbotenant.js` omits
  `TURBOTENANT_APPLY_URL_508_AVENUE_E`.

### Low

- No `_headers` file, so no `Referrer-Policy` governing what leaks on the outbound
  TurboTenant hop. No `404.html`.
- `robots.txt` is a blanket `Allow: /`, so `/apply/*` and `/portal` redirects are crawlable.
- Duplicated footer nav targets (two links to `apply.html`; three labels for one `/portal`).
- Contact fallback copy says "Online applications for this home aren't open right now" even
  on the `/apply/start` path where the visitor never picked a home.
- No env var templating: no `wrangler.toml`, no `.dev.vars.example`. `wrangler pages dev`
  starts with everything unset.

---

## 5. Furnished stays (Airbnb / VRBO) — shipped

Both Tricou units are listed on VRBO and Airbnb for **30+ night stays** (New Orleans
restricts residential short-term rentals). Long-term leasing is still the goal; the stays
fill gaps between leases. Do not let site copy imply nightly or weekly stays.

| Unit | VRBO | Airbnb |
|---|---|---|
| 1332 Tricou St (2BR/2BA) | [5063788](https://www.vrbo.com/5063788) | room `832710289760465793` ("Jazz House") — **not linked**, see below |
| 1334 Tricou St (2BR/1BA) | [5063799](https://www.vrbo.com/5063799) | [700851692178654878](https://www.airbnb.com/rooms/700851692178654878) ("Mardi Gras Mamba House") |

1332's Airbnb page currently **404s publicly** because the listing is snoozed while booked,
so `stays.js` deliberately leaves `airbnb: null` for it — a button to a dead page is worse
than no button. Its iCal feed still works while hidden. Set the URL once the listing is
visible again.

**No Airbnb/VRBO API is involved and none is needed.** Availability comes from each
platform's iCal export, proxied by `functions/api/availability.js` (required: neither
platform sends CORS headers). Feed URLs carry calendar access tokens — env vars only,
never committed. `.dev.vars` is gitignored as of this work; it was not before.

Still outstanding here:
- `STAYS_ICAL_*` env vars in Cloudflare Pages (only `1332_AIRBNB` has been tested locally).
- Confirm 30 nights is the correct published floor — Airbnb doesn't expose the minimum-stay
  setting to an unauthenticated fetch, so it could not be verified independently.
- Confirm room `832710289760465793` is in fact 1332 and not another unit; it was inferred
  from the calendar link supplied alongside a question about 1332, and its public page
  404s so it could not be checked directly.

## 6. What changed this session

| Commit | Change |
|---|---|
| `76d8594` | 508 card badge "StrikeWorks" → "Single Family" |
| `215662f` | Featured 508 Avenue E on homepage (2nd position), portfolio stat 2 → 3 |
| `f9d2bf5` | Trimmed homepage Featured properties to first two cards |
| `9b48bb8` | Added woman-owned (RPH) / veteran-owned (StrikeWorks) designations site-wide |
| `2e3edea` | Higher-res StrikeWorks logo (320x320, transparent bg) |
| `9ca6e66` | Compacted property gallery |
| `5125acf` | This handoff document |
| `4a8fedd` | Furnished-stays feature + iCal availability API; fixed 1332's dead Apply CTAs, photo-count badges, ownership copy |

Earlier in the session, 508 Avenue E was added as a full property page with 5 photos
sourced from the owner's own Redfin listing (owner confirmed they hold the rights).

**Gallery fix detail, since it is easy to regress:** the old layout was a `2fr 1fr` grid with
thumbnails stacked in the right column, each carrying `aspect-ratio: 4/3`. That aspect ratio
overrode the `1fr` rows, so the thumbnail column outgrew the main photo — roughly 1100px of
thumbs against a ~507px image, leaving hundreds of px of dead space beneath it, and about
double that on the 8-photo 508 page. It is now a full-bleed main photo plus an auto-fit
thumbnail strip; 4 and 8 photos cost identical vertical space (measured 590px on 508, down
from ~2200px).

One CSS gotcha worth not relearning: `aspect-ratio` combined with `max-height` shrinks the
element's **width** to preserve the ratio once height clamps, which just moves the dead space
from below the image to the right of it. `.gallery-main` therefore uses
`height: clamp(240px, 40vw, 480px)` with no `aspect-ratio`.

Note the homepage intentionally shows only 2 of 3 properties — that was an explicit owner
decision, not an oversight. A stale audit note calls it a gap; it is not.

---

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
