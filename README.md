# reignpropertyholdings
reignpropertyholdings.com

Static marketing site for Reign Property Holdings LLC, deployed to Cloudflare
Pages (`public/`) with Cloudflare Pages Functions (`functions/`).

## TurboTenant integration

Rental applications, screening, and the resident portal run on TurboTenant. The
site links to internal routes that redirect to TurboTenant. A listing's public
TurboTenant URL can live in `functions/_shared/turbotenant.js`, and every
listing can also be pointed or re-pointed with an environment variable — no
deploy needed.

Both listings are checked in. **1334 Tricou St** is open for September and its
Apply button goes to TurboTenant. **1332 Tricou St** is marked
`available: false` — its listing URL is recorded, but Apply goes to the contact
form until that flips to `true`.

| Route | Goes to |
| --- | --- |
| `/apply` | Account-wide TurboTenant application |
| `/apply/1332-tricou-st` | Application for 1332 Tricou St |
| `/apply/1334-tricou-st` | Application for 1334 Tricou St |
| `/portal` | TurboTenant resident portal (pay rent, maintenance requests) |
| `/apply.html` | On-site page explaining the application process |

### Environment variables

Set these in the Cloudflare Pages project (Settings → Environment variables):

| Variable | Required | Purpose |
| --- | --- | --- |
| `TURBOTENANT_APPLY_URL` | no | Fallback application link used when a listing has no link of its own |
| `TURBOTENANT_APPLY_URL_1332_TRICOU_ST` | no | Application link for 1332 Tricou St — also overrides its `available: false` |
| `TURBOTENANT_APPLY_URL_1334_TRICOU_ST` | no | Overrides the checked-in link for 1334 Tricou St |
| `TURBOTENANT_PORTAL_URL` | no | Resident portal link (defaults to `https://rental.turbotenant.com/`) |
| `SENDGRID_API_KEY` | yes | Sends contact-form submissions |

Resolution order per listing: its environment variable, then its checked-in
`url`, then the account-wide `TURBOTENANT_APPLY_URL`. A listing marked
`available: false` considers only its own environment variable, so an
unavailable home never falls through to a generic application.

Only `https://` URLs on `turbotenant.com` / `turbotenant.io` hosts are accepted,
so a mistyped variable can't turn `/apply` into an open redirect. When a
listing's link is missing or rejected, `/apply/<slug>` falls back to the contact
form (prefilled with that property) instead of a dead link — the "Apply" buttons
stay safe to ship before the TurboTenant listings are live.

### Adding a property

1. Add the listing to `LISTINGS` in `functions/_shared/turbotenant.js` (slug,
   display name, detail page path, its TurboTenant `url` if there is one, and
   `available`).
2. Or set its `TURBOTENANT_APPLY_URL_<SLUG>` variable in Cloudflare Pages.
3. Link to `/apply/<slug>` from the property page, card, and `apply.html`.
