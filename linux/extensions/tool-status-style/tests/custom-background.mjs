import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters as stripAnsi } from 'node:util';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sdkRoot = process.env.PI_SDK_ROOT ?? join(homedir(), '.local/lib/node_modules/@earendil-works/pi-coding-agent');
const require = createRequire(join(sdkRoot, 'package.json'));
const tuiEntry = require.resolve('@earendil-works/pi-tui');
const { createJiti } = require('jiti');
const jiti = createJiti(import.meta.url, { moduleCache: true, alias: {
  '@earendil-works/pi-coding-agent': join(sdkRoot, 'dist/index.js'),
  '@earendil-works/pi-tui': tuiEntry,
} });
const sdk = await jiti.import(join(sdkRoot, 'dist/index.js'));
assert.equal(sdk.VERSION, '1.3.0', 'test only the supported Pi release');
const themes = await jiti.import(join(sdkRoot, 'dist/modes/interactive/theme/theme.js'));
const { visibleWidth } = await jiti.import(tuiEntry);
const alps = await jiti.import(join(process.env.ALPS_TEST_ROOT ?? join(homedir(), '.pi/agent/npm/node_modules/alps-pi'), 'src/features/chrome-frame/patch.ts'));
const { default: install } = await jiti.import(join(root, 'index.ts'));
const ui = { requestRender() {} };
const green = '\x1b[38;2;74;222;128m';
const red = '\x1b[38;2;248;113;113m';
const custom = () => new sdk.CustomMessageComponent({
  role: 'custom', customType: 'web-search-content-ready', content: '后台结果 ready\n\n**加粗内容**', display: true,
});
const register = () => {
  const handlers = new Map();
  install({ on(name, handler) { handlers.set(name, handler); } });
  return (name, ctx = { mode: 'tui', hasUI: true, ui: { notify(message, level) { assert.notEqual(level, 'warning', message); } } }) => handlers.get(name)?.({}, ctx);
};
let cases = 0;
for (const name of ['dark', 'light']) {
  themes.setThemeInstance(themes.loadThemeFromPath(join(sdkRoot, `dist/modes/interactive/theme/${name}.json`), 'truecolor'));
  assert.equal(sdk.Theme, themes.Theme);
  const before = {
    rebuild: sdk.CustomMessageComponent.prototype.rebuild,
    bg: sdk.Theme.prototype.bg,
    fg: sdk.Theme.prototype.fg,
    getBgAnsi: sdk.Theme.prototype.getBgAnsi,
    style: sdk.Theme.prototype.style,
    renderSessionItems: sdk.InteractiveMode.prototype.renderSessionItems,
    handleEvent: sdk.InteractiveMode.prototype.handleEvent,
    sharedBg: themes.theme.bg('customMessageBg', 'probe'),
    sharedBgAnsi: themes.theme.getBgAnsi('customMessageBg'),
    customFg: themes.theme.fg('customMessageText', 'probe'),
    diffAdded: themes.theme.fg('toolDiffAdded', 'probe'),
    diffRemoved: themes.theme.fg('toolDiffRemoved', 'probe'),
  };
  assert.ok(custom().render(80).some(line => line.includes(before.sharedBgAnsi)), 'baseline custom message has theme background');
  const emit = register();
  assert.equal(sdk.CustomMessageComponent.prototype.rebuild, before.rebuild, 'factory must not patch');
  emit('session_start', { mode: 'rpc', hasUI: true });
  assert.equal(sdk.CustomMessageComponent.prototype.rebuild, before.rebuild, 'RPC must not patch');
  emit('session_start');
  const rebuild = sdk.CustomMessageComponent.prototype.rebuild;
  const item = custom();
  assert.equal(item.box.bgFn('probe'), '\x1b[49mprobe\x1b[49m');
  const bgFn = item.box.bgFn;
  for (let i = 0; i < 10; i++) { item.invalidate(); item.setExpanded(i % 2 === 0); }
  assert.equal(item.box.bgFn, bgFn, 'rebuilds must not accumulate wrappers');
  emit('resources_discover');
  assert.equal(sdk.CustomMessageComponent.prototype.rebuild, rebuild, 'reinstall must be idempotent');
  assert.equal(themes.theme.bg('customMessageBg', 'probe'), before.sharedBg);
  assert.equal(themes.theme.getBgAnsi('customMessageBg'), before.sharedBgAnsi);
  assert.equal(themes.theme.style('probe', { bg: 'customMessageBg' }), before.sharedBg);
  assert.equal(themes.theme.fg('customMessageText', 'probe'), before.customFg);
  assert.equal(themes.theme.fg('toolDiffAdded', 'probe'), before.diffAdded);
  assert.equal(themes.theme.fg('toolDiffRemoved', 'probe'), before.diffRemoved);

  for (const framed of [false, true]) {
    if (framed) {
      const state = alps.enablePatch();
      assert.equal(state.enabled, true);
      assert.equal(state.failures.size, 0);
    }
    const assistantMessage = { role: 'assistant', content: [
      { type: 'thinking', thinking: 'Reasoning text' }, { type: 'text', text: 'Normal answer' },
    ], stopReason: 'stop' };
    const assistant = new sdk.AssistantMessageComponent(assistantMessage);
    const user = new sdk.UserMessageComponent('用户消息');
    const assistantBefore = assistant.render(80);
    const userBefore = user.render(80);
    const current = custom();
    for (const expanded of [false, true]) {
      current.setExpanded(expanded);
      for (let width = 1; width <= 120; width++) {
        const lines = current.render(width);
        assert.ok(lines.every(line => !line.includes(before.sharedBgAnsi)), `${name}: custom bg at width ${width}`);
        // Native Box padding can exceed extremely narrow widths; ALPS clips it.
        if (framed || width >= 8) assert.ok(lines.every(line => visibleWidth(line) <= width), `width ${width}`);
        if (width === 80) {
          const text = lines.map(stripAnsi).join('\n');
          assert.ok(text.includes('后台结果 ready')); assert.ok(text.includes('加粗内容'));
          if (framed) assert.ok(text.includes('CUSTOM'));
        }
        cases++;
      }
    }
    assert.deepEqual(assistant.render(80), assistantBefore, 'assistant/thinking must stay unchanged');
    assert.deepEqual(user.render(80), userBefore, 'user messages must stay unchanged');
    const tool = new sdk.ToolExecutionComponent('read', 'test-tool', { path: '/tmp/example' }, {}, sdk.createReadToolDefinition(process.cwd()), ui, process.cwd());
    tool.updateResult({ content: [{ type: 'text', text: 'partial output' }], details: undefined }, true);
    emit('resources_discover');
    if (framed) assert.ok(tool.render(80).some(line => line.includes(green + '╭─ ')), 'pending tool green');
    for (const isError of [false, true]) {
      tool.updateResult({ content: [{ type: 'text', text: 'tool output' }], details: undefined, isError });
      const lines = tool.render(80);
      if (framed) assert.ok(lines.some(line => line.includes((isError ? red : green) + '╭─ ')), 'tool status border');
      for (const token of ['toolPendingBg', 'toolSuccessBg', 'toolErrorBg']) {
        assert.equal(themes.theme.bg(token, 'probe'), '\x1b[49mprobe\x1b[49m');
        assert.equal(themes.theme.getBgAnsi(token), '\x1b[49m');
        assert.equal(themes.theme.style('probe', { bg: token }), '\x1b[49mprobe\x1b[49m');
      }
    }
    if (framed) {
      alps.disablePatch();
      assert.equal(alps.getGlobalPatchState().conflicts.size, 0, 'custom render hook must not conflict with ALPS');
      assert.ok(current.render(80).every(line => !line.includes(before.sharedBgAnsi)), 'native custom after frame disabled');
    }
  }
  const changedLater = custom();
  const laterBg = text => `later:${text}`;
  changedLater.box.setBgFn(laterBg);
  emit('session_shutdown');
  assert.equal(changedLater.box.bgFn, laterBg, 'cleanup must preserve another owner');
  assert.equal(sdk.CustomMessageComponent.prototype.rebuild, before.rebuild);
  assert.equal(sdk.Theme.prototype.bg, before.bg);
  assert.equal(sdk.Theme.prototype.style, before.style);
  assert.equal(sdk.Theme.prototype.fg, before.fg);
  assert.equal(sdk.Theme.prototype.getBgAnsi, before.getBgAnsi);
  assert.equal(sdk.InteractiveMode.prototype.renderSessionItems, before.renderSessionItems);
  assert.equal(sdk.InteractiveMode.prototype.handleEvent, before.handleEvent);
  assert.equal(item.box.bgFn('probe'), before.sharedBg, 'cleanup restores existing custom boxes');
  assert.ok(custom().render(80).some(line => line.includes(before.sharedBgAnsi)), 'new boxes restore original background');
  emit('session_shutdown');
  // A reload creates a fresh extension instance after the previous shutdown.
  const reloaded = register();
  reloaded('session_start');
  assert.equal(custom().box.bgFn('probe'), '\x1b[49mprobe\x1b[49m');
  reloaded('session_shutdown');
  assert.equal(sdk.CustomMessageComponent.prototype.rebuild, before.rebuild);
  assert.equal(sdk.Theme.prototype.bg, before.bg);
}
console.log(`PASS: ${cases} custom rendering cases; dark/light, native/ALPS, expansion, widths, tool borders, shared colors, reload and ownership-safe cleanup`);
