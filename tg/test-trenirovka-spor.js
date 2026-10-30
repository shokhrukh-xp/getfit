'use strict';
/* 30.10 (аудит): спор по тренировке («изменено на другом устройстве») решить было негде —
   подходы дня навсегда висели «не дошли». Заперто: подходы с телефона уходят поверх
   серверной версии (её копия остаётся на телефоне), второй спор подряд — стоп, без цикла. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),M=require('./mock');
const UID='308687648', ID='2026-10-30_test';
async function прогон(browser,споров){
  const page=await browser.newPage({viewport:{width:390,height:844}}), посты=[];
  await page.addInitScript(([UID,ID])=>{ if(sessionStorage.getItem('seeded'))return; sessionStorage.setItem('seeded','1');
    localStorage.setItem('shp_v1_work_sync_'+UID,JSON.stringify({versions:{},pending:{[ID]:{body:{date:'2026-10-30',day:'D1',ex:[{n:'Жим',s:[{w:26,r:10,ok:1}]}]},deleted:false,version:0,operation:'op_old'}}}));
  },[UID,ID]);
  let осталось=споров;
  await M.поднять(page,{wait:0,handleRoute:async route=>{
    const u=new URL(route.request().url());
    if(u.pathname!=='/w'||route.request().method()!=='POST')return false;
    const b=JSON.parse(route.request().postData()||'{}');посты.push(b);
    if(осталось-->0)await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,code:'conflict',version:7+посты.length,deleted:false})});
    else await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,version:99,updated:99})});
    return true;}});
  await page.waitForTimeout(4000);
  const ws=await page.evaluate(u=>JSON.parse(localStorage.getItem('shp_v1_work_sync_'+u)||'{}'),UID);
  const копии=await page.evaluate(u=>JSON.parse(localStorage.getItem('shp_v1_work_conflicts_'+u)||'[]'),UID);
  await page.close();
  return {посты,ws,копии};
}
(async()=>{
  const browser=await chromium.launch();
  try{
    let r=await прогон(browser,1);
    const мои=r.посты.filter(b=>b.id===ID);
    assert.ok(мои.length>=2,'после спора отправлено ещё раз: '+мои.length);
    assert.equal(мои[1].version,8,'второй раз — с версией сервера');
    assert.ok(!(r.ws.pending||{})[ID],'подходы дошли');
    assert.equal(r.копии.length,1,'серверная версия отложена копией');
    console.log('PASS спор по тренировке — подходы с телефона поверх серверных, копия на телефоне');
    r=await прогон(browser,5);
    const мои2=r.посты.filter(b=>b.id===ID);
    assert.ok(мои2.length<=3,'без бесконечного цикла: '+мои2.length);
    assert.ok((r.ws.pending||{})[ID]&&(r.ws.pending||{})[ID].conflict,'второй спор подряд — стоп');
    console.log('PASS второй спор подряд — остановка, без цикла');
  }finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
