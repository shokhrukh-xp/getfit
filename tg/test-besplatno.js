'use strict';
/* 14.10: два решения после прохода Codex «глазами новичка».
   GF-02 — без подписки 3 записи еды через ИИ в день: сколько осталось, видно
   на кнопке «Добавить приём». GF-04 — незаписанный приём не значит
   «пропущен»: на «Еде» вопрос «ел или нет» с двумя кнопками. */
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const ME={sex:'m',age:34,ht:178,bw:88,goal:'fat',wt:'down',gym:'muscle',level:'mid',place:'gym',only:'all',lim:[],eq:[]};
const УЖИН=[{id:9,t:'23:20',kind:'ужин',kcal:215,prot:14,text:'яичница'}];
async function стенд(b,width,theme,o){
 const p=await b.newPage({viewport:{width,height:900}});
 o=o||{};const опц={theme,page:'food',me:ME,wait:2500};for(const k in опц)if(!(k in o))o[k]=опц[k];
 const err=await M.поднять(p,o);
 await p.waitForTimeout(500);return {p,err};
}
const подпись=p=>p.$eval('#food-add small',e=>e.textContent.trim());
(async()=>{const b=await chromium.launch();try{
 /* 1. сколько бесплатных осталось — на кнопке */
 {const {p,err}=await стенд(b,390,'dark',{sub:'нет',бесплатно:{left:2,of:3}});
  ok(/бесплатно ещё 2 из 3/.test(await подпись(p)),'без подписки: на кнопке видно остаток — '+await подпись(p));
  ok(!err.length,'без ошибок'+(err.length?': '+err.join(' | '):''));await p.close();}
 {const {p}=await стенд(b,390,'dark',{sub:'нет',бесплатно:{left:0,of:3}});
  ok(/кончились/.test(await подпись(p)),'лимит исчерпан — так и написано: '+await подпись(p));await p.close();}
 {const {p}=await стенд(b,390,'dark',{});
  ok(await подпись(p)==='Фото или пара слов тренеру','с доступом — подпись прежняя');await p.close();}
 /* 2. вопрос про незаписанные приёмы */
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const где=theme+' '+width+': ',o={time:'23:22',day:{meals:УЖИН,пробелы:{kinds:['завтрак','обед'],ответ:null}}};
  const {p,err}=await стенд(b,width,theme,o);
  const к=await p.evaluate(()=>{const e=document.getElementById('fgaps');if(!e||e.hidden)return null;
   return {т:e.textContent,кн:[...e.querySelectorAll('button[data-gap]')].map(x=>{const r=x.getBoundingClientRect();return {v:x.dataset.gap,h:r.height,r:r.right}}),вбок:document.documentElement.scrollWidth>innerWidth}});
  ok(к&&/Завтрак и обед не записаны/.test(к.т)&&/Ты их ел\?/.test(к.т),где+'вопрос виден: '+(к&&к.т));
  ok(к&&к.кн.map(x=>x.v).join()==='не записал,пропустил'&&к.кн.every(x=>x.h>=44&&x.r<=width),где+'две кнопки, не меньше 44 px, в экране');
  ok(к&&!к.вбок,где+'страница не ездит вбок');
  await p.locator('#fgaps').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/gf-gaps-'+theme+'-'+width+'.png'});
  await p.click('#fgaps button[data-gap="не записал"]');await p.waitForTimeout(500);
  const з=(o.gaps||[]).slice(-1)[0]||{};
  ok(з.ответ==='не записал',где+'ответ ушёл на сервер');
  ok(await p.$eval('#fgaps',e=>e.hidden),где+'ответил — вопрос ушёл');
  ok(!err.length,где+'без ошибок'+(err.length?': '+err.join(' | '):''));
  await p.close();
 }
 /* 3. всё записано или уже ответил — вопроса нет */
 {const {p}=await стенд(b,390,'dark',{day:{meals:УЖИН,пробелы:{kinds:['завтрак'],ответ:'пропустил'}}});
  ok(await p.$eval('#fgaps',e=>e.hidden),'уже ответил — не спрашиваем');await p.close();}
 {const {p}=await стенд(b,390,'dark',{day:{пробелы:{kinds:[],ответ:null}}});
  ok(await p.$eval('#fgaps',e=>e.hidden),'пробелов нет — вопроса нет');await p.close();}
 {const {p}=await стенд(b,390,'dark',{time:'21:00',day:{meals:[{id:5,t:'20:40',kind:'ужин',kcal:500,prot:30,text:'плов'}],пробелы:{kinds:['обед'],ответ:null}}});
  ok(/Обед не записан\. Ты обедал\?/.test(await p.$eval('#fgaps',e=>e.textContent)),'один приём — «Обед не записан. Ты обедал?»');await p.close();}
}finally{await b.close();}
console.log(bad?'ПРОВАЛОВ: '+bad:'всё ок');process.exit(bad?1:0);})();
