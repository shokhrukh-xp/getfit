'use strict';
/* 22.10, его слова «картинки фото грузятся очень долго» и выбор «храни на
   телефоне». Проверяем:
   1) кружок приёма просит миниатюру (s=t), один снимок — один запрос;
   2) пришёл полный снимок (старый, без X-Photo-Size: t) — в кэш ложится
      уменьшенный до 320 px;
   3) повторное открытие — из кэша телефона: снимок виден без скачивания,
      сервер спрашиваем только о доступе (check=1);
   4) доступ закрыт (404 на check) — снимок пропадает и из кэша;
   5) раскрытая тарелка в круге — полный снимок (без s=t);
   6) сброс дневника (wipeLocal) стирает миниатюры этого аккаунта. */
const {chromium}=require('playwright'),M=require('./mock');
let плохо=0;const дано=(ok,t)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+t);if(!ok)плохо++};
const KEY='abcdefghijklmnopqrstuv';
const URLP='https://getfit-sync.sh-pulatov.workers.dev/photo?key='+KEY;
(async()=>{const b=await chromium.launch();try{
 const ctx=await b.newContext({viewport:{width:390,height:900}});
 /* большой снимок 1200×900 — как старый, без миниатюры на сервере */
 const big=await (async()=>{const p=await ctx.newPage();const d=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=900;const g=c.getContext('2d');g.fillStyle='#c84';g.fillRect(0,0,1200,900);g.fillStyle='#284';g.fillRect(300,200,600,500);return c.toDataURL('image/jpeg',.95).split(',')[1];});await p.close();return Buffer.from(d,'base64');})();
 let запросы=[],доступ=true,сбросФаза=false;
 const маршрут=async route=>{const u=new URL(route.request().url());if(u.pathname!=='/photo')return false;
  запросы.push(u.search);
  /* фаза сброса: проверка доступа «да», а байтов уже нет — так видно, что кэш стёр именно сброс */
  if(сбросФаза&&u.searchParams.get('check')==='1'){await route.fulfill({status:204,body:''});return true;}
  if(!доступ)return route.fulfill({status:404,body:''}),true;
  if(u.searchParams.get('check')==='1'){await route.fulfill({status:204,body:''});return true;}
  await route.fulfill({status:200,contentType:'image/jpeg',body:big});return true;};
 const день={meals:[{id:1,t:'08:40',kind:'завтрак',text:'тест',kcal:400,prot:30,img:URLP}]};
 const виден=p=>p.waitForFunction(()=>Array.from(document.querySelectorAll('[data-private-photo]')).some(e=>(e.getAttribute('href')||e.getAttribute('src')||'').startsWith('blob:')),null,{timeout:8000}).then(()=>true,()=>false);
 /* 1–2 */
 let p=await ctx.newPage();await M.поднять(p,{time:'19:40',day:день,handleRoute:маршрут});
 дано(await виден(p),'кружок приёма показывает снимок');
 const байты=запросы.filter(q=>!/check=1/.test(q));
 дано(байты.length===1&&/s=t/.test(байты[0]),'один запрос миниатюры (s=t) на снимок: '+JSON.stringify(запросы));
 await p.waitForTimeout(400);
 const вКэше=await p.evaluate(()=>new Promise(res=>{const r=indexedDB.open('gf-photos',1);r.onsuccess=()=>{const st=r.result.transaction('p').objectStore('p');const q=st.getAll();q.onsuccess=()=>res(q.result.map(v=>v.d.byteLength));};r.onerror=()=>res(null);}));
 дано(вКэше&&вКэше.length===1&&вКэше[0]<40000,'в кэше телефона — уменьшенная копия ('+(вКэше&&вКэше[0])+' байт вместо '+big.length+')');
 const размер=await p.evaluate(()=>new Promise(res=>{const r=indexedDB.open('gf-photos',1);r.onsuccess=()=>{const q=r.result.transaction('p').objectStore('p').getAll();q.onsuccess=()=>{const v=q.result[0];createImageBitmap(new Blob([v.d])).then(bm=>res([bm.width,bm.height]));};};}));
 дано(Math.max(...размер)<=320,'миниатюра не больше 320 px: '+размер.join('×'));
 await p.close();
 /* 3 */
 запросы=[];p=await ctx.newPage();await M.поднять(p,{time:'19:40',day:день,handleRoute:маршрут});
 дано(await виден(p),'повторное открытие — снимок виден');
 await p.waitForTimeout(500);
 дано(запросы.every(q=>/check=1/.test(q))&&запросы.length===1,'повторно — без скачивания, только проверка доступа: '+JSON.stringify(запросы));
 await p.close();
 /* 4 */
 доступ=false;запросы=[];p=await ctx.newPage();await M.поднять(p,{time:'19:40',day:день,handleRoute:маршрут});
 await p.waitForFunction(()=>Array.from(document.querySelectorAll('[data-private-photo]')).every(e=>!e.getAttribute('href')&&!e.getAttribute('src')),null,{timeout:8000}).catch(()=>{});
 дано(await p.evaluate(()=>Array.from(document.querySelectorAll('[data-private-photo]')).every(e=>!e.getAttribute('href')&&!e.getAttribute('src'))),'доступ закрыт — снимок пропал');
 await p.waitForTimeout(300);
 const после=await p.evaluate(()=>new Promise(res=>{const r=indexedDB.open('gf-photos',1);r.onsuccess=()=>{const q=r.result.transaction('p').objectStore('p').count();q.onsuccess=()=>res(q.result);};}));
 дано(после===0,'и из кэша телефона ('+после+')');
 await p.close();доступ=true;
 /* 6 */
 /* сброс через профиль: «Начать заново → стереть всё»; после сброса снимок серверу больше не виден */
 const сброс=async route=>{const u=new URL(route.request().url());
  if(u.pathname==='/session'){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,session:{epoch:доступ?0:1,full_epoch:доступ?0:1,reset_at:1}})});return true;}
  if(u.pathname==='/forget'){доступ=false;сбросФаза=true;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,session:{epoch:1,full_epoch:1,reset_at:1},cleanupPending:false})});return true;}
  return маршрут(route);};
 запросы=[];p=await ctx.newPage();await M.поднять(p,{time:'19:40',day:день,handleRoute:сброс,preserveReload:true});await виден(p);await p.waitForTimeout(400);
 const было=await p.evaluate(()=>new Promise(res=>{const r=indexedDB.open('gf-photos',1);r.onsuccess=()=>{const q=r.result.transaction('p').objectStore('p').count();q.onsuccess=()=>res(q.result);};}));
 дано(было===1,'до сброса миниатюра в кэше ('+было+')');
 await p.click('#profbtn');await p.click('#profreset');await p.click('[data-reset="all"]');await p.waitForTimeout(2500);
 const стёрто=await p.evaluate(()=>new Promise(res=>{const r=indexedDB.open('gf-photos',1);r.onsuccess=()=>{const q=r.result.transaction('p').objectStore('p').count();q.onsuccess=()=>res(q.result);};}));
 дано(стёрто===0,'сброс дневника стирает миниатюры ('+стёрто+')');
 await p.close();
 /* 5: атрибут крупного снимка у раскрытой тарелки */
 const исх=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
 дано(/photoAttr\(m\.img,false,open,!m\.me\)/.test(исх)&&/' data-photo-big="1"'/.test(исх)&&/el\.hasAttribute\('data-photo-big'\)/.test(исх),'раскрытая тарелка просит полный снимок, кружок — миниатюру');
 await ctx.close();
}finally{await b.close()}
console.log(плохо?'ПРОВАЛОВ: '+плохо:'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(плохо?1:0);})();
