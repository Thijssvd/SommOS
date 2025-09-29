import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { promises as fs } from 'fs';
import { injectManifest } from 'workbox-build';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = resolve(__dirname, 'dist');
const SW_SOURCE = resolve(__dirname, 'sw.js');
const SW_DEST = resolve(DIST_DIR, 'sw.js');

async function ensureDistExists() {
  try {
    await fs.access(DIST_DIR);
  } catch (error) {
    throw new Error('Vite build output not found. Run "npm run build" (Vite) before building the service worker.');
  }
}

async function buildServiceWorker() {
  await ensureDistExists();

  const { count, size, warnings } = await injectManifest({
    swSrc: SW_SOURCE,
    swDest: SW_DEST,
    globDirectory: DIST_DIR,
    globPatterns: [
      '**/*.{html,js,css,json,webmanifest,ico,png,svg,jpg,jpeg,webp,woff,woff2,ttf}'
    ],
    globIgnores: ['workbox-*.js', 'sw.js'],
    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
  });

  if (warnings && warnings.length > 0) {
    warnings.forEach((warning) => console.warn('Workbox warning:', warning));
  }

  console.log(`Generated service worker with ${count} precached files (${size} bytes).`);
}

buildServiceWorker().catch((error) => {
  console.error('Service worker build failed:', error);
  process.exitCode = 1;
});
