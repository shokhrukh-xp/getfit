'use strict';
// 07.10, его слова: «почему за вчера и сегодня меня спрашивает, была или нет
// тренировка? Я же отмечаю „завершить и сохранить“ после каждой тренировки —
// нужно сразу ставить галочку в день, который сохранился». Его выборы кнопками:
// «✓ + итог по нажатию» и «подписать „Вне зала“».
//  1) день, сохранённый на этой неделе (с пн), — зелёный с ✓ и датой «вчера»;
//     прошлая неделя — без ✓;
//  2) нажал на такой день — «сделан вчера · …», итог записи, без «Завершить»;
//     «Сделать этот день ещё раз сегодня» — обычный список;
//  3) сохранённый сегодня — ✓, но открывается обычный список (его можно править);
//  4) карточка спорта по плану — под «Вне зала», у тенниса «Играл / Не играл»
//     (у женщины — «Играла»), у бега — «Было / Не было».
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;function ok(c,t){console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++}
const зап=(сдвиг,day,ex)=>({id:M.Д(сдвиг)+'_'+day,date:M.Д(сдвиг),day,name:'День '+day.slice(1),week:1,dur:52,
 updated:new Date(M.Д(сдвиг)+'T19:10:00').toISOString(),ex});
const ПРИСЕД={n:'Присед со штангой',id:'Barbell_Squat',unit:'reps',sets:[{w:60,r:12},{w:60,r:12},{w:60,r:10}]};
const ПЛАНКА={n:'Планка',id:'Plank',unit:'sec',sets:[{w:null,r:60},{w:null,r:45}]};
const ЛЕСТНИЦА={n:'Лестница',id:'Step_Mill',unit:'min',int:'hard',sets:[{w:null,r:20}]};
// вт 06.10 (вчера) — эта неделя; вс 04.10 — прошлая. TODAY в стенде — среда 07.10.
const ТЕН=[{kind:'теннис',min:120,intensity:'mod',kcal:1226,plan:1}];
function fx(extra){const o=opts('dark');o.page='gym';o.hist=[зап(1,'D1',[ПРИСЕД,ПЛАНКА,ЛЕСТНИЦА]),зап(3,'D2',[ПРИСЕД])].concat(extra||[]);
 o.todayPlan=ТЕН;o.day={...o.day,gymPlan:false,plan:ТЕН};return o}
const кнопки=p=>p.evaluate(()=>[...document.querySelectorAll('#dayseg button')].map(b=>({k:b.dataset.day,i:(b.querySelector('i')||{}).textContent,
 done:b.dataset.done==='1',fin:b.dataset.fin==='1',после:getComputedStyle(b.querySelector('b'),'::after').content})));
(async()=>{const b=await chromium.launch();try{
 const пн=(new Date(M.TODAY+'T12:00:00').getDay()+6)%7;
 if(пн<1){console.log('  (понедельник: «вчера» — прошлая неделя, проверка недели не про сегодня)');}
 let p=await b.newPage({viewport:{width:390,height:844}}),err=await M.поднять(p,fx());
 await p.waitForTimeout(400);
 let к=await кнопки(p);const d1=к.find(x=>x.k==='D1'),d2=к.find(x=>x.k==='D2');
 if(пн>=1){
  ok(d1&&d1.fin&&d1.done&&d1.i==='вчера'&&/✓/.test(d1.после),'вчерашний день 1 — зелёный, ✓ после имени, «вчера»: '+JSON.stringify(d1));
  ok(d2&&!d2.fin,'день 2 с прошлой недели — без ✓: '+JSON.stringify(d2));
  await p.click('#dayseg button[data-day="D1"]');
  const шапка=(await p.locator('#nexthint').innerText()).replace(/\s+/g,' ');
  ok(/^сделан вчера · день 1/.test(шапка)&&/6 \/ \d+ подход/.test(шапка),'шапка — «сделан вчера», 6 подходов из записи: '+шапка);
  const пункты=await p.locator('#list .dview .dvl li').allInnerTexts();
  ok(пункты.length===3&&/60×12 · 60×12 · 60×10/.test(пункты[0])&&/60 с · 45 с/.test(пункты[1])&&/20 мин · тяжело/.test(пункты[2]),'итог записи по упражнениям, в своих единицах: '+JSON.stringify(пункты));
  ok(/6\s*подходов/.test(await p.locator('.dvsum').innerText())&&/2040\s*кг/.test(await p.locator('.dvsum').innerText())&&/52\s*мин/.test(await p.locator('.dvsum').innerText()),'сводка: подходы, тоннаж только у повторов, минуты');
  ok(!await p.locator('#finish').isVisible()&&!await p.locator('#reset').isVisible()&&!await p.locator('#phaseline').isVisible(),'в итоге нет «Завершить», «Очистить день» и совета к подходам');
  ok(await p.locator('#planbox').isVisible(),'карточка «Вне зала» остаётся — она про сегодня');
  await p.click('#dvagain');
  ok(await p.locator('#list .dview').count()===0&&await p.locator('#list .exrow').count()>0&&await p.locator('#finish').isVisible(),'«Сделать этот день ещё раз сегодня» — обычный список и «Завершить»');
  ok(!/^сделан/.test(await p.locator('#nexthint').innerText()),'шапка снова про сегодня');
 }
 // карточка тенниса
 const план=(await p.locator('#planbox').innerText()).replace(/\s+/g,' ');
 const кн=await p.locator('#planbox .rb button').allInnerTexts();
 ok(/^Вне зала/i.test(план)&&/после «Играл»/.test(план)&&кн.join('|')==='Играл|Не играл','теннис — под «Вне зала», «Играл / Не играл»: '+план+' '+кн.join('|'));
 ok(!err.length,'без ошибок JS '+err.join('|'));
 await p.close();

 // 3) сохранённый сегодня — ✓, но обычный список
 p=await b.newPage({viewport:{width:390,height:844}});
 err=await M.поднять(p,fx([зап(0,'D2',[ПРИСЕД])]));await p.waitForTimeout(400);
 к=await кнопки(p);const d2с=к.find(x=>x.k==='D2');
 ok(d2с&&d2с.fin&&d2с.i==='сегодня','сохранённый сегодня день 2 — ✓ «сегодня»: '+JSON.stringify(d2с));
 await p.click('#dayseg button[data-day="D2"]');
 ok(await p.locator('#list .dview').count()===0&&await p.locator('#finish').isVisible(),'сегодняшний открывается обычным списком (его можно поправить)');
 ok(!err.length,'без ошибок JS '+err.join('|'));
 await p.close();

 // 4) у женщины — «Играла», у бега — «Было»
 p=await b.newPage({viewport:{width:390,height:844}});
 const o=fx();o.me={...o.me,sex:'f'};const БЕГ=[{kind:'бег',min:30,intensity:'mod',kcal:300,plan:1}];
 o.todayPlan=ТЕН.concat(БЕГ);o.day={...o.day,plan:ТЕН.concat(БЕГ)};
 err=await M.поднять(p,o);await p.waitForTimeout(400);
 const кн2=await p.locator('#planbox .rb button').allInnerTexts();
 ok(кн2.join('|')==='Играла|Не играла|Было|Не было','у неё теннис — «Играла», бег — «Было»: '+кн2.join('|'));
 ok(!err.length,'без ошибок JS '+err.join('|'));
 await p.close();
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
