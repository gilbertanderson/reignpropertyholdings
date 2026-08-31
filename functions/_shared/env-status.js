// Reports which Pages Function environment variables are set, without
// revealing values. Used by /api/status so dashboard gaps are visible from
// the live site after deploy.

const KEYS = [
  { key: "SENDGRID_API_KEY", group: "contact", required: true },
  { key: "CLOUDFLARE_WEB_ANALYTICS_TOKEN", group: "analytics" },
  { key: "TURBOTENANT_APPLY_URL", group: "turbotenant" },
  { key: "TURBOTENANT_APPLY_URL_1332_TRICOU_ST", group: "turbotenant" },
  { key: "TURBOTENANT_APPLY_URL_1334_TRICOU_ST", group: "turbotenant" },
  { key: "TURBOTENANT_APPLY_URL_508_AVENUE_E", group: "turbotenant" },
  { key: "TURBOTENANT_PORTAL_URL", group: "turbotenant" },
  { key: "STAYS_ICAL_1332_VRBO", group: "stays", slug: "1332-tricou-st" },
  { key: "STAYS_ICAL_1332_AIRBNB", group: "stays", slug: "1332-tricou-st" },
  { key: "STAYS_ICAL_1334_VRBO", group: "stays", slug: "1334-tricou-st" },
  { key: "STAYS_ICAL_1334_AIRBNB", group: "stays", slug: "1334-tricou-st" },
];

function isSet(env, key) {
  const value = env[key];
  return typeof value === "string" && value.trim().length > 0;
}

export function envStatus(env) {
  const variables = Object.fromEntries(
    KEYS.map(({ key, required }) => [
      key,
      { set: isSet(env, key), ...(required ? { required: true } : {}) },
    ])
  );

  const missingRequired = KEYS.filter(
    ({ key, required }) => required && !isSet(env, key)
  ).map(({ key }) => key);

  const stays = {
    "1332-tricou-st": KEYS.filter(
      (entry) => entry.group === "stays" && entry.slug === "1332-tricou-st"
    ).every((entry) => isSet(env, entry.key)),
    "1334-tricou-st": KEYS.filter(
      (entry) => entry.group === "stays" && entry.slug === "1334-tricou-st"
    ).every((entry) => isSet(env, entry.key)),
  };

  return {
    ok: missingRequired.length === 0,
    variables,
    stays,
    missingRequired,
    analytics: isSet(env, "CLOUDFLARE_WEB_ANALYTICS_TOKEN"),
    contact: isSet(env, "SENDGRID_API_KEY"),
  };
}
