'use strict';
/* 27.10: первый запрос и уточнение могут упасть; повтор не теряет анкету,
   ответы или уже полученную программу. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),M=require('./mock');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await M.поднять(page,{newbie:true,theme:'dark',wait:2000});
  await M.шаги(page,{});
  let failures=1;
  await page.route(/\/onboard(\?|$)/,async route=>{
    if(failures-->0)return route.fulfill({status:504,contentType:'application/json',body:JSON.stringify({error:'ИИ не ответил',code:'slow'})});
    return route.fallback();
  });
  await page.click('#wz-go');await page.waitForSelector('#wzretry');
  assert.ok(await page.locator('#wzchat').innerText().then(t=>t.includes('Попробуйте ещё раз')));
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('shp_v1_me')||'{}'));
  await page.click('#wzretry');await page.waitForSelector('.wzq [data-opt="колени"]');
  assert.equal(await page.locator('.aiprev').count(),1);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('shp_v1_me')||'{}'));
  assert.equal(after.age,before.age);assert.equal(after.bw,before.bw);
  failures=1;
  await page.click('.wzq [data-opt="колени"]');await page.waitForSelector('#wzretry');
  assert.equal(await page.locator('.aiprev').count(),1,'при отказе уточнения программа остаётся');
  assert.ok(await page.locator('#wzapply').isVisible(),'по программе можно начать');
  assert.equal(await page.locator('#wzretry').innerText(),'Повторить уточнение');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('shp_v1_onbdraft')||'{}').qa.at(-1).a),'колени','ответ сохранён до сети');
  await page.click('#wzretry');await page.waitForSelector('.wzdone');
  assert.ok((await page.locator('.wzdone').innerText()).includes('Убрал присед'));
  await page.reload();await page.waitForSelector('#onbbar:not([hidden])');await page.click('#onbbar');
  await page.waitForSelector('.aiprev');assert.ok((await page.locator('.aiprev').innerText()).includes('Жим ногами'));
  await page.click('#wzapply');await page.waitForFunction(()=>!document.querySelector('#picker').classList.contains('show'));
  console.log('PASS сбой первой сборки → повтор; сбой уточнения → сохранение ответа и программы → повтор → перезапуск → принятие');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
