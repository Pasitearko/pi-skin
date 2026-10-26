import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {scan} from '../tools/privacy-check.mjs';
import {projectRoot} from '../tools/setup.mjs';
test('public source passes privacy scan',()=>assert.deepEqual(scan(projectRoot),[]));
test('privacy scanner rejects private payload names, home paths and token patterns',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pi privacy '));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'auth.json'),'{}');
 fs.writeFileSync(path.join(root,'leak.txt'),['C:', '/Users/', 'example/private', '\n', 'ghp_', 'x'.repeat(40)].join(''));
 const findings=scan(root);assert.ok(findings.some(f=>f.reason==='private/generated payload filename'));assert.ok(findings.some(f=>f.reason==='machine-bound Windows path'));assert.ok(findings.some(f=>f.reason==='GitHub token'));
});
test('published package identity matches pi-skin and its lockfile',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(projectRoot,'package.json'),'utf8'));
 const lock=JSON.parse(fs.readFileSync(path.join(projectRoot,'package-lock.json'),'utf8'));
 assert.equal(pkg.name,'@jiuliyear/pi-skin');
 assert.equal(pkg.repository.url,'https://github.com/Pasitearko/pi-skin.git');
 assert.equal(pkg.homepage,'https://github.com/Pasitearko/pi-skin#readme');
 assert.equal(pkg.bugs.url,'https://github.com/Pasitearko/pi-skin/issues');
 assert.equal(pkg.pi.image,'https://raw.githubusercontent.com/Pasitearko/pi-skin/main/docs/previews/windows-terminal-real.png');
 assert.ok(pkg.keywords.includes('pi-package'));
 assert.equal(pkg.publishConfig.access,'public');
 for(const entry of [lock,lock.packages['']]){
  assert.equal(entry.name,pkg.name);assert.equal(entry.version,pkg.version);
 }
});
test('published package declares exactly the eight entrypoints and no install hooks',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(projectRoot,'package.json'),'utf8'));
 assert.equal(pkg.license,'MIT');assert.equal(pkg.pi.extensions.length,8);assert.equal(pkg.pi.themes.length,1);
 for(const file of [...pkg.pi.extensions,...pkg.pi.themes])assert.ok(fs.existsSync(path.join(projectRoot,file)));
 for(const hook of ['install','postinstall','preinstall','prepare'])assert.equal(pkg.scripts[hook],undefined);
});
