'use strict';
/* 28.10, Claude: ошибки экранов раньше не доходили до сервера (reportErr писал в старый
   Firebase) — «сбои везде» видел только он. Теперь строка уходит на /err: одна и та же —
   один раз, не больше 10 за открытие, «Script error.» — мимо, без uid. Стенд по умолчанию
   не шлёт (127.0.0.1), здесь отправка включена флагом. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const M=require('./mock');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:900}});const o={wait:800};
  await page.addInitScript(()=>{window.__errBeacon=true;});
  const errors=await M.поднять(page,o);
    await page.evaluate(()=>{const e=m=>window.dispatchEvent(new ErrorEvent('error',{message:m,lineno:7}));e('Тестовый сбой экрана');e('Тестовый сбой экрана');e('Script error.');});
  await page.waitForFunction(()=>true);await page.waitForTimeout(600);
  const мои=(o.errs||[]).map(x=>JSON.parse(x)).filter(x=>/Тестовый сбой/.test(x.m));
  assert.equal(мои.length,1,'одна и та же ошибка — один раз: '+JSON.stringify(o.errs));
  assert.equal(мои[0].w,'js');assert.match(мои[0].b,/^\d\d\.\d\d \d\d:\d\d$/,'метка сборки');assert.ok(!('uid' in мои[0]),'без uid');
  assert.ok(!(o.errs||[]).some(x=>/Script error/.test(x)),'Script error — мимо');
  await page.evaluate(()=>{for(let i=0;i<30;i++)window.dispatchEvent(new ErrorEvent('error',{message:'сбой '+i,lineno:i}));});await page.waitForTimeout(600);
  assert.ok((o.errs||[]).length<=10,'не больше 10 за открытие: '+(o.errs||[]).length);
  // без флага стенд не шлёт ничего
  const page2=await browser.newPage({viewport:{width:390,height:900}});const o2={wait:800};
  await M.поднять(page2,o2);await page2.evaluate(()=>window.dispatchEvent(new ErrorEvent('error',{message:'без флага',lineno:1})));await page2.waitForTimeout(400);
  assert.equal((o2.errs||[]).length,0,'стенд без флага не шлёт');
  assert.deepEqual(errors.filter(e=>!/Тестовый сбой|сбой \d|Script error/.test(e)),[]);
  console.log('PASS ошибки экранов: строка уходит на /err один раз, не больше 10, без uid; стенд без флага молчит');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
