import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type {Plugin, ResolvedConfig, ViteDevServer} from "vite";

// ----------------- helpers -----------------

const NOW_ISO = () => new Date().toISOString();

function createLogger(scope: string) {
    const tag = (level: string) => `[${scope}] ${level.toUpperCase()}`;
    return {
        info(msg: string, meta?: unknown) {
            console.log(tag("info"), msg, meta ?? "");
        },
        warn(msg: string, meta?: unknown) {
            console.warn(tag("warn"), msg, meta ?? "");
        },
    };
}

function runCommand(cmd: string): string | null {
    try {
        const {execSync} = require("node:child_process");
        return (
            execSync(cmd, {stdio: ["ignore", "pipe", "ignore"]})
                .toString()
                .trim() || null
        );
    } catch {
        return null;
    }
}

async function writeFileIfChanged(filePath: string, payload: string) {
    try {
        const existing = await fsp.readFile(filePath, "utf8");
        if (existing === payload) return false;
    } catch {
        // ignore
    }
    await fsp.mkdir(path.dirname(filePath), {recursive: true});
    await fsp.writeFile(filePath, payload, "utf8");
    return true;
}

function hashETag(s: string) {
    return `W/"${crypto.createHash("sha1").update(s).digest("hex")}"`;
}

const ensureLeadingSlash = (s: string) => (s.startsWith("/") ? s : `/${s}`);

// ----------------- types -----------------

export type ManifestIcon = {
    src: string;
    sizes: string;
    type?: string;
    purpose?: "any" | "maskable" | "monochrome" | "any maskable";
};

export type Screenshot = {
    src: string;
    sizes?: string;
    type?: string;
    label?: string;
    form_factor?: "wide" | "narrow";
};

export type ManifestOptions = {
    outputDir?: string | false; // optional mirror to disk
    filename?: string; // default "manifest.json"

    name?: string;
    short_name?: string;
    description?: string;
    lang?: string;
    dir?: "rtl" | "ltr";

    start_url?: string;
    scope?: string;
    id?: string;
    display?: "standalone" | "fullscreen" | "minimal-ui" | "browser";
    orientation?: "any" | "portrait" | "landscape";
    background_color?: string;
    theme_color?: string;
    categories?: string[];
    prefer_related_applications?: boolean;
    related_applications?: Array<{ platform: string; url?: string; id?: string }>;
    protocol_handlers?: Array<{ protocol: string; url: string }>;

    icons?: ManifestIcon[];
    screenshots?: Screenshot[];

    extra?: Record<string, unknown>;
    includeBuildMeta?: boolean;
    transform?: (
        json: Record<string, unknown>,
        ctx: { mode: "development" | "production" },
    ) => Record<string, unknown>;
};

// ----------------- internals -----------------

function readPkgVersion(): string | null {
    try {
        const pkg = JSON.parse(
            fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"),
        );
        return typeof pkg.version === "string" ? pkg.version : null;
    } catch {
        return null;
    }
}

function gitShort(): string | null {
    return (
        runCommand("git describe --tags --exact-match") ||
        runCommand("git describe --tags --always") ||
        runCommand("git rev-parse --short HEAD") ||
        null
    );
}

function defaultIcons(): ManifestIcon[] {
    return [
        {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
        },
        {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
        },
    ];
}

function normalizeIcons(icons: ManifestIcon[] | undefined): ManifestIcon[] {
    const list = (icons ?? defaultIcons()).map((i) => ({
        ...i,
        src: ensureLeadingSlash(i.src),
    }));
    const seen = new Set<string>();
    return list.filter((i) => {
        const key = `${i.src}|${i.sizes}|${i.purpose ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function hasMaskableIcon(icons?: ManifestIcon[]) {
    return (icons ?? []).some((i) => (i.purpose ?? "").includes("maskable"));
}

function buildManifest(opts: ManifestOptions, mode: "development" | "production") {
    const pkgVersion = readPkgVersion();
    const vcsVersion = gitShort();
    const theme = opts.theme_color ?? "#0a131b";

    const base: Record<string, unknown> = {
        lang: opts.lang ?? "en",
        dir: opts.dir ?? "ltr",
        name: opts.name ?? "My App",
        short_name: opts.short_name ?? "App",
        description: opts.description ?? undefined,
        start_url: ensureLeadingSlash(opts.start_url ?? "/"),
        scope: ensureLeadingSlash(opts.scope ?? "/"),
        id: ensureLeadingSlash(opts.id ?? "/"),
        display: opts.display ?? "standalone",
        orientation: opts.orientation ?? undefined,
        background_color: opts.background_color ?? theme,
        theme_color: theme,
        categories: opts.categories ?? undefined,
        prefer_related_applications: opts.prefer_related_applications ?? undefined,
        related_applications: opts.related_applications ?? undefined,
        protocol_handlers: opts.protocol_handlers ?? undefined,
        icons: normalizeIcons(opts.icons),
        screenshots: opts.screenshots ?? undefined,
    };

    if (opts.includeBuildMeta !== false) {
        base.pkgVersion = pkgVersion ?? undefined;
        base.version = vcsVersion ?? pkgVersion ?? undefined;
        base.buildTime = NOW_ISO();
    }

    let merged = {...base, ...(opts.extra ?? {})};
    if (opts.transform) {
        merged = opts.transform(merged, {mode});
    }
    return merged;
}

// ----------------- plugin -----------------

export function generateManifest(options: ManifestOptions = {}): Plugin {
    const log = createLogger("manifest");
    const filename = options.filename ?? "manifest.json";

    let root = process.cwd();
    let config: ResolvedConfig;
    let lastJSON = "{}\n";

    function serialize(mode: "development" | "production") {
        const json = buildManifest(options, mode);
        if (!hasMaskableIcon(json.icons as ManifestIcon[])) {
            log.warn(
                "No maskable icon found; add purpose: 'maskable' for better Android PWA rendering.",
            );
        }
        return JSON.stringify(json, null, 2) + "\n";
    }

    return {
        name: "vite-plugin-pwa-manifest",
        apply: () => true,

        configResolved(c) {
            config = c;
            root = c.root ?? process.cwd();
            lastJSON = serialize(c.command === "serve" ? "development" : "production");
        },

        buildStart() {
            lastJSON = serialize("production");

            if (options.outputDir) {
                const outPath = path.resolve(root, options.outputDir, filename);
                writeFileIfChanged(outPath, lastJSON).then((changed) => {
                    if (changed) log.info("Manifest mirrored to disk", {file: outPath});
                });
            }
        },

        generateBundle() {
            this.emitFile({
                type: "asset",
                fileName: filename,
                source: lastJSON,
            });
            log.info("Manifest emitted", {file: filename});
        },

        configureServer(server: ViteDevServer) {
            const route = `/${filename}`;
            server.middlewares.use(route, (req, res) => {
                const payload = serialize("development");
                const etag = hashETag(payload);

                res.setHeader(
                    "Content-Type",
                    "application/manifest+json; charset=utf-8",
                );
                res.setHeader(
                    "Cache-Control",
                    "no-store, no-cache, must-revalidate, max-age=0",
                );
                res.setHeader("Pragma", "no-cache");
                res.setHeader("Expires", "0");
                res.setHeader("ETag", etag);

                if (req.headers["if-none-match"] === etag) {
                    res.statusCode = 304;
                    res.end();
                    return;
                }

                res.end(payload);
            });
            log.info(`dev route mounted → ${route} (no-store)`);
        },
    };
}

export default generateManifest;
