// Exercise the real factories with only the SDK VERSION export substituted.
// No network, terminal, clipboard or installed package writes.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const modules=resolve(process.argv[2]||process.env.PI_TEST_MODULES||fileURLToPath(new URL('../node_modules',import.meta.url)));
const require=createRequire(join(modules,'test.cjs'));
const {createJiti}=require('jiti');
const root=join(dirname(dirname(fileURLToPath(import.meta.url))),'extensions');
const aliases=Object.fromEntries(['pi-coding-agent','pi-tui','pi-ai','pi-agent-core'].flatMap(name=>
  ['@earendil-works','@mariozechner'].map(scope=>[`${scope}/${name}`,join(modules,'@earendil-works',name,'dist/index.js')])));
const temp=await mkdtemp(join(tmpdir(),'pi-frame-version-'));
try {
  for(const version of ['1.0.4','1.1.0','1.2.0','1.3.0','1.4.0','1.5.0','1.1.1','1.2.1','1.3.1','1.4.1','1.5.1','1.6.0','9.9.9','1.1.0-beta.1','1.2.0-beta.1','1.3.0-beta.1','1.4.0-beta.1','1.5.0-beta.1']) {
    const shim=join(temp,`sdk-${version}.mjs`);
    await writeFile(shim,`export * from ${JSON.stringify(aliases['@earendil-works/pi-coding-agent'].replaceAll('\\','/'))};\nexport const VERSION = ${JSON.stringify(version)};\n`);
    const jiti=createJiti(import.meta.url,{alias:{...aliases,'@earendil-works/pi-coding-agent':shim},fsCache:false,moduleCache:false});
    const sdk=await jiti.import(shim);
    const tui=await jiti.import(aliases['@earendil-works/pi-tui']);
    for(const [name,prototype,method] of [
      ['clean-frame-copy',tui.TuiAltScreen.prototype,'getActiveSelectionText'],
      ['frame-click-toggle',sdk.ToolExecutionComponent.prototype,'handleMouse'],
    ]) {
      const supported=(name==='clean-frame-copy'?['1.0.4','1.1.0','1.2.0','1.3.0','1.5.0']:['1.0.4','1.1.0','1.2.0','1.5.0']).includes(version);
      await test(`${name}: Pi ${version} ${supported?'enables without warning':'warns and leaves native behavior'}`,async()=>{
        const extension=await jiti.import(join(root,name,'index.ts'));
        const handlers=new Map(),notifications=[];
        const original=prototype[method];
        extension.default({on:(n,h)=>handlers.set(n,h),registerCommand(){}});
        try {
          handlers.get('session_start')({},{hasUI:true,mode:'tui',ui:{notify:(...args)=>notifications.push(args)}});
          if(supported) {assert.notEqual(prototype[method],original);assert.deepEqual(notifications,[]);}
          else {assert.equal(prototype[method],original);assert.equal(notifications.length,1);assert.equal(notifications[0][1],'warning');assert.ok(notifications[0][0].includes(`Pi ${version}`));}
        } finally {handlers.get('session_shutdown')();}
        assert.equal(prototype[method],original);
      });
      await test(`${name}: Pi ${version} RPC does not install hooks or warn`,async()=>{
        const extension=await jiti.import(join(root,name,'index.ts'));
        const handlers=new Map(),notifications=[],original=prototype[method];
        extension.default({on:(n,h)=>handlers.set(n,h),registerCommand(){}});
        try {
          handlers.get('session_start')({},{hasUI:true,mode:'rpc',ui:{notify:(...args)=>notifications.push(args)}});
          assert.equal(prototype[method],original);assert.deepEqual(notifications,[]);
        } finally {handlers.get('session_shutdown')();}
      });
    }
  }
} finally {await rm(temp,{recursive:true,force:true});}
