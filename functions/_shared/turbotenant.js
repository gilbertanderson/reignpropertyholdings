// Shared TurboTenant configuration.
//
// Reign Property Holdings uses TurboTenant for online rental applications,
// screening, and the resident portal. A listing's public TurboTenant URL can
// be checked in below, and each one can also be set or overridden as a
// Cloudflare Pages environment variable so it can be re-pointed without a
// deploy:
//
//   TURBOTENANT_APPLY_URL                  Account-wide "Apply Now" link (/apply/start, and fallback)
//   TURBOTENANT_APPLY_URL_1332_TRICOU_ST   Per-listing application link
//   TURBOTENANT_APPLY_URL_1334_TRICOU_ST   Per-listing application link
//   TURBOTENANT_PORTAL_URL                 Resident portal login (optional)
//
// Any listing without a configured link falls back to the contact form, so a
// missing variable never produces a dead "Apply" button.

export const PORTAL_URL_FALLBACK = "https://rental.turbotenant.com/";

// Only TurboTenant-owned hosts may be redirected to, so a mistyped or
// tampered environment variable can't turn /apply into an open redirect.
const ALLOWED_HOST_SUFFIXES = ["turbotenant.com", "turbotenant.io"];

export const LISTINGS = {
  "1332-tricou-st": {
    name: "1332 Tricou St",
    envKey: "TURBOTENANT_APPLY_URL_1332_TRICOU_ST",
    page: "/property-1332-tricou-st.html",
  },
  "1334-tricou-st": {
    name: "1334 Tricou St",
    envKey: "TURBOTENANT_APPLY_URL_1334_TRICOU_ST",
    page: "/property-1334-tricou-st.html",
    // Public TurboTenant listing, available September. The env var above
    // overrides this when the listing moves or is taken down.
    url: "https://rental.turbotenant.com/p/1332-1334-tricou-st-new-orleans-la-unit-1334/bdeb7acd-242d-4391-8134-e403717fc77f",
  },
};

export function isTurboTenantUrl(value) {
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

// Resolves the application URL for a listing slug. Returns null when nothing
// usable is configured, letting the caller fall back to the contact form.
export function resolveApplyUrl(env, slug) {
  const listing = slug ? LISTINGS[slug] : null;
  // Most specific first: this listing's env var, then its checked-in listing
  // URL, then the account-wide env var.
  const candidates = [
    listing && env[listing.envKey],
    listing && listing.url,
    env.TURBOTENANT_APPLY_URL,
  ];
  for (const candidate of candidates) {
    if (isTurboTenantUrl(candidate)) return candidate.toString().trim();
  }
  return null;
}

export function resolvePortalUrl(env) {
  return isTurboTenantUrl(env.TURBOTENANT_PORTAL_URL)
    ? env.TURBOTENANT_PORTAL_URL.toString().trim()
    : PORTAL_URL_FALLBACK;
}

export function contactFallbackUrl(slug) {
  const listing = slug ? LISTINGS[slug] : null;
  return listing
    ? `/contact.html?property=${encodeURIComponent(listing.name)}&apply=1`
    : "/contact.html?apply=1";
}

export function redirect(url) {
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "no-store" },
  });
}

// Slug for the account-wide application, i.e. /apply/start. The bare /apply
// path is the static apply.html page, so the general application lives here.
export const GENERAL_SLUG = "start";

// Shared handler behind /apply/<slug>.
export function handleApply(env, rawSlug) {
  let slug = (rawSlug || "").toString().toLowerCase();
  if (slug === GENERAL_SLUG) slug = "";

  // Unknown listing slug: send them to the properties index rather than
  // starting an application for a home we don't have.
  if (slug && !LISTINGS[slug]) {
    return redirect("/properties.html");
  }

  const applyUrl = resolveApplyUrl(env, slug);
  return redirect(applyUrl || contactFallbackUrl(slug));
}
