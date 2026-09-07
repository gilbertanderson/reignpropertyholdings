import { listingAvailability } from "../_shared/turbotenant.js";

// Long-term lease availability for property cards / detail pages.
// Driven by checked-in TurboTenant listing flags (+ optional Pages env
// overrides). Not a live TurboTenant feed — that product has no public API.

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method not allowed" }, 405);
  }

  const body = { listings: listingAvailability(env) };

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return json(body);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
