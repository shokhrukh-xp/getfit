'use strict';
/* 02.11: покупка Pro в приложении из магазина (его выбор «Напрямую в магазины», месяц + год,
   $9.99 / $59.99, 7 дней бесплатно). Стенд: подставной Capacitor с плагином NativePurchases.
   Заперто: цены и проба — из магазина; ни звёзд, ни промокода в приложении из магазина;
   покупка уходит серверу (Apple — JWS, Google — purchaseToken + базовый план и предложение);
   «Восстановить покупки» и тихая сверка при запуске; отмена покупки — без ошибки;
   в Telegram подписка из магазина — «управлять в настройках телефона», без «Отменить». */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};

async function поднять(b, вид, доп){
  доп=доп||{};
  const p=await b.newPage({viewport:{width:390,height:844}});
  const сервер={iap:[], купил:!!доп.купил};
  if(вид!=='telegram') await p.addInitScript(({вид, отмена, куплено})=>{
    window.__маг={вызовы:[]};
    const пусто=new Proxy({},{get:(t,м)=>м==='then'?undefined:()=>Promise.resolve({remove(){}})});
    const андр=вид==='android';
    const товары=андр?[
      {identifier:'month',planIdentifier:'wellbol_pro_month',priceString:'$9.99',price:9.99,offerId:null,offerToken:'tok-m'},
      {identifier:'year',planIdentifier:'wellbol_pro_year',priceString:'$59.99',price:59.99,offerId:null,offerToken:'tok-y'},
      {identifier:'year',planIdentifier:'wellbol_pro_year',priceString:'$59.99',price:59.99,offerId:'trial7',offerToken:'tok-y-trial'}]
     :[{identifier:'wellbol_pro_month',priceString:'$9.99',price:9.99,introductoryPrice:{price:0},introEligibility:2},
       {identifier:'wellbol_pro_year',priceString:'$59.99',price:59.99,introductoryPrice:{price:0},introEligibility:2}];
    const NP={
      getProducts:a=>{window.__маг.вызовы.push(['getProducts',a]);return Promise.resolve({products:товары});},
      purchaseProduct:a=>{window.__маг.вызовы.push(['purchaseProduct',a]);
        if(отмена) return Promise.reject(new Error('User cancelled'));
        return Promise.resolve(андр?{transactionId:'t1',purchaseToken:'PT-1'}:{transactionId:'t1',jwsRepresentation:'JWS-1'});},
      restorePurchases:()=>{window.__маг.вызовы.push(['restorePurchases']);return Promise.resolve();},
      getPurchases:a=>{window.__маг.вызовы.push(['getPurchases',a]);return Promise.resolve({purchases:куплено?[андр?{purchaseToken:'PT-old'}:{jwsRepresentation:'JWS-old'}]:[]});},
      manageSubscriptions:()=>{window.__маг.вызовы.push(['manageSubscriptions']);return Promise.resolve();}
    };
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>андр?'android':'ios',
      Plugins:{Haptics:пусто,App:пусто,Browser:пусто,StatusBar:пусто,NativePurchases:NP}};
    let исх;Object.defineProperty(window,'Telegram',{configurable:true,get(){return исх;},
      set(v){ if(v&&v.WebApp){ v.WebApp.initData=''; v.WebApp.initDataUnsafe={}; } исх=v; }});
    try{ localStorage.setItem('wb_session',JSON.stringify({token:'sess-test-1',user:{id:'308687648',first_name:'Ш'}})); }catch(e){}
  },{вид, отмена:!!доп.отмена, куплено:!!доп.куплено});
  const o=opts('dark');o.bot=false;o.sub='нет';
  o.handleRoute=async r=>{
    const u=new URL(r.request().url()), п=u.pathname;
    const дать=d=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
    if(п==='/app/iap/token') return дать({ok:true,token:'uuid-308687648'}),true;
    if(п==='/app/iap/apple'||п==='/app/iap/google'){ сервер.iap.push([п,JSON.parse(r.request().postData()||'{}')]); сервер.купил=true; return дать({ok:true,sub:{ok:true,kind:'store'}}),true; }
    if(п==='/sub'&&сервер.купил) return дать({ok:true,stars:500,link:null,features:[],sub:{ok:true,kind:'store',store:вид==='android'?'google':'apple',product:'wellbol_pro_year',until:Date.now()+7*864e5,canceled:false,trial:true,paid:true}}),true;
    return false;
  };
  const err=await M.поднять(p,o);await p.waitForTimeout(700);
  return {p,err,сервер};
}
const маг=p=>p.evaluate(()=>window.__маг.вызовы);

(async()=>{const b=await chromium.launch();try{
  /* ── 1. iPhone: тарифы из магазина, без звёзд и промокода ── */
  {const {p,err,сервер}=await поднять(b,'ios');
   ok(err.length===0,'iPhone: без ошибок '+(err[0]||''));
   await p.evaluate(()=>{const x=document.createElement('button');x.id='sub-on';document.body.appendChild(x);x.click();x.remove();});await p.waitForTimeout(500);
   const т=await p.evaluate(()=>document.getElementById('subm').textContent);
   ok(/Год\s*·\s*\$59\.99/.test(т)&&/Месяц\s*·\s*\$9\.99/.test(т),'цены — из магазина: год $59.99, месяц $9.99');
   ok(/50% выгоднее/.test(т),'год — «≈ 50% выгоднее»');
   ok(/7 дней бесплатно, затем \$59\.99 в год/.test(т),'проба 7 дней и цена после неё');
   ok(/продлевается автоматически[\s\S]*App Store[\s\S]*24 часа/.test(т)&&/Условия/.test(т)&&/Конфиденциальность/.test(т),'условия автопродления и ссылки (Apple 3.1.2)');
   ok(!/★/.test(т),'ни одной звезды');
   ok(await p.evaluate(()=>document.getElementById('sub-promo').hidden),'промокода нет');
   ok((await p.textContent('#sub-buy')).trim()==='Попробовать 7 дней бесплатно','кнопка — «Попробовать 7 дней бесплатно»');
   ok(/Восстановить покупки/.test(т),'есть «Восстановить покупки»');
   /* выбрать месяц и обратно год */
   await p.click('[data-mag="wellbol_pro_month"]');await p.waitForTimeout(150);
   ok(/затем \$9\.99 в месяц/.test(await p.textContent('#sub-what')),'выбран месяц — «затем $9.99 в месяц»');
   await p.click('[data-mag="wellbol_pro_year"]');await p.waitForTimeout(150);
   /* покупка */
   await p.click('#sub-buy');await p.waitForTimeout(900);
   const к=(await маг(p)).find(x=>x[0]==='purchaseProduct');
   ok(к&&к[1].productIdentifier==='wellbol_pro_year'&&к[1].productType==='subs'&&к[1].appAccountToken==='uuid-308687648'&&!к[1].planIdentifier,'покупка: год, подписка, UUID покупателя; без плана Android');
   ok(сервер.iap.length===1&&сервер.iap[0][0]==='/app/iap/apple'&&сервер.iap[0][1].jws==='JWS-1','серверу ушла JWS транзакции');
   ok(!(await p.evaluate(()=>document.getElementById('subm').classList.contains('show'))),'после покупки окно закрылось');
   const стр=await p.evaluate(()=>(document.getElementById('subrow')||{}).textContent||'');
   ok(/Pro подключён — пробный период, продление/.test(стр)&&/Управлять/.test(стр),'профиль: пробный период, продление, «Управлять» ('+стр.slice(0,80)+')');
   await p.evaluate(()=>document.getElementById('sub-manage').click());await p.waitForTimeout(200);
   ok((await маг(p)).some(x=>x[0]==='manageSubscriptions'),'«Управлять» открывает подписки магазина');
   await p.close();}

  /* ── 2. отмена покупки — без ошибки; «Восстановить покупки» без покупок ── */
  {const {p,сервер}=await поднять(b,'ios',{отмена:true});
   await p.evaluate(()=>{const x=document.createElement('button');x.id='sub-on';document.body.appendChild(x);x.click();x.remove();});await p.waitForTimeout(400);
   await p.click('#sub-buy');await p.waitForTimeout(400);
   ok(!/Покупка не прошла/.test(await p.textContent('#sub-note'))&&сервер.iap.length===0,'отменил покупку — без красной ошибки');
   await p.click('#sub-restore');await p.waitForTimeout(500);
   ok((await маг(p)).some(x=>x[0]==='restorePurchases'),'«Восстановить» зовёт магазин');
   ok(/Покупок в магазине не нашлось/.test(await p.textContent('#sub-note')),'покупок нет — так и сказано');
   await p.close();}

  /* ── 3. запуск: тихая сверка покупок магазина ── */
  {const {p,сервер}=await поднять(b,'ios',{куплено:true});await p.waitForTimeout(500);
   ok(сервер.iap.some(x=>x[1].jws==='JWS-old'),'при запуске купленное в магазине ушло на сервер');
   ok(!(await маг(p)).some(x=>x[0]==='restorePurchases'),'тихая сверка — без окна входа магазина (restorePurchases не зовём)');
   await p.close();}

  /* ── 4. Android: базовый план и предложение пробы ── */
  {const {p,err,сервер}=await поднять(b,'android');
   ok(err.length===0,'Android: без ошибок '+(err[0]||''));
   await p.evaluate(()=>{const x=document.createElement('button');x.id='sub-on';document.body.appendChild(x);x.click();x.remove();});await p.waitForTimeout(400);
   const т=await p.evaluate(()=>document.getElementById('subm').textContent);
   ok(/7 дней бесплатно, затем \$59\.99 в год/.test(т)&&/Google Play/.test(т),'Android: проба из предложения trial7, «Google Play»');
   await p.click('#sub-buy');await p.waitForTimeout(900);
   const к=(await маг(p)).find(x=>x[0]==='purchaseProduct');
   ok(к&&к[1].productIdentifier==='wellbol_pro_year'&&к[1].planIdentifier==='year'&&к[1].offerToken==='tok-y-trial','Android: товар, базовый план year и предложение пробы');
   ok(сервер.iap.length===1&&сервер.iap[0][0]==='/app/iap/google'&&сервер.iap[0][1].token==='PT-1','серверу ушёл purchaseToken');
   await p.close();}

  /* ── 5. Telegram: подписка из магазина — управлять в телефоне, без «Отменить» звёздами ── */
  {const {p,err}=await поднять(b,'telegram',{купил:true});
   ok(err.length===0,'Telegram: без ошибок '+(err[0]||''));
   const стр=await p.evaluate(()=>(document.getElementById('subrow')||{}).textContent||'');
   ok(/через App Store/.test(стр)&&/настройках телефона/.test(стр)&&!/Отменить/.test(стр),'Telegram: «через App Store … в настройках телефона», без «Отменить» ('+стр.slice(0,80)+')');
   await p.close();}
}finally{await b.close();}
console.log(bad?'\nПРОВАЛОВ: '+bad:'\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(bad?1:0);})().catch(e=>{console.error(e);process.exit(1);});
