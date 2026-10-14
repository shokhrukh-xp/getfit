'use strict';
/* 14.10, GF-01: два аккаунта Telegram на одном устройстве. Codex на
   Xplorence в общем Chrome увидел чужие 86,5 кг и цель 75 кг: ключи
   хранилища были общими. Проверяем: чужой не видит прежнего, хозяин
   прежних ключей живёт как жил, спорное не отдаётся никому. */
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const A={sex:'m',age:41,ht:191,bw:86.5,goal:'fat',wt:'down',gym:'muscle',level:'mid',place:'gym',only:'all',lim:[],eq:[],tw:75};
async function стенд(b,id,засеять){
 const p=await b.newPage({viewport:{width:390,height:900}});
 const ушло=[];
 p.on('request',r=>{try{const u=new URL(r.url());if(u.pathname==='/s'){const d=JSON.parse(r.postData()||'{}');ушло.push(d);}}catch(e){}});
 await p.addInitScript(з=>{ if(sessionStorage.getItem('__засеяно'))return; sessionStorage.setItem('__засеяно','1');
   for(const k in з) localStorage.setItem(k,з[k]); }, засеять);
 const err=await M.поднять(p,{me:A,tgId:id,wait:2500});
 await p.waitForTimeout(600);
 const ls=await p.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k);}return o;});
 const текст=await p.evaluate(()=>document.body.innerText);
 const видит=await p.evaluate(()=>{try{return myData()||null}catch(e){return null}});
 return {p,err,ls,текст,ушло,видит};
}
const сеанс=JSON.stringify({epoch:0,full_epoch:0});
(async()=>{const b=await chromium.launch();try{
 /* 1. На устройстве уже жил A (111). Открывает B (222). */
 {const {p,err,ls,текст,ушло,видит}=await стенд(b,222,{'shp_v1_data_session_111':сеанс,'tgcs_state_me':JSON.stringify({me:A,at:'2026-10-13T10:00:00Z'})});
  ok(!ls['shp_v1_owner'],'хозяин прежних ключей не назначен чужому');
  ok(Object.keys(ls).some(k=>k.indexOf('shp_v1_@222_')===0),'у B своё пространство shp_v1_@222_');
  const свой=JSON.parse(ls['shp_v1_@222_me']||'null');
  ok(!свой||свой.ht!==191,'B не получил профиль A: '+JSON.stringify(свой&&[свой.bw,свой.tw]));
  ok(!/86[,.]5/.test(текст),'на экране B нет чужих 86,5 кг');
  ok(!видит||видит.ht!==191,'приложение B не видит профиль A (рост 191): '+JSON.stringify(видит&&видит.ht));
  ok(!ушло.some(d=>d.key==='me'&&d.data&&d.data.me&&d.data.me.bw===86.5),'профиль A не ушёл в облако B');
  ok(JSON.parse(ls['shp_v1_me']||'{}').bw===86.5,'прежние ключи A не тронуты (вес B не записан поверх)');
  ok(!err.length,'без ошибок'+(err.length?': '+err.join(' | '):''));await p.close();}
 /* 2. Хозяин: в прежних ключах только он сам */
 {const {p,err,ls,текст}=await стенд(b,111,{'shp_v1_data_session_111':сеанс});
  ok(ls['shp_v1_owner']==='111','A признан хозяином прежних ключей');
  ok(!Object.keys(ls).some(k=>k.indexOf('shp_v1_@')===0),'A живёт в прежних ключах, ничего не переносили');
  ok(JSON.parse(ls['shp_v1_me']||'{}').ht===191,'A видит свой профиль (рост 191) в прежних ключах');
  ok(!err.length,'без ошибок'+(err.length?': '+err.join(' | '):''));await p.close();}
 /* 3. Спорное: в прежних ключах двое — не отдаём никому */
 {const {p,err,ls}=await стенд(b,111,{'shp_v1_data_session_111':сеанс,'shp_v1_data_session_222':сеанс});
  ok(ls['shp_v1_owner']==='?','спорные прежние ключи заморожены');
  ok(Object.keys(ls).some(k=>k.indexOf('shp_v1_@111_')===0),'A начинает со своего пространства и облака');
  ok(!err.length,'без ошибок'+(err.length?': '+err.join(' | '):''));await p.close();}
}finally{await b.close();}
console.log(bad?'ПРОВАЛОВ: '+bad:'всё ок');process.exit(bad?1:0);})();
