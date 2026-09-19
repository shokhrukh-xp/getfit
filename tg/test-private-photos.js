'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const M=require('./mock');
const key='abcdefghijklmnopqrstuv';
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1cAAAAASUVORK5CYII=','base64');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:900}});let visible=true;const requests=[];
  const errors=await M.поднять(page,{wait:1800,day:{meals:[{id:1,t:'08:40',kind:'завтрак',text:'тест',kcal:400,prot:30,img:'https://getfit-sync.sh-pulatov.workers.dev/photo?key='+key}]},handleRoute:async route=>{
   const req=route.request(),u=new URL(req.url());if(u.pathname!=='/photo')return false;
   requests.push({url:req.url(),headers:req.headers()});
   await route.fulfill({status:visible?200:404,contentType:'image/png',body:visible?pixel:Buffer.from('')});return true;
  }});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-private-photo]')).some(e=>(e.getAttribute('href')||e.getAttribute('src')||'').startsWith('blob:')));
  assert.ok(requests.length>0);assert.ok(requests.every(r=>r.headers['x-tg-init']==='mock'&&r.headers['x-data-epoch']==='0'));
  assert.ok(requests.every(r=>!r.url.includes('initData')&&!r.url.includes('x-tg-init')));
  assert.equal(await page.locator('img[src*="workers.dev"],image[href*="workers.dev"]').count(),0);
  visible=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-private-photo]')).every(e=>!e.getAttribute('href')&&!e.getAttribute('src')));
  assert.deepEqual(errors,[]);
  console.log('PASS photos: header-authenticated blob rendering; no public image URL; revoked access clears the displayed blob on resume');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
