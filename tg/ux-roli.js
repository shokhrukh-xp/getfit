'use strict';
/* 01.11: проход «живой специалист» глазами клиента и специалиста — снимки для разбора (не проверка) */
const fs=require('fs'),path=require('path'),{chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
const src=fs.readFileSync(path.join(__dirname,'test-roli-ekrany.js'),'utf8');
const ВЕР='2026-10-29.1';
const ИМЕНА={food:'дневник еды',food_photo:'фото еды',gym:'тренировки',body:'вес и замеры',body_photo:'фото тела',labs:'анализы',health:'здоровье и ограничения',cycle:'цикл'};
const МОЖНО={trainer:['gym','body','body_photo','food','health'],nutri:['food','food_photo','body','body_photo','labs','health','cycle']};
const i=src.indexOf('function сервер('),j=src.indexOf('\n}\n',i)+3;
const сервер=eval('('+src.slice(i,j).replace(/^function сервер/,'function')+')');
const D=process.argv[2];fs.mkdirSync(D,{recursive:true});let n=0;
const sh=async(p,name)=>{n++;const f=path.join(D,String(n).padStart(2,'0')+'-'+name+'.png');await p.screenshot({path:f});console.log('SHOT',f);};
const txt=async(p,sel)=>(await p.locator(sel).first().innerText().catch(()=>'')).replace(/\n+/g,' | ').slice(0,700);
const step=async(name,fn)=>{try{await fn();}catch(e){console.log('STEP FAIL',name,e.message.split('\n')[0]);}};
(async()=>{const b=await chromium.launch();try{
 /* КЛИЕНТ */
 const s=сервер({log:[{at:Date.now()-3600e3,cat:'body',what:'просмотр',kind:'trainer',name:'Тимур Ахмедов'}]});
 const o=opts('light');o.features=['roli'];o.roli=s.обработчик;o.base=M.БАЗА+'?pro=TSTRNR01';
 const p=await b.newPage({viewport:{width:390,height:844}});const err=await M.поднять(p,o);
 await step('join',async()=>{await p.waitForSelector('#roljok',{timeout:5000});await sh(p,'k-podklyuchenie');console.log('JOIN',await txt(p,'#roljbody'));
   await p.click('#roljok');await p.waitForTimeout(500);await sh(p,'k-posle-podklyucheniya');console.log('AFTER',await txt(p,'#roljm'));
   await p.click('#roljclose').catch(()=>{});await p.waitForTimeout(300);});
 await step('home',async()=>{await p.evaluate(()=>{const x=document.querySelector('button[role="tab"][data-page="home"]');if(x)x.click();});await p.waitForTimeout(600);await sh(p,'k-segodnya');
   console.log('HOME has trainer:',/Тимур/.test(await p.locator('main').innerText()));});
 await step('my',async()=>{await p.click('#profbtn');await p.waitForTimeout(400);await sh(p,'k-profil');console.log('PROF',await txt(p,'#pqmain'));
   await p.click('#pq-spec');await p.waitForTimeout(700);await sh(p,'k-moi-specialisty');console.log('MY',await txt(p,'#rolmy'));
   await p.click('#profclose');await p.waitForTimeout(200);await p.click('#profclose').catch(()=>{});await p.waitForTimeout(200);});
 await step('offer',async()=>{s.offer={name:'Тимур Ахмедов',kind:'trainer',at:77,prog:{name:'Сила · 1 день',note:'Начнём с базы',author:{name:'Тимур Ахмедов',kind:'trainer'},
   days:[{s:'Низ',sub:'',ex:[{id:'Barbell_Squat',n:'Присед со штангой',en:'Barbell Squat',m:'quadriceps',q:'barbell',sets:4,reps:'5–8',rest:150}]}]}};
   await p.evaluate(()=>{const x=document.querySelector('button[role="tab"][data-page="gym"]');if(x)x.click();});await p.waitForTimeout(900);await sh(p,'k-trenirovka-predlozhenie');
   console.log('OFFER',await txt(p,'#roloffer'));
   await p.click('#roloffer [data-rol="take"]');await p.waitForTimeout(900);await sh(p,'k-trenirovka-programma-trenera');console.log('GYMTOP',(await p.locator('main').innerText()).slice(0,400).replace(/\n+/g,' | '));});
 await step('coach',async()=>{await p.click('#coachnav');await p.waitForTimeout(800);await sh(p,'k-ii-trener');console.log('COACH',await txt(p,'#coachm'));
   await p.keyboard.press('Escape');await p.evaluate(()=>{const m=document.getElementById('coachm');if(m)m.classList.remove('show');});});
 await step('chat',async()=>{s.msgs=[{id:1,me:false,text:'Как прошла тренировка? Колено не беспокоит?',at:Date.now()-7200e3,seen:true}];
   await p.click('#profbtn');await p.waitForTimeout(300);await p.click('#pq-spec');await p.waitForTimeout(600);await p.click('#rolmy [data-rol="chat"]');await p.waitForTimeout(700);
   await sh(p,'k-perepiska');console.log('CHAT',await txt(p,'#rolcm'));});
 console.log('ERRS',JSON.stringify(err).slice(0,300));await p.close();
 /* КЛИЕНТ нутрициолога: предложение нормы на «Еде», комментарий к приёму */
 const s3=сервер({my:[{id:'l2',kind:'nutri',name:'Нигора',proStatus:'ok',cats:['food','body']}],normOffer:{name:'Нигора',kcal:1800,prot:140,fat:60,rules:['ужин до 20:00','сладкое — 1 раз в неделю'],at:5}});
 const o3=opts('light');o3.features=['roli'];o3.roli=s3.обработчик;
 const p3=await b.newPage({viewport:{width:390,height:844}});await M.поднять(p3,o3);await p3.waitForTimeout(800);
 await step('food',async()=>{await p3.evaluate(()=>{const x=document.querySelector('button[role="tab"][data-page="food"]');if(x)x.click();});await p3.waitForTimeout(900);await sh(p3,'k-eda-norma-nutri');
   console.log('FOOD',(await p3.locator('main').innerText()).slice(0,600).replace(/\n+/g,' | '));});
 await p3.close();
 /* СПЕЦИАЛИСТ */
 const s2=сервер({pro:[{kind:'trainer',name:'Тимур Ахмедов',status:'ok',code:'TSTRNR01',link:'https://t.me/WellbolTestBot?start=s_TSTRNR01'}],
   clients:[{id:'l1',kind:'trainer',client:'777',name:'Карина',cats:['gym','body']},{id:'l3',kind:'trainer',client:'778',name:'Мадина',cats:['gym','body','food']}]});
 const o2=opts('light');o2.features=['roli'];o2.roli=s2.обработчик;
 const p2=await b.newPage({viewport:{width:390,height:844}});await M.поднять(p2,o2);await p2.waitForTimeout(800);
 await step('pro',async()=>{await sh(p2,'s-start-ekran');await p2.click('#profbtn');await p2.waitForTimeout(400);await sh(p2,'s-profil');console.log('SPROF',await txt(p2,'#pqmain'));
   await p2.click('#pq-pro');await p2.waitForTimeout(800);await sh(p2,'s-kabinet');console.log('KAB',await txt(p2,'#rolpro'));
   await p2.click('#rolpro [data-rol="card"]');await p2.waitForTimeout(900);await sh(p2,'s-kartochka-klienta');console.log('CARD',await txt(p2,'#rolcm, #rolcbody'));
   const tabs=await p2.locator('#rol-ccat button').allTextContents();console.log('TABS',tabs.join(' / '));
   for(const v of ['prog','ai','chat']){const bt=p2.locator('#rol-ccat button[data-v="'+v+'"]');if(await bt.count()){await bt.click();await p2.waitForTimeout(800);await sh(p2,'s-tab-'+v);console.log('TAB',v,await txt(p2,'#rolcbody'));}}});
 await p2.close();
}finally{await b.close();}})();
