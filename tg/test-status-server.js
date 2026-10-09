'use strict';
// 09.10, его снимок: красное «20 подходов отмечено · Telegram не ответил, данные
// на телефоне», хотя все 20 подходов уже были на сервере. Строка отвечала по
// запасной копии в CloudStorage Telegram. Его выбор «Статус по серверу»:
//  1) копия в Telegram не легла, сервер принял — «Сохранено в облаке», не красное;
//  2) сервер не принял — красное «не отправлено, данные на телефоне» и «Повторить»;
//  3) «Повторить», когда сервер снова на связи, — зелёное;
//  4) «Завершить и сохранить» при сбое только Telegram — «Сохранено ✓».
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;function ok(c,t){console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++}
const нота=p=>p.evaluate(()=>{const e=document.getElementById('dbnote');return {т:e.textContent.trim(),к:e.className,кн:!!e.querySelector('button')}});
const сбойW=u=>u.pathname==='/w', ответ503=r=>r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['dark','light']){
  const p=await b.newPage({viewport:{width:390,height:844}});
  const o=opts(theme);o.page='gym';
  const err=await M.поднять(p,o);await p.waitForTimeout(500);
  await p.click('#dayseg button[data-day="D1"]');await p.waitForTimeout(300);
  await p.click('#list .exrow[data-pickex="0"]');await p.waitForTimeout(400);
  // 1) Telegram не отвечает, сервер принял
  await p.evaluate(()=>{Telegram.WebApp.CloudStorage.setItem=(k,v,cb)=>cb('temporary failure',false);});
  await p.locator('.setrow .ok').first().click();
  await p.waitForFunction(()=>/Сохранено в облаке/.test(document.getElementById('dbnote').textContent),null,{timeout:9000}).catch(()=>{});
  let н=await нота(p);
  ok(/1 подход отмечено · Сохранено в облаке/.test(н.т)&&!/bad/.test(н.к),theme+': копия в Telegram не легла, сервер принял — зелёное: '+н.т);
  ok(!/Telegram/.test(н.т),theme+': про Telegram в строке ни слова');
  // 2) сервер не принял
  await p.route(сбойW,ответ503);
  await p.locator('.setrow .ok').nth(1).click();
  await p.waitForFunction(()=>/не отправлено/.test(document.getElementById('dbnote').textContent),null,{timeout:9000}).catch(()=>{});
  н=await нота(p);
  ok(/2 подхода отмечено · не отправлено, данные на телефоне\s*Повторить/.test(н.т)&&/bad/.test(н.к)&&н.кн,theme+': сервер не принял — красное с «Повторить»: '+н.т);
  await p.locator('#dbnote').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/gf-status-server-err-'+theme+'.png'});
  // 3) «Повторить» — сервер снова принимает
  await p.unroute(сбойW,ответ503);
  await p.click('#dbnote button');
  await p.waitForFunction(()=>/Сохранено в облаке/.test(document.getElementById('dbnote').textContent),null,{timeout:9000}).catch(()=>{});
  н=await нота(p);
  ok(/2 подхода отмечено · Сохранено в облаке/.test(н.т)&&!/bad/.test(н.к)&&!н.кн,theme+': после «Повторить» — зелёное: '+н.т);
  // 4) «Завершить» при сбое только Telegram
  await p.locator('.card.exact .allb').click();await p.waitForTimeout(400);
  await p.click('#finish');await M.ответитьДлительность(p,45);await p.waitForTimeout(900);
  const кн=await p.$eval('#finish',e=>e.textContent.trim());н=await нота(p);
  ok(/Сохранено/.test(кн)&&!/bad/.test(н.к),theme+': «Завершить» — «'+кн+'», строка: '+н.т);
  ok(!err||!err.length,theme+': без ошибок на странице'+(err&&err.length?': '+err.join(' | '):''));
  await p.close();
 }
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
