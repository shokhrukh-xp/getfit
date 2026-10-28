'use strict';
/* 13.10, его выбор кнопкой «короткая реплика»: после замера формой — слово
   тренера. Запись не ждёт модель: сначала «Замер записан», реплика приходит
   следом и встаёт на его место. Нет реплики (без подписки, модель не ответила)
   или /measure/say упал — остаётся «Замер записан», без красного. */
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const СЛОВО='Весы сегодня в хорошем настроении: средний за неделю 87,9 кг, на 0,3 ниже прошлой. Утро после плова им не помешало.';
async function замер(b,theme,width,o){
 const p=await b.newPage({viewport:{width,height:844}});
 o=Object.assign({theme,meas:M.замеры().filter(m=>m.date!==M.TODAY)},o||{});
 let просили=0;
 const was=o.handleRoute;
 o.handleRoute=async r=>{const u=new URL(r.request().url());
  if(u.pathname==='/measure/say'){просили++;
   if(o.сбой){await r.fulfill({status:503,contentType:'application/json',body:'{"error":"нет"}'});return true;}
   await new Promise(x=>setTimeout(x,300));
   await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,text:o.слово===undefined?СЛОВО:o.слово})});return true;}
  return was?was(r):false;};
 const err=await M.поднять(p,o);
 await M.замерВручную(p);await p.locator('#fw').scrollIntoViewIfNeeded();
 await p.fill('#fw','87,6');await p.click('#fmsave');
 await p.waitForFunction(()=>document.querySelector('#fmreply').textContent==='Замер записан');
 await p.waitForTimeout(900);
 const r=await p.evaluate(()=>{const e=document.getElementById('fmreply');const b=e.getBoundingClientRect();
  return {т:e.textContent,к:e.className,видно:!e.hidden,вбок:document.documentElement.scrollWidth>innerWidth,ширина:b.width}});
 return {p,r,err,просили:()=>просили};
}
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const где=theme+' '+width+': ';
  let {p,r,err,просили}=await замер(b,theme,width);
  ok(просили()===1,где+'после записи слово тренера просили один раз');
  ok(r.т===СЛОВО&&r.видно&&!/bad|wait/.test(r.к),где+'реплика встала на место «Замер записан»: '+r.т.slice(0,50));
  ok(!r.вбок,где+'страница не ездит вбок');
  await p.locator('#fmreply').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/gf-zamer-slovo-'+theme+'-'+width+'.png'});
  ok(!err.length,где+'без ошибок на странице'+(err.length?': '+err.join(' | '):''));
  await p.close();
  ({p,r}=await замер(b,theme,width,{слово:null}));
  ok(r.т==='Замер записан'&&!/bad/.test(r.к),где+'нет реплики — остаётся «Замер записан»');await p.close();
  ({p,r}=await замер(b,theme,width,{сбой:true}));
  ok(r.т==='Замер записан'&&!/bad/.test(r.к),где+'сбой реплики — без красного, «Замер записан»');await p.close();
 }
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
