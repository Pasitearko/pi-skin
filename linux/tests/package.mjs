import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { patchPlan } from '../../tools/setup.mjs';
import { mcpUiPatchPlan, mcpUiUndoPlan } from '../tools/mcp-ui-patch.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modules = path.join(root, 'node_modules');
const require = createRequire(path.join(root, 'package.json'));
const { createJiti } = require('jiti');
const aliases = Object.fromEntries(['pi-coding-agent', 'pi-tui'].map(name =>
  ['@earendil-works/' + name, path.join(modules, '@earendil-works', name, 'dist/index.js')]));
const jiti = createJiti(import.meta.url, { alias: aliases });
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

await test('Linux package is separate, explicit and loads all seven extensions', async () => {
  const manifest = read('package.json');
  assert.equal(manifest.private, true);
  assert.equal(manifest.pi.extensions.length, 7);
  const sdk = await jiti.import(aliases['@earendil-works/pi-coding-agent']);
  assert.equal(sdk.VERSION, '1.3.0');
  const loader = await jiti.import(path.join(modules, '@earendil-works/pi-coding-agent/dist/core/extensions/loader.js'));
  const loaded = await loader.loadExtensions(manifest.pi.extensions.map(file => path.join(root, file)), root);
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.extensions.length, 7);
});
await test('configuration exports only reviewed appearance and public package metadata', () => {
  const settings = read('config/settings.example.json');
  assert.deepEqual(Object.keys(settings).sort(), ['alps-pi', 'defaultThinkingLevel', 'defaultTools', 'fullscreenScrollbar', 'hideThinkingBlock', 'showHardwareCursor'].sort());
  assert.equal(settings.hideThinkingBlock, false);
  assert.equal(settings['alps-pi'].inputMetrics.elapsedTime, false);
  assert.equal(read('config/keybindings.example.json')['tui.altScreen.search'], 'ctrl+f');
  assert.equal(read('config/packages.example.json').packages.length, 7);
});
await test('optional MCP and Kitty templates do not import personal configuration', () => {
  const github = read('config/mcp-github.example.json').mcpServers.github;
  assert.equal(github.command, 'github-mcp-server');
  assert.equal(github.openUi, false);
  assert.equal(github.lifecycle, 'lazy');
  assert.equal(github.env, undefined);
  const playwright = read('config/mcp-playwright.example.json').mcpServers.playwright;
  for (const flag of ['--isolated', '--sandbox', '--no-webmcp']) assert.ok(playwright.args.includes(flag));
  const kitty = fs.readFileSync(path.join(root, 'config/kitty-input.example.conf'), 'utf8');
  assert.match(kitty, /mouse_map ctrl\+left release grabbed,ungrabbed mouse_handle_click link/);
  assert.match(kitty, /map ctrl\+v no_op/);
  assert.doesNotMatch(kitty, /^mouse_map left /m);
});
await test('optional MCP UI patch has independent pinned payloads and version/hash guards', () => {
  const payloadRoot = path.join(root, 'compat/mcp-ui-filter');
  const manifest = read('compat/mcp-ui-filter/patches/manifest.json');
  assert.equal(manifest.packages.length, 1);
  const pkg = manifest.packages[0];
  assert.equal(pkg.name, 'pi-mcp-adapter');
  assert.equal(pkg.version, '5.3.2');
  assert.equal(pkg.files.length, 2);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-linux-mcp-preflight-'));
  try {
    const pkgRoot = path.join(temporary, pkg.name);
    fs.mkdirSync(pkgRoot, { recursive: true });
    const json = path.join(pkgRoot, 'package.json');
    fs.writeFileSync(json, JSON.stringify({ name: pkg.name, version: pkg.version }));
    for (const file of pkg.files) {
      const payload = fs.readFileSync(path.join(payloadRoot, file.payload));
      assert.equal(crypto.createHash('sha256').update(payload).digest('hex'), file.after);
      assert.match(file.before, /^[a-f0-9]{64}$/);
      fs.writeFileSync(path.join(pkgRoot, file.path), payload);
    }
    assert.deepEqual(mcpUiPatchPlan(temporary, payloadRoot), []);
    const result = spawnSync(process.execPath, [path.join(root, 'tools/patches.mjs'), '--mcp-ui-filter', '--modules', temporary], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).profile, 'mcp-ui-filter');
    assert.equal(JSON.parse(result.stdout).changedFiles, 0);
    const receipt = path.join(temporary, 'fake-undo.json');
    fs.writeFileSync(receipt, JSON.stringify({ schema: 1, files: [{ path: '../outside.ts' }] }));
    assert.throws(() => mcpUiUndoPlan(temporary, payloadRoot, receipt), /Invalid MCP UI undo path/);
    const first = pkg.files[0];
    fs.writeFileSync(receipt, JSON.stringify({ schema: 1, files: [{
      path: pkg.name + '/' + first.path, before: first.before, after: first.after,
      original: Buffer.from('tampered pristine bytes').toString('base64'),
    }] }));
    assert.throws(() => mcpUiUndoPlan(temporary, payloadRoot, receipt), /Undo original checksum mismatch/);
    const alias = path.join(temporary, 'symlinked-modules');
    fs.symlinkSync(temporary, alias, 'dir');
    assert.throws(() => mcpUiPatchPlan(alias, payloadRoot), /Symlink/);
    fs.writeFileSync(path.join(pkgRoot, pkg.files[0].path), '// unrelated local edit\n');
    assert.throws(() => mcpUiPatchPlan(temporary, payloadRoot), /refusing overwrite/);
    fs.writeFileSync(json, JSON.stringify({ name: pkg.name, version: '0.0.0' }));
    assert.throws(() => mcpUiPatchPlan(temporary, payloadRoot), /Version mismatch/);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
await test('Linux patch payload checksums match and applied dependencies are idempotent', () => {
  const manifest = read('patches/manifest.json');
  let count = 0;
  for (const pkg of manifest.packages) for (const file of pkg.files) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file.payload))).digest('hex');
    assert.equal(hash, file.after); count++;
  }
  assert.equal(count, 13);
  assert.deepEqual(patchPlan(modules, root), []);
});
await test('patch preflight refuses unknown versions and unrelated local edits', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-linux-preflight-'));
  try {
    const first = read('patches/manifest.json').packages[0];
    const pkgRoot = path.join(temporary, first.name);
    fs.mkdirSync(pkgRoot, { recursive: true });
    const json = path.join(pkgRoot, 'package.json');
    fs.writeFileSync(json, JSON.stringify({ name: first.name, version: '0.0.0' }));
    assert.throws(() => patchPlan(temporary, root), /Version mismatch/);
    fs.writeFileSync(json, JSON.stringify({ name: first.name, version: first.version }));
    const file = path.join(pkgRoot, first.files[0].path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '// unrelated local modification\n');
    assert.throws(() => patchPlan(temporary, root), /refusing overwrite/);
    assert.equal(fs.readFileSync(file, 'utf8'), '// unrelated local modification\n');
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
