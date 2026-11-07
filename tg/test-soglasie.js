'use strict';
/* 02.11: согласие на ИИ (пункт 5 к выпуску; Apple 5.1.2(i), Google User Data) и «не медицинское изделие».
   Его выбор: окно только в приложении из магазина; «Не сейчас» — работает без ИИ, включить в профиле.
   Заперто: без soglasie — ничего нет; Telegram — окна нет, строка «не медицинское» есть; приложение из
   магазина — окно при первом входе, фон окна не закрывает, «Не сейчас» → сервер {yes:false}, профиль
   «ИИ-помощник: выключен» → «Согласен» → {yes:true}; ответ сервера ii_net открывает окно снова. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};

async function поднять(b, доп){
  доп=доп||{};
  const p=await b.newPage({viewport:{width:390,height:844}});
  const сервер={ii:[], сост:доп.сост===undefined?null:доп.сост};
  if(доп.родное) await p.addInitScript(()=>{
    const пусто=new Proxy({},{get:(t,м)=>м==='then'?undefined:()=>Promise.resolve({remove(){}})});
    window.__откр=[];
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios',Plugins:{Haptics:пусто,App:пусто,StatusBar:пусто,
      Browser:{open:o=>{window.__откр.push(o&&o.url);return Promise.resolve();},addListener:()=>Promise.resolve({remove(){}})},
      NativePurchases:{getPurchases:()=>Promise.resolve({purchases:[]}),getProducts:()=>Promise.resolve({products:[]})}}};
    let исх;Object.defineProperty(window,'Telegram',{configurable:true,get(){return исх;},set(v){ if(v&&v.WebApp){ v.WebApp.initData=''; v.WebApp.initDataUnsafe={}; } исх=v; }});
    try{ localStorage.setItem('wb_session',JSON.stringify({token:'sess-test-1',user:{id:'308687648',first_name:'Ш'}})); }catch(e){}
  });
  const o=opts('dark');o.bot=false;
  o.handleRoute=async r=>{
    const п=new URL(r.request().url()).pathname;
    const дать=(d,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(d)});
    if(п==='/sub') return дать({ok:true,stars:500,link:null,features:доп.features||[],sub:{ok:true,kind:'grand',until:0}}),true;
    if(п==='/ii-soglasie'){
      if(r.request().method()==='POST'){ const b2=JSON.parse(r.request().postData()||'{}'); сервер.ii.push(b2); сервер.сост={yes:b2.yes,v:1}; return дать({ok:true,soglasie:сервер.сост,yes:b2.yes}),true; }
      return дать({ok:true,soglasie:сервер.сост,yes:!!(сервер.сост&&сервер.сост.yes),nado:true,v:1}),true;
    }
    return false;
  };
  const err=await M.поднять(p,o);await p.waitForTimeout(900);
  return {p,err,сервер};
}
const видна=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&getComputedStyle(e).display!=='none';},sel);
const окно=p=>p.evaluate(()=>document.getElementById('iim').classList.contains('show'));
const открытьПрофиль=async p=>{ await p.click('#profbtn'); await p.waitForTimeout(400); await p.click('#pq-akk'); await p.waitForTimeout(300); };   /* 07.11: согласия и удаление — в «Данные и аккаунт» */
const строкаМед=p=>p.evaluate(()=>[...document.querySelectorAll('.pqfoot .f-soglasie')].some(e=>/не медицинское изделие/.test(e.textContent)&&getComputedStyle(e).display!=='none'));

(async()=>{const b=await chromium.launch();try{
  /* 1. без soglasie — ни окна, ни строк */
  {const {p,err}=await поднять(b,{родное:true});
   ok(err.length===0,'без ошибок '+(err[0]||''));
   ok(!(await окно(p)),'без выключателя окна согласия нет');
   await открытьПрофиль(p);ok(!(await видна(p,'#profii')),'и строки «ИИ-помощник» нет');ok(!(await строкаМед(p)),'и строки «не медицинское» нет');
   await p.close();}
  /* 2. Telegram с soglasie — окна нет, «не медицинское изделие» есть */
  {const {p,err}=await поднять(b,{features:['soglasie']});
   ok(err.length===0,'Telegram: без ошибок '+(err[0]||''));
   ok(!(await окно(p)),'в Telegram окна согласия нет (его выбор — только магазин)');
   await открытьПрофиль(p);ok(!(await видна(p,'#profii')),'и строки «ИИ-помощник» нет');ok(await строкаМед(p),'«Wellböl — не медицинское изделие…» в профиле есть');
   await p.close();}
  /* 3. приложение из магазина: первый вход — окно, «Не сейчас», профиль, «Согласен» */
  {const {p,err,сервер}=await поднять(b,{родное:true,features:['soglasie']});
   ok(err.length===0,'приложение: без ошибок '+(err[0]||''));
   ok(await окно(p),'первый вход — окно согласия');
   const т=await p.textContent('#iim');
   ok(/Anthropic \(Claude\), OpenAI и Google \(Gemini\)/.test(т)&&/не используют их для рекламы/.test(т),'названы все три сервиса ИИ и «не для рекламы»');
   ok(/Без согласия работают дневник, вес, замеры и зал/.test(т),'сказано, что работает без согласия');
   ok(/не медицинское изделие/.test(т),'и «не медицинское изделие»');
   await p.click('#iim .modalbox a[data-ii-link]');await p.waitForTimeout(200);
   ok((await p.evaluate(()=>window.__откр)).some(u=>/wellbol\.com\/privacy/.test(u||'')),'ссылка открывает политику');
   await p.mouse.click(5,5);await p.waitForTimeout(200);ok(await окно(p),'фон окно не закрывает — нужен явный ответ');
   await p.click('#iino');await p.waitForTimeout(400);
   ok(сервер.ii.length===1&&сервер.ii[0].yes===false,'«Не сейчас» → сервер {yes:false}');
   ok(!(await окно(p)),'окно закрылось');
   await открытьПрофиль(p);
   ok(/ИИ-помощник\s*выключен/.test(await p.textContent('#profii')),'в профиле «ИИ-помощник: выключен»');
   await p.click('#profii');await p.waitForTimeout(300);ok(await окно(p),'строка открывает окно');
   await p.click('#iiyes');await p.waitForTimeout(400);
   ok(сервер.ii.length===2&&сервер.ii[1].yes===true,'«Согласен» → сервер {yes:true}');
   ok(/ИИ-помощник\s*включён/.test(await p.textContent('#profii')),'строка — «включён»');
   await открытьПрофиль(p);await p.click('#profii');await p.waitForTimeout(300);
   ok(await видна(p,'#iioff')&&!(await видна(p,'#iiyes')),'включено — в окне «Выключить ИИ»');
   await p.click('#iioff');await p.waitForTimeout(400);ok(сервер.ii[2]&&сервер.ii[2].yes===false,'«Выключить ИИ» → {yes:false}');
   await p.close();}
  /* 4. уже согласен — окна нет; сервер ответил ii_net — окно снова и понятный текст */
  {const {p,err}=await поднять(b,{родное:true,features:['soglasie'],сост:{yes:true,v:1}});
   ok(err.length===0,'согласен: без ошибок '+(err[0]||''));
   ok(!(await окно(p)),'уже согласен — окна нет');
   await p.route(/\/coach(\?|$)/,r=>r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'ИИ-помощник выключен: вы не разрешили отправлять данные сервисам ИИ.',code:'ii_net'})}));
   await p.click('#coachnav');await p.fill('#ctext','Съел два яйца');await p.click('#csend');
   await p.waitForTimeout(1500);
   const текст=await p.textContent('#chatlog');
   ok(/ИИ-помощник выключен/.test(текст),'ii_net — в чате «ИИ-помощник выключен…»');
   ok(await окно(p),'ii_net открывает окно согласия');
   await p.close();}
}finally{await b.close();}
console.log(bad?'\nПРОВАЛОВ: '+bad:'\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(bad?1:0);})().catch(e=>{console.error(e);process.exit(1);});
