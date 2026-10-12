const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');
(async () => {
  const result=await esbuild.build({entryPoints:[path.resolve(__dirname,'../src/background/creation-history.ts')],bundle:true,write:false,platform:'node',format:'cjs'});
  const loaded={exports:{}};
  new Function('module','exports','require',result.outputFiles[0].text)(loaded,loaded.exports,require);
  const entries=Array.from({length:51},(_,index)=>({id:String(index+1),generatedAt:new Date(1700000000000+index*1000).toISOString()}));
  const original=JSON.stringify(entries);
  const history=loaded.exports.latestCreationHistory(entries);
  assert.equal(history.length,50);
  assert.equal(history[0].id,'51');
  assert.equal(history.at(-1).id,'2');
  assert(!history.some(entry=>entry.id==='1'));
  assert.equal(JSON.stringify(entries),original);
  assert.equal(loaded.exports.latestCreationHistory(history)[0].id,'51');
  console.log('PASS: latest 50 images, newest first, oldest rolls out, stable on reload');
})().catch(error=>{console.error(error);process.exitCode=1;});
