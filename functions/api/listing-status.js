// Leased status for a TurboTenant listing, read from the committed config
// rather than TurboTenant itself.
//
// TurboTenant has no public API, iCal feed, or webhooks (see HANDOFF.md §1) —
// there is no live source to poll the way /api/availability polls Airbnb and
// VRBO. Scraping TurboTenant's own pages was considered and rejected: this
// account has been suspended by their Trust & Safety team once already, and
// automated requests to their site are exactly what would risk that again.
//
// So `leased` is authored by hand in LISTINGS (../_shared/turbotenant.js) and
// this endpoint just echoes it. The "live update" this buys is real, just
// not automatic: flip the flag, redeploy, and the card and detail page pick
// it up from one place instead of needing hand-edited prose in three files.

import { LISTINGS } from "../_shared/turbotenant.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Static, committed data — cacheable, but short enough that flipping
      // the flag and redeploying shows up quickly without a hard refresh.
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function onRequest({ request }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") || "").toLowerCase().trim();
  const listing = LISTINGS[slug];

  if (!listing) {
    return json({ leased: null });
  }

  return json({ leased: listing.leased === true });
}
