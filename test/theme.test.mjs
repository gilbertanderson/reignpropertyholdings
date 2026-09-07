// Static checks for the dark-mode wiring. theme.js is a DOM/localStorage
// script with no pure functions to unit test in isolation, so this suite
// verifies the pieces that have to agree with each other by construction:
// every page loads the toggle script and carries a toggle button, the CSS
// defines the theme tokens theme.js and every page rely on, and the
// synchronous script comes before the deferred one so it can prevent a
// flash of the wrong theme.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
};

const PUBLIC = join(import.meta.dirname, '..', 'public');
const pages = readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));
t('found all 9 pages', pages.length === 9);

for (const page of pages) {
  const html = readFileSync(join(PUBLIC, page), 'utf8');

  const themeScript = /<script src="\/?js\/theme\.js"><\/script>/.exec(html);
  t(`${page}: loads theme.js`, !!themeScript);

  const mainScript = /<script src="\/?js\/main\.js"><\/script>/.exec(html);
  t(`${page}: loads main.js`, !!mainScript);

  if (themeScript && mainScript) {
    // theme.js must run synchronously in <head>, before main.js (which is
    // deferred and runs late) — otherwise the flash it exists to prevent
    // still happens.
    t(`${page}: theme.js precedes main.js`, themeScript.index < mainScript.index);
  }

  t(`${page}: theme.js has no defer/async`, !/theme\.js"[^>]*\b(defer|async)\b/.test(html));
  t(`${page}: theme.js is inside <head>`, html.indexOf('js/theme.js') < html.indexOf('</head>'));

  t(`${page}: has a toggle button`, /data-theme-toggle(?!-)/.test(html));
  t(`${page}: toggle carries a label span`, /data-theme-toggle-label/.test(html));
}

// --- CSS ------------------------------------------------------------------
const css = readFileSync(join(PUBLIC, 'css', 'style.css'), 'utf8');

t('defines --surface on :root', /:root\s*\{[^}]*--surface:/.test(css));
t('color-scheme: light on :root', /:root\s*\{[^}]*color-scheme:\s*light/.test(css));

const mediaBlock = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/.exec(css);
t('media query guards against data-theme="light"', !!mediaBlock);
t('media query redefines --surface', !!mediaBlock && /--surface:/.test(mediaBlock[1]));
t('media query sets color-scheme: dark', !!mediaBlock && /color-scheme:\s*dark/.test(mediaBlock[1]));

const explicitDark = /:root\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(css);
t('explicit :root[data-theme="dark"] block exists', !!explicitDark);
t('explicit dark block redefines --surface', !!explicitDark && /--surface:/.test(explicitDark[1]));

// The two dark blocks are meant to carry the same tokens (system default and
// explicit override should look identical) — a hand-edit to one that misses
// the other is exactly the kind of drift this guards against.
if (mediaBlock && explicitDark) {
  const tokensOf = (block) => [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)]
    .map(([, k, v]) => `${k}:${v.trim()}`).sort().join('\n');
  t('media and explicit dark blocks define the same tokens', tokensOf(mediaBlock[1]) === tokensOf(explicitDark[1]));
}

t('.theme-toggle rule exists', /\.theme-toggle\s*\{/.test(css));
t('no stray #fff assigned to a surface token', !/--surface:\s*#fff\b/i.test(css.replace(/--surface: #ffffff;/, '')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
