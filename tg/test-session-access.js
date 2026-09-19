'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const M=require('./mock');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:900}});let joined=false,body=null;
  const errors=await M.поднять(page,{newbie:true,preserveReload:true,wait:1200,handleRoute:async route=>{
   const req=route.request(),p=new URL(req.url()).pathname;
   if(p==='/session'&&!joined){await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'invite',error:'Нужен код'})});return true;}
   if(p==='/join'){
    body=JSON.parse(req.postData());assert.equal(req.headers()['x-tg-init'],'mock');
    joined=true;await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});return true;
   }
   return false;
  }});
  await page.waitForSelector('#gate.show');await page.fill('#gcode','familytest');await page.click('#gjoin');
  await page.waitForFunction(()=>!document.getElementById('gate').classList.contains('show'));
  assert.equal(body.code,'familytest');assert.equal(body.uid,'308687648');assert.equal(joined,true);
  assert.deepEqual(errors,[]);
  console.log('PASS session: invitation code entry works before the first diary session exists');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
