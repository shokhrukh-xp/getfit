'use strict';
/* 18.10, его слова: «найди решение чтобы даже не приходилось нажимать
   повторить. Нужно чтобы всё срабатывало с первого раза». Отправка в чат
   (рецепт из круга, «В Telegram» у меню и покупок) сама повторяет запрос до
   трёх раз с тем же op; человек видит «Отправляю…», а не «Повторить».
   Проверяем:
   1. Меню: первый ответ 503, второй ok — «Отправил ✓» без нажатия, оба
      запроса с одним op.
   2. Рецепт из круга: 502 «Дошло не всё» трижды — текст сервера под кнопкой и
      «Повторить»; «Повторить» идёт тем же op; потом ok — «Отправлено в чат ✓».
      Перерисовка круга состояние не сбрасывает.
   3. Отказ по делу (tg_closed, 4xx, 200 с ok:false) — без автоповтора, сразу
      текст сервера; «Повторить» — тем же op.
   4. Обрыв связи — тоже повтор; ушло — кнопка неактивна, второй тап не шлёт.
      Меню после успеха — новый op. */
const {chromium}=require('playwright'),M=require('./mock'),assert=require('assert/strict');
let failures=0;
const ok=(c,m)=>{if(!c){failures++;console.error('FAIL',m);}else console.log('ok',m);};
const until=async(fn,m)=>{for(let i=0;i<500;i++){if(await fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Не дождался: '+m);};
const give=(r,d,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(d)});
/* Паузы между повторами на стенде — 30 мс вместо 2 и 5 с */
const быстро=p=>p.evaluate(()=>{window.__паузыОтправки=[30,30];});
(async()=>{const b=await chromium.launch();try{
 /* 1. Меню и покупки */
 {const p=await b.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(5000);
  const sent=[],ответы=[{s:503,d:{error:'Сервер занят'}},{s:200,d:{ok:true}}];
  const menu={ok:true,span:'day',from:M.Д(-1),дни:[],покупки:{отделы:[],дома:[]}};
  const errors=await M.поднять(p,{page:'eat',menu:{day:menu},handleRoute:async r=>{
   if(new URL(r.request().url()).pathname!=='/menu/send')return false;
   sent.push(JSON.parse(r.request().postData()));const a=ответы.shift()||{s:200,d:{ok:true}};await give(r,a.d,a.s);return true;}});
  await быстро(p);
  await p.click('[data-eseg="buy"]');
  await p.click('[data-msend="day:buy"]');
  await p.waitForFunction(()=>document.querySelector('[data-msend="day:buy"]').textContent==='Отправил ✓');
  ok(sent.length===2,'меню: 503, потом ok — два запроса, человек ничего не нажимал');
  ok(sent[0].op&&sent[0].op===sent[1].op,'меню: повтор с тем же op — сервер не пришлёт второй раз');
  ok(await p.locator('#eatbody .mwarn').count()===0,'меню: ошибки на экране нет');
  ok(!(await p.locator('#eatbody').innerText()).includes('Повторить'),'меню: «Повторить» не показан');
  await p.click('[data-msend="day:buy"]');
  await until(()=>sent.length===3,'третий запрос');
  await p.waitForFunction(()=>document.querySelector('[data-msend="day:buy"]').textContent==='Отправил ✓');
  ok(sent[2].op&&sent[2].op!==sent[0].op,'меню: новая отправка после успеха — новый op');
  assert.deepEqual(errors,[]);await p.close();}

 /* 2–4. Рецепт из круга */
 {const p=await b.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(5000);
  const sent=[];let ответы=[];
  const errors=await M.поднять(p,{page:'circle',handleRoute:async r=>{
   if(new URL(r.request().url()).pathname!=='/recipe')return false;
   sent.push(JSON.parse(r.request().postData()));const a=ответы.shift()||{s:200,d:{ok:true}};
   if(a.abort){await r.abort();return true;}
   await new Promise(x=>setTimeout(x,40));await give(r,a.d,a.s);return true;}});
  await быстро(p);
  await p.locator('[data-lbwho]:not(.lbme)').first().click();await p.locator('.plate').first().click();
  const btn=()=>p.locator('[data-recipe]').first();
  const текст=()=>btn().innerText();

  const дошлоНеВсё={s:502,d:{error:'Дошло не всё — часть рецепта Telegram не принял.'}};
  ответы=[дошлоНеВсё,дошлоНеВсё,дошлоНеВсё];
  await btn().evaluate(e=>{e.click();e.click();});
  await until(async()=>(await текст())==='Повторить','«Повторить» после трёх отказов');
  ok(sent.length===3,'рецепт: три попытки сами, второй тап во время отправки запроса не шлёт');
  ok(new Set(sent.map(x=>x.op)).size===1&&sent[0].op,'рецепт: все три — с одним op');
  ok(sent[0].owner&&sent[0].id,'рецепт: owner и id на месте');
  const warn=await p.locator('.plate.open .mwarn').innerText();
  ok(warn.includes('Не удалось отправить')&&warn.includes('Дошло не всё'),'рецепт: виден текст сервера, а не просто активная кнопка');

  await p.locator('.plate.open .pltx').first().click();await p.locator('.plate.open').waitFor({state:'detached'});
  await p.locator('.plate').first().click();
  ok((await текст())==='Повторить'&&await p.locator('.plate.open .mwarn').count()===1,'рецепт: свернул и раскрыл — ошибка не стёрлась');

  ответы=[{s:403,d:{error:'Бот закрыт — открой @WellbolBot и нажми «Старт».',code:'tg_closed'}}];
  await btn().click();
  await until(()=>sent.length===4,'четвёртый запрос');await until(async()=>(await текст())==='Повторить','отказ tg_closed');
  ok(sent.length===4,'рецепт: бот закрыт — без автоповтора');
  ok(sent[3].op===sent[0].op,'рецепт: «Повторить» — тем же op, сервер дошлёт недостающее');
  ok((await p.locator('.plate.open .mwarn').innerText()).includes('Бот закрыт'),'рецепт: причина отказа видна');

  ответы=[{s:200,d:{ok:false,error:'Рецепта нет.'}}];
  await btn().click();
  await until(()=>sent.length===5,'пятый запрос');await until(async()=>(await текст())==='Повторить','отказ ok:false');
  ok(sent.length===5,'рецепт: 200 с ok:false — отказ по делу, без автоповтора');

  ответы=[{abort:true},{s:200,d:{ok:true}}];
  await btn().click();
  await until(async()=>(await текст())==='Отправлено в чат ✓','успех после обрыва');
  ok(sent.length===7&&sent[5].op===sent[0].op&&sent[6].op===sent[0].op,'рецепт: обрыв связи — повтор сам, тем же op');
  ok(await p.locator('.plate.open .mwarn').count()===0,'рецепт: после успеха ошибки нет');
  ok(await btn().isDisabled(),'рецепт: ушло — кнопка неактивна, как было до 18.10');
  await btn().evaluate(e=>e.click());await new Promise(r=>setTimeout(r,100));
  ok(sent.length===7,'рецепт: тап по «Отправлено в чат ✓» второй раз не шлёт');
  assert.deepEqual(errors,[]);await p.close();}
}catch(e){failures++;console.error('FAIL',e.message);}finally{await b.close();}
process.exitCode=failures?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
