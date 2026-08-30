// Restores pre-Google-Photos listing images as *-original.jpg (+ webp) from git.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REV = 'db83119';
const DEST = 'public/images/properties/508-avenue-e';

/** @type {{ src: string, dest: string, widths: number[] }[]} */
const FILES = [
  { src: 'exterior-front', dest: 'exterior-front-original', widths: [400, 800, 1024] },
  { src: 'exterior-porch', dest: 'exterior-porch-original', widths: [400, 640] },
  { src: 'living-room', dest: 'living-room-original', widths: [400, 800, 1024] },
  { src: 'living-room-furnished', dest: 'living-room-furnished-original', widths: [400, 640] },
  { src: 'living-room-furnished-2', dest: 'living-room-furnished-2', widths: [400, 640] },
  { src: 'kitchen', dest: 'kitchen-original', widths: [400, 800, 1024] },
  { src: 'bedroom', dest: 'bedroom-original', widths: [400, 800, 1024] },
  { src: 'bathroom', dest: 'bathroom-original', widths: [400, 800] },
];

mkdirSync(DEST, { recursive: true });

function gitShow(path) {
  return execFileSync('git', ['show', `${REV}:${path}`]);
}

for (const { src, dest, widths } of FILES) {
  const repoPath = `public/images/properties/508-avenue-e/${src}.jpg`;
  writeFileSync(join(DEST, `${dest}.jpg`), gitShow(repoPath));
  for (const w of widths) {
    const webpRepo = `public/images/properties/508-avenue-e/${src}-${w}.webp`;
    try {
      writeFileSync(join(DEST, `${dest}-${w}.webp`), gitShow(webpRepo));
    } catch {
      // width variant may not exist for this source
    }
  }
}

console.log(`Restored ${FILES.length} original JPEG sets into ${DEST}`);
