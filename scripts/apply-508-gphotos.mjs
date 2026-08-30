// One-off: map imports/gphotos-import into public/images/properties/508-avenue-e
// and print gallery HTML for property-508-avenue-e.html

import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const IMPORT_DIR = 'imports/gphotos-import';
const DEST_DIR = 'public/images/properties/508-avenue-e';
const SLUG = '508-avenue-e';
const BASE = `images/properties/${SLUG}`;

const MAPPING = [
  { src: '22.jpg', name: 'exterior-front', alt: 'Front exterior of 508 Avenue E' },
  { src: '08.jpg', name: 'exterior-porch', alt: 'Front porch at 508 Avenue E' },
  { src: '29.jpg', name: 'exterior-back', alt: 'Backyard and driveway at 508 Avenue E' },
  { src: '30.jpg', name: 'exterior-garage', alt: 'Detached garage at 508 Avenue E' },
  { src: '17.jpg', name: 'interior-hallway', alt: 'Interior hallway at 508 Avenue E' },
  { src: '14.jpg', name: 'living-room', alt: 'Living room at 508 Avenue E' },
  { src: '02.jpg', name: 'living-room-furnished', alt: 'Furnished living room at 508 Avenue E' },
  { src: '03.jpg', name: 'living-room-desk', alt: 'Living room desk area at 508 Avenue E' },
  { src: '18.jpg', name: 'kitchen', alt: 'Kitchen at 508 Avenue E' },
  { src: '10.jpg', name: 'kitchen-dining', alt: 'Kitchen and dining area at 508 Avenue E' },
  { src: '21.jpg', name: 'bedroom', alt: 'Bedroom at 508 Avenue E' },
  { src: '04.jpg', name: 'bedroom-furnished', alt: 'Furnished bedroom at 508 Avenue E' },
  { src: '26.jpg', name: 'bedroom-dresser', alt: 'Bedroom with dresser at 508 Avenue E' },
  { src: '28.jpg', name: 'bedroom-ensuite', alt: 'Bedroom with ensuite bath at 508 Avenue E' },
  { src: '12.jpg', name: 'bedroom-2', alt: 'Second bedroom at 508 Avenue E' },
  { src: '15.jpg', name: 'bedroom-office', alt: 'Bedroom office nook at 508 Avenue E' },
  { src: '11.jpg', name: 'bathroom', alt: 'Bathroom with laundry at 508 Avenue E' },
  { src: '19.jpg', name: 'bathroom-tub', alt: 'Bathroom with tub at 508 Avenue E' },
  { src: '24.jpg', name: 'bathroom-shower', alt: 'Bathroom shower at 508 Avenue E' },
];

mkdirSync(DEST_DIR, { recursive: true });
rmSync(DEST_DIR, { recursive: true, force: true });
mkdirSync(DEST_DIR, { recursive: true });

for (const { src, name } of MAPPING) {
  copyFileSync(join(IMPORT_DIR, src), join(DEST_DIR, `${name}.jpg`));
}

// WebP variants (same rules as optimize-images.mjs)
const WIDTHS = [400, 800, 1200, 1600, 2400];
const QUALITY = 82;

for (const { name } of MAPPING) {
  const src = join(DEST_DIR, `${name}.jpg`);
  const { width: natural } = await sharp(src).metadata();

  for (const w of WIDTHS) {
    if (w > natural) continue;
    const out = join(DEST_DIR, `${name}-${w}.webp`);
    await sharp(src).resize({ width: w }).webp({ quality: QUALITY }).toFile(out);
  }

  if (natural < WIDTHS[0]) {
    await sharp(src).webp({ quality: QUALITY }).toFile(join(DEST_DIR, `${name}-${natural}.webp`));
  } else if (!WIDTHS.includes(natural) && natural < WIDTHS[WIDTHS.length - 1]) {
    await sharp(src).webp({ quality: QUALITY }).toFile(join(DEST_DIR, `${name}-${natural}.webp`));
  }
}

function webpSrcset(name) {
  const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.webp$`);
  const files = readdirSync(DEST_DIR)
    .map((f) => {
      const m = f.match(re);
      return m ? { w: Number(m[1]), f } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.w - b.w);
  return files.map(({ w, f }) => `${BASE}/${f} ${w}w`).join(', ');
}

const meta = [];
for (const { name, alt } of MAPPING) {
  const { width, height } = await sharp(join(DEST_DIR, `${name}.jpg`)).metadata();
  meta.push({ name, alt, width, height, srcset: webpSrcset(name) });
}

const hero = meta[0];
const mainPicture = `
        <picture>
          <source type="image/webp" srcset="${hero.srcset}" sizes="(max-width: 1220px) 100vw, 1180px" data-gallery-source>
          <img src="${BASE}/${hero.name}.jpg" alt="${hero.alt}" width="${hero.width}" height="${hero.height}">
        </picture>`;

const thumbs = meta
  .map((item, i) => {
    const active = i === 0 ? ' class="active"' : '';
    const thumbWebp = `${BASE}/${item.name}-400.webp`;
    const shortAlt = item.alt.replace(' at 508 Avenue E', ' thumbnail');
    return `
        <button${active} data-full="${BASE}/${item.name}.jpg" data-full-srcset="${item.srcset}" data-alt="${item.alt}">
          <picture><source type="image/webp" srcset="${thumbWebp}"><img src="${BASE}/${item.name}.jpg" alt="${shortAlt}" width="${item.width}" height="${item.height}" loading="lazy"></picture>
        </button>`;
  })
  .join('');

console.log('<!-- GALLERY_MAIN -->');
console.log(mainPicture);
console.log('<!-- GALLERY_THUMBS -->');
console.log(thumbs);
console.log(`<!-- PHOTO_COUNT: ${meta.length} -->`);
