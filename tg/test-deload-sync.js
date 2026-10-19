'use strict';
const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),{fixture,start,until,sleep}=require('./test-settings-save');
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['dark','light'])for(const width of [320,390]){
  const f=fixture(),A=await start(b,f,theme,width),B=await start(b,f,theme,width),a=A.p,p=B.p;
  const open=async x=>{await x.click('#profclose');await x.click('.l1 [data-page="gym"]');await x.click('#schedbtn')};await open(a);await open(p);
  const doc=()=>{const r=f.sq.prepare("SELECT data FROM state WHERE uid='svc_settings' AND key='deload_user'").get();return r&&JSON.parse(r.data)};
  await a.click('#deloadon');await until(()=>doc()?.by&&Object.values(doc().by).some(x=>x.on),'включение подтверждено сервером');
  await p.reload();await sleep(1800);await p.click('.l1 [data-page="gym"]');await p.click('#schedbtn');await p.locator('#deloadoff').waitFor({state:'visible'});
  await p.click('#deloadoff');await until(()=>Object.values(doc().by).some(x=>x.on===false),'отмена подтверждена');
  await a.reload();await sleep(1800);await a.click('.l1 [data-page="gym"]');await a.click('#schedbtn');await a.locator('#deloadon').waitFor({state:'visible'});assert(Object.values(doc().by).every(x=>!x.on));
  f.fail=true;await a.click('#deloadon');await a.locator('#schedm .save-notice.bad').waitFor();assert(Object.values(doc().by).every(x=>!x.on));f.fail=false;await a.evaluate(()=>window.dispatchEvent(new Event('online')));await until(()=>Object.values(doc().by).some(x=>x.on),'досылка лёгкой недели');
  assert.deepEqual(A.errors,[]);assert.deepEqual(B.errors,[]);await a.close();await p.close();console.log('PASS '+theme+width+': лёгкая неделя и отмена — между устройствами, отказ и повтор');
 }
 const src=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
 function fun(n){const a=src.indexOf('function '+n+'('),b=src.indexOf('\n}',a);return src.slice(a,b+2)}
 const c=vm.createContext({TODAY:'2026-10-19',profile:'shp',get:()=>c.date,set:(k,v)=>c.date=v,gset(){},myData:()=>({plate:.5}),PLATES:[25,20,15,10,5,2.5,1.25,.5],BARW:20});
 vm.runInContext(src.match(/function plateMin\(\).*\n/)[0]+fun('plateText')+fun('stepOf')+fun('deloadOn'),c);
 assert.equal(c.plateMin(),.5);assert.equal(c.plateText(21),'гриф 20 + 0,5 на сторону');assert.equal(c.plateText(23),'гриф 20 + 3×0,5 на сторону');assert.equal(c.stepOf({eq:'штанга',inc:.5}),1);
 c.date='2026-10-13';assert(c.deloadOn());c.date='2026-10-12';assert(!c.deloadOn());assert.equal(c.date,null);c.date='2026-10-20';assert(!c.deloadOn());
 console.log('PASS настоящий расчёт: блин 0,5 кг, шаг 1 кг; лёгкая неделя ровно 7 дней');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
