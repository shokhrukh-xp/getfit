'use strict';
/* 22.10, ревью Codex foto-review R1–R4: жизненный цикл кэша фото. Блок
   функций кэша берём из index.html как есть (от «var PRIVATEPHOTOS» до
   MutationObserver) и гоняем в пустой странице с настоящим IndexedDB и
   управляемым сервером:
   R1 — ответ, пришедший после сброса, не кладёт снимок ни на диск, ни в память;
   R2 — отказ (404) убирает и миниатюру, и полный снимок; без нового ответа
        сервера снимок больше не выдаётся;
   R3 — чужие тарелки (shared) на диск не пишутся; новый сеанс спрашивает сервер;
   R4 — «не больше 400» держится между короткими сеансами.
   Повторное ревью (foto-rereview): отказ одного снимка и выход из круга не
   гасят загрузки других; старый ответ проверки не отменяет новое разрешение. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),M=require('./mock');
let плохо=0;const дано=(ok,t)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+t);if(!ok)плохо++};
const исх=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const блок=исх.slice(исх.indexOf('var PRIVATEPHOTOS=new Map();'),исх.indexOf('new MutationObserver(loadPrivatePhotos)'));
(async()=>{const b=await chromium.launch();try{
 /* настоящий адрес стенда: у about:blank нет IndexedDB */
 const p=await b.newPage();await p.goto(M.БАЗА+'catalog.json');await p.setContent('<body></body>');
 await p.evaluate(блок=>{
  window.SYNCURL='https://srv';window.__uid='1';window.syncUid=()=>window.__uid;window.esc=x=>x;
  window.__net=[];window.__ответ=null;
  window.tgFetch=url=>{window.__net.push(url);return (window.__ответ?window.__ответ(url):Promise.resolve(new Response(new Blob([new Uint8Array(500)],{type:'image/jpeg'}),{headers:{'X-Photo-Size':'t'}})));};
  (0,eval)(блок);
  window.кол=()=>new Promise(res=>{const r=indexedDB.open('gf-photos',1);r.onsuccess=()=>{const q=r.result.transaction('p').objectStore('p').count();q.onsuccess=()=>res(q.result);};});
 },блок);
 /* R1 */
 const r1=await p.evaluate(async()=>{let отпустить;window.__ответ=()=>new Promise(res=>{отпустить=()=>res(new Response(new Blob([new Uint8Array(500)],{type:'image/jpeg'}),{headers:{'X-Photo-Size':'t'}}));});
  const pr=фкАдрес('race',false).catch(e=>'отказ');await new Promise(r=>setTimeout(r,50));
  await фкСтереть('1');отпустить();const итог=await pr;await new Promise(r=>setTimeout(r,200));window.__ответ=null;
  return {итог:typeof итог==='string'&&итог.startsWith('blob:')?'показан':итог,диск:await кол(),память:ФКЭШ.mem.size};});
 дано(r1.диск===0&&r1.память===0&&r1.итог!=='показан','R1: ответ после сброса не возвращает снимок '+JSON.stringify(r1));
 /* R2 */
 const r2=await p.evaluate(async()=>{
  await фкАдрес('acc',false);await фкАдрес('acc',true);await new Promise(r=>setTimeout(r,150));
  фкОчиститьПамять();const из=await фкАдрес('acc',false);   /* второй сеанс: миниатюра с диска */
  window.__ответ=url=>Promise.resolve(new Response('',{status:404}));
  await фкАдрес('acc',true).catch(()=>{});                    /* полный — после resume заново */
  const до=__net.length;фкПроверить('acc');await new Promise(r=>setTimeout(r,150));
  const большой=await фкАдрес('acc',true).then(()=>'выдан',()=>'нет');const малый=await фкАдрес('acc',false).then(()=>'выдан',()=>'нет');
  window.__ответ=null;
  return {большой,малый,память:[...ФКЭШ.mem.keys()].filter(k=>k.endsWith('|acc')).length,диск:await кол()};});
 дано(r2.большой==='нет'&&r2.малый==='нет'&&r2.память===0&&r2.диск===0,'R2: отказ убирает оба размера, снимок больше не выдаётся '+JSON.stringify(r2));
 /* R3 */
 const r3=await p.evaluate(async()=>{фкОчиститьПамять();ФКЭШ.нет.clear();const n0=__net.length;
  await фкАдрес('drug',false,true);await new Promise(r=>setTimeout(r,150));const диск=await кол();
  фкОчиститьПамять();window.__ответ=()=>Promise.reject(new Error('офлайн'));const офлайн=await фкАдрес('drug',false,true).then(()=>'показан',()=>'нет');window.__ответ=null;
  return {диск,офлайн,запросов:__net.length-n0};});
 дано(r3.диск===0&&r3.офлайн==='нет'&&r3.запросов===2,'R3: чужой снимок не на диске, без ответа сервера не показывается '+JSON.stringify(r3));
 /* повторное ревью R1: отказ одного снимка не гасит загрузку другого; выход из круга — свои фото */
 const r5=await p.evaluate(async()=>{фкОчиститьПамять();ФКЭШ.нет.clear();
  const ждём={};window.__ответ=url=>new Promise(res=>{ждём[new URL(url).searchParams.get('key')]=res;});
  document.body.innerHTML='<img data-private-photo="valid"><img data-private-photo="denied"><img data-private-photo="mine">';
  loadPrivatePhotos();await new Promise(r=>setTimeout(r,80));
  const png=()=>new Response(new Blob([new Uint8Array(400)],{type:'image/jpeg'}),{headers:{'X-Photo-Size':'t'}});
  ждём.denied(new Response('',{status:404}));await new Promise(r=>setTimeout(r,50));
  фкОбщиеСброс();                                   /* выход из круга во время загрузки своего */
  ждём.valid(png());ждём.mine(png());
  for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,50));if(Object.keys(ждём).length>=3&&document.querySelector('[data-private-photo="valid"]').src.startsWith('blob:'))break;
   for(const k of ['valid','mine'])if(ждём[k]){const f=ждём[k];delete ждём[k];f(png());}}
  window.__ответ=null;const src=k=>(document.querySelector('[data-private-photo="'+k+'"]').getAttribute('src')||'').slice(0,5);
  return {valid:src('valid'),mine:src('mine'),denied:src('denied')};});
 дано(r5.valid==='blob:'&&r5.mine==='blob:'&&r5.denied==='','повторное R1: «404 B, 200 A» и выход из круга не гасят разрешённые '+JSON.stringify(r5));
 /* повторное ревью R2: старый 404 проверки после нового 204 — новое разрешение остаётся */
 const r6=await p.evaluate(async()=>{clearPrivatePhotos();document.body.innerHTML='';
  await фкАдрес('chk',false);await new Promise(r=>setTimeout(r,150));фкОчиститьПамять();
  let старый;window.__ответ=url=>/check=1/.test(url)?new Promise(res=>{старый=res;}):Promise.resolve(new Response(new Blob([new Uint8Array(400)],{type:'image/jpeg'}),{headers:{'X-Photo-Size':'t'}}));
  await фкАдрес('chk',false);фкПроверить('chk');await new Promise(r=>setTimeout(r,50));
  clearPrivatePhotos();                              /* новый сеанс */
  window.__ответ=url=>/check=1/.test(url)?Promise.resolve(new Response(null,{status:204})):Promise.resolve(new Response(new Blob([new Uint8Array(400)],{type:'image/jpeg'}),{headers:{'X-Photo-Size':'t'}}));
  const нов=await фкАдрес('chk',false);фкПроверить('chk');await new Promise(r=>setTimeout(r,80));
  старый(new Response('',{status:404}));await new Promise(r=>setTimeout(r,80));
  const ещё=await фкАдрес('chk',false).then(()=>'выдан',()=>'нет');window.__ответ=null;
  return {новый:нов.slice(0,5),после:ещё,запрещён:ФКЭШ.нет.has('chk')};});
 дано(r6.новый==='blob:'&&r6.после==='выдан'&&!r6.запрещён,'повторное R2: запоздавший ответ проверки старого сеанса не отменяет новое разрешение '+JSON.stringify(r6));
 /* R4 */
 const r4=await p.evaluate(async()=>{const счёт=[];
  for(let с=0;с<18;с++){ФКЭШ.подрезан=false;ФКЭШ.n=0;фкОчиститьПамять();
   for(let i=0;i<24;i++) await фкАдрес('k'+с+'_'+i,false);
   await new Promise(r=>setTimeout(r,120));счёт.push(await кол());}
  return счёт;});
 дано(Math.max(...r4)<=ФК_МАКС_ПРОВ(),'R4: лимит держится между сеансами '+JSON.stringify(r4.slice(-4)));
}finally{await b.close()}
console.log(плохо?'ПРОВАЛОВ: '+плохо:'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(плохо?1:0);})();
function ФК_МАКС_ПРОВ(){ return 400; }
