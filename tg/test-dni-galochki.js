'use strict';
// 07.10, его слова: «почему за вчера и сегодня меня спрашивает, была или нет
// тренировка? Я же отмечаю „завершить и сохранить“ после каждой тренировки —
// нужно сразу ставить галочку в день, который сохранился». Потом по двум
// снимкам: «оба дня сделаны. Так почему в одном открывается один вид, а в
// другом другой вид?» Его выборы кнопками: ✓ на сохранённых днях; сделанный
// день везде — как сегодняшний список, числа можно поправить и за вчера.
//  1) день, сохранённый на этой неделе (с пн), — зелёный с ✓ и датой «вчера»;
//     прошлая неделя — без ✓;
//  2) вчерашний день открывается тем же списком, что сегодняшний: «сделан
//     вчера · …», результаты и «N из M»; «Очистить день» спрятана, есть
//     «Сделать этот день ещё раз сегодня», кнопка — «Сохранить изменения»;
//  3) правка вчерашнего пишется во вчерашнюю запись, сегодняшней не появляется;
//  4) «ещё раз сегодня» — обычный сегодняшний день;
//  5) сохранённый сегодня — ✓, обычный список;
//  6) спорт по расписанию не спрашиваем.
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;function ok(c,t){console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++}
const зап=(сдвиг,day,ex)=>({id:M.Д(сдвиг)+'_'+day,date:M.Д(сдвиг),day,name:'День '+day.slice(1),week:1,dur:45,
 t0:new Date(M.Д(сдвиг)+'T18:00:00').toISOString(),updated:new Date(M.Д(сдвиг)+'T19:10:00').toISOString(),ex});
// имена — как в готовой программе стенда (день 1 — присед и квадрицепс)
const ПРИСЕД={n:'Приседания со штангой',id:'Barbell_Squat',unit:'reps',sets:[{w:60,r:12},{w:60,r:12},{w:60,r:10}]};
const ТЯГА={n:'Румынская тяга с гантелями',id:'Stiff-Legged_Dumbbell_Deadlift',unit:'reps',sets:[{w:26,r:10},{w:26,r:10},{w:26,r:10}]};
const ЖИМ={n:'Жим лёжа',id:'Barbell_Bench_Press_-_Medium_Grip',unit:'reps',sets:[{w:55,r:8}]};
const ТЕН=[{kind:'теннис',min:120,intensity:'mod',kcal:1226,plan:1}];
// D1 — вчера (эта неделя, если сегодня не понедельник); D2 — воскресенье прошлой
// недели, считаем от понедельника стенда (08.10: «3 дня назад» в четверг — уже эта неделя).
const ПН=(new Date(M.TODAY+'T12:00:00').getDay()+6)%7;
function fx(extra){const o=opts('dark');o.page='gym';o.hist=[зап(1,'D1',[ПРИСЕД,ТЯГА]),зап(ПН+1,'D2',[ЖИМ])].concat(extra||[]);
 o.todayPlan=ТЕН;o.day={...o.day,gymPlan:false,plan:ТЕН};return o}
const кнопки=p=>p.evaluate(()=>[...document.querySelectorAll('#dayseg button')].map(b=>({k:b.dataset.day,i:(b.querySelector('i')||{}).textContent,
 done:b.dataset.done==='1',fin:b.dataset.fin==='1',после:getComputedStyle(b.querySelector('b'),'::after').content})));
const шапка=async p=>(await p.locator('#nexthint').innerText()).replace(/\s+/g,' ');
const запись=(p,id)=>p.evaluate(k=>{const v=localStorage.getItem('tgcs_workouts_'+k)||localStorage.getItem('cs_workouts_'+k);try{return v?JSON.parse(v):null}catch(e){return v}},id);
(async()=>{const b=await chromium.launch();try{
 const пн=(new Date(M.TODAY+'T12:00:00').getDay()+6)%7;
 let p=await b.newPage({viewport:{width:390,height:844}}),err=await M.поднять(p,fx());
 await p.waitForTimeout(400);
 if(пн<1) console.log('  (понедельник: «вчера» — прошлая неделя, проверки дня недели пропущены)');
 else{
  let к=await кнопки(p);const d1=к.find(x=>x.k==='D1'),d2=к.find(x=>x.k==='D2');
  ok(d1&&d1.fin&&d1.done&&d1.i==='вчера'&&/✓/.test(d1.после),'вчерашний день 1 — зелёный, ✓ после имени, «вчера»: '+JSON.stringify(d1));
  ok(d2&&!d2.fin,'день 2 с прошлой недели — без ✓: '+JSON.stringify(d2));
  await p.click('#dayseg button[data-day="D1"]');
  const ш=await шапка(p);
  ok(/^сделан вчера · день 1/.test(ш)&&/6 \/ \d+ подход/.test(ш),'шапка — «сделан вчера», 6 подходов из записи: '+ш);
  const строки=await p.locator('#list .exrow').allInnerTexts();
  ok(строки.length>=2&&/60×12/.test(строки[0])&&/3 из \d/.test(строки[0])&&/26×10/.test(строки[1])&&/3 из 3 ✓/.test(строки[1]),'тот же список, что у сегодняшнего: результаты и «N из M»: '+JSON.stringify(строки.slice(0,2)));
  ok(await p.locator('#finish').innerText()==='Сохранить изменения'&&!await p.locator('#reset').isVisible()&&await p.locator('#againtoday').isVisible(),'«Сохранить изменения», без «Очистить день», есть «ещё раз сегодня»');
  // 3) правка вчерашнего
  await p.click('#list .exrow[data-pickex="0"]');await p.waitForTimeout(200);
  const w=p.locator('#list .setrow[data-set="2"] input[data-f="w"]');
  await w.fill('62,5');await w.dispatchEvent('change');await p.waitForTimeout(150);
  await p.click('#finish');await p.waitForTimeout(1200);
  const вчера=await запись(p,M.Д(1)+'_D1'),сегодня=await запись(p,M.TODAY+'_D1');
  const вес=вчера&&вчера.ex&&(вчера.ex.find(x=>/Присед/.test(x.n))||{}).sets;
  ok(вес&&вес.some(v=>v.w===62.5)&&вчера.date===M.Д(1),'правка ушла во вчерашнюю запись: '+JSON.stringify(вес));
  ok(!сегодня,'сегодняшней записи дня 1 не появилось');
  ok(вчера&&вчера.dur===45,'время вчерашнего занятия правка не тронула: '+(вчера&&вчера.dur));
  к=await кнопки(p);ok(к.find(x=>x.k==='D1').i==='вчера','кнопка по-прежнему «вчера» — день не стал сегодняшним');
  // 4) ещё раз сегодня
  await p.click('#againtoday');
  const ш2=await шапка(p);
  ok(!/^сделан/.test(ш2)&&/^0 \//.test(ш2.replace(/^.*?(\d+ \/)/,'$1'))&&await p.locator('#finish').innerText()==='Завершить и сохранить'&&await p.locator('#reset').isVisible(),'«ещё раз сегодня» — обычный сегодняшний день: '+ш2);
 }
 // 6) спорт по расписанию не спрашиваем
 ok(!await p.locator('#planbox').isVisible()&&await p.locator('#planbox .rb button').count()===0,'теннис по расписанию — без вопроса «играл или нет»');
 ok(!err.length,'без ошибок JS '+err.join('|'));
 await p.close();

 // 5) сохранённый сегодня — ✓ и обычный список
 p=await b.newPage({viewport:{width:390,height:844}});
 err=await M.поднять(p,fx([зап(0,'D2',[ЖИМ])]));await p.waitForTimeout(400);
 const к2=await кнопки(p);const d2с=к2.find(x=>x.k==='D2');
 ok(d2с&&d2с.fin&&d2с.i==='сегодня','сохранённый сегодня день 2 — ✓ «сегодня»: '+JSON.stringify(d2с));
 await p.click('#dayseg button[data-day="D2"]');
 const ш3=await шапка(p);
 ok(/^сделан сегодня · день 2/.test(ш3)&&await p.locator('#finish').innerText()==='Завершить и сохранить'&&await p.locator('#list .exrow').count()>0,'сегодняшний — тот же список, шапка «сделан сегодня» (как «сделан вчера»): '+ш3);
 ok(!err.length,'без ошибок JS '+err.join('|'));
 await p.close();
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
