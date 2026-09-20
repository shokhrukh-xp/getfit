'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const M=require('./mock');
(async()=>{
 const browser=await chromium.launch();
 try {
  let page=await browser.newPage({viewport:{width:390,height:900}});
  await page.route('**://cdn.jsdelivr.net/**',r=>r.abort());
  const errors=await M.поднять(page,{theme:'dark',wait:2700});
  await page.click('.l1 button[data-page="food"]');
  await page.waitForTimeout(500);
  assert.equal(await page.locator('[data-confirm-food]').count(),0,'do not confirm unfinished today');
  await page.close();
  page=await browser.newPage({viewport:{width:390,height:900}});
  await page.route('**://cdn.jsdelivr.net/**',r=>r.abort());
  const pastErrors=await M.поднять(page,{theme:'dark',wait:2700,day:{date:'2026-08-20'}});
  await page.click('.l1 button[data-page="food"]');
  await page.waitForTimeout(900);

  let sent;
  await page.route('**/day/close',async route=>{sent=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})})});
  await page.click('[data-confirm-food]');
  await page.waitForFunction(()=>document.querySelector('[data-confirm-food]').textContent.includes('подтверждена'));
  assert.equal(sent.date,'2026-08-20');assert.ok(sent.uid);
  assert.equal(errors.length+pastErrors.length,0,errors.concat(pastErrors).join('\n'));
  console.log('PASS past-day confirmation sends selected day; today excluded; success visible; no browser errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
