'use strict';
// A completed set remains on its original day across Tashkent midnight,
// even when the device runs in another timezone. All API calls are mocked.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const M = require('./mock');
(async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:390,height:900},timezoneId:'Pacific/Honolulu'});
    const errors=await M.поднять(page,{page:'gym',wait:2600});
    await page.click('#list .exrow');
    await page.click('.card.exact .allb');
    const dates=[];
    page.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/day')dates.push(u.searchParams.get('date'));});
    const result=await page.evaluate(async()=>{
      const old=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tashkent'});
      const done=document.querySelectorAll('.setrow.done').length;
      const Native=Date;
      const at=+new Native(old+'T19:01:00Z'); // 00:01 next day in Tashkent
      window.Date=new Proxy(Native,{
        construct:(t,args)=>args.length?new t(...args):new t(at),
        get:(t,p)=>p==='now'?(()=>at):t[p]
      });
      window.dispatchEvent(new Event('focus'));
      await new Promise(r=>setTimeout(r,500));
      const records=Object.keys(localStorage).filter(k=>k.startsWith('tgcs_workouts_')).map(k=>JSON.parse(localStorage.getItem(k)));
      const after=document.querySelectorAll('.setrow.done').length;
      window.dispatchEvent(new Event('focus'));
      await new Promise(r=>setTimeout(r,100));
      return {old,next:new Native(at).toLocaleDateString('sv-SE',{timeZone:'Asia/Tashkent'}),
        done,records,after,again:document.querySelectorAll('.setrow.done').length};
    });
    assert.notEqual(result.next,result.old);assert.ok(result.done>0);
    assert.equal(result.records.length,1);assert.equal(result.records[0].date,result.old);
    assert.ok(result.records[0].ex.length>0);assert.equal(result.after,0);assert.equal(result.again,0);
    assert.ok(dates.includes(result.next),'food requested for next day: '+dates);
    assert.deepEqual(errors,[]);
    console.log('PASS midnight: timezone, yesterday saved, new day empty, food date advanced, repeat safe, no page errors');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
