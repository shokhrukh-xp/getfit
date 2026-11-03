'use strict';
/* 02.11: ручной ввод еды без ИИ (за ruchnoy; его выбор «Ручной ввод + 3 ИИ»).
   Заперто: без флага кнопки нет; с флагом на «Еде» «Записать вручную — без ИИ»; поиск по базе →
   граммы → КБЖУ пересчитаны → /meal/add; недавнее → /meal/repeat; своё блюдо без калорий не
   записывается, с калориями — /meal/add; «Штрихкод» открывает сканер. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const БАЗА=[{n:'Творог 5%',g:200,k:121,p:17.2,f:5,u:1.8,c:0,вид:'продукт'},{n:'Плов с говядиной',g:250,k:192.2,p:7.5,f:9.9,u:17.7,c:0.7,вид:'блюдо'},{n:'Банан',g:120,k:89,p:1.1,f:0.3,u:23,c:2.6,вид:'продукт'}];

async function поднять(b, доп){
  доп=доп||{};
  const p=await b.newPage({viewport:{width:390,height:844}});
  const сервер={add:[], rep:[]};
  const o=opts('dark');o.bot=false;o.page='food';o.sub='нет';o.features=доп.features||[];
  o.recent=[{id:'2026-11-01_abc',date:'2026-11-01',kind:'обед',text:'Гречка с курицей',kcal:520,prot:42,fib:4}];
  const handle=o.handleRoute;
  o.handleRoute=async r=>{
    const п=new URL(r.request().url()).pathname;
    const дать=d=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
    const день={date:new Date().toISOString().slice(0,10),meals:[{id:'x',text:'тест',kcal:100}],kcal:100,prot:5,targets:{kcal:2000,prot:120}};
    if(п==='/hand/base') return дать({ok:true,v:'t',items:БАЗА}),true;
    if(п==='/meal/add'){ сервер.add.push(JSON.parse(r.request().postData()||'{}')); return дать({ok:true,id:'n1',day:день}),true; }
    if(п==='/meal/repeat'){ сервер.rep.push(JSON.parse(r.request().postData()||'{}')); return дать({ok:true,day:день}),true; }
    return handle?handle(r):false;
  };
  const err=await M.поднять(p,o);await p.waitForTimeout(900);
  return {p,err,сервер};
}
const видна=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&getComputedStyle(e).display!=='none';},sel);
const окно=p=>p.evaluate(()=>document.getElementById('handm').classList.contains('show'));

(async()=>{const b=await chromium.launch();try{
  {const {p,err}=await поднять(b,{});
   ok(err.length===0,'без ошибок '+(err[0]||''));
   ok(!(await видна(p,'#food-hand')),'без выключателя кнопки «Записать вручную» нет');
   await p.close();}
  {const {p,err,сервер}=await поднять(b,{features:['ruchnoy']});
   ok(err.length===0,'с ruchnoy: без ошибок '+(err[0]||''));
   ok(await видна(p,'#food-hand'),'на «Еде» есть «Записать вручную — без ИИ»');
   await p.waitForTimeout(3200);
   ok(await p.evaluate(()=>{ try{ const o=JSON.parse(localStorage.getItem('wb_food_base')||'null'); return !!(o&&o.d&&o.d.length>1000); }catch(e){ return false; } }),'база загружена заранее (после запуска) и лежит в телефоне');
   await p.click('#food-hand');await p.waitForTimeout(400);
   ok(await окно(p),'открылось окно ручного ввода');
   await p.fill('#handq','плов гов');await p.waitForTimeout(200);
   ok(/Плов с говядиной[\s\S]*250 г · Б 19 · Ж 25 · У 44[\s\S]*≈ 481 ккал/.test(await p.textContent('#handlist')),'по названию сразу ккал и БЖУ на порцию: «плов гов» → Плов с говядиной, 250 г, ≈ 481 ккал');
   await p.fill('#handq','palov');await p.waitForTimeout(200);
   ok(/Плов/.test(await p.textContent('#handlist')),'ищет и по-узбекски («palov»)');
   await p.fill('#handq','');await p.waitForTimeout(100);
   ok(/Гречка с курицей/.test(await p.textContent('#handlist')),'недавние показаны до поиска');
   await p.fill('#handq','твор');await p.waitForTimeout(200);
   ok(/Творог 5%/.test(await p.textContent('#handlist'))&&!/Банан/.test(await p.textContent('#handlist')),'поиск по базе: «твор» → «Творог 5%»');
   await p.click('#handlist .hitem:has-text("Творог 5%")');await p.waitForTimeout(200);
   ok(await p.inputValue('#handgr')==='200','граммы по умолчанию — обычная порция (200)');
   ok(/≈ 242 ккал · белки 34\.4 г · жиры 10 г · углеводы 3\.6 г/.test(await p.textContent('#handcalc')),'КБЖУ на 200 г: '+await p.textContent('#handcalc'));
   await p.fill('#handgr','150');await p.waitForTimeout(100);
   ok(/≈ 182 ккал/.test(await p.textContent('#handcalc')),'пересчёт на 150 г');
   await p.fill('#handgr','0');ok(await p.$eval('#handsave',e=>e.disabled),'0 г — «Записать» закрыта');
   await p.fill('#handgr','150');await p.click('#handsave');await p.waitForTimeout(400);
   const a=сервер.add[0]||{};
   ok(a.text==='Творог 5%, 150 г'&&a.kcal===182&&a.prot===25.8&&a.uid,'на сервер: «Творог 5%, 150 г», 182 ккал, белок 25.8');
   ok(!(await окно(p)),'окно закрылось '+(await p.textContent('#handstate')));ok(/Записал: Творог 5%, 150 г/.test(await p.textContent('#freply')),'«Записал: …»');
   await p.click('#food-hand');await p.waitForTimeout(300);
   await p.click('[data-hrep="0"]');await p.waitForTimeout(400);
   ok(сервер.rep.length===1&&сервер.rep[0].id==='2026-11-01_abc','недавнее → /meal/repeat');
   await p.click('#food-hand');await p.waitForTimeout(300);
   await p.fill('#handq','зюзюкщ');await p.waitForTimeout(150);
   ok(/В базе такого нет/.test(await p.textContent('#handlist')),'нет в базе — подсказка «своё блюдо»');
   await p.click('#handown');await p.waitForTimeout(150);
   ok(await p.inputValue('#hon')==='зюзюкщ','своё блюдо: название из поиска');
   await p.click('#hownsave');await p.waitForTimeout(150);
   ok(/Укажите калории/.test(await p.textContent('#handstate'))&&сервер.add.length===1,'без калорий не записывается');
   await p.fill('#hok','650');await p.fill('#hop','30,5');await p.click('#hownsave');await p.waitForTimeout(400);
   const a2=сервер.add[1]||{};
   ok(a2.text==='зюзюкщ'&&a2.kcal===650&&a2.prot===30.5,'своё блюдо → /meal/add (650 ккал, белок 30,5)');
   await p.click('#food-hand');await p.waitForTimeout(300);await p.click('#handscan');await p.waitForTimeout(300);
   ok(await p.evaluate(()=>document.getElementById('scanm').classList.contains('show')),'«Штрихкод» открывает сканер');
   await p.close();}
}finally{await b.close();}
console.log(bad?'\nПРОВАЛОВ: '+bad:'\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(bad?1:0);})().catch(e=>{console.error(e);process.exit(1);});
