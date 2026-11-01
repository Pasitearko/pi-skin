import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modules = path.join(root, 'node_modules');
const require = createRequire(path.join(root, 'package.json'));
const { createJiti } = require('jiti');
const tuiPath = path.join(modules, '@earendil-works/pi-tui/dist/index.js');
const jiti = createJiti(import.meta.url, { alias: { '@earendil-works/pi-tui': tuiPath } });
// Exercise the installed payload after the Linux test runner applies the manifest.
const { renderNeonBox, renderCompactThinkingBox } = await jiti.import(
  path.join(modules, 'alps-pi/src/features/chrome-frame/chrome.ts'));
const { DEFAULT_CONFIG, getChromeStyle } = await jiti.import(
  path.join(modules, 'alps-pi/src/features/chrome-frame/styles.ts'));
const { visibleWidth, truncateToWidth } = await jiti.import(tuiPath);
const yellow = '\x1b[38;2;230;216;156m';
const reset = '\x1b[39m';
const palette = { borderMuted: 90, borderAccent: 94, accent: 96, text: 37, muted: 90 };
const theme = {
  fg(token, text) {
    assert.notEqual(token, 'linuxAssistantThinkingBorder', 'private border token must not reach the theme');
    return `\x1b[${palette[token] ?? 35}m${text}${reset}`;
  },
  bg: (_token, text) => text,
};
const strip = line => line.replace(/\x1b\[[0-9;:]*m/g, '');
function assertFrame(lines, width) {
  assert.ok(lines[0].startsWith(yellow + '╭─ '));
  assert.ok(lines[0].endsWith('╮' + reset));
  assert.ok(lines.at(-1).startsWith(yellow + '╰'));
  assert.ok(lines.at(-1).endsWith('╯' + reset));
  for (const line of lines.slice(1, -1)) {
    assert.ok(line.startsWith(yellow + '│' + reset));
    assert.ok(line.endsWith(yellow + '│' + reset));
  }
  for (const line of lines) assert.equal(visibleWidth(line), width);
}

await test('ASSISTANT and expanded THINK borders are pale yellow, not their labels or body', () => {
  for (const kind of ['assistant', 'thinking']) for (const width of [8, 24, 80]) {
    const lines = renderNeonBox(kind, ['中文 body', 'next line'], width, theme);
    assertFrame(lines, width);
    const label = kind === 'assistant' ? 'ASSISTANT' : 'THINK';
    assert.ok(lines[0].includes(theme.fg('accent', label.slice(0, width - 5))));
    assert.ok(lines[1].includes('\x1b[37m'), 'body keeps its original theme token');
    assert.ok(!lines.slice(1, -1).some(line => line.includes(yellow + '中文')));
  }
});
await test('collapsed THINK keeps its original preview and heading colors', () => {
  for (const width of [8, 24, 80]) {
    const lines = renderCompactThinkingBox(['中文 preview', 'hidden line'], width, theme);
    assertFrame(lines, width);
    assert.ok(lines[0].includes(theme.fg('accent', 'THINK'.slice(0, width - 5))), 'heading retains accent');
    const preview = truncateToWidth('中文 preview', width - 4, '', false);
    const paddedPreview = preview + ' '.repeat(width - 4 - visibleWidth(preview));
    assert.ok(lines[1].includes(theme.fg('borderAccent', paddedPreview)), 'visible preview retains borderAccent, not yellow');
    assert.ok(!lines.join('').includes('hidden line'));
  }
});
await test('embedded content and elapsed colors survive without leaking into the border', () => {
  const red = '\x1b[31mred\x1b[39m';
  const elapsedText = '\x1b[32m2s\x1b[39m tail';
  for (const kind of ['assistant', 'thinking']) {
    const lines = renderNeonBox(kind, [red + ' body'], 40, theme, { elapsedText, tokenText: '10 tok' });
    assertFrame(lines, 40);
    assert.ok(lines[1].includes(red));
    assert.match(lines[1], /\x1b\[37m body +\x1b\[39m/);
    assert.ok(lines.at(-1).includes('\x1b[32m2s\x1b[39m'));
    assert.ok(lines.at(-1).includes(yellow + ' tail' + reset));
  }
  const compact = renderCompactThinkingBox(['preview'], 40, theme, DEFAULT_CONFIG, { elapsedText });
  assertFrame(compact, 40);
  assert.ok(compact.at(-1).includes('\x1b[32m2s\x1b[39m'));
  assert.ok(compact.at(-1).includes(yellow + ' tail' + reset));
});
await test('plain elapsed text follows the pale-yellow frame in all three message states', () => {
  for (const kind of ['assistant', 'thinking']) {
    const lines = renderNeonBox(kind, ['body'], 40, theme, { elapsedText: '2s' });
    assertFrame(lines, 40);
    assert.ok(lines.at(-1).includes(yellow + '2s' + reset));
  }
  const compact = renderCompactThinkingBox(['preview'], 40, theme, DEFAULT_CONFIG, { elapsedText: '2s' });
  assertFrame(compact, 40);
  assert.ok(compact.at(-1).includes(yellow + '2s' + reset));
});
await test('other message kinds and shared theme defaults are unchanged', () => {
  for (const kind of ['user', 'custom', 'skill', 'compaction', 'branch', 'tool',
    'toolPending', 'toolSuccess', 'toolError', 'bash', 'working']) {
    const lines = renderNeonBox(kind, ['body'], 30, theme);
    assert.ok(!lines.join('').includes(yellow), kind);
    assert.ok(lines[0].startsWith(theme.fg(getChromeStyle(kind).border, '╭─ ')), kind);
  }
  assert.equal(DEFAULT_CONFIG.styles.assistant.border, 'borderMuted');
  assert.equal(DEFAULT_CONFIG.styles.thinking.border, 'borderMuted');
});
await test('narrow fallbacks, empty messages and OSC links retain their behavior', () => {
  for (const kind of ['assistant', 'thinking']) {
    assert.deepEqual(renderNeonBox(kind, [], 30, theme), []);
    for (const width of [0, 1, 7]) {
      const lines = renderNeonBox(kind, ['中文 body'], width, theme);
      assert.ok(!lines.join('').includes(yellow));
      for (const line of lines) assert.ok(visibleWidth(line) <= width);
      const compact = renderCompactThinkingBox(['preview'], width, theme);
      assert.ok(!compact.join('').includes(yellow));
    }
  }
  const link = '\x1b]8;;https://example.com\x07link\x1b]8;;\x07';
  const lines = renderNeonBox('assistant', [link], 30, theme);
  assertFrame(lines, 30);
  assert.ok(lines.join('').includes('\x1b]8;;https://example.com/\x1b\\link\x1b]8;;\x1b\\'));
  assert.ok(strip(lines[0]).startsWith('╭─ ASSISTANT'));
});
