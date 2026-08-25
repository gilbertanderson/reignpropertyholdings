// Availability for the Tricou furnished stays, read from the booking
// platforms' own iCal exports.
//
// This has to run server-side: Airbnb and VRBO serve their iCal endpoints
// without an Access-Control-Allow-Origin header, so a browser fetch from the
// static site fails on CORS. The Function proxies the request.
//
// Feed URLs come from environment variables only (see ../_shared/stays.js) —
// they contain an access token for the booking calendar and must never be
// checked in.

import { MIN_NIGHTS, STAYS, icalFeeds } from "../_shared/stays.js";

const DAY_MS = 86400000;

// Platforms refresh their exports every 30 minutes to a few hours, so a
// tighter cache would just burn requests without being any fresher.
const CACHE_SECONDS = 1800;

// A feed that hangs shouldn't hold the response open.
const FETCH_TIMEOUT_MS = 5000;

// How far ahead to report booked ranges. Beyond this the calendar is mostly
// noise for someone deciding on a stay.
const HORIZON_DAYS = 365;

// RFC 5545 folds long lines by inserting CRLF followed by a space or tab.
// Unfold before parsing or a folded DTSTART silently fails to match.
export function unfoldIcs(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

// Accepts both the all-day form (20260901) and the datetime form
// (20260901T140000Z). Returns UTC midnight so day math stays exact.
export function parseIcsDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(String(value).trim());
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function readProp(block, name) {
  // The property may carry parameters, e.g. DTSTART;VALUE=DATE:20260901
  const re = new RegExp(`(?:^|\\n)${name}(?:;[^:\\n]*)?:([^\\r\\n]+)`);
  const match = re.exec(block);
  return match ? parseIcsDate(match[1]) : null;
}

// Extracts busy ranges as [start, end) in epoch ms.
export function parseBusyRanges(ics) {
  const text = unfoldIcs(String(ics));
  const ranges = [];
  const eventRe = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;
  while ((match = eventRe.exec(text)) !== null) {
    const block = match[1];
    const start = readProp(block, "DTSTART");
    if (start === null) continue;
    // DTEND is exclusive in iCal: a booking with DTEND 20260910 frees the
    // 10th. When DTEND is absent the event covers a single day.
    const end = readProp(block, "DTEND");
    const endMs = end === null ? start + DAY_MS : end;
    if (endMs > start) ranges.push({ start, end: endMs });
  }
  return ranges;
}

// Collapses overlapping and touching ranges so gap math is straightforward.
export function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

// The first date from which a stay of at least minNights fits without hitting
// a booking. With a 30-night floor a nightly calendar isn't much use — this
// single date is what someone actually needs to know.
export function nextAvailableFrom(busy, minNights, fromMs) {
  const needed = minNights * DAY_MS;
  const merged = mergeRanges(busy.filter((range) => range.end > fromMs));
  let cursor = fromMs;
  for (const range of merged) {
    if (range.start - cursor >= needed) return cursor;
    cursor = Math.max(cursor, range.end);
  }
  // Nothing blocking far enough out — open from the end of the last booking.
  return cursor;
}

function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function json(body, status = 200, cacheSeconds = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheSeconds
        ? `public, max-age=${cacheSeconds}`
        : "no-store",
    },
  });
}

async function fetchFeed(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/calendar, text/plain, */*" },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (err) {
    // A platform being slow or down is not an error worth surfacing to a
    // visitor — the availability line just doesn't render.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") || "").toLowerCase().trim();

  if (!STAYS[slug]) {
    // Not a stay listing (or not a listing at all). Same shape as the
    // nothing-configured case so the client has one branch to handle.
    return json({ available: null }, 200, CACHE_SECONDS);
  }

  const feeds = icalFeeds(env, slug);
  if (!feeds.length) {
    return json({ available: null, reason: "not-configured" }, 200, CACHE_SECONDS);
  }

  const results = await Promise.all(
    feeds.map(async (feed) => ({
      source: feed.source,
      text: await fetchFeed(feed.url),
    }))
  );

  const ok = results.filter((result) => result.text !== null);
  if (!ok.length) {
    // Every feed failed. Report nothing rather than claiming the home is wide
    // open, which would be worse than showing no availability at all.
    return json({ available: null, reason: "unreachable" }, 200);
  }

  const busy = ok.flatMap((result) => parseBusyRanges(result.text));
  const today = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  );
  const horizon = today + HORIZON_DAYS * DAY_MS;

  const merged = mergeRanges(busy).filter(
    (range) => range.end > today && range.start < horizon
  );

  return json(
    {
      available: true,
      slug,
      minNights: MIN_NIGHTS,
      availableFrom: isoDay(nextAvailableFrom(busy, MIN_NIGHTS, today)),
      busyRanges: merged.map((range) => ({
        from: isoDay(range.start),
        to: isoDay(range.end),
      })),
      sources: ok.map((result) => result.source),
    },
    200,
    CACHE_SECONDS
  );
}
