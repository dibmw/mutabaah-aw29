// Menulis public/version.json sebelum `vite build` agar build ID yang
// dibaca client (fetch) selalu sama dengan yang di-inject via vite define.
// Sumber versi: VERCEL_GIT_COMMIT_SHA (7 char) > git rev-parse --short HEAD > timestamp.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function resolveVersion() {
  const fromVercel = (process.env.VERCEL_GIT_COMMIT_SHA || '').trim().slice(0, 7);
  if (fromVercel) return { version: fromVercel, source: 'vercel-commit' };
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (sha) return { version: sha, source: 'git-head' };
  } catch {
    // abaikan, fallback ke timestamp
  }
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return { version: `build-${stamp}`, source: 'timestamp' };
}

const { version, source } = resolveVersion();
const buildTime = new Date().toISOString();
const payload = { version, buildTime, source };

const outDir = path.join(process.cwd(), 'public');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'version.json'), JSON.stringify(payload, null, 2) + '\n');
console.log(`[version] wrote public/version.json: ${JSON.stringify(payload)}`);
