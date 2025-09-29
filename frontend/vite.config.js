import { defineConfig } from 'vite';
import { resolve, dirname, extname, basename, join } from 'path';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';

const normalizeToPosix = (value) => value.replace(/\\/g, '/');

const manifestIconHasher = () => {
  let outDir;
  let publicDir;

  return {
    name: 'sommos-manifest-icon-hasher',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
      const configuredPublicDir = config.publicDir ?? 'public';
      publicDir = resolve(config.root, configuredPublicDir);
    },
    async writeBundle() {
      const manifestPath = resolve(outDir, 'manifest.json');

      let manifestRaw;
      try {
        manifestRaw = await fs.readFile(manifestPath, 'utf8');
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          return;
        }

        throw error;
      }

      let manifestJson;
      try {
        manifestJson = JSON.parse(manifestRaw);
      } catch (error) {
        throw new Error(`Unable to parse web app manifest at ${manifestPath}: ${error}`);
      }

      if (!Array.isArray(manifestJson.icons) || manifestJson.icons.length === 0) {
        return;
      }

      const updatedIcons = [];

      for (const icon of manifestJson.icons) {
        if (!icon || typeof icon.src !== 'string' || icon.src.trim() === '') {
          updatedIcons.push(icon);
          continue;
        }

        const cleanSrc = icon.src.replace(/^\//, '');
        const distIconPath = resolve(outDir, cleanSrc);
        const publicIconFallbackPath = resolve(publicDir, cleanSrc);

        let sourceBuffer;
        let originalPath;

        try {
          sourceBuffer = await fs.readFile(distIconPath);
          originalPath = distIconPath;
        } catch (error) {
          if (error && error.code === 'ENOENT') {
            try {
              sourceBuffer = await fs.readFile(publicIconFallbackPath);
              originalPath = publicIconFallbackPath;
            } catch (fallbackError) {
              if (fallbackError && fallbackError.code === 'ENOENT') {
                updatedIcons.push(icon);
                continue;
              }

              throw fallbackError;
            }
          } else {
            throw error;
          }
        }

        const hash = createHash('sha256').update(sourceBuffer).digest('hex').slice(0, 8);
        const extension = extname(cleanSrc);
        const withoutExt = basename(cleanSrc, extension);
        const iconDir = dirname(cleanSrc);
        const hashedFileName = `${withoutExt}.${hash}${extension}`;
        const relativeOutputPath = iconDir === '.' ? hashedFileName : join(iconDir, hashedFileName);
        const absoluteOutputPath = resolve(outDir, relativeOutputPath);

        await fs.mkdir(dirname(absoluteOutputPath), { recursive: true });
        await fs.writeFile(absoluteOutputPath, sourceBuffer);

        // Remove the unhashed copy when it exists inside the build output.
        if (originalPath === distIconPath) {
          await fs.rm(distIconPath, { force: true });
        }

        updatedIcons.push({
          ...icon,
          src: `/${normalizeToPosix(relativeOutputPath)}`
        });
      }

      const updatedManifest = JSON.stringify(
        {
          ...manifestJson,
          icons: updatedIcons
        },
        null,
        2
      );

      await fs.writeFile(manifestPath, `${updatedManifest}\n`, 'utf8');
    }
  };
};

export default defineConfig(() => ({
  root: __dirname,
  base: '/',
  publicDir: 'public',
  appType: 'mpa',
  plugins: [manifestIconHasher()],
  server: {
    port: 3000,
    strictPort: true,
    open: false,
    headers: {
      'Cache-Control': 'no-store'
    },
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.SOMMOS_API_PORT || process.env.API_PORT || 3001}`,
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    port: 4173,
    strictPort: true,
    open: false,
    headers: {
      'Cache-Control': 'no-store'
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    manifest: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        pairing: resolve(__dirname, 'test-pairing.html')
      }
    }
  },
  css: {
    devSourcemap: true
  },
  optimizeDeps: {
    include: ['chart.js/auto']
  }
}));
