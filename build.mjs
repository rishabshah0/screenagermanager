import { build, context } from 'esbuild';
import { cpSync, rmSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localRequire = createRequire(join(__dirname, 'node_modules', '.package-lock.json'));

const isWatch = process.argv.includes('--watch');

const STATIC = [
  'manifest.json',
  'popup/popup.html',
  'popup/popup.css',
  'blocked/blocked.html',
  'blocked/blocked.css',
  'settings/settings.html',
  'settings/settings.css',
  'icons',
];

rmSync('dist', { recursive: true, force: true });

for (const p of STATIC) {
  cpSync(`src/${p}`, `dist/${p}`, { recursive: true });
}

const localResolvePlugin = {
  name: 'local-resolve',
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      try {
        const resolved = localRequire.resolve(args.path);
        return { path: resolved };
      } catch {
        return null;
      }
    });
  },
};

const options = {
  entryPoints: [
    { in: 'src/background/service-worker.js', out: 'background/service-worker' },
    { in: 'src/popup/popup.js', out: 'popup/popup' },
    { in: 'src/blocked/blocked.js', out: 'blocked/blocked' },
    { in: 'src/settings/settings.js', out: 'settings/settings' },
  ],
  bundle: true,
  format: 'esm',
  outdir: 'dist',
  target: 'chrome120',
  minify: false,
  plugins: [localResolvePlugin],
};

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build(options);
  console.log('Build complete → dist/');
}
