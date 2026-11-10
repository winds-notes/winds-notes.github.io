#!/usr/bin/env node
/* Generates dark.css from styles.css.
 *
 * Every colour in the app chrome is remapped for a dark appearance and scoped
 * under html[data-theme="dark"]: light surfaces become dark (keeping a hint of
 * their hue), dark text becomes light, accents stay. The writing paper itself,
 * notebook covers, colour swatches, canvases and previews keep their light
 * look so handwriting, exports and thumbnails are unchanged.
 *
 * Run `npm run build:dark` after editing styles.css. A test fails when
 * dark.css is out of date. No dependencies.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SCOPE = 'html[data-theme="dark"]';
// Paper-like or colour-sample elements that stay as designed in dark mode.
const KEEP_LIGHT = ['.page-shell', '.stack-page-body', '.book-cover', '.cover-', '.paper-preview', '.mini-',
  '.thumb-canvas-wrap', '.hero-paper', '.hero-pencil', '.hero-lines', '.hero-underline', '.hero-hello', '.hero-doodle', '.color-button',
  '.extended-swatch', '.fill-swatch', '.inline-text-editor', '.size-preview', '.image-crop', '#objectRotationHandle',
  '#objectCropHandle', '.artist-active-material', '.artist-sample', '.active-fill-color', '#inkCanvas', '#pageCanvas',
  '#liveCanvas', '.pencil-diagnostics pre', '.winds-auth-wait', '.theme-swatch'];

/* ---------- colour helpers ---------- */
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function toRgb(h, s, l) {
  if (!s) return [l, l, l].map(v => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
}
function parseColor(text) {
  const value = text.trim().toLowerCase();
  if (value === 'white') return {rgb: [255, 255, 255], a: 1, form: 'hex'};
  if (value === 'black') return {rgb: [0, 0, 0], a: 1, form: 'hex'};
  let m = value.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('');
    if (hex.length !== 6 && hex.length !== 8) return null;
    const n = i => parseInt(hex.slice(i, i + 2), 16);
    return {rgb: [n(0), n(2), n(4)], a: hex.length === 8 ? n(6) / 255 : 1, form: 'hex'};
  }
  m = value.match(/^rgba?\(([^)]*)\)$/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return {rgb: parts.slice(0, 3), a: parts.length > 3 ? parts[3] : 1, form: 'rgb'};
  }
  return null;
}
function format({rgb, a}, form) {
  if (a < 1 || form === 'rgb') return `rgba(${rgb.join(',')},${+a.toFixed(3)})`;
  return '#' + rgb.map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}
/** Remap one colour for a role: background, text or border. */
function remap(color, role) {
  let [h, s, l] = toHsl(...color.rgb);
  // Neutral whites/greys take the app's cool blue-violet tint in dark mode.
  if (s < 0.05 && role !== 'text') { h = 0.66; s = 0.16; }
  let next = null;
  if (role === 'bg') {
    if (l > 0.82) next = [h, s * 0.32, 0.115 + (1 - l) * 0.55];       // white and tints → deep surfaces
    else if (s > 0.35 && l >= 0.3) next = null;                          // accent fills stay
    else if (l >= 0.5) next = [h, s * 0.4, 0.13 + (1 - l) * 0.45];       // greys → dark greys
  } else if (role === 'text') {
    if (l < 0.55) next = s >= 0.6 ? [h, s, Math.max(0.7, 1 - l)] : [h, s * 0.45, 0.91 - l * 0.35]; // ink → light
    else if (l < 0.8) next = [h, s, s > 0.4 ? Math.max(l, 0.74) : Math.max(l, 0.66)];             // muted/accents → readable
  } else if (role === 'border') {
    if (l > 0.75) next = [h, s * 0.35, 0.2 + (1 - l) * 0.45];
  }
  if (!next) return null;
  return format({rgb: toRgb(next[0], clamp(next[1]), clamp(next[2])), a: color.a}, color.form);
}
const COLOR_TOKEN = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b/g;
function remapValue(value, role) {
  let changed = false;
  const out = value.replace(COLOR_TOKEN, token => {
    const color = parseColor(token);
    if (!color) return token;
    const mapped = remap(color, role);
    if (!mapped) return token;
    changed = true; return mapped;
  });
  return changed ? out : null;
}
function roleFor(property, value) {
  const p = property.toLowerCase();
  if (p.startsWith('--')) {
    const color = parseColor(value.replace(/!important/, '').trim());
    if (!color) return null;
    const l = toHsl(...color.rgb)[2];
    return l > 0.82 ? 'bg' : l < 0.45 ? 'text' : null;
  }
  if (/^background(-color|-image)?$/.test(p)) return 'bg';
  if (/^(color|fill|caret-color|-webkit-text-fill-color|text-decoration-color)$/.test(p)) return 'text';
  // Focus outlines keep their light accent colour so they stay visible.
  if (/^(border(-(top|right|bottom|left))?(-color)?|column-rule(-color)?)$/.test(p)) return 'border';
  return null;
}

/* ---------- minimal CSS parser (rules, nested @media/@supports) ---------- */
function parse(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  function readUntil(stops) {
    let out = '', quote = null, depth = 0;
    while (i < css.length) {
      const c = css[i];
      if (quote) { out += c; if (c === '\\') { out += css[++i] || ''; } else if (c === quote) quote = null; i++; continue; }
      if (c === '"' || c === "'") { quote = c; out += c; i++; continue; }
      if (c === '(') depth++; else if (c === ')') depth--;
      if (depth <= 0 && stops.includes(c)) return out;
      out += c; i++;
    }
    return out;
  }
  function block() {
    const nodes = [];
    while (i < css.length) {
      while (/\s/.test(css[i] || '')) i++;
      if (i >= css.length) break;
      if (css[i] === '}') { i++; break; }
      const prelude = readUntil(['{', ';', '}']).trim();
      if (css[i] === ';') { i++; continue; }      // @import / @charset
      if (css[i] === '}') continue;
      i++;                                         // '{'
      if (/^@(media|supports|layer|container)\b/i.test(prelude)) nodes.push({type: 'group', prelude, children: block()});
      else if (prelude.startsWith('@')) { skipBlock(); }   // @keyframes, @font-face, @page
      else { const body = readUntil(['}']); i++; nodes.push({type: 'rule', selector: prelude, body}); }
    }
    return nodes;
  }
  function skipBlock() {
    let depth = 1;
    while (i < css.length && depth) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
  }
  return block();
}
function splitTopLevel(text, separator) {
  const parts = []; let depth = 0, quote = null, current = '';
  for (let k = 0; k < text.length; k++) {
    const c = text[k];
    if (quote) { current += c; if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; current += c; continue; }
    if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--;
    if (c === separator && depth === 0) { parts.push(current); current = ''; continue; }
    current += c;
  }
  if (current.trim()) parts.push(current);
  return parts;
}
function scopeSelector(selector) {
  const kept = splitTopLevel(selector, ',').map(s => s.trim()).filter(Boolean)
    .filter(s => !KEEP_LIGHT.some(token => s.includes(token)) && !/(^|[\s>+~(])canvas\b/.test(s));
  return kept.map(s => {
    if (s.startsWith(':root')) return SCOPE + s.slice(5);
    if (/^html\b/.test(s)) return SCOPE + s.slice(4);
    return `${SCOPE} ${s}`;
  }).join(',');
}
function render(nodes) {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'group') { const inner = render(node.children); if (inner) out += `${node.prelude}{\n${inner}}\n`; continue; }
    const selector = scopeSelector(node.selector);
    if (!selector) continue;
    const declarations = [];
    for (const declaration of splitTopLevel(node.body, ';')) {
      const colon = declaration.indexOf(':');
      if (colon < 0) continue;
      const property = declaration.slice(0, colon).trim(), value = declaration.slice(colon + 1).trim();
      const role = roleFor(property, value);
      if (!role) continue;
      const mapped = remapValue(value, role);
      if (mapped) declarations.push(`${property}:${mapped}`);
    }
    if (declarations.length) out += `${selector}{${declarations.join(';')}}\n`;
  }
  return out;
}

/* Hand-tuned layer, applied after the generated rules. */
const TUNING = `
/* ---- hand-tuned dark surfaces ---- */
${SCOPE}{color-scheme:dark;--ink:#e6e7f2;--muted:#9a9cb6;--pale:#1d1e29;--border:#2c2d3b}
${SCOPE} body{background:#101118;color:var(--ink)}
${SCOPE} .library-view{background:#101118}
${SCOPE} .editor-view,${SCOPE} .editor-body,${SCOPE} .editor-body .canvas-stage,${SCOPE} .editor-body .page-scroller,${SCOPE} .canvas-stage{background:#0d0e14}
${SCOPE} .library-header,${SCOPE} .editor-header,${SCOPE} .editor-header.command-bar{background:#16171f;border-color:#262735}
${SCOPE} .page-shell,${SCOPE} .stack-page-body{box-shadow:0 10px 34px rgba(0,0,0,.55)}
${SCOPE} .stack-page-heading{color:#a59dff}
${SCOPE} .pop-menu,${SCOPE} .cloud-dialog,${SCOPE} .modal,${SCOPE} .mandala-dialog,${SCOPE} .pdf-import-dialog,${SCOPE} .startup-recovery{border-color:#2c2d3b;box-shadow:0 22px 60px rgba(0,0,0,.6)}
${SCOPE} .btn-primary{color:#fff}
${SCOPE} input::placeholder,${SCOPE} textarea::placeholder{color:#6f7190}
${SCOPE} .notebook-card{border-color:#262735;box-shadow:0 8px 26px rgba(0,0,0,.35)}
${SCOPE} .toast{background:#e9e8ff;color:#1b1c2b}
${SCOPE} ::-webkit-scrollbar-thumb{background:#33354a;border-radius:8px}
${SCOPE} .hero-paper{color:#20213e}
${SCOPE} .color-button span{box-shadow:0 0 0 1.5px rgba(255,255,255,.32)}
${SCOPE} .pop-menu.theme-menu button[aria-checked="true"],${SCOPE} .pop-menu.shape-menu .shape-grid button[aria-checked="true"],${SCOPE} .editor-header .shape-tool-trigger.active{color:#c4beff}
${SCOPE} .hero-continue{background:#1b1a2c;border-color:#3a3566}
${SCOPE} kbd{background:#24253a;border-color:#3a3c55;color:#e2e3f0}
`;

function buildDarkCss(source) {
  return `/* Generated by tools/build-dark-theme.cjs from styles.css — do not edit by hand.\n * Run: npm run build:dark */\n${render(parse(source))}${TUNING}`;
}
module.exports = {buildDarkCss, remap, parseColor};

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const css = buildDarkCss(fs.readFileSync(path.join(root, 'styles.css'), 'utf8'));
  fs.writeFileSync(path.join(root, 'dark.css'), css);
  console.log(`dark.css: ${css.length} bytes`);
}
