import { injectAnalytics } from "./_shared/analytics.js";

// Injects Cloudflare Web Analytics into HTML responses when
// CLOUDFLARE_WEB_ANALYTICS_TOKEN is configured. Static assets and API routes
// pass through unchanged.
export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const updated = injectAnalytics(html, context.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN);
  if (updated === html) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(updated, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
