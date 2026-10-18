'use strict';
/* 13.10: характер тренера на выбор. Его слова: «давай позволим пользователям
   выбирать характер тренера: стандартный, весёлый и хардкорный». Его выборы:
   спросить каждого (строка в знакомстве и карточка на главной, пока не
   выбрал), менять в профиле и словами в чате. */
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const ME={sex:'m',age:34,ht:178,bw:88,goal:'fat',wt:'down',gym:'muscle',level:'mid',place:'gym',only:'all',lim:[],eq:[]};
const мой=p=>p.evaluate(()=>{try{return JSON.parse(localStorage.getItem('shp_v1_me'))||{}}catch(e){return {}}});
async function поднять(b,width,theme,o){
 const p=await b.newPage({viewport:{width,height:900}});const ушло=[];
 p.on('request',r=>{try{const u=new URL(r.url());if(u.pathname==='/s'){const d=JSON.parse(r.postData()||'{}');if(d.key==='me')ушло.push(d.data&&d.data.me&&d.data.me.voice);}}catch(e){}});
 const err=await M.поднять(p,Object.assign({theme},o||{}));await p.waitForTimeout(400);return {p,err,ушло};
}
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const где=theme+' '+width+': ';
  /* 1. карточка на главной, пока не выбрал */
  let {p,err,ушло}=await поднять(b,width,theme,{me:ME});
  const к=await p.evaluate(()=>{const e=document.getElementById('voicenudge');if(!e||e.hidden)return null;
   return {т:e.textContent,кн:[...e.querySelectorAll('button[data-voice]')].map(x=>({v:x.dataset.voice,h:x.getBoundingClientRect().height})),вбок:document.documentElement.scrollWidth>innerWidth}});
  ok(к&&/Какой тренер тебе нужен/.test(к.т)&&к.кн.map(x=>x.v).join()==='standard,fun,hard',где+'карточка с тремя характерами: '+(к&&к.кн.map(x=>x.v)));
  ok(к&&к.кн.every(x=>x.h>=44)&&!к.вбок,где+'кнопки не меньше 44 px, страница не ездит вбок');
  await p.locator('#voicenudge').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/gf-voice-card-'+theme+'-'+width+'.png'});
  await p.click('#voicenudge button[data-voice="hard"]');await p.waitForTimeout(300);
  ok(await p.evaluate(()=>document.getElementById('voicenudge').hidden),где+'выбрал — карточка ушла');
  ok((await мой(p)).voice==='hard'&&ушло.includes('hard'),где+'саркастичный записан и ушёл на сервер');
  /* 2. профиль: видно выбор, можно сменить */
  await p.click('#profbtn');await p.waitForTimeout(400);
  /* 17.10: в списке профиля — строка «Характер» со значением, выбор — в её листе */
  ok(/саркастичный/.test(await p.textContent('#pv-voice')),где+'строка «Характер» показывает выбор: '+await p.textContent('#pv-voice'));
  await p.click('#pq-voice');await p.waitForTimeout(300);
  const пр=await p.evaluate(()=>({нажат:(document.querySelector('#me-voice button[aria-pressed="true"]')||{}).dataset,
   подсказка:(document.getElementById('me-voice-hint')||{}).textContent}));
  ok(пр.нажат&&пр.нажат.v==='hard'&&/без унижения/.test(пр.подсказка),где+'в профиле — саркастичный и подсказка: '+пр.подсказка);
  await p.locator('#me-voice').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/gf-voice-prof-'+theme+'-'+width+'.png'});
  await p.click('#me-voice button[data-v="standard"]');await p.waitForTimeout(400);
  ok((await мой(p)).voice==='standard'&&ушло.includes('standard'),где+'сменил в профиле на стандартного');
  ok(/без шуток/.test(await p.textContent('#me-voice-hint')),где+'подсказка сменилась');
  ok(/без шуток/.test(await p.textContent('#me-voice button[data-v="standard"]')),где+'у каждого варианта подпись, что он значит');
  await p.click('#pqback');await p.waitForTimeout(300);
  ok(/спокойный/.test(await p.textContent('#pv-voice')),где+'назад — и строка «Характер» уже со новым значением');
  ok(!err.length,где+'без ошибок на странице'+(err.length?': '+err.join(' | '):''));
  await p.close();
 }
 /* 3. уже выбрал — карточки нет */
 let {p}=await поднять(b,390,'dark',{me:Object.assign({voice:'fun'},ME)});
 ok(await p.evaluate(()=>document.getElementById('voicenudge').hidden),'выбор есть — карточки нет');await p.close();
 /* 4. профиль не заполнен — сначала знакомство, карточки нет */
 ({p}=await поднять(b,390,'dark',{}));
 ok(await p.evaluate(()=>document.getElementById('voicenudge').hidden),'профиль не заполнен — карточки нет');await p.close();
 /* 5. словами в чате: сервер сменил — приложение показывает */
 ({p}=await поднять(b,390,'dark',{me:Object.assign({voice:'standard'},ME),onCoach:()=>({ok:true,reply:'Принял. Теперь без поблажек, но и без мата.',voice:'hard'})}));
 await p.click('#coachnav');await p.waitForTimeout(600);
 await p.fill('#ctext','давай хардкор');await p.click('#csend');
 await p.waitForFunction(()=>document.querySelector('#chatlog').textContent.includes('без поблажек'),null,{timeout:6000}).catch(()=>{});
 ok((await мой(p)).voice==='hard','чат: «давай хардкор» — характер сменился и в приложении');
 await p.close();
 /* 6. 14.10, его выбор: знакомство по шагам, характер — после «С чего начнём?» */
 let r=await поднять(b,390,'dark',{newbie:true,wait:2500});p=r.p;
 ok(!(await p.isVisible('#wz-voice').catch(()=>false)),'в шагах знакомства характера нет');
 await M.шаги(p,{only:'food'});await p.waitForTimeout(1200);
 ok(await p.evaluate(()=>!document.getElementById('startcard').hidden&&document.getElementById('voicenudge').hidden),'после знакомства — сначала «С чего начнём?», карточки характера пока нет');
 await p.click('#startcard [data-start="later"]');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!document.getElementById('voicenudge').hidden),'«Позже» — и следом спрашиваем характер');
 await p.close();
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
