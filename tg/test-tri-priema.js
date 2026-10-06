'use strict';
// 06.10, его вопрос по снимку: «почему на дуге дальше один + и один − кружки?»
// «+» ≈12:03 был обедом, «−» ≈15:33 — «ещё приём»: четвёртый приём через 3,5 ч,
// по сути перекус наперёд, хотя с 05.10 перекусы заранее не планируются.
// Его выбор кнопкой: «Три приёма: после обеда — ужин». Проверяем подсказки
// дуги в разное время дня: только завтрак → обед → ужин, ужин не раньше 18:30,
// после ужина ничего, второй кружок подписан именем приёма, а не «−».
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;function ok(c,t){console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++}
const еда=(id,t,kind,kcal)=>({id,t,kind,kcal,prot:Math.round(kcal/14),img:'/p/'+(id%2?'a':'b')+'.jpg',text:kind});
const СЛУЧАИ=[
 {имя:'его 06.10: завтрак 08:19, сейчас 12:03',time:'12:03',meals:[еда(1,'08:19','завтрак',398)],ждём:['≈12:03 · обед','≈18:30 · ужин'],todo:'ужин',left:2},
 {имя:'обед записан в 12:30, сейчас 13:00',time:'13:00',meals:[еда(1,'08:19','завтрак',398),еда(2,'12:30','обед',600)],ждём:['≈18:30 · ужин'],left:1},
 {имя:'обед поздно, в 16:30',time:'16:40',meals:[еда(1,'08:19','завтрак',398),еда(2,'16:30','обед',600)],ждём:['≈20:00 · ужин'],left:1},
 {имя:'ужин записан — дальше ничего',time:'19:30',meals:[еда(1,'08:19','завтрак',398),еда(2,'12:30','обед',600),еда(3,'19:00','ужин',500)],ждём:[],left:0},
 {имя:'пустое утро',time:'08:15',meals:[],ждём:['≈08:30 · завтрак','≈12:00 · обед'],todo:'обед',left:3},
 {имя:'перекус не считается основным приёмом',time:'11:00',meals:[еда(1,'08:00','завтрак',400),еда(2,'10:30','перекус',150)],ждём:['≈14:00 · обед','≈18:30 · ужин'],todo:'ужин',left:2},
 {имя:'13:00 без записей — ждём обед, не завтрак',time:'13:00',meals:[],ждём:['≈13:00 · обед','≈18:30 · ужин'],todo:'ужин',left:2},
 {имя:'только завтрак, уже 17:00 — ужин сейчас',time:'17:00',meals:[еда(1,'08:19','завтрак',398)],ждём:['≈17:00 · ужин'],left:1},
];
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const с of СЛУЧАИ){
  const p=await b.newPage({viewport:{width:390,height:844}}),tag=theme+' · '+с.имя;
  const kcal=с.meals.reduce((s,m)=>s+m.kcal,0),prot=с.meals.reduce((s,m)=>s+m.prot,0);
  const err=await M.поднять(p,{theme,time:с.time,day:{meals:с.meals,kcal,prot,targets:{...M.день().targets,kcal:1850,prot:160}},score:null});
  const планы=await p.locator('.hclk-svg .hb-next,.hclk-svg .hb-todo').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
  ok(JSON.stringify(планы)===JSON.stringify(с.ждём),'подсказки дуги '+tag+' '+JSON.stringify(планы));
  ok(!планы.some(x=>/ещё приём|перекус/.test(x)),'ни «ещё приёма», ни перекуса наперёд '+tag);
  if(с.todo){const t=await p.locator('.hclk-svg .hb-todo text').textContent();ok(t===с.todo,'второй кружок подписан «'+с.todo+'», а не «−» '+tag+' '+t);
   ok(await p.locator('.hclk-svg .hb-todo path').count()===0,'знака «−» больше нет '+tag);}
  const строка=await p.locator('.day-status').innerText();
  if(с.left===0)ok(/на сегодня всё|дальше только если голоден|хватит/.test(строка),'после ужина — только если голоден '+tag+' '+строка);
  if(с.left>1){const rp=160-prot,мясо=Math.round(rp/с.left/0.22/10)*10;ok(строка.includes('по ~'+мясо+' г'),'белок делится на оставшиеся основные приёмы ('+с.left+') '+tag+' '+строка);}
  await p.locator('#coachnav').click();
  const hint=await p.locator('#ctext').getAttribute('placeholder');
  ok(с.ждём.length?hint==='Еда: '+с.ждём[0].split(' · ')[1]:hint==='Еда или вопрос','чат ждёт тот же приём, что и дуга '+tag+' '+hint);
  await p.locator('#coachclose').click();
  ok(!err.length,'без ошибок JS '+tag+' '+err.join('|'));
  await p.close();
 }
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
