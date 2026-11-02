'use strict';
/* 02.11: вход через Google в приложении из магазина (его «добавь» на «почему нет входа через Google?»).
   Заперто: кнопка есть, только когда в сборке ID клиентов Google (window.WB_GOOGLE) и плагин SocialLogin;
   iPhone — iOS-клиент и scopes email/profile, Android — веб-клиент без scopes; ID token уходит на
   /app/google, сессия запоминается; закрыл окно Google — без ошибки; в Telegram кнопки нет. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};

async function поднять(b, вид, доп){
  доп=доп||{};
  const p=await b.newPage({viewport:{width:390,height:844}});
  const сервер={google:[]};
  if(вид!=='telegram') await p.addInitScript(({вид, ids, отмена})=>{
    window.__g={вызовы:[]};
    const пусто=new Proxy({},{get:(t,м)=>м==='then'?undefined:()=>Promise.resolve({remove(){}})});
    const SL={
      initialize:a=>{window.__g.вызовы.push(['initialize',a]);return Promise.resolve();},
      login:a=>{window.__g.вызовы.push(['login',a]);
        if(отмена) return Promise.reject(new Error('The user canceled the sign-in flow.'));
        return Promise.resolve({provider:'google',result:{idToken:'GID-TOKEN',profile:{name:'Bahrom G',email:'b@gmail.com'}}});}
    };
    const пл={Haptics:пусто,App:пусто,Browser:пусто,StatusBar:пусто};
    if(ids!=='без плагина') пл.SocialLogin=SL;
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>вид,Plugins:пл};
    if(ids&&ids!=='без плагина') window.WB_GOOGLE=ids;
    let исх;Object.defineProperty(window,'Telegram',{configurable:true,get(){return исх;},
      set(v){ if(v&&v.WebApp){ v.WebApp.initData=''; v.WebApp.initDataUnsafe={}; } исх=v; }});
    try{ if(!sessionStorage.getItem('был')){ sessionStorage.setItem('был','1'); localStorage.removeItem('wb_session'); } }catch(e){}
  },{вид, ids:доп.ids===undefined?{web:'web-1.apps.googleusercontent.com',ios:'ios-1.apps.googleusercontent.com'}:доп.ids, отмена:!!доп.отмена});
  const o=opts('dark');o.bot=false;
  o.handleRoute=async r=>{
    const п=new URL(r.request().url()).pathname;
    if(п==='/app/google'){ сервер.google.push(JSON.parse(r.request().postData()||'{}'));
      await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,token:'ap_google_1',how:'google',user:{id:'u_00000000000000aa',first_name:'Bahrom G'},new:true})}); return true; }
    return false;
  };
  const err=await M.поднять(p,o);await p.waitForTimeout(600);
  return {p,err,сервер};
}
const видна=(p,id)=>p.evaluate(i=>{const e=document.getElementById(i);return !!e&&!e.hidden&&e.offsetParent!==null;},id);
const вызовы=p=>p.evaluate(()=>window.__g.вызовы);

(async()=>{const b=await chromium.launch();try{
  /* 1. iPhone: кнопка, iOS-клиент, scopes, токен на сервер, сессия */
  {const {p,err,сервер}=await поднять(b,'ios');
   ok(err.length===0,'iPhone: без ошибок '+(err[0]||''));
   ok(await видна(p,'vgoogle'),'iPhone: «Войти через Google» на экране входа');
   ok(/Войти через Google/.test(await p.textContent('#vgoogle'))&&!!(await p.$('#vgoogle svg')),'кнопка со знаком G');
   await p.click('#vgoogle');await p.waitForTimeout(800);
   const в=await вызовы(p).catch(()=>[]);
   const сессия=await p.evaluate(()=>{try{return JSON.parse(localStorage.getItem('wb_session')||'null');}catch(e){return null;}});
   ok(сервер.google.length===1&&сервер.google[0].token==='GID-TOKEN'&&сервер.google[0].name==='Bahrom G','на сервер ушёл ID token Google и имя');
   ok(сессия&&сессия.token==='ap_google_1'&&сессия.how==='google','сессия Google запомнена');
   await p.close();}
  /* проверка параметров плагина — без перезагрузки (отдельный стенд, где сервер отвечает ошибкой не нужен) */
  {const {p}=await поднять(b,'ios',{отмена:true});
   await p.click('#vgoogle');await p.waitForTimeout(400);
   const в=await вызовы(p);
   const и=в.find(x=>x[0]==='initialize'), л=в.find(x=>x[0]==='login');
   ok(и&&и[1].google.iOSClientId==='ios-1.apps.googleusercontent.com'&&и[1].google.iOSServerClientId==='web-1.apps.googleusercontent.com'&&!и[1].google.webClientId,'iPhone: iOS-клиент (+ веб как серверный)');
   ok(л&&л[1].provider==='google'&&JSON.stringify(л[1].options.scopes)==='["email","profile"]','iPhone: scopes email и profile');
   ok(!(await p.textContent('#verr')).trim(),'закрыл окно Google — без ошибки');
   ok(!(await p.$eval('#vgoogle',e=>e.disabled)),'кнопка снова доступна');
   await p.close();}
  /* 2. Android: веб-клиент, без scopes */
  {const {p,err}=await поднять(b,'android',{отмена:true});
   ok(err.length===0,'Android: без ошибок '+(err[0]||''));
   ok(await видна(p,'vgoogle')&&!(await видна(p,'vapple')),'Android: Google есть, Apple нет');
   await p.click('#vgoogle');await p.waitForTimeout(400);
   const в=await вызовы(p);
   const и=в.find(x=>x[0]==='initialize'), л=в.find(x=>x[0]==='login');
   ok(и&&и[1].google.webClientId==='web-1.apps.googleusercontent.com'&&!и[1].google.iOSClientId,'Android: веб-клиент');
   ok(л&&!л[1].options.scopes,'Android: без scopes');
   await p.close();}
  /* 3. нет ID в сборке или нет плагина — кнопки нет */
  {const {p}=await поднять(b,'ios',{ids:null});
   ok(!(await видна(p,'vgoogle'))&&await видна(p,'vapple'),'без ID Google в сборке — кнопки нет, Apple есть');
   await p.close();}
  {const {p}=await поднять(b,'android',{ids:{web:'',ios:'ios-1'}});
   ok(!(await видна(p,'vgoogle')),'Android без веб-клиента — кнопки нет');
   await p.close();}
  {const {p}=await поднять(b,'ios',{ids:'без плагина'});
   ok(!(await видна(p,'vgoogle')),'без плагина — кнопки нет');
   await p.close();}
  /* 4. Telegram — экрана входа и Google нет */
  {const {p,err}=await поднять(b,'telegram');
   ok(err.length===0&&!(await видна(p,'vgoogle')),'Telegram: без входа через Google');
   await p.close();}
}finally{await b.close();}
console.log(bad?'\nПРОВАЛОВ: '+bad:'\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(bad?1:0);})().catch(e=>{console.error(e);process.exit(1);});
