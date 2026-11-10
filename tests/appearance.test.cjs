// Appearance (theme.js + generated dark.css) and library sorting.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.dirname(require.resolve('../app.js'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const {buildDarkCss, remap, parseColor} = require('../tools/build-dark-theme.cjs');

function themeWindow({saved = null, dark = false} = {}) {
  const store = new Map(saved ? [['winds-notes-theme-v1', saved]] : []);
  const listeners = [];
  const media = {matches: dark, addEventListener: (type, fn) => listeners.push(fn)};
  const meta = {content: '', setAttribute(name, value) { this[name] = value; }};
  const html = {dataset: {}};
  const window = {
    localStorage: {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v))},
    matchMedia: () => media,
    document: {documentElement: html, querySelector: () => meta}
  };
  vm.runInNewContext(read('theme.js'), {window, globalThis: window});
  return {theme: window.WindsTheme, html, meta, store, setDevice(value) { media.matches = value; listeners.forEach(fn => fn()); }};
}

test('appearance follows the device by default and applies before the stylesheets', () => {
  const light = themeWindow();
  assert.equal(light.theme.mode, 'system');
  assert.equal(light.html.dataset.theme, 'light');
  assert.equal(light.meta.content, '#f8f9fc');
  const dark = themeWindow({dark: true});
  assert.equal(dark.html.dataset.theme, 'dark');
  assert.equal(dark.meta.content, '#16171f');
  dark.setDevice(false);
  assert.equal(dark.html.dataset.theme, 'light', 'tracks the device while on Match device');
  const html = read('index.html');
  assert.ok(html.indexOf('theme.js') < html.indexOf('styles.css'), 'theme is applied before the first paint');
  assert.ok(html.indexOf('styles.css') < html.indexOf('dark.css'));
});

test('an explicit choice is remembered and ignores device changes; invalid values are rejected', () => {
  const app = themeWindow({dark: true});
  assert.equal(app.theme.set('light'), true);
  assert.equal(app.store.get('winds-notes-theme-v1'), 'light');
  assert.equal(app.html.dataset.theme, 'light');
  app.setDevice(true);
  assert.equal(app.html.dataset.theme, 'light');
  assert.equal(app.theme.set('sepia'), false);
  assert.equal(app.theme.mode, 'light');
  assert.equal(themeWindow({saved: 'dark'}).html.dataset.theme, 'dark');
  assert.equal(themeWindow({saved: 'bogus'}).theme.mode, 'system');
});

test('dark.css is generated from the current styles.css', () => {
  assert.equal(read('dark.css'), buildDarkCss(read('styles.css')), 'run: npm run build:dark');
});

test('dark mode darkens app surfaces, lightens text and keeps the writing paper, covers and canvases light', () => {
  const css = read('dark.css');
  const hex = value => { const c = parseColor(value); return (c.rgb[0] * 299 + c.rgb[1] * 587 + c.rgb[2] * 114) / 1000; };
  assert.ok(hex(remap(parseColor('#ffffff'), 'bg')) < 50, 'white surfaces become dark');
  assert.ok(hex(remap(parseColor('#20213e'), 'text')) > 190, 'ink-coloured text becomes light');
  assert.equal(remap(parseColor('#6557ed'), 'bg'), null, 'accent buttons keep their colour');
  for (const kept of ['.page-shell', '.stack-page-body', '.book-cover', '.paper-preview', '.color-button', '.theme-swatch'])
    assert.ok(!new RegExp(`\\${kept}[^{]*\\{[^}]*background`).test(css), kept + ' stays as designed');
  assert.ok(!/(^|[\s>+~,])canvas\b[^{]*\{/m.test(css), 'canvases are never restyled');
  assert.match(css, /html\[data-theme="dark"\] \.editor-header/);
  assert.match(css, /color-scheme:dark/);
  for (const line of css.split('\n').filter(l => l.includes('{') && !l.startsWith('@') && !l.startsWith('/*') && l.trim() !== '}'))
    for (const selector of line.slice(0, line.indexOf('{')).split(','))
      assert.match(selector.trim(), /^html\[data-theme="dark"\]/, 'every rule is scoped to dark mode: ' + selector);
});

test('library sorting: recent, name, newest and oldest, with a stable name tie-break', () => {
  const app = read('app.js');
  const code = app.slice(app.indexOf('  /* Library order'), app.indexOf('  function renderContinue(){'));
  const store = new Map();
  const context = {localStorage: {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v)}, Date};
  vm.runInNewContext(code + '\nglobalThis.api={sortNotebooks,librarySort};', context);
  const books = [
    {id: 'a', title: 'physics', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z'},
    {id: 'b', title: 'Algebra 10', createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-11-05T00:00:00Z'},
    {id: 'c', title: 'Algebra 9', createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z'},
    {id: 'd', title: 'Legacy', updatedAt: '2025-12-01T00:00:00Z'}
  ];
  const ids = mode => [...context.api.sortNotebooks(books, mode)].map(b => b.id).join('');
  assert.equal(ids('recent'), 'bacd');
  assert.equal(ids('name'), 'cbda', 'case-insensitive, numeric-aware');
  assert.equal(ids('created'), 'bcad');
  assert.equal(ids('oldest'), 'dacb', 'notebooks without createdAt fall back to updatedAt');
  assert.equal(context.api.librarySort(), 'recent');
  store.set('winds-notes-sort-v1', 'name');assert.equal(context.api.librarySort(), 'name');
  store.set('winds-notes-sort-v1', '<script>');assert.equal(context.api.librarySort(), 'recent');
  assert.equal(books[0].id, 'a', 'sorting never reorders the stored notebooks');
});
