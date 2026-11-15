#!/usr/bin/env node
/**
 * Builds the consolidated production stylesheets from their manifests.
 *
 * The pages load `frontend/css/style.css` and `frontend/css/motion-extended.css`. Those files are
 * GENERATED from the small modules under `frontend/css/` (see `style.manifest.css` and
 * `motion-extended.manifest.css`, where import order defines the cascade). Edit the modules, never
 * the generated files, then run:
 *
 *     node scripts/build-css.mjs          # rebuild the bundles
 *     node scripts/build-css.mjs --check  # exit 1 if a bundle is out of date (used in CI)
 *
 * No dependencies. Output is deterministic, so a clean `--check` means the bundle matches its sources.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CSS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'css');

const TARGETS = [
  {
    manifest: 'style.manifest.css',
    output: 'style.css',
    title: 'ExpenseTracker Pro - Production Consolidated Stylesheet',
  },
  {
    manifest: 'motion-extended.manifest.css',
    output: 'motion-extended.css',
    title: 'ExpenseTracker Pro - Production Consolidated Motion Stylesheet',
  },
];

const IMPORT_LINE = /^@import url\(["']([^"']+)["']\);$/;

function read(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

/** Wraps one imported module in its start and end markers. */
function block(raw, file, stack) {
  if (stack.includes(file)) {
    throw new Error(`Circular @import: ${[...stack, file].map((f) => path.relative(CSS_DIR, f)).join(' -> ')}`);
  }
  if (!fs.existsSync(file)) {
    throw new Error(`@import "${raw}" not found (${path.relative(CSS_DIR, file)})`);
  }
  const body = expand(file, [...stack, file]).trimEnd();
  return `/* --- Content from ${raw} --- */\n${body}\n\n/* --- End of ${raw} --- */`;
}

/** Returns a file's text with each run of @import lines replaced by the imported modules, inlined. */
function expand(file, stack) {
  const dir = path.dirname(file);
  let out = '';
  let text = [];
  let run = [];

  const flushText = () => {
    if (text.length) out += `${text.join('\n')}\n`;
    text = [];
  };
  const flushRun = () => {
    if (!run.length) return;
    if (out && !out.endsWith('\n\n')) out += '\n';
    out += `${run.join('\n\n')}\n\n`;
    run = [];
  };

  for (const line of read(file)) {
    const match = IMPORT_LINE.exec(line.trim());
    if (match) {
      flushText();
      run.push(block(match[1], path.resolve(dir, match[1]), stack));
    } else {
      flushRun();
      text.push(line);
    }
  }
  flushText();
  flushRun();
  return out;
}

function build({ manifest, title }) {
  const file = path.join(CSS_DIR, manifest);
  return `/* ${title} */\n${expand(file, [file]).trimEnd()}\n`;
}

const check = process.argv.includes('--check');
let stale = false;

for (const target of TARGETS) {
  const outFile = path.join(CSS_DIR, target.output);
  const next = build(target);
  const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').replace(/\r\n/g, '\n') : null;

  if (check) {
    if (current !== next) {
      stale = true;
      console.error(`STALE  frontend/css/${target.output} does not match ${target.manifest} and its modules.`);
    } else {
      console.log(`ok     frontend/css/${target.output}`);
    }
  } else if (current === next) {
    console.log(`up to date  frontend/css/${target.output}`);
  } else {
    fs.writeFileSync(outFile, next);
    console.log(`wrote       frontend/css/${target.output} (${next.split('\n').length} lines)`);
  }
}

if (stale) {
  console.error('\nRun `node scripts/build-css.mjs` and commit the result. Edit the modules, not the generated bundle.');
  process.exit(1);
}
