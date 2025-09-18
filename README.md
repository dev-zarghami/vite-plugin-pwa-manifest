# vite-plugin-pwa-manifest

[![npm version](https://img.shields.io/npm/v/vite-plugin-pwa-manifest.svg)](https://www.npmjs.com/package/vite-plugin-pwa-manifest)
[![license](https://img.shields.io/github/license/dev-zarghami/vite-plugin-pwa-manifest.svg)](LICENSE)

> Vite plugin to generate a **Progressive Web App (PWA) manifest** with env-aware metadata and a dev no-store preview route.

---

## ✨ Features

- Generates a valid `manifest.json` automatically at build time
- Mirrors manifest to disk (`outputDir`) for static hosting/CDNs
- Serves manifest in **dev mode** with `Cache-Control: no-store`
- Adds build metadata (version, git commit, timestamp) out of the box
- Flexible `transform` hook to fully customize the manifest JSON
- Warns if you don’t provide a maskable icon (for better Android support)

---
## 📦 Installation

```bash
npm install vite-plugin-pwa-manifest --save-dev
# or
yarn add -D vite-plugin-pwa-manifest
# or
pnpm add -D vite-plugin-pwa-manifest
```

---

## 🚀 Usage

Add the plugin in your `vite.config.ts` (or `vite.config.js`):

```ts
import { defineConfig } from "vite";
import generateManifest from "vite-plugin-pwa-manifest";

export default defineConfig({
  plugins: [
    generateManifest({
      name: "My App",
      short_name: "App",
      description: "Example PWA with Vite",
      theme_color: "#0a131b",
      icons: [
        { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
      ],
      includeBuildMeta: true, // adds version/git/buildTime
      outputDir: "public",    // optional: also write manifest.json to /public
      transform(json, { mode }) {
        if (mode === "development") {
          json.name = "My App (dev)";
        }
        return json;
      }
    })
  ]
});
```

### Dev Mode
- Served at: `http://localhost:5173/manifest.json`
- Headers: `Cache-Control: no-store`, `ETag`, `Vary: If-None-Match`
- Always reflects the latest config.

### Build Mode
- `manifest.json` is emitted into your Vite bundle.
- Optionally mirrored to `outputDir` (like `public/manifest.json`).

---

## ⚙️ Options

| Option                   | Type                         | Default       | Description |
|--------------------------|------------------------------|---------------|-------------|
| `outputDir`              | `string \| false`            | `false`       | Mirror manifest file to disk (useful for static hosting) |
| `filename`               | `string`                     | `manifest.json` | Output filename |
| `name` / `short_name`    | `string`                     | `"My App"` / `"App"` | App display names |
| `description`            | `string`                     | –             | Description of the PWA |
| `start_url` / `scope`    | `string`                     | `"/"`         | Entry point & navigation scope |
| `id`                     | `string`                     | `"/"`         | App ID (leave as string; no forced slash) |
| `display`                | `"standalone" \| ...`        | `"standalone"`| Display mode |
| `orientation`            | `"portrait" \| ...`          | –             | Screen orientation |
| `background_color`       | `string`                     | `theme_color` | Splash screen background |
| `theme_color`            | `string`                     | `"#0a131b"`   | Theme color |
| `icons`                  | `ManifestIcon[]`             | default 192/512 maskable icons | Icons |
| `screenshots`            | `Screenshot[]`               | –             | Screenshots for app stores |
| `extra`                  | `Record<string, unknown>`    | –             | Extra JSON fields |
| `includeBuildMeta`       | `boolean`                    | `true`        | Add `pkgVersion`, `version`, `buildTime` |
| `transform`              | `(json, ctx) => json`        | –             | Hook to customize final manifest JSON |

---

## 🛠️ Example Output

```json
{
  "lang": "fa",
  "dir": "rtl",
  "name": "My App",
  "short_name": "App",
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
  "pkgVersion": "0.1.0",
  "version": "abc1234",
  "buildTime": "2025-09-09T13:45:00.000Z"
}
```

---

## 🤝 Contributing

Issues and PRs are welcome!  
Please file bugs or feature requests here: [issues](https://github.com/dev-zarghami/vite-plugin-pwa-manifest/issues).

---

## 📄 License

[MIT](LICENSE) © 2025
