#!/usr/bin/env node
/**
 * Frontend audit — measures what makes the frontend hard to follow, so cleanup
 * progress is a number instead of an impression. No dependencies, read-only.
 *
 *   node scripts/frontend-audit.mjs            # human-readable report
 *   node scripts/frontend-audit.mjs --json     # machine-readable
 *   node scripts/frontend-audit.mjs --top 25   # longer "worst offenders" lists
 *
 * Web:    !important per file, the same selector+property declared in several
 *         files (the real "one element, many owners" problem), CSS living in
 *         HTML/JS (inline style attributes, el.style writes, <style> blocks).
 * Mobile: inline style objects, StyleSheet blocks, hard-coded colours.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const topN = Number(args[args.indexOf('--top') + 1]) || 12;

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(p, 'utf8');
const count = (s, re) => (s.match(re) || []).length;
const top = (m, n = topN) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

/** Minimal CSS reader: yields {context, selector, prop, important} per declaration. */
function* declarations(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const ctx = [];            // stack of at-rule preludes ('' for plain rules)
  let buf = '', depth = 0;
  const rules = [];          // [{selectors, body, context}]
  const stack = [];
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '(') depth++;
    if (c === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && c === '{') {
      const prelude = buf.trim(); buf = '';
      if (/^@(media|supports|layer|container)/i.test(prelude)) stack.push({ kind: 'group', prelude });
      else if (/^@/.test(prelude)) stack.push({ kind: 'skip', prelude });
      else stack.push({ kind: 'rule', prelude, body: '' });
    } else if (depth === 0 && c === '}') {
      const top = stack.pop();
      if (top && top.kind === 'rule') {
        const context = stack.filter((s) => s.kind === 'group').map((s) => s.prelude).join(' > ');
        const skipped = stack.some((s) => s.kind === 'skip');
        if (!skipped) rules.push({ selectors: top.prelude, body: top.body + buf, context });
      }
      buf = '';
    } else {
      buf += c;
      const t = stack[stack.length - 1];
      if (t && t.kind === 'rule' && (c === ';')) { t.body += buf; buf = ''; }
    }
  }
  const pending = [];
  for (const r of rules) {
    const selectors = r.selectors.split(',').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    let d = 0, cur = '';
    const parts = [];
    for (const ch of r.body) {
      if (ch === '(') d++; if (ch === ')') d = Math.max(0, d - 1);
      if (ch === ';' && d === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    for (const part of parts) {
      const i = part.indexOf(':'); if (i < 1) continue;
      const prop = part.slice(0, i).trim().toLowerCase();
      if (!/^[-a-z]+$/.test(prop)) continue;
      const important = /!\s*important/i.test(part.slice(i + 1));
      selectors.forEach((selector, idx) => { pending.push({ context: r.context, selector, prop, important, first: idx === 0 }); });
    }
  }
  yield* pending;
}

// ---------------------------------------------------------------- web CSS
const cssFiles = walk(path.join(root, 'frontend', 'css'), ['.css']);
let totalDecl = 0, totalImportant = 0, totalLines = 0;
const importantByFile = new Map(), declByFile = new Map();
const owners = new Map();   // "context|selector|prop" -> Set(files)
for (const f of cssFiles) {
  const src = read(f); totalLines += src.split('\n').length;
  let n = 0, imp = 0;
  for (const d of declarations(src)) {
    if (d.first) { n++; if (d.important) imp++; }
    const key = `${d.context}|${d.selector}|${d.prop}`;
    if (!owners.has(key)) owners.set(key, new Set());
    owners.get(key).add(rel(f));
  }
  totalDecl += n; totalImportant += imp;
  importantByFile.set(rel(f), imp); declByFile.set(rel(f), n);
}
const multi = [...owners.entries()].filter(([, s]) => s.size > 1);
const multiBySelector = new Map();
for (const [key, files] of multi) {
  const [ctx, sel] = key.split('|');
  const k = (ctx ? `${sel}  [${ctx}]` : sel);
  multiBySelector.set(k, (multiBySelector.get(k) || 0) + 1);
}
const filesInConflict = new Map();
for (const [, files] of multi) for (const f of files) filesInConflict.set(f, (filesInConflict.get(f) || 0) + 1);

// ---------------------------------------------------------------- CSS inside HTML / JS
const webSrc = [...walk(path.join(root, 'frontend'), ['.html', '.js'])].filter((p) => !rel(p).includes('/vendor/'));
const inlineAttr = new Map(), elStyle = new Map(), styleBlocks = new Map();
let inlineAttrTotal = 0, elStyleTotal = 0, styleBlockTotal = 0, htmlOnclick = 0;
for (const f of webSrc) {
  const s = read(f);
  const a = count(s, /\bstyle\s*=\s*\\?["']/g);
  const e = count(s, /\.style\.[a-zA-Z]+\s*=[^=]|\.style\.cssText|\.style\.setProperty|setAttribute\(\s*['"]style['"]/g);
  const b = count(s, /<style[\s>]|createElement\(\s*['"]style['"]\s*\)/g);
  if (a) inlineAttr.set(rel(f), a); if (e) elStyle.set(rel(f), e); if (b) styleBlocks.set(rel(f), b);
  inlineAttrTotal += a; elStyleTotal += e; styleBlockTotal += b;
  if (f.endsWith('.html')) htmlOnclick += count(s, /\son[a-z]+\s*=\s*["']/g);
}

// ---------------------------------------------------------------- mobile
const tsx = [...walk(path.join(root, 'mobile', 'app'), ['.tsx']), ...walk(path.join(root, 'mobile', 'components'), ['.tsx'])];
const inlineObj = new Map(), hexColors = new Map(), lines = new Map();
let inlineObjTotal = 0, hexTotal = 0, styleSheets = 0;
for (const f of tsx) {
  const s = read(f);
  const o = count(s, /style=\{\s*\{|style=\{\s*\[[^\]]*\{/g);
  const h = count(s, /['"`]#[0-9a-fA-F]{3,8}['"`]/g);
  inlineObj.set(rel(f), o); hexColors.set(rel(f), h); lines.set(rel(f), s.split('\n').length);
  inlineObjTotal += o; hexTotal += h; styleSheets += count(s, /StyleSheet\.create/g);
}

const report = {
  web: {
    cssFiles: cssFiles.length, cssLines: totalLines, declarations: totalDecl,
    important: totalImportant,
    importantPct: totalDecl ? +(100 * totalImportant / totalDecl).toFixed(1) : 0,
    importantTopFiles: top(importantByFile),
    selectorPropertyDeclaredInSeveralFiles: multi.length,
    mostContestedSelectors: top(multiBySelector),
    filesMostInvolvedInConflicts: top(filesInConflict),
    inlineStyleAttributes: { total: inlineAttrTotal, topFiles: top(inlineAttr) },
    styleWrittenFromJs: { total: elStyleTotal, topFiles: top(elStyle) },
    styleBlocksOrInjectedStyleTags: { total: styleBlockTotal, topFiles: top(styleBlocks) },
    inlineEventHandlerAttributesInHtml: htmlOnclick,
  },
  mobile: {
    screensAndComponents: tsx.length, inlineStyleObjects: inlineObjTotal,
    styleSheetBlocks: styleSheets, hardCodedHexColours: hexTotal,
    inlineStyleTopFiles: top(inlineObj), hexTopFiles: top(hexColors), longestFiles: top(lines),
  },
};

if (asJson) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }
const pad = (n, w = 6) => String(n).padStart(w);
const list = (rows) => rows.map(([k, v]) => `   ${pad(v)}  ${k}`).join('\n');
const w = report.web, m = report.mobile;
console.log(`WEB CSS  ${w.cssFiles} files, ${w.cssLines} lines, ${w.declarations} declarations
  !important:           ${w.important}  (${w.importantPct}% of declarations)
  same selector+property declared in 2+ files:  ${w.selectorPropertyDeclaredInSeveralFiles}

 files with the most !important
${list(w.importantTopFiles)}

 selectors whose properties are declared in several files
${list(w.mostContestedSelectors)}

 files most involved in those conflicts
${list(w.filesMostInvolvedInConflicts)}

CSS INSIDE HTML / JS
  inline style="…" attributes:      ${w.inlineStyleAttributes.total}
${list(w.inlineStyleAttributes.topFiles)}
  element.style writes from JS:     ${w.styleWrittenFromJs.total}
${list(w.styleWrittenFromJs.topFiles)}
  <style> blocks / injected tags:   ${w.styleBlocksOrInjectedStyleTags.total}
${list(w.styleBlocksOrInjectedStyleTags.topFiles)}
  inline on…= handlers in HTML:     ${w.inlineEventHandlerAttributesInHtml}  (block removing 'unsafe-inline' from the CSP)

MOBILE  ${m.screensAndComponents} files
  inline style objects: ${m.inlineStyleObjects}   StyleSheet blocks: ${m.styleSheetBlocks}   hard-coded hex colours: ${m.hardCodedHexColours}
 most inline style objects
${list(m.inlineStyleTopFiles)}
 most hard-coded colours
${list(m.hexTopFiles)}
 longest files (lines)
${list(m.longestFiles)}
`);
