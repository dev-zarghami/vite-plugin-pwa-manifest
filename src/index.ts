import path from 'node:path';
import type { Logger, Plugin, ViteDevServer } from 'vite';
import { writeFileIfChanged } from './internal/fs';
import { publicRoute, sendAsset } from './internal/server';
import { gitVersion, readPkgVersion } from './internal/meta';

const PLUGIN_NAME = 'vite-plugin-pwa-manifest';
const TAG = '[manifest]';
const DEFAULT_FILENAME = 'manifest.json';
const DEFAULT_THEME = '#0a131b';

// ----------------- types -----------------

export type ManifestIcon = {
  src: string;
  sizes: string;
  type?: string;
  purpose?: 'any' | 'maskable' | 'monochrome' | 'any maskable';
};

export type Screenshot = {
  src: string;
  sizes?: string;
  type?: string;
  label?: string;
  form_factor?: 'wide' | 'narrow';
};

export type ManifestMode = 'development' | 'production';

export type ManifestOptions = {
  /** Mirror the manifest to this directory on disk (relative to root). `false`/omitted disables it. */
  outputDir?: string | false;
  /** Output filename. Defaults to `"manifest.json"`. */
  filename?: string;

  name?: string;
  short_name?: string;
  description?: string;
  lang?: string;
  dir?: 'rtl' | 'ltr';

  start_url?: string;
  scope?: string;
  id?: string;
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation?: 'any' | 'portrait' | 'landscape';
  background_color?: string;
  theme_color?: string;
  categories?: string[];
  prefer_related_applications?: boolean;
  related_applications?: Array<{ platform: string; url?: string; id?: string }>;
  protocol_handlers?: Array<{ protocol: string; url: string }>;

  icons?: ManifestIcon[];
  screenshots?: Screenshot[];

  /** Arbitrary extra fields merged into the manifest. */
  extra?: Record<string, unknown>;
  /** Append `pkgVersion`/`version`/`buildTime`/`mode`. Default `true`. */
  includeBuildMeta?: boolean;
  /** Final transform over the assembled manifest object. */
  transform?: (json: Record<string, unknown>, ctx: { mode: ManifestMode }) => Record<string, unknown>;
};

// ----------------- internals -----------------

const ensureLeadingSlash = (s: string): string => (s.startsWith('/') ? s : `/${s}`);

function defaultIcons(): ManifestIcon[] {
  return [
    { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ];
}

function normalizeIcons(icons: ManifestIcon[] | undefined): ManifestIcon[] {
  const seen = new Set<string>();
  return (icons ?? defaultIcons())
    .map((icon) => ({ ...icon, src: ensureLeadingSlash(icon.src) }))
    .filter((icon) => {
      const key = `${icon.src}|${icon.sizes}|${icon.purpose ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const hasMaskableIcon = (icons: ManifestIcon[]): boolean =>
  icons.some((i) => (i.purpose ?? '').includes('maskable'));

interface ProjectMeta {
  pkgVersion: string | null;
  vcsVersion: string | null;
}

function buildManifest(
  opts: ManifestOptions,
  mode: ManifestMode,
  meta: ProjectMeta,
): Record<string, unknown> {
  const theme = opts.theme_color ?? DEFAULT_THEME;

  const manifest: Record<string, unknown> = {
    lang: opts.lang ?? 'en',
    dir: opts.dir ?? 'ltr',
    name: opts.name ?? 'My App',
    short_name: opts.short_name ?? 'App',
    description: opts.description,
    start_url: ensureLeadingSlash(opts.start_url ?? '/'),
    scope: ensureLeadingSlash(opts.scope ?? '/'),
    id: ensureLeadingSlash(opts.id ?? '/'),
    display: opts.display ?? 'standalone',
    orientation: opts.orientation,
    background_color: opts.background_color ?? theme,
    theme_color: theme,
    categories: opts.categories,
    prefer_related_applications: opts.prefer_related_applications,
    related_applications: opts.related_applications,
    protocol_handlers: opts.protocol_handlers,
    icons: normalizeIcons(opts.icons),
    screenshots: opts.screenshots,
  };

  if (opts.includeBuildMeta !== false) {
    manifest.pkgVersion = meta.pkgVersion ?? undefined;
    manifest.version = meta.vcsVersion ?? meta.pkgVersion ?? undefined;
    manifest.buildTime = new Date().toISOString();
    manifest.mode = mode;
  }

  const merged = { ...manifest, ...(opts.extra ?? {}) };
  return opts.transform ? opts.transform(merged, { mode }) : merged;
}

// ----------------- plugin -----------------

export function generateManifest(options: ManifestOptions = {}): Plugin {
  const filename = options.filename ?? DEFAULT_FILENAME;

  let logger!: Logger;
  let base = '/';
  let root = process.cwd();
  let lastJSON = '{}\n';
  let warnedMaskable = false;

  // Project metadata is stable for the life of the process — read it once.
  const meta: ProjectMeta = { pkgVersion: null, vcsVersion: null };

  const serialize = (mode: ManifestMode): string => {
    const manifest = buildManifest(options, mode, meta);
    if (!warnedMaskable && !hasMaskableIcon(manifest.icons as ManifestIcon[])) {
      logger.warn(`${TAG} no maskable icon found; add purpose: 'maskable' for better Android rendering.`);
      warnedMaskable = true;
    }
    return JSON.stringify(manifest, null, 2) + '\n';
  };

  return {
    name: PLUGIN_NAME,

    configResolved(config) {
      logger = config.logger;
      base = config.base || '/';
      root = config.root || process.cwd();
      meta.pkgVersion = readPkgVersion(root);
      meta.vcsVersion = gitVersion();
      lastJSON = serialize(config.command === 'serve' ? 'development' : 'production');
    },

    async buildStart() {
      lastJSON = serialize('production');
      if (options.outputDir) {
        const outPath = path.resolve(root, options.outputDir, filename);
        await writeFileIfChanged(outPath, lastJSON, logger, TAG);
      }
    },

    generateBundle() {
      this.emitFile({ type: 'asset', fileName: filename, source: lastJSON });
      logger.info(`${TAG} emitted ${filename}`);
    },

    configureServer(server: ViteDevServer) {
      const route = publicRoute(base, filename);
      server.middlewares.use(route, (req, res) => {
        sendAsset(req, res, {
          content: lastJSON,
          contentType: 'application/manifest+json; charset=utf-8',
        });
      });
      logger.info(`${TAG} dev route mounted → ${route} (no-store)`);
    },
  };
}

export default generateManifest;
