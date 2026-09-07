// Leased-status wiring: the /api/listing-status endpoint's logic, plus
// structural checks that the card and detail-page markup for 508 Avenue E
// agree with what public/js/main.js expects. The DOM-rendering half (does
// the label actually appear, does the Apply button actually hide) needs a
// browser and isn't covered here — see the PR description for how it was
// verified visually.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LISTINGS } from '../functions/_shared/turbotenant.js';
import { onRequest } from '../functions/api/listing-status.js';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
};

function req(url, method = 'GET') {
  return onRequest({ request: new Request(url, { method }) });
}

// --- LISTINGS config -------------------------------------------------------
t('508 is marked leased', LISTINGS['508-avenue-e'].leased === true);
t('508 is not accepting applications while leased', LISTINGS['508-avenue-e'].available === false);
t('1332 is not marked leased (its false means "not open yet", not "leased")', LISTINGS['1332-tricou-st'].leased !== true);
t('1334 is not marked leased', LISTINGS['1334-tricou-st'].leased !== true);

// --- Endpoint behavior -------------------------------------------------------
{
  const res = await req('https://x/api/listing-status?slug=508-avenue-e');
  const body = await res.json();
  t('200 for a known leased listing', res.status === 200);
  t('reports leased: true for 508', body.leased === true);
  t('cacheable (not no-store) since this is static config, not live data', /max-age/.test(res.headers.get('Cache-Control') || ''));
}
{
  const res = await req('https://x/api/listing-status?slug=1332-tricou-st');
  const body = await res.json();
  t('reports leased: false for a listing without the flag', body.leased === false);
}
{
  const res = await req('https://x/api/listing-status?slug=not-a-real-listing');
  const body = await res.json();
  t('unknown slug reports leased: null rather than false', body.leased === null);
}
{
  const res = await req('https://x/api/listing-status?slug=508-AVENUE-E');
  const body = await res.json();
  t('slug lookup is case-insensitive, matching /api/availability\'s convention', body.leased === true);
}
{
  const res = await req('https://x/api/listing-status', 'POST');
  t('POST is rejected', res.status === 405);
}
{
  const res = await req('https://x/api/listing-status', 'HEAD');
  t('HEAD is allowed (link checkers), same as GET', res.status === 200);
}

// --- Markup: independent slug-keyed elements, not nested ------------------
const publicDir = join(import.meta.dirname, '..', 'public');
const index = readFileSync(join(publicDir, 'index.html'), 'utf8');
const properties = readFileSync(join(publicDir, 'properties.html'), 'utf8');
const detail = readFileSync(join(publicDir, 'property-508-avenue-e.html'), 'utf8');

for (const [name, html] of [['index.html', index], ['properties.html', properties]]) {
  t(`${name}: 508 card carries a status label`, /data-listing-status-label="508-avenue-e"/.test(html));
  t(`${name}: 508 card's status label is compact`, /data-listing-status-compact/.test(html));
  t(`${name}: 508 card's Apply link is independently slug-tagged`, /data-listing-apply="508-avenue-e"/.test(html));
  // The two must NOT be nested inside a shared [data-listing-status] wrapper
  // that the old (buggy) version of this feature used — main.js queries them
  // independently, so a leftover wrapper attribute would be dead markup.
  t(`${name}: no stray data-listing-status wrapper attribute`, !/data-listing-status="/.test(html));
}

t('detail page: status label present', /data-listing-status-label="508-avenue-e"/.test(detail));
t('detail page: status label is NOT compact (full sentence, not "Leased")', !/data-listing-status-label="508-avenue-e"[^>]*data-listing-status-compact/.test(detail));
t('detail page: the whole Apply block is slug-tagged for hiding', /data-listing-apply="508-avenue-e"/.test(detail));
t('detail page: Apply block wraps the Apply Now button', /data-listing-apply="508-avenue-e"[^]*?Apply Now/.test(detail));

// --- main.js wiring ----------------------------------------------------------
const mainJs = readFileSync(join(publicDir, 'js', 'main.js'), 'utf8');
t('main.js queries labels and apply links independently (no shared-block lookup)', /data-listing-status-label/.test(mainJs) && /data-listing-apply/.test(mainJs));
t('main.js fetches /api/listing-status', /\/api\/listing-status/.test(mainJs));
t('main.js caches the fetch by slug (one request per listing, not per element)', /listingStatusBySlug/.test(mainJs));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
