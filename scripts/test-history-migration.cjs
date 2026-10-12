const assert=require('node:assert/strict');
const path=require('node:path');
const esbuild=require('esbuild');
(async()=>{
 const result=await esbuild.build({entryPoints:[path.resolve(__dirname,'../src/lib/example-images.ts')],bundle:true,write:false,platform:'node',format:'cjs'});
 const loaded={exports:{}};
 new Function('module','exports','require',result.outputFiles[0].text)(loaded,loaded.exports,require);
 const history=[{id:'generated-image'}];
 const task={status:'generating'};
 const data={'prompt-butler-image-history':history,'prompt-butler-image-task':task,'prompt-butler-favorites':[]};
 global.chrome={storage:{local:{get:async key=>({[key]:data[key]}),set:async values=>Object.assign(data,values)}}};
 await loaded.exports.migrateLegacyPromptImages();
 assert.deepEqual(data['prompt-butler-image-history'],history,'Opening workspace must preserve creation history');
 assert.deepEqual(data['prompt-butler-image-task'],task,'Image migration must preserve generation task');
 console.log('PASS: legacy migration preserves creation history and running image task');
})().catch(error=>{console.error(error);process.exitCode=1;});
