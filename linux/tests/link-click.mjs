import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(path.join(root, 'package.json'));
const { createJiti } = require('jiti');
const jiti = createJiti(import.meta.url);
const { createFileLinkOutputFilter, supportsNativeLinkHover } = await jiti.import(path.join(root, 'patches/alps-pi/src/file-link-click.ts'));
const { installCtrlClickLinkOpener } = await jiti.import(path.join(root, 'patches/alps-pi/src/local-file-opener.ts'));
const { createBottomInputRuntime } = await jiti.import(path.join(root, 'node_modules/alps-pi/src/features/bottom-input/runtime.ts'));
const { TuiAltScreen } = await import(path.join(root, 'node_modules/@earendil-works/pi-tui/dist/tui-alt-screen.js'));
const osc = url => `\x1b]8;;${url}\x1b\\label\x1b]8;;\x1b\\`;
const targets = ['https://example.com/a?b=1', 'http://localhost:8080/', 'file:///tmp/中文%20资料.html'];
function fixture(url, raw = false, nativeHover = false) {
  const opened = [], written = [];
  const terminal = { columns: 100, rows: 10, write(data) { written.push(data); } };
  const tui = new TuiAltScreen(terminal, false, undefined, { openUrl: target => opened.push(target), copyOnSelect: false });
  tui.requestRender = () => {};
  tui.previousScreen = [raw ? url : osc(url)];
  const originalOpen = tui.openUrl, originalWrite = terminal.write;
  const savedEnv = Object.fromEntries(['TERM', 'KITTY_WINDOW_ID', 'TMUX', 'ZELLIJ', 'STY'].map(key => [key, process.env[key]]));
  let dispose;
  try {
    for (const key of Object.keys(savedEnv)) delete process.env[key];
    if (nativeHover) Object.assign(process.env, { TERM: 'xterm-kitty', KITTY_WINDOW_ID: '1' });
    dispose = installCtrlClickLinkOpener(tui);
  } finally {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  const event = (button, release = false, x = 1) => tui.handleMouseEvent({ button, release, x, y: 0 });
  return { tui, terminal, opened, written, dispose, event, originalOpen, originalWrite };
}
await test('all OSC 8 links stay internal; streaming output preserves text, styles and images', () => {
  const style = '\x1b[31m', image = '\x1b_Ga=T;AAAA\x1b\\';
  for (const url of targets) {
    const input = style + osc(url) + image;
    for (let cut = 0; cut <= input.length; cut++) {
      const f = createFileLinkOutputFilter();
      const output = f.filter(input.slice(0, cut)) + f.filter(input.slice(cut)) + f.flush();
      assert.equal(output, style + '\x1b]8;;\x1b\\label\x1b]8;;\x1b\\' + image);
      assert.ok(!output.includes(url));
    }
    const f = createFileLinkOutputFilter();
    assert.ok(!(f.filter(`\x1b]8;;${url}`) + f.flush()).includes(url));
  }
  const f = createFileLinkOutputFilter();
  const overflow = f.filter('\x1b]8;;https://' + 'x'.repeat(17000)) + f.filter('secret\x07visible');
  assert.ok(overflow.endsWith('visible'));
  assert.ok(!overflow.includes('secret'));
});
await test('native hover is limited to direct Kitty, not other terminals or multiplexers', () => {
  const kitty = { TERM: 'xterm-kitty', KITTY_WINDOW_ID: '1' };
  assert.equal(supportsNativeLinkHover(kitty), true);
  for (const env of [{}, { TERM: 'xterm-kitty' }, { TERM: 'xterm-256color', KITTY_WINDOW_ID: '1' },
    { ...kitty, KITTY_WINDOW_ID: '' }, ...['TMUX', 'ZELLIJ', 'STY'].map(key => ({ ...kitty, [key]: '' }))]) {
    assert.equal(supportsNativeLinkHover(env), false);
  }
});
await test('Kitty keeps native OSC 8 hover data but still opens only on Ctrl-left', () => {
  for (const url of targets) {
    for (const modifier of [0, 4, 8, 20, 24, 28]) {
      const f = fixture(url, false, true);
      f.terminal.write(osc(url));
      assert.equal(f.written.at(-1), osc(url));
      assert.equal(f.terminal.write, f.originalWrite, 'native hover must not alter terminal output');
      f.event(modifier); f.event(modifier, true);
      assert.deepEqual(f.opened, []);
      f.dispose();
    }
    const f = fixture(url, false, true);
    f.event(16); f.event(16, true);
    assert.deepEqual(f.opened, [url]);
    f.dispose();
    assert.equal(f.tui.openUrl, f.originalOpen);
    assert.equal(f.terminal.write, f.originalWrite);
  }
});
await test('real Pi 1.3.0 fullscreen handler opens HTTP(S) and file only on Ctrl-left press AND release', () => {
  for (const url of targets) {
    for (const modifier of [0, 4, 8, 20, 24, 28]) {
      const f = fixture(url);
      f.event(modifier); f.event(modifier, true);
      assert.deepEqual(f.opened, [], `blocked modifier ${modifier} on ${url}`);
      f.dispose();
    }
    const f = fixture(url);
    f.event(16); f.event(16, true);
    assert.deepEqual(f.opened, [url]);
    f.terminal.write(osc(url));
    assert.ok(f.written.every(data => !data.includes(url)));
    assert.ok(f.tui.previousScreen[0].includes(url), 'hit testing must keep the original OSC 8');
    f.dispose();
    assert.equal(f.tui.openUrl, f.originalOpen);
    assert.equal(f.terminal.write, f.originalWrite);
  }
});
await test('mismatched modifiers, middle/right buttons, release without press and Ctrl-drag never open', () => {
  for (const sequence of [
    [[16, true]], [[0, false], [16, true]], [[16, false], [0, true]],
    [[17, false], [17, true]], [[18, false], [18, true]],
    [[16, false], [48, false, 3], [16, true, 3]],
    [[20, false], [16, true]],
  ]) {
    const f = fixture(targets[0]);
    for (const [button, release, x] of sequence) f.event(button, release, x);
    assert.deepEqual(f.opened, []);
    f.dispose();
  }
});
await test('plain drag still selects text; multiple owners restore only after the last dispose', () => {
  const f = fixture(targets[0]);
  f.event(0, false, 0); f.event(32, false, 3); f.event(0, true, 3);
  assert.equal(f.tui.getActiveSelectionText(), 'labe');
  assert.deepEqual(f.opened, []);
  const second = installCtrlClickLinkOpener(f.tui);
  const wrapper = f.tui.openUrl;
  f.dispose();
  assert.equal(f.tui.openUrl, wrapper);
  f.tui.lastClick = undefined;
  f.event(16); f.event(16, true);
  assert.deepEqual(f.opened, [targets[0]]);
  second(); second();
  assert.equal(f.tui.openUrl, f.originalOpen);
  assert.equal(f.terminal.write, f.originalWrite);
});
await test('bare HTTP(S) and safe file URIs still open via Ctrl; ANSI and CJK columns are respected', () => {
  for (const url of [targets[0], targets[1], new URL('../README.md', import.meta.url).href]) {
    const f = fixture(`\x1b[31m中文 ${url}\x1b[0m`, true);
    f.event(0, false, 6); f.event(0, true, 6);
    assert.deepEqual(f.opened, []);
    f.tui.lastClick = undefined;
    f.event(16, false, 6); f.event(16, true, 6);
    assert.deepEqual(f.opened, [url]);
    f.dispose();
  }
});
await test('bare URLs preserve balanced delimiters and exclude surrounding prose punctuation', () => {
  const wikipedia = 'https://en.wikipedia.org/wiki/Function_(mathematics)';
  for (const [text, expected, column] of [
    [wikipedia, wikipedia, 1],
    [`(${wikipedia}).`, wikipedia, 2],
    ['https://example.com/a_(b_(c))', 'https://example.com/a_(b_(c))', 1],
    ['[https://example.com/a[b]].', 'https://example.com/a[b]', 2],
    ['https://[::1]', 'https://[::1]', 1],
    ['https://example.com/a{b}', 'https://example.com/a{b}', 1],
    ['https://example.com/函数（示例）', 'https://example.com/函数（示例）', 1],
    ['https://example.com/【示例】', 'https://example.com/【示例】', 1],
    ['（https://example.com/a）。', 'https://example.com/a', 3],
  ]) {
    const f = fixture(text, true);
    try {
      f.event(16, false, column); f.event(16, true, column);
      assert.deepEqual(f.opened, [expected], text);
    } finally { f.dispose(); }
  }
  const f = fixture(`(${wikipedia}).`, true);
  try {
    const punctuationColumn = wikipedia.length + 1;
    f.event(16, false, punctuationColumn); f.event(16, true, punctuationColumn);
    assert.deepEqual(f.opened, [], 'surrounding punctuation is not a clickable URL');
  } finally { f.dispose(); }
});
await test('link policy survives footer toggles and starts with both optional visuals disabled', () => {
  const f = fixture(targets[0]);
  f.dispose(); // Runtime, not this fixture, must own the policy.
  let footer;
  const runtime = createBottomInputRuntime();
  const ui = {
    setWidget(_key, factory) { if (factory) factory(f.tui); },
    setFooter(factory) { footer?.dispose(); footer = factory?.(f.tui, {}, {}); },
  };
  runtime.bindSession({ mode: 'tui', hasUI: true, ui });
  for (const enabled of [false, true, false]) {
    runtime.configure({ beautifiedInputEnabled: false, footerEnabled: enabled });
    f.tui.lastClick = undefined;
    f.event(0); f.event(0, true);
    assert.deepEqual(f.opened, []);
    f.tui.lastClick = undefined;
    f.event(20); f.event(20, true);
    assert.deepEqual(f.opened, []);
  }
  f.tui.lastClick = undefined;
  f.event(16); f.event(16, true);
  assert.deepEqual(f.opened, [targets[0]]);
  runtime.dispose(); runtime.dispose();
  assert.equal(f.tui.openUrl, f.originalOpen);
  assert.equal(f.terminal.write, f.originalWrite);
});
await test('unsupported fullscreen targets remain untouched rather than partially installing', () => {
  const openUrl = () => assert.fail('must not launch');
  const target = { mode: 'fullscreen', openUrl };
  installCtrlClickLinkOpener(target)();
  assert.equal(target.openUrl, openUrl);
});
