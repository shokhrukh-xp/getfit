'use strict';
const {chromium}=require('playwright'),assert=require('assert/strict'),{fixture,start,until}=require('./test-settings-save');
(async()=>{const b=await chromium.launch();try{for(const theme of ['dark','light'])for(const width of [320,390]){
 const f=fixture(),route=f.route;let payload;f.route=async r=>{if(new URL(r.request().url()).pathname==='/ai'){payload=r.request().postDataJSON();await r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,code:'ai_down',error:'fixture'})});return true}return route(r)};
 const {p,errors}=await start(b,f,theme,width);await p.click('#pq-gym');await p.click('#progedit');
 for(const [box,v] of [['when','morning'],['min','30'],['level','new'],['place','home'],['eq','db'],['focus','back'],['lim','knee']])await p.click('#sb-'+box+' [data-v="'+v+'"]');
 await p.click('#sb-place [data-v="gym"]');await p.click('#sb-plate [data-v="0.5"]');await p.fill('#sb-dis','берпи, выпады');await p.click('#sb-go');
 await until(()=>payload,'сборщик получил запрос');await until(()=>f.me().plate===.5,'настройки сборки подтверждены');
 for(const [k,v] of Object.entries({when:'morning',min:30,level:'new',place:'gym',plate:.5}))assert.equal(payload.me[k],v,k);
 for(const [k,v] of [['eq','db'],['focus','back'],['lim','knee'],['dislikes','берпи']])assert(payload.me[k].includes(v),k);
 assert.equal(payload.min,30);assert(payload.focus.length>0);assert(payload.days>=2);assert.deepEqual(f.me().dislikes,['берпи','выпады']);
 await p.reload();await p.waitForTimeout(1800);await p.click('#profbtn');await p.click('#pq-gym');await p.click('#progedit');assert.equal(await p.locator('#sb-plate [data-v="0.5"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#sb-min [data-v="30"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#sb-dis').inputValue(),'берпи, выпады');assert.deepEqual(errors,[]);await p.close();console.log('PASS '+theme+width+': все условия сборки — в реальном запросе, серверном профиле и после reload');
 }}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
