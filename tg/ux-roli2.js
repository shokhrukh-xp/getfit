'use strict';
/* 01.11: «Тренер — два голоса» и «Клиенты» — снимки для проверки глазами (не проверка) */
const fs=require('fs'),path=require('path'),{chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
const src=fs.readFileSync(path.join(__dirname,'test-roli-ekrany.js'),'utf8');
const ВЕР='2026-10-29.1';
const ИМЕНА={food:'дневник еды',food_photo:'фото еды',gym:'тренировки',body:'вес и замеры',body_photo:'фото тела',labs:'анализы',health:'здоровье и ограничения',cycle:'цикл'};
const МОЖНО={trainer:['gym','body','body_photo','food','health'],nutri:['food','food_photo','body','body_photo','labs','health','cycle']};
const i=src.indexOf('function сервер('),j=src.indexOf('\n}\n',i)+3;
const сервер=eval('('+src.slice(i,j).replace(/^function сервер/,'function')+')');
const D=process.argv[2];fs.mkdirSync(D,{recursive:true});let n=0;
const sh=async(p,name)=>{n++;const f=path.join(D,String(n).padStart(2,'0')+'-'+name+'.png');await p.screenshot({path:f});console.log('SHOT',f);};
const txt=async(p,sel)=>(await p.locator(sel).first().innerText().catch(()=>'')).replace(/\n+/g,' | ').slice(0,500);
const step=async(name,fn)=>{try{await fn();}catch(e){console.log('STEP FAIL',name,e.message.split('\n')[0]);}};
const сводка=s=>{const h=s.обработчик;s.обработчик=async(p,u,т,м)=>{if(p.endsWith('/roli/summary'))return{status:200,body:{ok:true,kind:'trainer',open:['gym','body'],gym:{week:2,last:{date:'2026-10-30',name:'Ноги'}},body:{now:79.2,before:80,last:'2026-10-31'},sent:{at:Date.now()-864e5*3,taken:true,name:'Сила · 3 дня'},unread:1}};return h(p,u,т,м);};return s;};
(async()=>{const b=await chromium.launch();try{
 const s=сервер({my:[{id:'l1',kind:'trainer',name:'Тимур Ахмедов',proStatus:'ok',cats:['gym','body'],unread:2}],
   msgs:[{id:1,me:false,text:'Как прошла тренировка? Колено не беспокоит?',at:Date.now()-3*3600e3,seen:true}]});
 const o=opts('light');o.features=['roli'];o.roli=s.обработчик;
 const p=await b.newPage({viewport:{width:390,height:844}});const err=await M.поднять(p,o);await p.waitForTimeout(1200);
 await step('home',async()=>{await sh(p,'k-segodnya');console.log('HOMECARD',await txt(p,'#rolhome'));console.log('NAV',await txt(p,'#coachnav'));});
 await step('coach',async()=>{await p.click('#rolhome [data-dg="open"]');await p.waitForTimeout(1500);await sh(p,'k-trener');
   console.log('WHO',await txt(p,'#coachpro'));console.log('KOMU',await txt(p,'#ckomu'));console.log('LOG',await txt(p,'#chatlog'));
   await p.fill('#ctext','Чуть ноет на приседе');await p.click('#csend');await p.waitForTimeout(1200);await sh(p,'k-trener-otpravleno');
   console.log('SENT',JSON.stringify(s.написано||null));
   await p.click('#ckomu [data-komu=""]');await p.waitForTimeout(300);await sh(p,'k-trener-ii');console.log('PH',await p.getAttribute('#ctext','placeholder'));});
 console.log('ERRS',JSON.stringify(err).slice(0,300));await p.close();
 /* ИИ предлагает передать */
 const s4=сервер({my:[{id:'l1',kind:'trainer',name:'Тимур Ахмедов',proStatus:'ok',cats:['gym','body']}]});
 const o4=opts('light');o4.features=['roli'];o4.roli=s4.обработчик;o4.onCoach=()=>({ok:true,reply:'Сегодня можно заменить присед на ягодичный мостик. Программу меняет Тимур — передать ему?',changes:[{what:'pro',kind:'trainer',link:'l1',name:'Тимур Ахмедов',text:'На приседе ноет колено. Можно заменить присед в программе?'}]});
 const p4=await b.newPage({viewport:{width:390,height:844}});await M.поднять(p4,o4);await p4.waitForTimeout(1000);
 await step('ai-pro',async()=>{await p4.click('#coachnav');await p4.waitForTimeout(800);await p4.fill('#ctext','колено ноет на приседе');await p4.click('#csend');
   await p4.waitForSelector('#chatlog .dgpro',{timeout:8000});await p4.waitForTimeout(400);await sh(p4,'k-ii-peredat');
   await p4.click('#chatlog [data-reco2="prosend"]');await p4.waitForTimeout(900);await sh(p4,'k-ii-peredano');console.log('PEREDANO',JSON.stringify(s4.написано||null));});
 await p4.close();
 /* СПЕЦИАЛИСТ */
 const s2=сводка(сервер({pro:[{kind:'trainer',name:'Тимур Ахмедов',status:'ok',code:'TSTRNR01',link:'https://t.me/WellbolTestBot?start=s_TSTRNR01'}],
   clients:[{id:'l1',kind:'trainer',client:'777',name:'Карина',cats:['gym','body'],unread:1},{id:'l3',kind:'trainer',client:'778',name:'Мадина',cats:['gym','body','food']}]}));
 const o2=opts('light');o2.features=['roli'];o2.roli=s2.обработчик;
 const p2=await b.newPage({viewport:{width:390,height:844}});await M.поднять(p2,o2);await p2.waitForTimeout(1000);
 await step('pro',async()=>{await sh(p2,'s-segodnya');console.log('NAV2',await txt(p2,'#coachnav'));
   await p2.click('#coachnav');await p2.waitForTimeout(1200);await sh(p2,'s-klienty');console.log('KAB',await txt(p2,'#rolpro'));
   await p2.click('#rolpro [data-rol="card"][data-who="777"]');await p2.waitForTimeout(1200);await sh(p2,'s-svodka');console.log('SUM',await txt(p2,'#rolcbody'));
   console.log('PROF OPEN',await p2.evaluate(()=>document.getElementById('profm').classList.contains('show')));
   await p2.click('#rolcclose');await p2.waitForTimeout(700);console.log('BACK TO KAB',await p2.evaluate(()=>document.getElementById('profm').classList.contains('show')));
   await p2.click('[data-dg="myai"]');await p2.waitForTimeout(800);console.log('MYAI',await p2.evaluate(()=>document.body.classList.contains('coach')));});
 await p2.close();
}finally{await b.close();}})();
