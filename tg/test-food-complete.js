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
  assert.equal(await page.locator('[data-confirm-food]').count(),0);
  assert.match(await page.locator('#fday').innerText(),/00:00 по Ташкенту/);
  await page.close();
  page=await browser.newPage({viewport:{width:390,height:900}});
  await page.route('**://cdn.jsdelivr.net/**',r=>r.abort());
  const pastErrors=await M.поднять(page,{theme:'dark',wait:2700});
  await page.click('.l1 button[data-page="food"]');
  // 07.10: выбираем прошлый день, а не подменяем ответ на запрос сегодня.
  await page.click('[data-fnav="-1"]');
  await page.waitForFunction(()=>document.querySelector('#fday').textContent.includes('учитывается автоматически'));

  assert.equal(await page.locator('[data-confirm-food]').count(),0);
  assert.match(await page.locator('#fday').innerText(),/учитывается автоматически/);
  assert.equal(errors.length+pastErrors.length,0,errors.concat(pastErrors).join('\n'));
  console.log('PASS past-day auto-completion notice visible; no manual confirmation; no browser errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
