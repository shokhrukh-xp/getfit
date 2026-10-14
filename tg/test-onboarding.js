'use strict';
/* 14.10: онбординг новичка — его выборы кнопками: шаги 1–4 (+ «где и когда»
   для зала), после знакомства — «С чего начнём?», одноразовые подсказки
   (первая еда, первый зал, первый чат — с сервера), «Как пользоваться» в
   профиле, справка про бота. */
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const ME={sex:'m',age:34,ht:178,bw:88,goal:'fat',wt:'down',gym:'muscle',level:'mid',place:'gym',only:'all',lim:[],eq:[],voice:'fun'};
const вид=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&!e.closest('[hidden]')&&e.getBoundingClientRect().height>0;},s);
(async()=>{const b=await chromium.launch();try{
 /* 1. шаги — снимки и размеры */
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const где=theme+' '+width+': ';
  const p=await b.newPage({viewport:{width,height:844}});
  const err=await M.поднять(p,{theme,newbie:true,wait:2500});
  const карт=await p.evaluate(()=>[...document.querySelectorAll('#wz-only button')].map(x=>{const r=x.getBoundingClientRect();return {h:r.height,r:r.right,t:x.textContent}}));
  ok(карт.length===2&&карт.every(x=>x.h>=44&&x.r<=width),где+'шаг 1: две карточки, крупные, в экране');
  await p.screenshot({path:'/tmp/gf-onb-1-'+theme+'-'+width+'.png'});
  await M.шаги(p,{до:'me'});await p.screenshot({path:'/tmp/gf-onb-2-'+theme+'-'+width+'.png'});
  await p.fill('#wz-age','34');await p.fill('#wz-ht','176');await p.fill('#wz-bw','88');await p.click('#wz-me-go');
  await p.waitForFunction(()=>{const g=document.getElementById('g-go');return g&&!g.disabled;},null,{timeout:8000}).catch(()=>{});
  await p.screenshot({path:'/tmp/gf-onb-3-'+theme+'-'+width+'.png'});
  await p.click('#g-go');await p.waitForTimeout(900);await p.screenshot({path:'/tmp/gf-onb-4-'+theme+'-'+width+'.png'});
  const вбок=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  ok(!вбок,где+'страница не ездит вбок');
  ok(!err.length,где+'без ошибок'+(err.length?': '+err.join(' | '):''));
  await p.close();
 }
 /* 2. «С чего начнём?» — после знакомства, один раз */
 {const p=await b.newPage({viewport:{width:390,height:844}});
  const err=await M.поднять(p,{theme:'light',newbie:true,wait:2500});
  await M.шаги(p,{only:'food'});await p.waitForTimeout(1500);
  ok(await вид(p,'#startcard'),'после знакомства — «С чего начнём?»');
  const кн=await p.$$eval('#startcard [data-start]',bs=>bs.map(x=>x.dataset.start).join());
  ok(кн==='food,later','у «только еды» — без тренировки: '+кн);
  await p.locator('#startcard').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/gf-onb-start.png'});
  await p.click('#startcard [data-start="food"]');await p.waitForTimeout(600);
  ok(await p.$eval('#coachm',e=>e.classList.contains('show')),'«Записать еду» открывает тренера');
  ok(!(await вид(p,'#startcard')),'карточка ушла');
  ok(!err.length,'без ошибок'+(err.length?': '+err.join(' | '):''));
  await p.close();}
 {const p=await b.newPage({viewport:{width:390,height:844}});
  await M.поднять(p,{theme:'dark',newbie:true,wait:2500});
  await M.шаги(p,{});await p.click('#wz-go');await p.waitForSelector('#wzapply',{timeout:8000}).catch(()=>{});
  await p.click('#wzapply');await p.waitForTimeout(1500);
  await p.click('.l1 [data-page="home"]').catch(()=>{});await p.waitForTimeout(500);
  const кн=await p.$$eval('#startcard [data-start]',bs=>bs.map(x=>x.dataset.start).join());
  ok(кн==='food,gym,later','еда и зал — и тренировка тоже: '+кн);
  await p.click('#startcard [data-start="later"]');await p.waitForTimeout(300);
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
  ok(!(await вид(p,'#startcard')),'«Позже» — и больше не появляется');
  await p.close();}
 /* 3. подсказки: первая еда и первый зал */
 for(const theme of ['light','dark']){
  const p=await b.newPage({viewport:{width:390,height:900}});
  await M.поднять(p,{theme,me:ME,page:'food',wait:2500});
  ok(await вид(p,'#foodhint'),theme+': под приёмами — «Нажми на приём, чтобы исправить»');
  await p.locator('#foodhint').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/gf-onb-foodhint-'+theme+'.png'});
  await p.click('#foodhint [data-hint="food"]');await p.waitForTimeout(200);
  ok(!(await вид(p,'#foodhint')),theme+': закрыл — ушла');
  await p.click('.l1 [data-page="gym"]');await p.waitForTimeout(600);
  ok(await вид(p,'#gymhint'),theme+': в зале — «Введи вес и повторы, затем отметь подход»');
  await p.locator('#gymhint').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/gf-onb-gymhint-'+theme+'.png'});
  await p.click('#gymhint [data-hint="gym"]');await p.waitForTimeout(200);
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
  await p.click('.l1 [data-page="food"]');await p.waitForTimeout(500);
  ok(!(await вид(p,'#foodhint')),theme+': подсказка еды не возвращается');
  await p.click('.l1 [data-page="gym"]');await p.waitForTimeout(500);
  ok(!(await вид(p,'#gymhint')),theme+': подсказка зала не возвращается');
  await p.close();
 }
 /* 4. «Как пользоваться» в профиле */
 for(const [sub,платно] of [['нет',false],[undefined,true]]){
  const p=await b.newPage({viewport:{width:390,height:900}});
  const o={theme:'dark',me:ME,wait:2500};if(sub)o.sub=sub;await M.поднять(p,o);
  await p.click('#profbtn');await p.waitForTimeout(500);
  await p.locator('#profhow').scrollIntoViewIfNeeded();await p.click('#profhow');await p.waitForTimeout(400);
  ok(await p.$eval('#howm',e=>e.classList.contains('show')),'«Как пользоваться» открывается');
  const т=await p.$eval('#howm',e=>e.innerText);
  ok(/Еда/.test(т)&&/Зал/.test(т)&&/Бот в Telegram/.test(т)&&/творога было 150 г/.test(т)&&/отмена/.test(т),'четыре пункта, в т.ч. как писать боту');
  ok(платно ? !(await вид(p,'#howfree')) : /3 записи еды в день/.test(await p.textContent('#howfree')),(платно?'с подпиской':'без подписки')+': строка про лимит '+(платно?'не нужна':'есть'));
  if(!платно) await p.screenshot({path:'/tmp/gf-onb-how.png'});
  await p.click('#howclose');await p.waitForTimeout(300);
  ok(!(await p.$eval('#howm',e=>e.classList.contains('show'))),'закрывается');
  await p.close();
 }
}finally{await b.close();}
console.log(bad?'ПРОВАЛОВ: '+bad:'всё ок');process.exit(bad?1:0);})();
