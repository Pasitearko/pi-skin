#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { patchPlan, applyPatchPlan } from '../../tools/setup.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modules = path.join(root, 'node_modules');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-linux-tests-'));
try {
  // Only development dependencies inside THIS checkout are patched, never ~/.pi.
  applyPatchPlan(patchPlan(modules, root), modules, path.join(temporary, 'undo'));
  const sdk = path.join(modules, '@earendil-works/pi-coding-agent');
  const env = { ...process.env, PI_TEST_MODULES: modules, PI_TEST_ROOT: sdk,
    PI_SDK_ROOT: sdk, ALPS_TEST_ROOT: path.join(modules, 'alps-pi') };
  // Do not let a user's optional audio/location environment alter the fixtures.
  delete env.PI_WEATHER_LOCATIONS;
  delete env.PI_COMPLETION_SOUND;
  for (const file of [
    'tests/package.mjs',
    'extensions/weather-row/tests/run.mjs',
    'extensions/working-timer/tests/run.mjs',
    'extensions/clean-frame-copy/tests/run.mjs',
    'extensions/tool-status-style/tests/custom-background.mjs',
  ]) {
    console.log('\n=== Linux:', file, '===');
    const result = spawnSync(process.execPath, [path.join(root, file)], { cwd: root, env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error(file + ' failed: ' + result.status);
  }
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
