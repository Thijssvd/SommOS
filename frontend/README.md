# SommOS Frontend

This directory contains the progressive web application (PWA) frontend for SommOS. It is built with [Vite](https://vitejs.dev/) for development and production bundling, and it ships a Workbox-powered service worker for offline support.

## Prerequisites

- Node.js 18.x (Node 16+ is supported, but Node 18 is recommended to match local backend requirements)
- npm 8+

Install dependencies once per checkout:

```bash
cd frontend
npm install
```

## Available scripts

All commands below are executed from the `frontend/` directory unless otherwise noted.

### `npm run dev`

Start the Vite development server at `http://localhost:3000`:

```bash
npm run dev
```

Key behaviors:

- Serves `index.html` with module hot reloading and cache-busting headers.
- Proxies `/api` requests to the backend. Override the backend port with `SOMMOS_API_PORT` (or `API_PORT`) when the API is not on the default `3001`.
- Watches source files under `frontend/` (HTML, JS, CSS, and assets).

### `npm run build`

Create a production build with hashed assets and an injected precache manifest:

```bash
npm run build
```

This performs two steps:

1. `vite build --mode production` generates the `dist/` directory, writes a web app manifest (`manifest.json`), fingerprints static assets, and rewrites icon paths via the custom `manifestIconHasher` plugin.
2. `node ./build-sw.mjs` runs Workbox `injectManifest`, producing `dist/sw.js` with a precache list limited to files smaller than 6 MB.

The output under `frontend/dist/` is ready to serve from a static host alongside the backend API.

### `npm run preview`

Serve the built assets with Vite's preview server on port `4173`:

```bash
npm run preview
```

This is useful for verifying the production bundle (including the generated service worker) before deployment. The preview server also applies `Cache-Control: no-store` headers to simplify service worker testing.

## Environment configuration

The frontend reads configuration from Vite environment variables and runtime globals:

- `VITE_API_BASE`: Explicit API origin used by the browser client (e.g., `https://example.com/api`). When omitted, the app falls back to `window.__SOMMOS_API_BASE__`, `process.env.SOMMOS_API_BASE_URL`, or derives the origin from `window.location`.
- `SOMMOS_API_PORT` / `API_PORT`: Optional overrides for the dev-server proxy target.

Create a `.env.local` file in `frontend/` to persist local overrides without committing them:

```bash
VITE_API_BASE=https://api.dev.local/api
SOMMOS_API_PORT=4000
```

## Service worker lifecycle

During development (`npm run dev`), the service worker is not registered so changes load instantly. In production builds:

- `frontend/sw.js` is processed by Workbox to precache hashed bundles, icons, and HTML shells.
- The generated worker skips waiting after activation and listens for `message` events to trigger immediate updates.
- Old caches are cleaned when a new build is deployed.

When testing updates locally, open DevTools > Application > Service Workers and use **Update on reload** to force refreshes.

## Project structure

- `index.html`, `test-pairing.html`: HTML entry points managed by Vite.
- `js/`: Application scripts (API client, UI helpers, and bootstrap `main.js`).
- `css/`: Stylesheets imported by the entry modules.
- `public/`: Static assets copied as-is, including the base `manifest.json` and PWA icons (hashed during build).
- `sw.js`: Service worker source injected with the production precache list via `build-sw.mjs`.
- `build-sw.mjs`: Script that runs Workbox `injectManifest` after the Vite build.
