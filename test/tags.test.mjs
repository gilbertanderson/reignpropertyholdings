// Every property card carries at least two tags.
//
// A card with a single pill reads as an oversight rather than a decision, and
// an uneven tag count also makes the cards different heights in the grid. This
// guards the rule so a tag can't be removed without noticing the card it
// leaves behind.
//
// Scope is deliberately the .card-tags rows on the listing pages. The lone
// .tag in a detail page's title row (Multifamily, Single Family) is a property
// type, not a feature pill, and is not covered.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIN_TAGS = 2;
const PUBLIC_DIR = 'public';

// Returns [{ file, address, tags }] for every property card on a page.
export function cardsIn(html, file = '') {
  return html
    .split('<article class="card">')
    .slice(1)
    .map((chunk) => {
      const article = chunk.split('</article>')[0];
      const address = /<div class="card-address">([^<]+)<\/div>/.exec(article);
      const tagBlock = /<div class="card-tags">([\s\S]*?)<\/div>/.exec(article);
      return {
        file,
        address: address ? address[1].trim() : '(no address)',
        tags: tagBlock
          ? [...tagBlock[1].matchAll(/<span class="tag">([^<]+)<\/span>/g)].map((m) => m[1])
          : [],
      };
    });
}

const pages = readdirSync(PUBLIC_DIR).filter((f) => f.endsWith('.html'));
const cards = pages.flatMap((f) =>
  cardsIn(readFileSync(join(PUBLIC_DIR, f), 'utf8'), f)
);

let fail = 0;
for (const card of cards) {
  const ok = card.tags.length >= MIN_TAGS;
  if (!ok) fail++;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${card.file} — ${card.address}: ` +
      `${card.tags.length} tag(s) [${card.tags.join(', ')}]`
  );
}

if (!cards.length) {
  console.log('  FAIL no property cards found — did the card markup change?');
  fail++;
}

console.log(`\n${cards.length - fail} passed, ${fail} failed (minimum ${MIN_TAGS} tags per card)`);
process.exit(fail ? 1 : 0);
