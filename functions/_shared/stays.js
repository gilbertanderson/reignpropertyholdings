// Shared configuration for the Tricou furnished-stay listings.
//
// Both Tricou units are also listed on VRBO and Airbnb for stays of 30 nights
// or more. New Orleans restricts short-term rentals in residential areas, so
// these are mid-term furnished stays — relocations, traveling medical staff,
// insurance placements — and not nightly vacation rentals. Nothing here or in
// the UI should imply otherwise.
//
// Long-term leasing through TurboTenant (see ./turbotenant.js) is still the
// goal; these stays fill the gaps between leases.
//
// Availability is read from each platform's own iCal export. Those URLs carry
// an access token that grants read access to the booking calendar, so they
// live only in environment variables and are never checked in:
//
//   STAYS_ICAL_1332_VRBO     VRBO reservation calendar export for 1332
//   STAYS_ICAL_1332_AIRBNB   Airbnb calendar export for 1332
//   STAYS_ICAL_1334_VRBO     VRBO reservation calendar export for 1334
//   STAYS_ICAL_1334_AIRBNB   Airbnb calendar export for 1334
//
// A listing with no configured feed simply renders no availability line, the
// same way a missing TURBOTENANT_* variable degrades to the contact form.

// Minimum stay we advertise, in nights. Publishing a floor lower than what the
// city allows would be a compliance problem, not a cosmetic one — change this
// only against the actual listing settings.
export const MIN_NIGHTS = 30;

// Only these hosts may be linked as booking destinations, so a mistyped or
// tampered value can't turn a "Book" button into an open redirect. Mirrors
// ALLOWED_HOST_SUFFIXES / isTurboTenantUrl in ./turbotenant.js.
const ALLOWED_HOST_SUFFIXES = [
  "vrbo.com",
  "homeaway.com",
  "airbnb.com",
  "abnb.me",
];

// Platform URLs are stored canonically. The links these came from carried
// utm_* / haExternalSourceId / search_mode tracking parameters from
// notification emails and search sessions; none of that belongs on the site.
export const STAYS = {
  "1332-tricou-st": {
    name: "1332 Tricou St",
    vrbo: "https://www.vrbo.com/5063788",
    // The Airbnb listing for this unit (room 832710289760465793, "Jazz
    // House") is snoozed while it's booked, and its public /rooms/ page
    // currently 404s — linking it would hand visitors a dead page, which is
    // worse than showing no Airbnb button at all. Availability still works:
    // the iCal export below keeps serving while the listing is hidden. Set
    // this once the listing is publicly visible again.
    airbnb: null,
    ical: { vrbo: "STAYS_ICAL_1332_VRBO", airbnb: "STAYS_ICAL_1332_AIRBNB" },
  },
  "1334-tricou-st": {
    name: "1334 Tricou St",
    vrbo: "https://www.vrbo.com/5063799",
    airbnb: "https://www.airbnb.com/rooms/700851692178654878",
    ical: { vrbo: "STAYS_ICAL_1334_VRBO", airbnb: "STAYS_ICAL_1334_AIRBNB" },
  },
};

export function isStayUrl(value) {
  if (!value) return false;
  let url;
  try {
    url = new URL(value.toString().trim());
  } catch (err) {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

// The booking links to render for a slug, in display order. Platforms without
// a configured URL are omitted rather than rendered dead.
export function stayLinks(slug) {
  const listing = slug ? STAYS[slug] : null;
  if (!listing) return [];
  return [
    { source: "vrbo", label: "Vrbo", url: listing.vrbo },
    { source: "airbnb", label: "Airbnb", url: listing.airbnb },
  ].filter((link) => isStayUrl(link.url));
}

// Configured iCal feeds for a slug. Returns [] when nothing is set, which the
// availability endpoint treats as "don't show an availability line at all".
export function icalFeeds(env, slug) {
  const listing = slug ? STAYS[slug] : null;
  if (!listing) return [];
  return Object.entries(listing.ical)
    .map(([source, envKey]) => ({ source, url: env[envKey] }))
    .filter((feed) => {
      if (!feed.url) return false;
      try {
        return new URL(feed.url.toString().trim()).protocol === "https:";
      } catch (err) {
        return false;
      }
    })
    .map((feed) => ({ source: feed.source, url: feed.url.toString().trim() }));
}
