import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// Preserve the originals and composition; regenerate after changing artwork.
const root = new URL('../public/images/', import.meta.url);
const output = new URL('optimized/', root);
await mkdir(output, { recursive: true });

for (const [directory, names, fullWidth] of [
  ['login', ['login-day', 'login-night'], 1670],
  ['hero', ['hero-spring', 'hero-summer', 'hero-autumn', 'hero-winter'], 1671],
]) {
  for (const name of names) {
    for (const width of [640, 1024, fullWidth]) {
      await sharp(new URL(`${directory}/${name}.webp`, root).pathname)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 85, effort: 6 })
        .toFile(new URL(`${name}-${width}.webp`, output).pathname);
    }
  }
}
