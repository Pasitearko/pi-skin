import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const modules = resolve(process.env.PI_TEST_MODULES || join(root, 'node_modules'));
const require = createRequire(join(modules, 'test.cjs'));
const { createJiti } = require('jiti');
const alias = Object.fromEntries(['pi-coding-agent', 'pi-tui', 'pi-ai', 'pi-agent-core']
  .map(name => [`@earendil-works/${name}`, join(modules, '@earendil-works', name, 'dist/index.js')]));
const jiti = createJiti(import.meta.url, { alias, fsCache: false });
const sdk = await jiti.import(alias['@earendil-works/pi-coding-agent']);
const tui = await jiti.import(alias['@earendil-works/pi-tui']);
assert.equal(sdk.VERSION, '1.5.0', 'run compatibility tests against the supported Pi release');
const [major, minor, patch] = sdk.VERSION.split('.').map(Number);
const unsupported = [`${major}.${minor - 1}.0`, `${major}.${minor}.${patch + 1}`, `${major}.${minor + 1}.0`];
const targets = [
  [tui.TuiAltScreen.prototype, 'getActiveSelectionText'],
  [tui.TuiAltScreen.prototype, 'applySelection'],
  [sdk.CustomMessageComponent.prototype, 'rebuild'],
  ...['fg', 'bg', 'getBgAnsi', 'style'].map(key => [sdk.Theme.prototype, key]),
  ...['renderSessionItems', 'handleEvent'].map(key => [sdk.InteractiveMode.prototype, key]),
  ...['ToolExecutionComponent', 'AssistantMessageComponent', 'BashExecutionComponent',
    'BranchSummaryMessageComponent', 'CompactionSummaryMessageComponent',
    'SkillInvocationMessageComponent', 'CustomMessageComponent']
    .map(key => [sdk[key].prototype, 'handleMouse']),
];
const descriptors = () => targets.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));

for (const name of ['clean-frame-copy', 'frame-click-toggle', 'tool-status-style']) {
  const { default: extension } = await jiti.import(join(root, 'extensions', name, 'index.ts'));
  const expectedTargets = name === 'clean-frame-copy' ? targets.slice(0, 2)
    : name === 'tool-status-style' ? targets.slice(2, 9) : targets.slice(9);
  const setup = () => {
    const handlers = new Map(), notifications = [];
    extension({ on: (event, handler) => handlers.set(event, handler), registerCommand() {} });
    return { handlers, notifications, ui: { notify: (...args) => notifications.push(args) } };
  };
  test(`${name}: Pi ${sdk.VERSION} installs every required hook and restores them on shutdown`, async t => {
    const before = descriptors();
    const { handlers, notifications, ui } = setup();
    const ctx = { mode: 'tui', hasUI: true, ui };
    t.after(async () => { await handlers.get('session_shutdown')({}, ctx); });
    assert.deepEqual(descriptors(), before, 'factory must not install hooks');
    await handlers.get('session_start')({}, ctx);
    assert.deepEqual(notifications, [], 'supported startup must not warn');
    for (const [target, key] of expectedTargets) {
      const index = targets.findIndex(([candidate, method]) => candidate === target && method === key);
      assert.notEqual(target[key], before[index]?.value, `${target.constructor.name}.${key} must be hooked`);
    }
    const installed = descriptors();
    await handlers.get('resources_discover')?.({}, ctx);
    assert.deepEqual(descriptors(), installed, 'discovery must not stack wrappers');
    await handlers.get('session_shutdown')({}, ctx);
    await handlers.get('session_shutdown')({}, ctx);
    assert.deepEqual(descriptors(), before, 'shutdown must restore all native descriptors idempotently');
  });
  test(`${name}: supported Pi leaves RPC, print and no-UI modes untouched`, async () => {
    for (const [mode, hasUI] of [['rpc', true], ['print', false], ['tui', false]]) {
      const before = descriptors();
      const { handlers, notifications, ui } = setup();
      const ctx = { mode, hasUI, ui };
      try {
        await handlers.get('session_start')({}, ctx);
        await handlers.get('resources_discover')?.({}, ctx);
        assert.deepEqual(descriptors(), before, `${mode}/${hasUI} must not install terminal hooks`);
        assert.deepEqual(notifications, []);
      } finally { await handlers.get('session_shutdown')({}, ctx); }
      assert.deepEqual(descriptors(), before);
    }
  });
}

for (const name of ['clean-frame-copy', 'frame-click-toggle', 'tool-status-style']) {
  for (const version of unsupported) {
    test(`${name}: a different Pi release warns without installing hooks (${version})`, async t => {
      const temp = mkdtempSync(join(tmpdir(), 'pi-version-'));
      t.after(() => rmSync(temp, { recursive: true, force: true }));
      const shim = join(temp, 'sdk.ts');
      writeFileSync(shim, `export * from ${JSON.stringify(alias['@earendil-works/pi-coding-agent'])};\nexport const VERSION = ${JSON.stringify(version)};\n`);
      const isolated = createJiti(import.meta.url, {
        alias: { ...alias, '@earendil-works/pi-coding-agent': shim },
        moduleCache: false, fsCache: false,
      });
      const { default: extension } = await isolated.import(join(root, 'extensions', name, 'index.ts'));
      const before = descriptors();
      const stateKey = Symbol.for('alps.pi.patch.v1');
      const previousState = Object.getOwnPropertyDescriptor(globalThis, stateKey);
      const state = { config: { styles: { toolPending: { bg: 'toolPendingBg', border: 'borderMuted', label: 'accent', text: 'text' } } }, configVersion: 17 };
      const originalState = structuredClone(state);
      globalThis[stateKey] = state;
      t.after(() => {
        if (previousState) Object.defineProperty(globalThis, stateKey, previousState);
        else delete globalThis[stateKey];
      });
      const handlers = new Map(), notifications = [];
      extension({ on: (event, handler) => handlers.set(event, handler), registerCommand() {} });
      const ctx = { mode: 'tui', hasUI: true, ui: { notify: (...args) => notifications.push(args) } };
      assert.deepEqual(descriptors(), before, 'factory must not install hooks');
      await handlers.get('session_start')({}, ctx);
      assert.deepEqual(descriptors(), before, 'unsupported startup must not install hooks');
      await handlers.get('resources_discover')?.({}, ctx);
      assert.deepEqual(descriptors(), before, 'unsupported discovery must not install hooks');
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0][1], 'warning');
      assert.ok(notifications[0][0].includes(`Pi ${version}`));
      await handlers.get('session_shutdown')({}, ctx);
      assert.deepEqual(descriptors(), before, 'shutdown must preserve native hooks');
      assert.strictEqual(globalThis[stateKey], state, 'unsupported lifecycle preserves the ALPS state owner');
      assert.deepEqual(state, originalState, 'unsupported lifecycle must not mutate ALPS styles or cache version');
    });
  }
}
