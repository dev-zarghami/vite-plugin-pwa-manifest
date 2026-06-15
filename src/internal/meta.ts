import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Build-time project metadata helpers.
 *
 * `execSync` is imported statically at module scope — NOT via `require()` —
 * because a CommonJS `require` does not exist in the ESM build and esbuild's
 * shim throws "Dynamic require is not supported", which silently disables git
 * detection.
 */

/** Read the `version` field from the project's `package.json`, or `null`. */
export function readPkgVersion(root: string = process.cwd()): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

function git(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
}

/** Short git commit hash, or `null` when not in a git work tree. */
export function gitCommitShort(): string | null {
  return git('git rev-parse --short HEAD');
}

/**
 * Best human-readable version from git: an exact tag, else nearest tag, else the
 * short commit. Returns `null` outside a git work tree.
 */
export function gitVersion(): string | null {
  return (
    git('git describe --tags --exact-match') ||
    git('git describe --tags --always') ||
    gitCommitShort()
  );
}
