'use strict';
/* 22.10, его снимок из зала (08:12): «На телефоне сохранено · правки не дошли
   в облако» красным — и после «Сохранено ✓ 27 подходов» тоже. На сервере
   правки лежали с 03:10:08: первая отправка оборвалась, повтор очереди через
   13 с прошёл, а строка помнила только первый отказ.
   Заперто: обрыв и 5xx — не красное («отправлю сам»), повтор сам, строка
   становится зелёной по факту доставки; «Завершить» при обрыве — «На телефоне ·
   отправлю сам», потом само «Сохранено ✓». Красное — только конфликт версий. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;function ok(c,t){console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++}
const нота=p=>p.evaluate(()=>{const e=document.getElementById('dbnote');return {т:e.textContent.trim(),к:e.className}});
(async()=>{const b=await chromium.launch();try{
  const p=await b.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(15000);
  const o=opts('dark');o.page='gym';
  const err=await M.поднять(p,o);await p.waitForTimeout(500);
  await p.evaluate(()=>{window.__красное=[];const смотреть=()=>{const e=document.getElementById('dbnote');if(!e)return;
    if(/\bbad\b/.test(e.className)||e.querySelector('.bad'))window.__красное.push(e.textContent);};
    new MutationObserver(смотреть).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});});
  /* A. правка дня: два отказа /s подряд (обрыв и 503), третья — принята */
  let отказовS=0;const сбойS=async r=>{if(отказовS<2){отказовS++;if(отказовS===1)return r.abort('failed');return r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});}return r.fallback();};
  await p.route(u=>u.pathname==='/s',сбойS);
  await p.click('#ordopen');await p.click('[data-orddn="0"]');await p.click('#orddone');
  await p.waitForFunction(()=>/отправлю сам/.test(document.getElementById('dbnote').textContent),null,{timeout:9000}).catch(()=>{});
  let н=await нота(p);ok(/связь прервалась, отправлю сам/.test(н.т)&&!/bad/.test(н.к),'правка при обрыве — спокойно: '+н.т);
  await p.waitForFunction(()=>/Сохранено: правки в облаке|Сохранено в облаке/.test(document.getElementById('dbnote').textContent),null,{timeout:15000}).catch(()=>{});
  н=await нота(p);ok(/Сохранено: правки в облаке|Сохранено в облаке/.test(н.т)&&отказовS===2,'повтор сам — строка зелёная без нажатия: '+н.т+' (отказов '+отказовS+')');
  await p.waitForTimeout(3500);н=await нота(p);ok(!/не дошли|прервалась/.test(н.т),'через 3 с — без ошибки: '+н.т);
  await p.unroute(u=>u.pathname==='/s',сбойS);
  /* B. «Завершить и сохранить»: первая /w оборвалась, повтор — принят */
  await p.click('#dayseg button[data-day="D1"]');await p.waitForTimeout(300);
  await p.click('#list .exrow[data-pickex="0"]');await p.waitForTimeout(400);
  await p.locator('.card.exact .allb').click();await p.waitForTimeout(1500);
  let отказовW=0;const сбойW=async r=>{if(отказовW<1){отказовW++;return r.abort('failed');}return r.fallback();};
  await p.route(u=>u.pathname==='/w',сбойW);
  await p.click('#finish');await M.ответитьДлительность(p,45);
  await p.waitForFunction(()=>/Сохранено ✓/.test(document.getElementById('finish').textContent),null,{timeout:15000}).catch(()=>{});
  const кн=await p.$eval('#finish',e=>e.textContent.trim());н=await нота(p);
  ok(/Сохранено ✓/.test(кн)&&!/bad/.test(н.к)&&отказовW===1,'«Завершить» при обрыве — само «'+кн+'», строка: '+н.т);
  const красное=await p.evaluate(()=>window.__красное);
  ok(красное.length===0,'красного не было ни разу'+(красное.length?': '+красное[0]:''));
  /* C. конфликт версий остаётся красным: человеку нужен выбор */
  const конфликт=r=>r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({ok:false,code:'settings_conflict',error:'Эти настройки изменены на другом устройстве.',data:{s:{}},conflicts:[['s']]})});
  await p.route(u=>u.pathname==='/s',конфликт);
  await p.click('#ordopen');await p.click('[data-orddn="0"]');await p.click('#orddone');
  await p.waitForFunction(()=>/правки не дошли/.test(document.getElementById('dbnote').textContent),null,{timeout:9000}).catch(()=>{});
  н=await нота(p);ok(/правки не дошли/.test(н.т)&&/bad/.test(н.к),'конфликт версий — красное: '+н.т);
  ok(!err||!err.length,'без ошибок на странице'+(err&&err.length?': '+err.join(' | '):''));
  await p.close();
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
