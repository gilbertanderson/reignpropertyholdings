// Generates responsive WebP variants beside each property JPEG.
//
// Run with:  npm install --no-save sharp && node scripts/optimize-images.mjs
//
// sharp is deliberately NOT a package.json dependency. Workers Builds runs
// `npm install`, and adding ~30MB of platform binaries to every deploy to
// support a task that runs only when photos change is a bad trade. The
// generated .webp files are committed; this script just reproduces them.
//
// Never upscales: a source narrower than a target width simply skips that
// width. Earlier work in this repo established that upscaling looks worse than
// the smaller native file, and that finding still holds.

import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'public/images/properties';
const WIDTHS = [400, 800, 1200, 1600, 2400];
const QUALITY = 82;

let made = 0, skipped = 0, savedBytes = 0;

for (const slug of readdirSync(ROOT)) {
  const dir = join(ROOT, slug);
  if (!statSync(dir).isDirectory()) continue;

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.jpg'))) {
    const src = join(dir, file);
    const base = file.replace(/\.jpg$/, '');
    const { width: natural } = await sharp(src).metadata();

    for (const w of WIDTHS) {
      // Skip widths at or above the natural size, except allow exactly one
      // variant at the natural width so the largest srcset entry is real.
      if (w > natural) continue;
      const out = join(dir, `${base}-${w}.webp`);
      await sharp(src).resize({ width: w }).webp({ quality: QUALITY }).toFile(out);
      made++;
      savedBytes += statSync(src).size - statSync(out).size;
    }

    // Sources smaller than the smallest width still need one variant.
    if (natural < WIDTHS[0]) {
      const out = join(dir, `${base}-${natural}.webp`);
      await sharp(src).webp({ quality: QUALITY }).toFile(out);
      made++;
    } else if (!WIDTHS.includes(natural) && natural < WIDTHS[WIDTHS.length - 1]) {
      // Full-resolution variant at the source's own width.
      const out = join(dir, `${base}-${natural}.webp`);
      await sharp(src).webp({ quality: QUALITY }).toFile(out);
      made++;
    }
  }
}

console.log(`${made} webp variants written, ${skipped} skipped`);
