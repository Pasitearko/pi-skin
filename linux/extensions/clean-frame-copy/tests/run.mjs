import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Local integration test: use the installed Pi and ALPS, never the clipboard.
const home = homedir();
const piRoot = process.env.PI_TEST_ROOT ?? `${home}/.local/lib/node_modules/@earendil-works/pi-coding-agent`;
const alpsRoot = process.env.ALPS_TEST_ROOT ?? `${home}/.pi/agent/npm/node_modules/alps-pi`;
const require = createRequire(`${piRoot}/package.json`);
const tuiRoot = dirname(dirname(require.resolve('@earendil-works/pi-tui')));
const { createJiti } = require('jiti');
const jiti = createJiti(import.meta.url, { alias: {
  '@earendil-works/pi-coding-agent': `${piRoot}/dist/index.js`,
  '@earendil-works/pi-tui': `${tuiRoot}/dist/index.js`,
} });
const sdk = await jiti.import(`${piRoot}/dist/index.js`);
assert.equal(sdk.VERSION, '1.3.0', 'private APIs require a regression pass on each Pi release');
const tui = await jiti.import(`${tuiRoot}/dist/index.js`);
const { renderLayoutFrame } = await jiti.import(`${tuiRoot}/dist/layout.js`);
const { createBottomInputEditor } = await jiti.import(`${alpsRoot}/src/features/bottom-input/editor.ts`);
const extension = await jiti.import(resolve(dirname(fileURLToPath(import.meta.url)), '../index.ts'));
const { cleanSelectionText, cleanSelectionHighlight } = extension;
const nativeCopy = tui.TuiAltScreen.prototype.getActiveSelectionText;
const nativeHighlight = tui.TuiAltScreen.prototype.applySelection;
const theme = { borderColor: s => `\x1b[34m${s}\x1b[39m`, fg: (_k, s) => s, bg: (_k, s) => s, bold: s => s };
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function editor(text, { enabled = true, fallback = false, popup = [] } = {}) {
  const state = { beautifiedInputEnabled: enabled, getTheme: () => theme,
    getFrameStatus: () => ({ model: 'test-model', thinking: 'high', context: '42%', elapsed: '3s' }) };
  const instance = createBottomInputEditor({ terminal: { rows: 200 }, requestRender() {} }, theme,
    { matches: () => false }, state, fallback ? { CustomEditor: false } : {});
  instance.setText(text);
  instance.focused = true;
  if (popup.length) {
    instance.autocompleteState = {};
    instance.autocompleteList = { render: () => popup };
  }
  assert.ok(instance instanceof tui.Editor);
  return instance;
}
function fixture(component, width = 60, { x = 0, y = 0, layoutHeight } = {}) {
  const rendered = component.render(width);
  const prefix = Array.from({ length: y }, () => '');
  const lines = [...prefix, ...rendered.map(line => ' '.repeat(x) + line)];
  const rect = { x, y, width, height: layoutHeight ?? rendered.length };
  const box = { component, rect, clip: rect, children: [] };
  const screen = { previousScreen: lines, currentLayout: { root: box }, terminal: { columns: width + x },
    hasOverlay: () => false, getSelectionBounds() { return this.selection; },
    getSelectionColumns: tui.TuiAltScreen.prototype.getSelectionColumns,
    applySelectionHighlight: tui.TuiAltScreen.prototype.applySelectionHighlight };
  return { instance: component, screen, lines, width, x, y, rendered };
}
function select(f, startRow, startCol, endRow, endCol, boundary = true) {
  f.screen.selection = { start: { row: startRow, col: startCol }, end: { row: endRow, col: endCol, boundary } };
}
function all(f) { select(f, f.y, f.x, f.y + f.rendered.length - 1, f.x + f.width); }
function clean(f) { return cleanSelectionText(f.screen, nativeCopy.call(f.screen) ?? ''); }
function noRerender(f) { f.instance.render = () => { throw Error('selection extraction must not render'); }; }
function highlightedCells(line) {
  // These fixtures use inverse video only for the fake cursor and selection.
  let inverse = false, col = 0;
  const result = [];
  for (const chunk of line.split(/(\x1b\[[0-?]*[ -/]*[@-~])/)) {
    if (chunk.startsWith('\x1b[')) {
      const codes = chunk.slice(2, -1).split(';').map(Number);
      for (const code of codes) { if (code === 0 || code === 27) inverse = false; if (code === 7) inverse = true; }
    } else for (const ch of chunk) {
      // Used only on ASCII fixtures; colored ANSI sequences consume no cells.
      if (inverse) result.push(col);
      col++;
    }
  }
  return result;
}

test('real ALPS multiline editor removes side borders and status rows', () => {
  const f = fixture(editor('first line\nsecond line'));
  all(f);
  assert.match(nativeCopy.call(f.screen), /│/);
  noRerender(f);
  assert.equal(clean(f), 'first line\nsecond line');
});
test('ALPS fallback editor uses the same verified geometry', () => {
  const f = fixture(editor('first line\nsecond line', { fallback: true })); all(f);
  assert.equal(f.instance.constructor.name, 'FallbackBeautifiedInputEditor');
  assert.equal(clean(f), 'first line\nsecond line');
});
test('partial multiline endpoints retain the exact selected substrings', () => {
  const f = fixture(editor('first line\nsecond line'));
  select(f, 1, 4, 2, 6);
  assert.equal(clean(f), 'rst line\nseco');
});
test('single-line partial selection does not gain or lose characters', () => {
  const f = fixture(editor('first line'));
  select(f, 1, 3, 1, 7);
  assert.equal(clean(f), 'irst');
});
test('blank rows, indentation, code fences and literal border glyphs remain', () => {
  const text = '  a │ b ─ c ╭ d\n\n```ts\n  const x = "│";\n```';
  const f = fixture(editor(text)); all(f);
  assert.equal(clean(f), text);
});
test('Chinese, emoji and combining graphemes remain intact', () => {
  const text = '中文 🌧️ e\u0301\n  下一行 😀';
  const f = fixture(editor(text)); all(f);
  assert.equal(clean(f), text);
});
test('Chinese partial endpoints use native grapheme-aware column bounds', () => {
  const f = fixture(editor('中文\n下一行'));
  select(f, 1, 3, 2, 3, false);
  assert.equal(clean(f), '中文\n下');
});
for (const width of [8, 12, 40, 140]) test(`narrow/wide editor at ${width} columns`, () => {
  const f = fixture(editor('a\nb'), width); all(f);
  assert.equal(clean(f), 'a\nb');
});
test('soft wraps retain existing visual-line copy semantics', () => {
  const f = fixture(editor('abcdefghijklmnop'), 12); all(f);
  const expected = f.rendered.slice(1, -1).map(line => tui.stripTerminalSequences(line).slice(2, -2).trimEnd()).join('\n');
  assert.equal(clean(f), expected);
  assert.ok(expected.includes('\n'));
});
test('autocomplete stays outside the mask and retains its own text', () => {
  const f = fixture(editor('/he', { popup: ['choice │ keep', '╰ popup ╯'] }));
  all(f);
  assert.equal(clean(f), '/he\nchoice │ keep\n╰ popup ╯');
  select(f, 3, 0, 4, 60);
  assert.equal(clean(f), 'choice │ keep\n╰ popup ╯');
});
test('nested native Box/Container offsets are respected without rendering', () => {
  const e = editor('hello\nworld');
  const box = new tui.Box(2, 1); box.addChild(e);
  const container = new tui.Container(); container.addChild(box);
  const f = fixture(container, 64, { x: 3, y: 2 });
  select(f, 4, 7, 5, 12);
  e.render = () => { throw Error('no editor rerender'); };
  noRerender(f);
  // Preserve real cells outside the editor rectangle (the parent's left padding).
  assert.equal(clean(f), 'hello\n     world');
});
test('highlight excludes the same outer cells as copied content', () => {
  const f = fixture(editor('hello\nworld')); all(f);
  // Remove the pre-existing fake cursor inverse before comparing selection cells.
  f.screen.previousScreen = f.lines.map(line => line.split(tui.CURSOR_MARKER).join('').replace(/\x1b\[(?:7|27)m/g, ''));
  const native = nativeHighlight.call(f.screen, f.screen.previousScreen, f.screen.currentLayout);
  const highlighted = cleanSelectionHighlight(f.screen, f.screen.previousScreen, f.screen.currentLayout, native);
  assert.deepEqual(highlightedCells(highlighted[0]), []);
  assert.deepEqual(highlightedCells(highlighted.at(-1)), []);
  for (const line of highlighted.slice(1, -1)) {
    const cells = highlightedCells(line);
    assert.ok(cells.length > 0);
    assert.ok(cells.every(col => col >= 2 && col < f.width - 2));
  }
});
test('a decoration-only selection remains an empty real selection', () => {
  const f = fixture(editor('hello')); select(f, 0, 0, 0, 60);
  assert.equal(clean(f), '');
});
test('ALPS disabled retains native behavior', () => {
  const f = fixture(editor('hello\nworld', { enabled: false })); all(f);
  assert.equal(clean(f), nativeCopy.call(f.screen));
});
test('native fallback below eight columns is unchanged', () => {
  const f = fixture(editor('a\nb'), 7); all(f);
  assert.equal(clean(f), nativeCopy.call(f.screen));
});
test('unknown editor and a user-drawn frame are not stripped', () => {
  const fake = { render: () => ['╭──────╮', '│ user │', '╰──────╯'] };
  const f = fixture(fake, 8); all(f);
  assert.equal(clean(f), nativeCopy.call(f.screen));
});
test('overlay selections retain native behavior', () => {
  const f = fixture(editor('hello')); all(f); f.screen.hasOverlay = () => true;
  assert.equal(clean(f), nativeCopy.call(f.screen));
});
test('stale width, native counts and clipped heights fail closed', () => {
  for (const mutate of [
    f => { f.instance.lastWidth--; },
    f => { f.instance.renderedVisibleLineCount++; },
    f => { f.screen.currentLayout.root.rect.height--; },
    f => { f.screen.previousScreen[1] = 'BROKEN'; },
  ]) {
    const f = fixture(editor('hello\nworld')); all(f); mutate(f);
    assert.equal(clean(f), nativeCopy.call(f.screen));
  }
});
test('real viewport leaf clipping cannot be mistaken for a complete editor', () => {
  const e = editor('one\ntwo\nthree');
  const layout = renderLayoutFrame(e, 60, 2, () => {});
  const f = fixture(e);
  f.screen.currentLayout = layout; f.screen.previousScreen = layout.lines;
  select(f, 0, 0, 1, 60);
  assert.equal(clean(f), nativeCopy.call(f.screen));
});
test('existing ALPS message-frame behavior keeps its title, removes borders', () => {
  const width = 30;
  const lines = ['╭─ TEST ' + '─'.repeat(width - 9) + '╮',
    '│ ' + 'hello'.padEnd(width - 4) + ' │', '╰' + '─'.repeat(width - 2) + '╯'];
  const render = () => lines;
  render[Symbol.for('alps.pi.wrappedRender.v2')] = { version: 18 };
  const component = { render, [Symbol.for('alps.pi.renderCache.v9')]: { width, lines } };
  const f = fixture(component, width); all(f);
  assert.equal(clean(f), 'TEST\nhello');
});
test('extension lifecycle, on/off and shutdown restore both native methods', () => {
  const handlers = new Map(), commands = new Map(), notices = [];
  extension.default({ on: (event, fn) => handlers.set(event, fn), registerCommand: (name, spec) => commands.set(name, spec) });
  const ctx = { hasUI: true, mode: 'tui', ui: { notify: (...args) => notices.push(args) } };
  handlers.get('session_start')({}, ctx);
  const f = fixture(editor('hello\nworld')); all(f);
  assert.equal(tui.TuiAltScreen.prototype.getActiveSelectionText.call(f.screen), 'hello\nworld');
  commands.get('clean-copy').handler('off', ctx);
  assert.equal(tui.TuiAltScreen.prototype.getActiveSelectionText.call(f.screen), nativeCopy.call(f.screen));
  commands.get('clean-copy').handler('on', ctx);
  assert.equal(tui.TuiAltScreen.prototype.getActiveSelectionText.call(f.screen), 'hello\nworld');
  handlers.get('session_shutdown')();
  assert.equal(tui.TuiAltScreen.prototype.getActiveSelectionText, nativeCopy);
  assert.equal(tui.TuiAltScreen.prototype.applySelection, nativeHighlight);
});
console.log(`PASS: ${passed} integration cases; real Pi/ALPS renderers, clipboard untouched.`);
