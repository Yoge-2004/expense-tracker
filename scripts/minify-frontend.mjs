#!/usr/bin/env node
/**
 * Minifies the static frontend's JavaScript and CSS for production. HTML and every other file are copied as is.
 *
 * The repository keeps readable sources. The site is served by Netlify (`netlify.toml`), whose build runs this in
 * place on its own checkout, so the committed files are never changed. File names and folders stay the same, so
 * HTML, the service worker's cache list and inline event handlers keep working.
 *
 * Classic scripts share top-level names (functions and variables defined in one file and used in another or in
 * HTML `onclick`). esbuild treats a script without import or export as global code and does not rename its
 * top-level names, so those links survive. `--strict` also checks that every top-level name is still present.
 *
 *     npm ci --prefix scripts/frontend-tools
 *     node scripts/minify-frontend.mjs --out frontend-min --strict   # CI: build a copy, fail on any problem
 *     node scripts/minify-frontend.mjs --in-place                    # Netlify: minify frontend/ itself
 *
 * Without --strict a file that fails to minify is kept as is and a warning is printed, so a deploy never breaks
 * because of an optimisation.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);

const strict = flag('--strict');
const inPlace = flag('--in-place');
const src = path.resolve(root, option('--src', 'frontend'));
const out = inPlace ? src : path.resolve(root, option('--out', ''));
if (!inPlace && !option('--out', '')) {
  console.error('Give --out <dir> to build a copy, or --in-place to minify the source folder.');
  process.exit(2);
}

let esbuild;
try {
  esbuild = createRequire(path.join(here, 'frontend-tools', 'package.json'))('esbuild');
} catch {
  console.error('esbuild is not installed. Run: npm ci --prefix scripts/frontend-tools');
  process.exit(2);
}

if (!inPlace) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(src, out, { recursive: true });
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Names declared at the top level of a classic script (column 0), which other files and HTML may use. */
function topLevelNames(code) {
  const names = new Set();
  for (const match of code.matchAll(/^(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(match[1]);
  }
  return names;
}

const gz = (text) => zlib.gzipSync(text, { level: 6 }).length;
const totals = { files: 0, raw: 0, min: 0, gzRaw: 0, gzMin: 0, kept: 0 };
const problems = [];

for (const file of walk(out)) {
  const ext = path.extname(file);
  if ((ext !== '.js' && ext !== '.css') || file.endsWith(`.min${ext}`)) continue;
  const rel = path.relative(out, file);
  const code = fs.readFileSync(file, 'utf8');
  try {
    const result = esbuild.transformSync(code, {
      loader: ext === '.js' ? 'js' : 'css',
      minify: true,
      legalComments: 'inline',
      logLevel: 'silent',
    });
    if (ext === '.js') {
      const lost = [...topLevelNames(code)].filter((name) => !result.code.includes(name));
      if (lost.length) throw new Error(`top-level names missing after minify: ${lost.join(', ')}`);
    }
    fs.writeFileSync(file, result.code);
    totals.files += 1;
    totals.raw += Buffer.byteLength(code);
    totals.min += Buffer.byteLength(result.code);
    totals.gzRaw += gz(code);
    totals.gzMin += gz(result.code);
  } catch (error) {
    totals.kept += 1;
    problems.push(`${rel}: ${String(error.message).split('\n')[0]}`);
  }
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`Minified ${totals.files} files: ${kb(totals.raw)} -> ${kb(totals.min)} raw, ${kb(totals.gzRaw)} -> ${kb(totals.gzMin)} gzip.`);
if (problems.length) {
  console.warn(`${totals.kept} file(s) kept unminified:`);
  for (const problem of problems) console.warn(`  - ${problem}`);
  if (strict) process.exit(1);
}
