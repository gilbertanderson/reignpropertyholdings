// Cloudflare Web Analytics injection for static HTML pages.
//
// The checked-in HTML carries a placeholder token so the site can be previewed
// without secrets. At request time, _middleware.js swaps in
// CLOUDFLARE_WEB_ANALYTICS_TOKEN from the environment, or strips the beacon
// script when the variable is unset so a broken placeholder never ships.

export const ANALYTICS_PLACEHOLDER = "REPLACE_WITH_CLOUDFLARE_ANALYTICS_TOKEN";

const BEACON_SCRIPT =
  '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token": "REPLACE_WITH_CLOUDFLARE_ANALYTICS_TOKEN"}\'></script>';

export function injectAnalytics(html, token) {
  if (!html || !html.includes(ANALYTICS_PLACEHOLDER)) return html;

  if (!token || !token.toString().trim()) {
    return html.replace(BEACON_SCRIPT, "");
  }

  return html.replaceAll(ANALYTICS_PLACEHOLDER, token.toString().trim());
}
