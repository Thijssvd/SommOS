# ⚠️ ARCHIVED - SommOS React POC

**Status**: Proof of Concept Only - Not Feature Complete

> **⚠️ Important**: This React frontend is **incomplete** and missing most production features.
> 
> **For production use**, see the main frontend at [`../frontend/`](../frontend/)
>
> This directory is kept for reference purposes only.

## Missing Features

- ❌ No authentication system
- ❌ No guest access
- ❌ No procurement module  
- ❌ No catalog view
- ❌ No real-time sync
- ❌ No role-based access control
- ❌ Limited styling

See [FRONTEND_COMPARISON.md](../FRONTEND_COMPARISON.md) for complete feature comparison.

---

## Original POC Description

Minimal React app aligned with SommOS frontend conventions:
- Port 3000, Vite proxy to backend `/api` on 3001
- Custom service worker `public/sw.js` and web manifest `public/manifest.json`
- Typed API client `src/lib/SommOSAPI.ts` with retry + timeout

## Scripts

```bash
# start dev server (port 3000)
npm run dev

# build
npm run build

# preview build (port 4173)
npm run preview
```

Backend should run on port 3001. Root project provides:
```bash
npm run dev:backend   # nodemon backend/server.js
```

## Notes
- Icons are optional. Manifest currently has an empty `icons` array.
- Service worker performs basic app shell and runtime caching.
- Update `VITE_API_BASE` if you need a non-proxied API base.
