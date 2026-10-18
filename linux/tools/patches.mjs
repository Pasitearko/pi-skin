#!/usr/bin/env node
// Reuse the audited path/hash/backup implementation; never use the Windows manifest.
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { patchPlan, applyPatchPlan, undoPatches } from '../../tools/setup.mjs';
import { mcpUiPatchPlan, mcpUiUndoPlan } from './mcp-ui-patch.mjs';

export const linuxRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export function main(args = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--apply') { options.apply = true; continue; }
    if (key === '--mcp-ui-filter') { options.mcpUiFilter = true; continue; }
    if (!['--modules', '--agent-dir', '--undo'].includes(key)) throw Error('Unknown argument: ' + key);
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error('Missing argument value: ' + key);
    if (options[key] !== undefined) throw Error('Duplicate argument: ' + key);
    options[key] = args[++i];
  }
  const agent = path.resolve(options['--agent-dir'] || process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi/agent'));
  const modules = path.resolve(options['--modules'] || path.join(agent, 'npm/node_modules'));
  const profile = options.mcpUiFilter ? 'mcp-ui-filter' : 'appearance';
  const payloadRoot = options.mcpUiFilter ? path.join(linuxRoot, 'compat/mcp-ui-filter') : linuxRoot;
  if (options['--undo']) {
    if (!options.apply) throw Error('--undo requires --apply');
    const receipt = path.resolve(options['--undo']);
    if (options.mcpUiFilter) {
      const restore = mcpUiUndoPlan(modules, payloadRoot, receipt);
      applyPatchPlan(restore, modules, path.join(agent, 'personalization-undo', 'linux-mcp-ui-restore-' + Date.now()));
    } else undoPatches(modules, receipt);
    console.log('Linux patches restored. Settings were not changed.');
    return;
  }
  const actions = options.mcpUiFilter ? mcpUiPatchPlan(modules, payloadRoot) : patchPlan(modules, payloadRoot);
  console.log(JSON.stringify({ platform: 'linux', profile, mode: options.apply ? 'apply' : 'dry-run',
    changedFiles: actions.length, files: actions.map(a => path.relative(modules, a.target)) }, null, 2));
  if (!options.apply || !actions.length) return;
  const undo = path.join(agent, 'personalization-undo', 'linux-' + profile + '-' + Date.now());
  applyPatchPlan(actions, modules, undo);
  console.log('Undo receipt:', path.join(undo, 'patch-undo.json'));
  console.log('Restart Pi. No settings, credentials or desktop configuration were changed.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
