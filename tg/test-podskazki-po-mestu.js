'use strict';
/* 22.10, проход новичком. Его выбор: подсказки «по месту, по одной» вместо
   отдельной «Как пользоваться» (её убрали); дни из анкеты — его, даже если
   не трогал; готовая программа без слова про вес; ошибка анкеты гаснет при
   вводе. */
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const вид=(p,s)=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&!e.closest('[hidden]')&&e.getBoundingClientRect().height>0;},s);
const пузырь=p=>p.evaluate(()=>{const b=document.querySelector('#cmark:not([hidden]) .cmbub'),r=document.querySelector('#cmark .cmring');if(!b)return null;
  const br=b.getBoundingClientRect(),rr=r.getBoundingClientRect(),k=b.querySelector('button').getBoundingClientRect();
  return {t:b.textContent,l:br.left,r:br.right,top:br.top,bot:br.bottom,btn:k.height,ring:{l:rr.left,t:rr.top,w:rr.width,h:rr.height}};});
const ждатьПузырь=async(p,мс)=>{for(let i=0;i<(мс||4000)/200;i++){const x=await пузырь(p);if(x)return x;await p.waitForTimeout(200);}return null;};
/* пауза между подсказками — 30 с; на стенде сдвигаем «когда сделано» назад */
const LSK=k=>'shp_v1_cm_'+k;
const сделано=(p,k)=>p.evaluate(k=>+(localStorage.getItem('shp_v1_cm_'+k)||0)>0,k);
const состарить=p=>p.evaluate(()=>{['coach','meas','foodadd','foodfix','set','ex','finish','chat','bot'].forEach(k=>{const v=+(localStorage.getItem('shp_v1_cm_'+k)||0);if(v)localStorage.setItem('shp_v1_cm_'+k,String(v-60000));});});
async function новичок(b,theme,width){
  const p=await b.newPage({viewport:{width,height:844}});
  const err=await M.поднять(p,{theme,newbie:true,sub:'нет',wait:2500,cm:true});
  await M.шаги(p,{});await p.click('#wz-go');await p.waitForTimeout(1200);
  return {p,err};
}
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const где=theme+' '+width+': ';
  const {p,err}=await новичок(b,theme,width);
  /* готовые программы: без слова про вес, честная строка */
  const сп=await p.evaluate(()=>({names:[...document.querySelectorAll('#picklist button[data-prof] b')].map(x=>x.textContent),
    goals:[...document.querySelectorAll('#picklist button[data-prof] u')].map(x=>x.textContent),note:(document.querySelector('#picklist .wzfree')||{}).textContent||''}));
  ok(сп.names.length>=2&&сп.names.every(n=>!/вес (вниз|вверх|на месте)/.test(n)),где+'имена готовых без слова про вес: '+сп.names.join(' | '));
  ok(сп.goals.every(g=>!/^вес /.test(g)),где+'под именем — только зал: '+сп.goals.join(' | '));
  ok(/только про зал/.test(сп.note)&&!/больше всех/.test(сп.note),где+'строка над списком честная: '+сп.note.slice(0,80));
  await p.click('#picklist button[data-prof]');await p.waitForTimeout(1500);
  const дни=await p.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('shp_v1_sched_any')||'{}')).map(Number).sort().join());
  ok(дни==='1,3,5',где+'дни зала — из анкеты (пн/ср/пт), а не готовой программы: '+дни);
  /* на «Сегодня» сначала «С чего начнём?», подсказок поверх нет */
  await p.click('.l1 [data-page="home"]');await p.waitForTimeout(1500);
  if(await вид(p,'#startcard')){ ok(!(await пузырь(p)),где+'пока висит «С чего начнём?» — подсказок нет'); await p.click('#startcard [data-start="later"]'); }
  const п1=await ждатьПузырь(p);
  ok(п1&&/ИИ-тренер/.test(п1.t)&&/доставкой/.test(п1.t),где+'первая подсказка — у кнопки «Тренер», про еду и доставку: '+(п1&&п1.t));
  ok(п1&&п1.l>=15&&п1.r<=width-15,где+'строка в экране с полями 16: '+(п1&&[п1.l,п1.r]));
  ok(п1&&п1.btn>=44,где+'«Понятно» не меньше 44');
  const nav=await p.$eval('#coachnav',e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height};});
  ok(п1&&Math.abs(п1.ring.l-(nav.l-5))<2&&Math.abs(п1.ring.w-(nav.w+10))<2,где+'рамка — вокруг самой кнопки');
  ok(п1&&п1.bot<=nav.t,где+'строка над кнопкой — не закрывает её');
  await p.waitForTimeout(400);await p.screenshot({path:'/tmp/gf-cm-coach-'+theme+'-'+width+'.png'});
  await p.click('#coachnav');await p.waitForTimeout(600);
  ok(await сделано(p,'coach'),где+'нажал саму кнопку — подсказка сделала своё');
  ok(!(await пузырь(p)),где+'в чате сразу следующей нет — пауза');
  await состарить(p);
  const п2=await ждатьПузырь(p);
  ok(п2&&/Яндекс Еде/.test(п2.t)&&/в Wellböl Pro/.test(п2.t),где+'в чате — про кафе и доставку (без Pro — «в Wellböl Pro»): '+(п2&&п2.t));
  await p.waitForTimeout(400);await p.screenshot({path:'/tmp/gf-cm-chat-'+theme+'-'+width+'.png'});
  await p.fill('#ctext','что взять');await p.waitForTimeout(300);
  ok(!(await пузырь(p))&&await сделано(p,'chat'),где+'начал писать — подсказка ушла');
  await p.fill('#ctext','');await p.click('#coachclose');await p.waitForTimeout(500);
  /* зал: вес и повторы у первой ячейки */
  await состарить(p);
  await p.click('.l1 [data-page="gym"]');await p.waitForTimeout(400);
  const п3а=await ждатьПузырь(p);
  ok(п3а&&/Нажмите на упражнение/.test(п3а.t),где+'в зале — сначала открыть упражнение: '+(п3а&&п3а.t));
  await p.click('#list .exrow');await p.waitForTimeout(300);
  await p.evaluate(()=>{const c=document.querySelector('#list .setrow .cell');if(c)c.scrollIntoView({block:'center'});});await p.waitForTimeout(200);
  const п3=await ждатьПузырь(p);
  ok(п3&&/вес и повторы/.test(п3.t),где+'открыл — сразу подсказка у ячейки подхода: '+(п3&&п3.t));
  const навВерх=await p.$eval('#l1',e=>e.getBoundingClientRect().top);
  ok(п3&&п3.ring.t+п3.ring.h<=навВерх+6,где+'ячейка под нижней панелью не подсвечивается — рамка выше панели');
  await p.waitForTimeout(400);await p.screenshot({path:'/tmp/gf-cm-gym-'+theme+'-'+width+'.png'});
  await p.click('#cmark [data-cmok]');await p.waitForTimeout(300);
  ok(!(await пузырь(p))&&await сделано(p,'set'),где+'«Понятно» закрывает');
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(2500);
  await p.click('.l1 [data-page="gym"]');await p.waitForTimeout(1500);
  const п4=await пузырь(p);
  ok(!п4||!/вес и повторы/.test(п4.t),где+'после перезагрузки та же не возвращается');
  ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),где+'страница не ездит вбок');
  ok(!err.length,где+'без ошибок'+(err.length?': '+err.join(' | '):''));
  await p.close();
 }
 /* старожил: тура нет */
 {const p=await b.newPage({viewport:{width:390,height:844}});
  await M.поднять(p,{theme:'dark',wait:2500,cm:true});
  for(const pg of ['home','food','gym']){await p.click('.l1 [data-page="'+pg+'"]');await p.waitForTimeout(1600);}
  ok(!(await пузырь(p)),'у того, кто начал до выпуска, подсказок нет');
  ok(!(await p.locator('#profhow').count())&&!(await p.locator('#howm').count()),'«Как пользоваться» убрана целиком');
  await p.close();}
 /* стенд по умолчанию — без подсказок, чтобы не мешали остальным наборам */
 {const p=await b.newPage({viewport:{width:390,height:844}});
  await M.поднять(p,{theme:'light',newbie:true,sub:'нет',wait:2500});
  await M.шаги(p,{});await p.click('#wz-go');await p.waitForTimeout(1200);await p.click('#picklist button[data-prof]');await p.waitForTimeout(3500);
  ok(!(await пузырь(p)),'на стенде без o.cm подсказки выключены');await p.close();}
 /* анкета: ошибка гаснет по мере ввода */
 {const p=await b.newPage({viewport:{width:390,height:844}});
  await M.поднять(p,{theme:'light',newbie:true,wait:2500});
  /* 28.10: профиль новичка — прямо на экране цели */
  await M.шаги(p,{до:'me'});await p.click('#goalconversation [data-gs="sex"][data-v="f"]');await p.fill('#gs-p-ht','165');if(await p.locator('#gs-p-bw').count())await p.fill('#gs-p-bw','64');
  await p.click('#goalconversation [data-gs="calc"]');
  ok(/Заполните: возраст/.test(await p.locator('#goalconversation').innerText())&&await p.locator('#goalconversation').getAttribute('data-state')==='profile','пустой возраст не отправляется — просим заполнить');
  ok(await p.locator('#gs-p-ht').inputValue()==='165','введённое не стирается');
  await p.fill('#gs-p-age','30');await p.click('#goalconversation [data-gs="calc"]');
  await p.waitForFunction(()=>{const e=document.getElementById('goalconversation');return e.dataset.state==='screen'&&e.getAttribute('aria-busy')==='false';});
  {const t=await p.locator('#goalconversation').innerText();ok(/Чего хотите/i.test(t),'заполнили — сразу экран цели с цифрами: '+t.slice(0,160).replace(/\s+/g,' '));}
  await p.close();}
}finally{await b.close();}
console.log(bad?'ПРОВАЛОВ: '+bad:'всё ок');process.exit(bad?1:0);})();
