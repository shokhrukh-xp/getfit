'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const M=require('./mock');
const UID='308687648',META='shp_v1_data_session_'+UID;
const history=[{id:'2026-09-18_D1',date:'2026-09-18',day:'D1',name:'RESET_SENTINEL',ex:[]}];
(async()=>{
  const browser=await chromium.launch();
  try{
    let epoch=0,failReset=true;const ops=[],writes=[];
    const handleRoute=async route=>{
      const req=route.request(),p=new URL(req.url()).pathname;
      const give=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      if(p==='/session'){await give(200,{ok:true,session:{epoch,full_epoch:epoch,reset_at:1}});return true;}
      if(p==='/forget'){
        ops.push(JSON.parse(req.postData()));
        if(failReset)await give(503,{error:'Сервер не подтвердил сброс'});
        else {epoch=1;await give(200,{ok:true,session:{epoch:1,full_epoch:1,reset_at:1},cleanupPending:false});}
        return true;
      }
      if(p==='/s'||p==='/w')writes.push({epoch:req.headers()['x-data-epoch'],body:req.postData()});
      return false;
    };
    const first=await browser.newPage({viewport:{width:390,height:900}});
    const errors=await M.поднять(first,{hist:history,me:{name:'RESET_SENTINEL'},preserveReload:true,handleRoute,wait:1800});
    await first.click('#profbtn');await first.click('#profreset');await first.click('[data-reset="all"]');
    await first.waitForFunction(()=>document.getElementById('resetstate').textContent.includes('не подтвердил'));
    assert.ok(await first.evaluate(()=>localStorage.getItem('tgcs_workouts_2026-09-18_D1')),'failed server reset preserves local diary');
    failReset=false;await first.click('[data-reset="all"]');
    await first.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}').epoch===1,META);
    await first.waitForTimeout(1700);
    assert.equal(ops[0].operation,ops[1].operation,'same reset retry id');
    assert.equal(await first.evaluate(()=>Object.values(localStorage).some(v=>v.includes('RESET_SENTINEL'))),false);
    console.log('PASS reset: failure preserves local data; retry is stable; successful reset clears and reloads');
    const second=await browser.newPage({viewport:{width:390,height:900}});
    const offset=writes.length;
    const secondErrors=await M.поднять(second,{hist:history,me:{name:'RESET_SENTINEL'},preserveReload:true,handleRoute,wait:2400});
    await second.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}').epoch===1,META);
    assert.equal(await second.evaluate(()=>Object.values(localStorage).some(v=>v.includes('RESET_SENTINEL'))),false);
    assert.ok(writes.slice(offset).every(w=>w.epoch==='1'&&!w.body.includes('RESET_SENTINEL')));
    console.log('PASS reset: second device clears stale profile/history before any upload');
    epoch=0;
    const third=await browser.newPage({viewport:{width:390,height:900}});
    const thirdErrors=await M.поднять(third,{hist:history,preserveReload:true,handleRoute,wait:1800});
    await third.evaluate(()=>localStorage.setItem('__mock_fail_cloud','1'));
    epoch=1;await third.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await third.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}').epoch===1,META);
    await third.waitForTimeout(1500);
    assert.ok(await third.evaluate(()=>JSON.parse(localStorage.getItem('shp_v1_cloud_cleanup')||'null')));
    assert.ok(await third.evaluate(()=>localStorage.getItem('cs_workouts_2026-09-18_D1')));
    assert.ok(await third.locator('#cleanupnotice').isVisible());
    await third.evaluate(()=>{localStorage.removeItem('__mock_fail_cloud');localStorage.setItem('cs_g1_state_new','{"fresh":true}');window.dispatchEvent(new Event('focus'));});
    await third.waitForFunction(()=>!JSON.parse(localStorage.getItem('shp_v1_cloud_cleanup')||'null'));
    assert.equal(await third.evaluate(()=>localStorage.getItem('cs_workouts_2026-09-18_D1')),null);
    assert.ok(await third.evaluate(()=>localStorage.getItem('cs_g1_state_new')));
    console.log('PASS reset: failed CloudStorage deletion retries without removing the new generation');
    // A legacy tab may observe another tab's new localStorage marker. It must
    // still compare the server with its captured generation and discard its data.
    epoch=0;
    const fourth=await browser.newPage({viewport:{width:390,height:900}});
    const fourthErrors=await M.поднять(fourth,{hist:history,preserveReload:true,handleRoute,wait:1800});
    epoch=1;
    await fourth.evaluate(k=>{localStorage.setItem(k,JSON.stringify({epoch:1,full_epoch:1}));window.dispatchEvent(new Event('focus'));},META);
    await fourth.waitForFunction(()=>!localStorage.getItem('tgcs_workouts_2026-09-18_D1'));
    console.log('PASS reset: another tab changing the marker cannot promote stale data to the new generation');
    // Deliberate reload cancels outstanding fetches; all actual page exceptions still count.
    for(const list of [errors,secondErrors,thirdErrors,fourthErrors])assert.deepEqual(list.filter(e=>!e.includes('Дневник обновляется после сброса')),[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
