import { envStatus } from "../_shared/env-status.js";

// Safe configuration probe for Cloudflare Pages env vars. Returns booleans
// only — never secret values — so gaps are visible after deploy.
export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method not allowed" }, 405);
  }

  const body = envStatus(env);
  if (request.method === "HEAD") {
    return new Response(null, {
      status: body.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return json(body, body.ok ? 200 : 503);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
