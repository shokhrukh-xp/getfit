'use strict';
/* 22.10, его слова после красной строки в зале: «проверь полностью весь код
   на такие ошибки и исправь». Заперто:
   1) замер: первая отправка оборвалась — повтор сам, «Замер записан», без красного;
   2) занятие вне зала: обрыв — повтор с тем же op (сервер не задвоит);
   3) тренер: ответ потерялся, а сервер сообщение принял — ответ на экране,
      ошибки и черновика нет (иначе «Повторить» записал бы еду второй раз);
   4) необработанный отказ где-то в приложении не пишет красное «Сбой — …»
      в строку тренировки. */
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const быстро=p=>p.addInitScript(()=>{window.__паузыОтправки=[300,300];});
(async()=>{const b=await chromium.launch();try{
  /* 1) замер */
  {const p=await b.newPage({viewport:{width:390,height:844}});await быстро(p);
   let n=0;const err=await M.поднять(p,{meas:M.замеры().filter(m=>m.date!==M.TODAY),handleRoute:async r=>{
     const u=new URL(r.request().url());if(u.pathname==='/measure'&&n++===0){await r.abort('failed');return true;}return false;}});
   await M.замерВручную(p);await p.locator('#fw').scrollIntoViewIfNeeded();await p.fill('#fw','87,6');await p.click('#fmsave');
   await p.waitForFunction(()=>/Замер записан|настроении/.test(document.querySelector('#fmreply').textContent),null,{timeout:8000}).catch(()=>{});
   const r=await p.evaluate(()=>{const e=document.getElementById('fmreply');return {т:e.textContent,к:e.className};});
   ok(n===2&&!/bad/.test(r.к)&&/Замер записан|настроении/.test(r.т),'замер: обрыв — повтор сам ('+n+' запроса), без красного: '+r.т.slice(0,40));
   ok(!err.length,'замер: без ошибок на странице'+(err.length?': '+err.join(' | '):''));await p.close();}
  /* 2) занятие вне зала */
  {const p=await b.newPage({viewport:{width:390,height:844}});await быстро(p);
   const ops=[];const err=await M.поднять(p,{page:'gym',handleRoute:async r=>{const u=new URL(r.request().url());
     if(u.pathname==='/act/add'){const d=JSON.parse(r.request().postData()||'{}');ops.push(d.op);if(ops.length===1){await r.abort('failed');return true;}}return false;}});
   await p.locator('.sportadd:visible').first().click();await p.locator('#sportm.show').waitFor();
   await p.click('#sp-save');await p.waitForTimeout(2500);
   ok(ops.length===2&&ops[0]&&ops[0]===ops[1],'занятие: обрыв — повтор сам и с тем же op: '+JSON.stringify(ops));
   ok(!err.length,'занятие: без ошибок на странице'+(err.length?': '+err.join(' | '):''));await p.close();}
  /* 3) тренер */
  {const p=await b.newPage({viewport:{width:390,height:844}});
   let чат=[],тс=0;const ТЕКСТ='съел овсянку 300 г';
   const err=await M.поднять(p,{handleRoute:async r=>{const u=new URL(r.request().url());
     if(u.pathname==='/coach'){const сейчас=тс+1000;чат=[{ts:сейчас,role:'user',text:ТЕКСТ},{ts:сейчас+1,role:'assistant',text:'Записал овсянку: 360 ккал.'}];await r.abort('failed');return true;}
     if(u.pathname==='/chat'){await r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,chat:чат})});return true;}
     return false;}});
   await p.click('#coachnav');await p.waitForTimeout(400);
   тс=await p.evaluate(()=>Date.now());await p.fill('#ctext',ТЕКСТ);await p.click('#csend');
   await p.waitForFunction(()=>/Записал овсянку/.test(document.querySelector('#chatlog').textContent),null,{timeout:8000}).catch(()=>{});
   const r=await p.evaluate(()=>({т:document.querySelector('#chatlog').textContent,поле:document.getElementById('ctext').value}));
   ok(/Записал овсянку/.test(r.т)&&!/Нет связи|Не получилось/.test(r.т)&&r.поле==='','тренер: сервер принял — ответ на экране, без ошибки и черновика (поле: «'+r.поле+'»)');
   ok(!err.length,'тренер: без ошибок на странице'+(err.length?': '+err.join(' | '):''));await p.close();}
  /* 4) чужой сбой не красит строку зала */
  {const p=await b.newPage({viewport:{width:390,height:844}});
   const err=await M.поднять(p,{page:'gym'});
   await p.evaluate(()=>{setTimeout(()=>{Promise.reject(new Error('посторонний сбой'));},0);});await p.waitForTimeout(500);
   const т=await p.$eval('#dbnote',e=>e.textContent+' | '+e.className);
   ok(!/Сбой/.test(т)&&!/bad/.test(т),'необработанный отказ — строка зала без «Сбой»: '+т);
   await p.close();}
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
