# Working notes for this repository

## Stop early and hand off before running out of context

**Rule:** when context is running low, stop doing new work and spend what is left
writing the handoff. Do not push on until the window ends mid-task — a truncated
session leaves the next one guessing.

Concretely:

- Land whatever is already safe to land (commit and push it), then stop taking on
  anything new.
- Update `HANDOFF.md` with: what changed, what was verified and how, what is
  still open, and any assumption a future session should re-test rather than
  inherit.
- Say plainly in the final message that the stop was for context, and what was
  left undone.

A half-finished task with an accurate handoff is worth more than a further
half-step with no record of it.

## Verify before asserting

The recurring failure in this repo has been trusting a stale mental model over a
fresh look:

- **Sync before you judge.** A clone that is behind will make you contradict what
  the owner is actually seeing. Fetch `origin/main` first.
- **`main` moves mid-task.** Re-read it before writing a fix; another PR may have
  already landed it.
- **Re-test environment limits.** Egress rules, connected MCP servers and
  available tools change between and within sessions. Test them, don't recite
  them. See `HANDOFF.md` section 3b for the current access matrix.

## Never publish an unverified fact about a property

Rents, parking counts, square footage, listing ids and deep links go on a live
rental listing. If a value is not confirmed, leave the gap and say so.

A related figure is not the figure: a TurboTenant *rent estimate* is market
research, not an asking rent, and must not be used to fill an `offers` block.

## Secrets

iCal feed URLs (`STAYS_ICAL_*`) and `SENDGRID_API_KEY` carry access tokens. They
belong in the Cloudflare Pages dashboard only — never committed, never written to
a file in the repo. `.dev.vars` and `.dev.vars.*` are gitignored;
`.dev.vars.example` documents the names with empty values.

## Conventions

- `npm test` runs every suite in `test/`. Add new suites to the `test` script.
- Availability comes from `/api/availability`, which parses the Airbnb/VRBO iCal
  exports server-side (those endpoints send no CORS headers, so a browser fetch
  cannot work).
- Furnished stays have a **30-night minimum**. New Orleans restricts short-term
  rentals in residential areas, so nothing in the UI may imply nightly booking.
- Every property card carries at least two tags; `test/tags.test.mjs` enforces it.
