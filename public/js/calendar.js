// Availability calendar for the furnished-stay listings.
//
// Renders a month grid from the busy ranges that /api/availability already
// derives from the Airbnb and VRBO iCal exports. This is a *display* calendar,
// not a booking engine: the stays have a 30-night floor (see
// functions/_shared/stays.js — New Orleans restricts short-term rentals in
// residential areas), and the reservation itself is still made on whichever
// platform the guest prefers. Nothing here should imply nightly booking.
//
// Loaded as a module so the pure date helpers below can be imported directly
// by test/calendar.test.mjs. Everything above renderInto() is side-effect free.

export const DAY_MS = 86400000;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// How many months a visitor can page through. The API caps busy ranges at a
// 365-day horizon, so going beyond a year would show empty months that only
// look available because we have no data that far out.
export const MAX_MONTHS = 12;

// "2026-09-01" -> UTC midnight ms. Returns null on anything unparseable so a
// malformed range is dropped rather than poisoning the whole grid.
export function parseDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(ms) ? null : ms;
}

export function startOfUtcDay(ms) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// The API's {from, to} strings -> {start, end} in ms. `to` is exclusive,
// matching iCal's DTEND, so a booking ending 2026-09-10 frees the 10th.
export function toRanges(busyRanges) {
  if (!Array.isArray(busyRanges)) return [];
  return busyRanges
    .map((range) => ({
      start: parseDay(range && range.from),
      end: parseDay(range && range.to),
    }))
    .filter((range) => range.start !== null && range.end !== null && range.end > range.start);
}

export function isBusy(dayMs, ranges) {
  return ranges.some((range) => dayMs >= range.start && dayMs < range.end);
}

// One month of cells, padded with nulls so the first of the month lands in the
// right weekday column. Sunday-first, matching how US booking sites read.
export function buildMonth(year, month, ranges, todayMs) {
  const firstMs = Date.UTC(year, month, 1);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leading = new Date(firstMs).getUTCDay();

  const cells = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const ms = Date.UTC(year, month, day);
    const iso = new Date(ms).toISOString().slice(0, 10);
    cells.push({
      day,
      iso,
      ms,
      past: ms < todayMs,
      today: ms === todayMs,
      // A past date is neither bookable nor worth flagging as booked.
      busy: ms >= todayMs && isBusy(ms, ranges),
    });
  }

  // Pad the tail so every month renders a rectangular grid.
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { year, month, label: `${MONTH_NAMES[month]} ${year}`, weeks };
}

// Advances a {year, month} pair by `delta` months, normalising the rollover.
export function addMonths(year, month, delta) {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

// ---------------------------------------------------------------------------
// Rendering. Below this line everything touches the DOM.
// ---------------------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderMonth(month) {
  const wrap = el("div", "cal-month");
  wrap.appendChild(el("h4", "cal-month-label", month.label));

  const table = el("table", "cal-grid");
  // The grid is a visual summary of data already stated in prose above it,
  // so it is presentational to a screen reader rather than a data table to
  // navigate cell by cell.
  table.setAttribute("role", "presentation");

  const thead = el("thead");
  const headRow = el("tr");
  WEEKDAYS.forEach((name) => {
    const th = el("th", null, name);
    th.setAttribute("scope", "col");
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  month.weeks.forEach((week) => {
    const row = el("tr");
    week.forEach((cell) => {
      if (!cell) {
        row.appendChild(el("td", "cal-day cal-empty"));
        return;
      }
      let className = "cal-day";
      if (cell.past) className += " is-past";
      else if (cell.busy) className += " is-booked";
      else className += " is-open";
      if (cell.today) className += " is-today";

      const td = el("td", className, String(cell.day));
      td.setAttribute("data-date", cell.iso);
      if (!cell.past) {
        td.title = `${cell.iso} — ${cell.busy ? "booked" : "available"}`;
      }
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function renderInto(container, data, todayMs) {
  const ranges = toRanges(data.busyRanges);
  // Two months at a time reads well on a phone and matches how the booking
  // platforms present their own calendars.
  const visible = 2;
  let offset = 0;

  const nav = el("div", "cal-nav");
  const prev = el("button", "cal-nav-btn", "‹");
  const next = el("button", "cal-nav-btn", "›");
  prev.type = "button";
  next.type = "button";
  prev.setAttribute("aria-label", "Previous months");
  next.setAttribute("aria-label", "Next months");
  const status = el("span", "cal-nav-status");
  nav.appendChild(prev);
  nav.appendChild(status);
  nav.appendChild(next);

  const months = el("div", "cal-months");

  const legend = el("div", "cal-legend");
  [
    ["is-open", "Available"],
    ["is-booked", "Booked"],
  ].forEach(([cls, label]) => {
    const item = el("span", "cal-legend-item");
    item.appendChild(el("span", `cal-swatch ${cls}`));
    item.appendChild(el("span", null, label));
    legend.appendChild(item);
  });

  const base = new Date(todayMs);
  const baseYear = base.getUTCFullYear();
  const baseMonth = base.getUTCMonth();

  function draw() {
    months.textContent = "";
    for (let i = 0; i < visible; i += 1) {
      const { year, month } = addMonths(baseYear, baseMonth, offset + i);
      months.appendChild(renderMonth(buildMonth(year, month, ranges, todayMs)));
    }
    prev.disabled = offset === 0;
    next.disabled = offset + visible >= MAX_MONTHS;

    // Each month already carries its own heading, so the nav names the span
    // rather than repeating the first month's label.
    const first = addMonths(baseYear, baseMonth, offset);
    const last = addMonths(baseYear, baseMonth, offset + visible - 1);
    status.textContent =
      first.year === last.year
        ? `${MONTH_NAMES[first.month]} – ${MONTH_NAMES[last.month]} ${last.year}`
        : `${MONTH_NAMES[first.month]} ${first.year} – ${MONTH_NAMES[last.month]} ${last.year}`;
  }

  prev.addEventListener("click", () => {
    offset = Math.max(0, offset - visible);
    draw();
  });
  next.addEventListener("click", () => {
    offset = Math.min(MAX_MONTHS - visible, offset + visible);
    draw();
  });

  // Paint the first two months before the panel is revealed, so the calendar
  // never appears as an empty box waiting on a click.
  draw();

  container.textContent = "";
  container.appendChild(nav);
  container.appendChild(months);
  container.appendChild(legend);

  const note = el(
    "p",
    "cal-note",
    `Calendar syncs from Airbnb and VRBO and can lag their sites by up to a few hours. ` +
      `Minimum stay is ${data.minNights || 30} nights — confirm exact dates when you book.`
  );
  container.appendChild(note);
  container.hidden = false;
}

// Reuses the fetch main.js already made for the availability line when it is
// there, so the page doesn't request the same endpoint twice.
function loadAvailability(slug) {
  const shared = typeof window !== "undefined" && window.__staysAvailability;
  if (shared && shared[slug]) return shared[slug];
  return fetch(`/api/availability?slug=${encodeURIComponent(slug)}`)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
}

function init() {
  const containers = document.querySelectorAll("[data-stays-calendar]");
  if (!containers.length) return;

  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  containers.forEach((container) => {
    const block = container.closest("[data-stays]");
    const slug = block && block.getAttribute("data-stays");
    if (!slug) return;

    loadAvailability(slug).then((data) => {
      // No feeds configured, every feed unreachable, or not a stay listing:
      // leave the calendar hidden rather than drawing an all-open grid that
      // would imply the home is wide open.
      if (!data || !data.available || !Array.isArray(data.busyRanges)) return;
      renderInto(container, data, todayMs);
    });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
