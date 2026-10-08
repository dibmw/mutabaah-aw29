import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import {defineConfig} from 'vite';

function readBuiltVersion(): { version: string; buildTime: string } {
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'public/version.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string; buildTime?: string };
    if (parsed.version) {
      return { version: parsed.version, buildTime: parsed.buildTime || new Date().toISOString() };
    }
  } catch {
    // belum ada public/version.json (mis. dev sebelum script jalan) -> fallback
  }
  return { version: 'dev', buildTime: new Date().toISOString() };
}

export default defineConfig(() => {
  const built = readBuiltVersion();
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(built.version),
      __BUILD_TIME__: JSON.stringify(built.buildTime),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
