'use strict';
/* 02.11: удаление аккаунта внутри приложения (пункт 2 к выпуску: Apple 5.1.1(v), Google).
   Заперто: кнопка «Удалить аккаунт» в профиле — только при udalit; окно перечисляет, что удалится;
   «Удалить навсегда» — только после слова «удалить»; подписка App Store — предупреждение и
   «Управлять подпиской», звёзды — «отменится сама»; сервер получает confirm, после удаления
   память устройства очищена (в приложении из магазина — и сессия), страница перезапускается. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};

async function поднять(b, доп){
  доп=доп||{};
  const p=await b.newPage({viewport:{width:390,height:844}});
  const сервер={del:[]};
  if(доп.родное) await p.addInitScript(()=>{
    window.__np=[];
    const пусто=new Proxy({},{get:(t,м)=>м==='then'?undefined:()=>Promise.resolve({remove(){}})});
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios',Plugins:{Haptics:пусто,App:пусто,Browser:пусто,StatusBar:пусто,
      NativePurchases:{manageSubscriptions:()=>{window.__np.push('manage');return Promise.resolve();},getPurchases:()=>Promise.resolve({purchases:[]}),getProducts:()=>Promise.resolve({products:[]})}}};
    let исх;Object.defineProperty(window,'Telegram',{configurable:true,get(){return исх;},set(v){ if(v&&v.WebApp){ v.WebApp.initData=''; v.WebApp.initDataUnsafe={}; } исх=v; }});
    try{ if(!sessionStorage.getItem('был')){ localStorage.setItem('wb_session',JSON.stringify({token:'sess-test-1',user:{id:'308687648',first_name:'Ш'}})); } }catch(e){}
  });
  const o=opts('dark');o.bot=false;
  o.handleRoute=async r=>{
    const п=new URL(r.request().url()).pathname;
    const дать=d=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
    if(п==='/sub') return дать({ok:true,stars:500,link:null,features:доп.features||[],sub:доп.sub||{ok:true,kind:'grand',until:0}}),true;
    if(п==='/account/delete'){ сервер.del.push(JSON.parse(r.request().postData()||'{}')); return дать({ok:true,магазин:доп.магазин||null}),true; }
    return false;
  };
  const err=await M.поднять(p,o);await p.waitForTimeout(700);
  return {p,err,сервер};
}
const видна=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&getComputedStyle(e).display!=='none';},sel);
const открытьПрофиль=async p=>{ await p.click('#profbtn'); await p.waitForTimeout(400); };

(async()=>{const b=await chromium.launch();try{
  /* 1. без udalit — кнопки нет */
  {const {p,err}=await поднять(b,{});
   ok(err.length===0,'без ошибок '+(err[0]||''));
   await открытьПрофиль(p);
   ok(!(await видна(p,'#profdel')),'без выключателя кнопки «Удалить аккаунт» нет');
   await p.close();}
  /* 2. Telegram, подписка за звёзды */
  {const {p,сервер}=await поднять(b,{features:['udalit'],sub:{ok:true,kind:'sub',until:Date.now()+9e8,paid:true,canceled:false,stars:500}});
   await открытьПрофиль(p);
   ok(await видна(p,'#profdel'),'в профиле есть «Удалить аккаунт»');
   await p.click('#profdel');await p.waitForTimeout(300);
   ok(await p.evaluate(()=>document.getElementById('udalm').classList.contains('show')),'открылось окно удаления');
   const т=await p.textContent('#udalm');
   ok(/Удалятся навсегда: дневник[\s\S]*входы через Telegram, Apple, Google и почту/.test(т),'перечислено, что удалится');
   ok(/Подписка за звёзды отменится сама/.test(т),'звёзды — «отменится сама»');
   ok(await p.$eval('#udalgo',e=>e.disabled),'«Удалить навсегда» закрыта без слова');
   await p.fill('#udalword','удали');ok(await p.$eval('#udalgo',e=>e.disabled),'не то слово — закрыта');
   for(const w of ['Delete','oʻchirish']){ await p.fill('#udalword',w); ok(!(await p.$eval('#udalgo',e=>e.disabled)),'«'+w+'» (язык экрана) — открыта'); }
   await p.fill('#udalword',' Удалить ');ok(!(await p.$eval('#udalgo',e=>e.disabled)),'«удалить» (любым регистром) — открыта');
   await p.evaluate(()=>{ localStorage.setItem('wb_test_mark','1'); });
   await p.click('#udalgo');await p.waitForTimeout(400);
   ok(сервер.del.length===1&&сервер.del[0].confirm==='удалить'&&сервер.del[0].uid,'сервер получил подтверждение удаления');
   ok(/Аккаунт удалён/.test(await p.textContent('#udalstate')),'«Аккаунт удалён»');
   ok(await p.evaluate(()=>localStorage.getItem('wb_test_mark')===null),'память устройства очищена');
   await p.close();}
  /* 3. приложение из магазина, подписка App Store — предупреждение и «Управлять подпиской», сессия стёрта */
  {const {p,err,сервер}=await поднять(b,{родное:true,features:['udalit'],sub:{ok:true,kind:'store',store:'apple',until:Date.now()+9e8,canceled:false,paid:true},магазин:'apple'});
   ok(err.length===0,'приложение: без ошибок '+(err[0]||''));
   await открытьПрофиль(p);
   await p.click('#profdel');await p.waitForTimeout(300);
   const т=await p.textContent('#udalm');
   ok(/оформлен через App Store\. Удаление аккаунта подписку не отменяет/.test(т),'App Store: удаление подписку не отменяет — сказано');
   await p.click('#udalmanage');await p.waitForTimeout(200);
   ok((await p.evaluate(()=>window.__np)).includes('manage'),'«Управлять подпиской» открывает подписки магазина');
   await p.fill('#udalword','удалить');await p.click('#udalgo');await p.waitForTimeout(400);
   ok(сервер.del.length===1,'удаление ушло на сервер');
   ok(/не забудьте отменить подписку в настройках App Store/i.test(await p.textContent('#udalstate')),'после удаления — напоминание отменить подписку');
   ok(await p.evaluate(()=>localStorage.getItem('wb_session')===null),'сессия приложения стёрта');
   await p.close();}
}finally{await b.close();}
console.log(bad?'\nПРОВАЛОВ: '+bad:'\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(bad?1:0);})().catch(e=>{console.error(e);process.exit(1);});
