# vite-plugin-pwa-manifest

[![npm version](https://img.shields.io/npm/v/vite-plugin-pwa-manifest.svg)](https://www.npmjs.com/package/vite-plugin-pwa-manifest)
[![license](https://img.shields.io/github/license/dev-zarghami/vite-plugin-pwa-manifest.svg)](LICENSE)

> Generate a **PWA web app manifest** for any Vite app — env-aware build metadata, a fully-typed config, and a no-store dev preview that honors your Vite `base`. Zero dependencies, ESM + CJS.

---

## Features

- 🧾 Generates a valid `manifest.json` at build time (emitted to your build `outDir`).
- 💾 Optional on-disk **mirror** (`outputDir`) for static hosting / CDNs — written only when changed.
- 🧪 **Dev preview** with `no-store` + weak `ETag`/`304`, served at the correct route under a custom `base`.
- 🏷️ Build metadata out of the box: `version` (git tag/commit), `pkgVersion`, `buildTime`, `mode`.
- 🎛️ Full `transform(json, { mode })` hook for complete control.
- 🖼️ Icon normalization + de-duplication, with a one-time warning when no maskable icon is present.
- 🟢 Zero runtime dependencies.

---

## Installation

```bash
npm i -D vite-plugin-pwa-manifest
# or: pnpm add -D vite-plugin-pwa-manifest
# or: yarn add -D vite-plugin-pwa-manifest
```

Requires **Node ≥ 18** and **Vite ≥ 4**.

---

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import generateManifest from 'vite-plugin-pwa-manifest';

export default defineConfig({
  plugins: [
    generateManifest({
      name: 'My App',
      short_name: 'App',
      description: 'Example PWA with Vite',
      theme_color: '#0a131b',
      icons: [
        { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
      outputDir: 'public', // optional: also write public/manifest.json
      transform(json, { mode }) {
        if (mode === 'development') json.name = 'My App (dev)';
        return json;
      },
    }),
  ],
});
```

Reference it from your HTML:

```html
<link rel="manifest" href="/manifest.json" />
```

| Phase | Behavior |
|-------|----------|
| **dev** (`vite`) | Served at the `manifest.json` route **under your Vite `base`** with `Cache-Control: no-store` + weak `ETag` (304 on `If-None-Match`). |
| **build** (`vite build`) | Emitted as a build asset to the root of your build `outDir`. |
| **`outputDir`** | Also written to disk (dev & build), skipped when unchanged. |

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filename` | `string` | `"manifest.json"` | Output filename. |
| `outputDir` | `string \| false` | `false` | Mirror the manifest to this directory on disk. |
| `name` / `short_name` | `string` | `"My App"` / `"App"` | Display names. |
| `description` | `string` | — | App description. |
| `lang` / `dir` | `string` / `"ltr" \| "rtl"` | `"en"` / `"ltr"` | Language & direction. |
| `start_url` / `scope` / `id` | `string` | `"/"` | Each is normalized to a **leading slash**. |
| `display` | `"standalone" \| "fullscreen" \| "minimal-ui" \| "browser"` | `"standalone"` | Display mode. |
| `orientation` | `"any" \| "portrait" \| "landscape"` | — | Orientation. |
| `background_color` | `string` | falls back to `theme_color` | Splash background. |
| `theme_color` | `string` | `"#0a131b"` | Theme color. |
| `categories` | `string[]` | — | App store categories. |
| `prefer_related_applications` / `related_applications` | — | — | Native app hints. |
| `protocol_handlers` | `Array<{ protocol; url }>` | — | Protocol handlers. |
| `icons` | `ManifestIcon[]` | 192/512 maskable | Icons (normalized + de-duped). |
| `screenshots` | `Screenshot[]` | — | Screenshots. |
| `extra` | `Record<string, unknown>` | — | Extra fields merged into the manifest. |
| `includeBuildMeta` | `boolean` | `true` | Add `pkgVersion`, `version`, `buildTime`, `mode`. |
| `transform` | `(json, { mode }) => json` | — | Final transform over the assembled manifest. |

> **Note:** `start_url`, `scope`, and `id` are always normalized to begin with `/`. Fields left `undefined` are omitted from the output.

### Types

```ts
type ManifestIcon = {
  src: string;
  sizes: string;
  type?: string;
  purpose?: 'any' | 'maskable' | 'monochrome' | 'any maskable';
};

type Screenshot = {
  src: string;
  sizes?: string;
  type?: string;
  label?: string;
  form_factor?: 'wide' | 'narrow';
};
```

---

## Build metadata

With `includeBuildMeta` (default `true`) the plugin appends:

| Field | Source |
|-------|--------|
| `version` | nearest git **tag**, else `git describe`, else short commit, else `pkgVersion`. |
| `pkgVersion` | `version` from your `package.json`. |
| `buildTime` | ISO timestamp of the build. |
| `mode` | `"development"` in dev, `"production"` in build. |

> Git is detected via a statically-imported `execSync` (not a dynamic `require`), so detection works correctly in **both** the ESM and CJS builds. Outside a git work tree these fields simply fall back to `pkgVersion`.

### Example output

```json
{
  "lang": "en",
  "dir": "ltr",
  "name": "My App",
  "short_name": "App",
  "description": "Example PWA with Vite",
  "start_url": "/",
  "scope": "/",
  "id": "/",
  "display": "standalone",
  "background_color": "#0a131b",
  "theme_color": "#0a131b",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "pkgVersion": "1.4.0",
  "version": "v1.4.0",
  "buildTime": "2025-09-09T13:45:00.000Z",
  "mode": "production"
}
```

---

## License

[MIT](./LICENSE) © dev.zarghami
