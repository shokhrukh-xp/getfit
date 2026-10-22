'use strict';
/* 14.10: онбординг новичка — его выборы кнопками: шаги 1–4 (+ «где и когда»
   для зала), после знакомства — «С чего начнём?», одноразовые подсказки
   (с 22.10 — по месту, test-podskazki-po-mestu.js). */
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
  /* 15.10: после «Начать по ней» — сразу «Сегодня», где ждёт карточка */
  ok(await вид(p,'#p-home') && await вид(p,'#startcard'),'после «Начать по ней» — сразу «Сегодня» с «С чего начнём?»');
  const кн=await p.$$eval('#startcard [data-start]',bs=>bs.map(x=>x.dataset.start).join());
  ok(кн==='food,gym,later','еда и зал — и тренировка тоже: '+кн);
  await p.click('#startcard [data-start="later"]');await p.waitForTimeout(300);
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
  ok(!(await вид(p,'#startcard')),'«Позже» — и больше не появляется');
  await p.close();}
 /* 15.10: «Начать по ней», пока тренер думает над уточнением, — принятие не сбивается */
 {const p=await b.newPage({viewport:{width:390,height:844}});
  const o={theme:'dark',newbie:true,wait:2500,onboardDelay:2500};
  await M.поднять(p,o);
  await M.шаги(p,{});await p.click('#wz-go');await p.waitForSelector('#wzapply',{timeout:8000}).catch(()=>{});
  await p.click('#wzapply');await p.waitForTimeout(3500);
  ok(!(await вид(p,'#wzapply')),'ответ тренера после «Начать по ней» не открывает сборку снова');
  ok(!(await p.evaluate(()=>document.body.innerHTML.indexOf('Колени или спина беспокоят')>=0)),'опоздавший вопрос тренера отброшен, а не дорисован в сборку');
  ok(await вид(p,'#p-home'),'и человек остаётся на «Сегодня»');
  await p.close();}
 /* 3–4. С 22.10 подсказки по месту и без «Как пользоваться» — test-podskazki-po-mestu.js */
}finally{await b.close();}
console.log(bad?'ПРОВАЛОВ: '+bad:'всё ок');process.exit(bad?1:0);})();
