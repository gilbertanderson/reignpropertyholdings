# reignpropertyholdings
reignpropertyholdings.com

Static marketing site for Reign Property Holdings LLC, deployed to Cloudflare
Pages (`public/`) with Cloudflare Pages Functions (`functions/`).

## TurboTenant integration

Rental applications, screening, and the resident portal run on TurboTenant. The
site never hardcodes TurboTenant URLs — it links to internal routes that redirect
using environment variables, so listings can be re-pointed without a deploy.

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
| `TURBOTENANT_APPLY_URL_1332_TRICOU_ST` | no | Application link for 1332 Tricou St |
| `TURBOTENANT_APPLY_URL_1334_TRICOU_ST` | no | Application link for 1334 Tricou St |
| `TURBOTENANT_PORTAL_URL` | no | Resident portal link (defaults to `https://rental.turbotenant.com/`) |
| `SENDGRID_API_KEY` | yes | Sends contact-form submissions |

Only `https://` URLs on `turbotenant.com` / `turbotenant.io` hosts are accepted,
so a mistyped variable can't turn `/apply` into an open redirect. When a
listing's link is missing or rejected, `/apply/<slug>` falls back to the contact
form (prefilled with that property) instead of a dead link — the "Apply" buttons
stay safe to ship before the TurboTenant listings are live.

### Adding a property

1. Add the listing to `LISTINGS` in `functions/_shared/turbotenant.js` (slug,
   display name, detail page path).
2. Set its `TURBOTENANT_APPLY_URL_<SLUG>` variable in Cloudflare Pages.
3. Link to `/apply/<slug>` from the property page, card, and `apply.html`.
