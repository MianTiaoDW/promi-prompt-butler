const assert = require('node:assert/strict'), path = require('node:path'), { build } = require('esbuild');
(async () => {
  const result = await build({ entryPoints: [path.resolve(__dirname, '../src/lib/mark-panel-layout.ts')], bundle: true, write: false, platform: 'node', format: 'cjs' });
  const module = { exports: {} }; new Function('module','exports','require',result.outputFiles[0].text)(module,module.exports,require);
  const { placeMarkPanel, latestFrame } = module.exports;
  const cases = [
    { host: {left:0,top:0,width:600,height:780}, selected:{left:80,top:280,right:460,bottom:360} },
    { host: {left:20,top:90,width:380,height:640}, selected:{left:45,top:210,right:370,bottom:390} },
    { host: {left:20,top:90,width:380,height:640}, selected:{left:45,top:540,right:370,bottom:620} },
    { host: {left:0,top:0,width:1000,height:800}, selected:{left:100,top:250,right:350,bottom:290} }
  ];
  for(const input of cases){const p=placeMarkPanel(input.host,input.selected,1100,850);const a={left:p.left+input.host.left,top:p.top+input.host.top,right:p.left+input.host.left+p.width,bottom:p.top+input.host.top+p.maxHeight};
    assert(a.right <= input.host.left+input.host.width && a.left>=input.host.left && a.top>=input.host.top && a.bottom<=Math.min(850,input.host.top+input.host.height));
    assert(a.right<=input.selected.left || a.left>=input.selected.right || a.bottom<=input.selected.top || a.top>=input.selected.bottom,'Panel must avoid readable selection');
  }
  let scheduled, count=0, resultValue; const frame=latestFrame(fn=>{scheduled=fn;count++;return 1},()=>{});
  for(let i=0;i<100;i++) frame.schedule(()=>{resultValue=i});
  assert.equal(count,1);scheduled();assert.equal(resultValue,99);
  frame.schedule(()=>{resultValue=200});frame.flush();assert.equal(resultValue,200);
  frame.schedule(()=>{resultValue=300});frame.cancel();scheduled();assert.equal(resultValue,200,'Unmount cancels pending changes');
  console.log('PASS: color panel avoids selections at narrow/wide sizes; 100 drag samples coalesce into latest frame; flush/cancel');
})().catch(error=>{console.error(error);process.exitCode=1});
