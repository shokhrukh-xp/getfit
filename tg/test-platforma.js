'use strict';
/* 31.10: слой платформы (ПЛ). Wellböl выходит отдельным приложением в App Store и
   Google Play (его решение 31.10: Capacitor; вход Telegram + Apple + почта). Всё, что
   приложение брало прямо у Telegram WebApp, теперь идёт через ПЛ:
   1) в Telegram всё как раньше — подпись x-tg-init, окна, «назад», ссылки Telegram;
   2) в приложении из магазина (Capacitor) — сессия Wellböl вместо подписи Telegram,
      отклик, ссылки, шапка и «назад» Android — плагинами Capacitor, облака Telegram нет.
   Стенд приложения из магазина: подставной window.Capacitor с плагинами, которые
   записывают вызовы, и Telegram без initData (скрипт мини-аппа может загрузиться,
   но человек не в Telegram). */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const API=/api\.wellbol\.com|workers\.dev/;

async function поднять(b, родное, доп){
  доп=доп||{};
  const p=await b.newPage({viewport:{width:390,height:844}});
  const запросы=[];
  p.on('request',r=>{ if(API.test(r.url())) запросы.push(r.headers()); });
  if(родное) await p.addInitScript(({сессия, ios})=>{
    window.__кап={вызовы:[],назад:null};
    const плагин=имя=>new Proxy({},{get:(t,м)=>{
      if(м==='then') return undefined;
      return (...a)=>{ window.__кап.вызовы.push([имя,String(м),a[0]]);
        if(имя==='App'&&м==='addListener'&&a[0]==='backButton') window.__кап.назад=a[1];
        return Promise.resolve({remove(){}}); };
    }});
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>ios?'ios':'android',
      Plugins:{Haptics:плагин('Haptics'),App:плагин('App'),Browser:плагин('Browser'),StatusBar:плагин('StatusBar')}};
    /* стенд кладёт свой Telegram — в приложении из магазина он без initData */
    let исх;Object.defineProperty(window,'Telegram',{configurable:true,get(){return исх;},
      set(v){ if(v&&v.WebApp){ v.WebApp.initData=''; v.WebApp.initDataUnsafe={}; } исх=v; }});
    if(сессия) try{ localStorage.setItem('wb_session',JSON.stringify({token:'sess-test-1',user:{id:'308687648',first_name:'Ш'}})); }catch(e){}
  },{сессия:доп.сессия!==false, ios:!!доп.ios});
  const o=opts('dark');o.bot=false;if(доп.route)o.handleRoute=доп.route;
  const err=await M.поднять(p,o);await p.waitForTimeout(600);
  return {p,err,запросы};
}
const вызовы=p=>p.evaluate(()=>window.__кап.вызовы);

(async()=>{const b=await chromium.launch();try{
  /* ── 1. Telegram: как раньше ── */
  {const {p,err,запросы}=await поднять(b,false);
   ok(err.length===0,'Telegram: страница без ошибок '+(err[0]||''));
   ok(await p.evaluate(()=>document.documentElement.dataset.platforma)==='telegram','Telegram: режим telegram');
   ok(запросы.length>0&&запросы.every(h=>h['x-tg-init']==='mock'),'Telegram: все запросы к серверу с подписью x-tg-init ('+запросы.length+')');
   ok(!запросы.some(h=>h['x-wb-session']),'Telegram: сессии приложения в запросах нет');
   ok(await p.evaluate(()=>!!window.__headerColor),'Telegram: цвет шапки ставит Telegram');
   await p.evaluate(()=>{window.__ссылки=[];});
   await p.click('#hbot');await p.waitForTimeout(300);
   ok(/t\.me\/WellbolBot/.test((await p.evaluate(()=>window.__ссылки||[])).join(' ')),'Telegram: «бот не подключён» открывает бота ссылкой Telegram');
   await p.click('#profbtn');await p.waitForTimeout(300);
   ok(await p.evaluate(()=>!!window.__назадВидна),'Telegram: профиль открыт — стрелка «назад» в шапке есть');
   await p.close();}

  /* ── 2. приложение из магазина ── */
  {const {p,err,запросы}=await поднять(b,true);
   ok(err.length===0,'приложение: страница без ошибок '+(err[0]||''));
   ok(await p.evaluate(()=>document.documentElement.dataset.platforma)==='native','приложение: режим native');
   ok(запросы.length>0,'приложение: запросы к серверу идут ('+запросы.length+')');
   ok(запросы.every(h=>h['x-wb-session']==='sess-test-1'),'приложение: все запросы с сессией Wellböl x-wb-session');
   ok(!запросы.some(h=>h['x-tg-init']),'приложение: подписи Telegram в запросах нет');
   ok(await p.evaluate(()=>!window.__headerColor),'приложение: шапку Telegram не трогаем');
   let в=await вызовы(p);
   ok(в.some(x=>x[0]==='StatusBar'&&x[1]==='setStyle'),'приложение: цвет системной строки — плагином StatusBar');
   ok(await p.evaluate(()=>typeof window.__кап.назад==='function'),'приложение: «назад» Android слушаем');
   await p.click('#hbot');await p.waitForTimeout(300);
   в=await вызовы(p);
   ok(в.some(x=>x[0]==='Browser'&&x[1]==='open'&&/t\.me\/WellbolBot/.test((x[2]||{}).url||'')),'приложение: бот открывается системным браузером');
   ok(в.some(x=>x[0]==='Haptics'&&x[1]==='impact'&&(x[2]||{}).style==='MEDIUM'),'приложение: отклик — плагином Haptics');
   ok(await p.evaluate(()=>!(window.__ссылки||[]).length),'приложение: ссылки Telegram не зовём');
   await p.click('#profbtn');await p.waitForTimeout(300);
   ok(await p.$eval('#profm',e=>e.classList.contains('show')),'приложение: профиль открыт');
   await p.evaluate(()=>window.__кап.назад());await p.waitForTimeout(300);
   ok(!(await p.$eval('#profm',e=>e.classList.contains('show'))),'приложение: «назад» Android закрыл профиль');
   await p.evaluate(()=>window.__кап.назад());await p.waitForTimeout(200);
   в=await вызовы(p);
   ok(в.some(x=>x[0]==='App'&&x[1]==='minimizeApp'),'приложение: «назад» на главной сворачивает приложение');
   await p.close();}

  /* ── 3. приложение без сессии: экран входа, вход по почте ── */
  {const тела=[];
   const route=async r=>{const u=new URL(r.request().url());
     if(u.pathname==='/app/mail/code'){тела.push(['code',r.request().postDataJSON()]);await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,sent:true,ttl:600})});return true;}
     if(u.pathname==='/app/mail/login'){const b=r.request().postDataJSON();тела.push(['login',b]);
       await r.fulfill({status:b.code==='123456'?200:400,contentType:'application/json',body:JSON.stringify(b.code==='123456'?{ok:true,token:'ap_x',how:'mail',user:{id:'308687648',first_name:''}}:{ok:false,code:'code_bad',error:'Код не подошёл.'})});return true;}
     return false;};
   const {p,err,запросы}=await поднять(b,true,{сессия:false,route});
   ok(err.length===0,'вход: страница без ошибок '+(err[0]||''));
   ok(await p.$eval('#vhod',e=>e.classList.contains('show')),'вход: без сессии — экран входа');
   ok(await p.isHidden('#vapple'),'вход: на Android кнопки Apple нет');
   ok(!запросы.some(h=>h['x-tg-init']),'вход: подпись Telegram не уходит');
   await p.click('#vmailbtn');await p.fill('#vemail','Anna@Example.com');await p.click('#vsend');await p.waitForTimeout(300);
   ok(тела.some(x=>x[0]==='code'&&x[1].email==='Anna@Example.com'),'вход: код запрошен на введённый адрес');
   ok(await p.isVisible('#vcode')&&/anna@example\.com/.test(await p.textContent('#vtext')),'вход: поле кода и куда отправили');
   await p.fill('#vcode','000000');await p.click('#vlogin');await p.waitForTimeout(300);
   ok(/не подошёл/.test(await p.textContent('#verr')),'вход: неверный код — понятная ошибка');
   await Promise.all([p.waitForEvent('load'),(async()=>{await p.fill('#vcode','123456');await p.click('#vlogin');})()]);
   await p.waitForTimeout(800);
   ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('wb_session')||'{}').token)==='ap_x','вход: сессия сохранена на телефоне');
   ok(!(await p.$eval('#vhod',e=>e.classList.contains('show'))),'вход: после входа экран входа закрыт');
   ok(запросы.some(h=>h['x-wb-session']==='ap_x'),'вход: дальше запросы идут с сессией');
   await p.close();}

  /* ── 4. вход через Telegram и кнопка Apple на iPhone ── */
  {let опрос=0;
   const route=async r=>{const u=new URL(r.request().url());
     if(u.pathname==='/app/tg'&&r.request().method()==='POST'){await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,id:'ABCDEFGHJKLM',secret:'s1',link:'https://t.me/WellbolTestBot?start=ap_abcdefghjklm',ttl:300})});return true;}
     if(u.pathname==='/app/tg'){опрос++;await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(опрос<2?{ok:true,state:'asked'}:{ok:true,state:'ok',token:'ap_t',how:'telegram',user:{id:'308687648',first_name:'Ш'}})});return true;}
     return false;};
   const {p}=await поднять(b,true,{сессия:false,route,ios:true});
   ok(await p.isVisible('#vapple'),'Telegram: на iPhone есть «Войти через Apple»');
   await Promise.all([p.waitForEvent('load',{timeout:15000}),p.click('#vtg')]);
   await p.waitForTimeout(600);
   const в=await вызовы(p).catch(()=>[]);
   ok(опрос>=2,'Telegram: приложение ждёт подтверждения в боте ('+опрос+' опроса)');
   ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('wb_session')||'{}').token)==='ap_t','Telegram: подтвердил в боте — вошёл');
   await p.close();}
}catch(e){console.error('УПАЛО:',e.stack);bad++;}
await b.close();
console.log(bad?'\nПРОВАЛОВ: '+bad:'\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
process.exit(bad?1:0);})();
