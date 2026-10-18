// Linux-only allowlist: do not broaden the Windows/base patch planner.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertSafePath } from '../../tools/setup.mjs';

const packageName = 'pi-mcp-adapter';
const version = '5.3.2';
const paths = ['host-html-template.ts', 'ui-server.ts'];
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
function context(modules, root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'patches/manifest.json'), 'utf8'));
  const pkg = manifest.packages?.[0];
  if (manifest.schema !== 1 || manifest.packages.length !== 1 || pkg.name !== packageName || pkg.version !== version ||
      pkg.files.length !== paths.length || !paths.every(name => pkg.files.filter(f => f.path === name).length === 1)) {
    throw Error('Invalid MCP UI allowlist/manifest');
  }
  const packageRoot = assertSafePath(path.join(modules, packageName), modules);
  const actual = JSON.parse(fs.readFileSync(assertSafePath(path.join(packageRoot, 'package.json'), modules), 'utf8'));
  if (actual.name !== packageName || actual.version !== version) throw Error(`Version mismatch: ${packageName} requires ${version}, found ${actual.version}`);
  return { pkg, packageRoot };
}
export function mcpUiPatchPlan(modules, root) {
  const { pkg, packageRoot } = context(modules, root);
  return pkg.files.flatMap(file => {
    const target = assertSafePath(path.join(packageRoot, file.path), packageRoot);
    const payload = assertSafePath(path.join(root, file.payload), path.join(root, 'patches'));
    const data = fs.readFileSync(payload);
    if (digest(data) !== file.after) throw Error('Patch payload checksum mismatch');
    const original = fs.readFileSync(target), before = digest(original);
    if (before === file.after) return [];
    if (before !== file.before) throw Error('Existing file differs from pristine/our patch; refusing overwrite: ' + file.path);
    return [{ target, payload, data, before, after: file.after, original }];
  });
}
export function mcpUiUndoPlan(modules, root, receipt) {
  const { pkg, packageRoot } = context(modules, root);
  const saved = JSON.parse(fs.readFileSync(receipt, 'utf8'));
  if (saved.schema !== 1 || !Array.isArray(saved.files) || !saved.files.length || saved.files.length > paths.length) throw Error('Invalid MCP UI undo receipt');
  const seen = new Set();
  return saved.files.map(row => {
    const file = pkg.files.find(f => row.path === packageName + '/' + f.path);
    if (!file || seen.has(row.path) || row.before !== file.before || row.after !== file.after || typeof row.original !== 'string') throw Error('Invalid MCP UI undo path/checksums');
    seen.add(row.path);
    const target = assertSafePath(path.join(packageRoot, file.path), packageRoot);
    const data = Buffer.from(row.original, 'base64');
    if (digest(data) !== file.before) throw Error('Undo original checksum mismatch');
    const original = fs.readFileSync(target);
    if (digest(original) !== file.after) throw Error('Patched file was changed; refusing undo overwrite');
    return { target, data, before: file.after, after: file.before, original };
  });
}
