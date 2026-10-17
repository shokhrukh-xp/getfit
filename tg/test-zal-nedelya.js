'use strict';
/* 17.10: «Зал на неделе» — три KPI на «Сегодня» (его выбор «Три KPI, индекс в
   Журнал»). Определения — ревью макета Codex (kpi-maket.md): неделя пн–вс,
   записанное занятие — запись с подходом на повторы, повторное сохранение —
   та же запись; группа получает наибольший коэффициент своих мышц; одна шкала
   у пяти строк; два результата — частые упражнения программы, без облегчённых. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let плохо=0;const дано=(ok,t)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+t);if(!ok)плохо++};
const П='Barbell_Squat', Ж='Barbell_Bench_Press_-_Medium_Grip', Р='Stiff-Legged_Dumbbell_Deadlift';
const зап=(id,date,ex,easy)=>({id,date,day:'A',name:'День A',week:1,easy:!!easy,updated:new Date(date+'T19:00:00').toISOString(),
 ex:ex.map(([n,i,w,r,unit])=>({n,id:i,unit:unit||'reps',sets:[1,2,3].map(()=>({w,r}))}))});
const сегодня=M.Д(0), прошлая=M.Д(7);
const журнал=[
 зап('a',сегодня,[['Приседания со штангой',П,75,8],['Жим лёжа',Ж,55,10],['Румынская тяга с гантелями',Р,28,10]]),
 зап('c',сегодня,[['Планка','Plank',null,60,'sec']]),                                   /* только секунды — не занятие */
 зап('b',прошлая,[['Приседания со штангой',П,72.5,8],['Жим лёжа',Ж,55,8],['Румынская тяга с гантелями',Р,28,10]]),
 зап('e',M.Д(3),[['Приседания со штангой',П,40,8]],true),
 зап('a',сегодня,[['Приседания со штангой',П,75,8],['Жим лёжа',Ж,55,10],['Румынская тяга с гантелями',Р,28,10]]),   /* повтор той же записи */
 /* ревью Codex Z4: одноимённое упражнение с другим id — не результат текущей программы */
 зап('o1',M.Д(9),[['Жим лёжа','Old_Bench_Id',45,8]]), зап('o2',M.Д(8),[['Жим лёжа','Old_Bench_Id',47.5,8]])];          /* облегчённое — не результат */
const числа=t=>t.replace(/ /g,' ').replace(/\s+/g,' ').trim();
(async()=>{const br=await chromium.launch();try{
 for(const theme of ['dark','light'])for(const width of [320,390]){
  const где=theme+' '+width+': ';
  const p=await br.newPage({viewport:{width,height:900}});
  await p.addInitScript(()=>{try{localStorage.setItem('shp_v1_shp_sched',JSON.stringify({1:1,3:1,5:1}))}catch(e){}});
  const o=opts(theme);o.hist=журнал;o.progress={sila:{verdict:'стоит',up:1,flat:1,down:0,rows:[{name:'Жим лёжа',was:{w:55,r:8,date:прошлая},now:{w:55,r:10,date:сегодня},pct:7}]}};
  const err=await M.поднять(p,o);await p.waitForTimeout(900);
  const z=p.locator('.vzbottom .zk');
  дано(await z.count()===1,где+'блок «Зал на неделе» на «Сегодня»');
  дано(/^Зал · \d+(–| \S+ – )\d+ \S+$/.test(числа(await z.locator('.zkhd').innerText())),где+'период — календарная неделя пн–вс: '+числа(await z.locator('.zkhd').innerText()));
  const зан=числа(await z.locator('.zklab').first().innerText());
  /* a — эта неделя; e (облегчённое) — если попало в неделю; c (только секунды) и b (прошлая) — нет */
  const пн=(()=>{const t=new Date(M.TODAY+'T12:00:00');t.setDate(t.getDate()-((t.getDay()+6)%7));return t.toISOString().slice(0,10);})();
  const ждём=1+(M.Д(3)>=пн?1:0);
  дано(new RegExp('^Записано занятий '+ждём+' из 3$').test(зан),где+'записано занятий: '+зан);
  дано(await z.locator('.zkdots i').count()===3 && await z.locator('.zkdots i.on').count()===ждём,где+'точки по плану');
  /* подходы: присед 3×(ноги 1) + румынская 3×(ноги 1) = 6 на ноги, а не сумма мышц */
  const гр=await z.locator('.zkrow').evaluateAll(rs=>rs.map(r=>({n:r.querySelector('b').textContent,f:r.querySelector('s strong').textContent,w:r.querySelector('.zkbar').getBoundingClientRect().width})));
  const ноги=гр.find(g=>g.n==='Ноги');
  /* + облегчённый присед 3 подхода, если попал в эту неделю: облегчённое — тоже занятие */
  дано(ноги && ноги.f===String(6+(ждём-1)*3),где+'ноги: по 1 за подход, у группы — наибольший коэффициент мышц, а не сумма '+JSON.stringify(ноги));
  дано(гр.length>=3 && гр.every(g=>Math.abs(g.w-гр[0].w)<1),где+'одна шкала: полосы одной длины');
  дано(await z.locator('.zkbar u').evaluateAll(us=>us.every(u=>getComputedStyle(u).boxShadow!=='none')),где+'черта плана с обводкой — видна поверх заливки');
  /* результаты: присед вес ↑ при тех же повторах, жим повторы ↑ при том же весе; облегчённое не учтено */
  const рез=await z.locator('.zkr').evaluateAll(rs=>rs.map(r=>r.innerText.replace(/ /g,' ').replace(/\s+/g,' ')));
  дано(рез.length===2,где+'два результата: '+JSON.stringify(рез));
  дано(рез.some(t=>/Приседания со штангой ↑ \+2,5 кг 8 повт\. · 72,5 → 75 кг · /.test(t)),где+'присед: +2,5 кг при тех же повторах');
  дано(рез.some(t=>/Жим лёжа ↑ \+2 повт\. 55 кг · 8 → 10 повт\. · /.test(t)),где+'жим: +2 повт. при том же весе');
  дано(!рез.some(t=>/40/.test(t)),где+'облегчённое занятие не сравнивается');
  дано(!рез.some(t=>/45|47,5/.test(t)),где+'одноимённое упражнение с чужим id не попадает в результаты');
  дано((гр.find(g=>g.n==='Грудь')||{}).f==='3',где+'повтор той же записи не удваивает подходы: грудь 3');
  дано(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),где+'помещается по ширине');
  дано(!err.length,где+'без ошибок '+err.join(' | '));
  if(theme==='dark'&&width===390){
   await z.locator('[data-zkgo="log"]').click();await p.waitForTimeout(900);
   дано(await p.locator('#p-log:not(.hide) #logsila .vzsila2').count()===1,'«Рабочие веса и объём» открывает Журнал с рабочими весами');
   дано(await p.locator('#p-home .vzsila2').count()===0,'на «Сегодня» рабочих весов больше нет');
  }
  await p.close();
 }
 /* ревью Codex Z3: «облегчить сегодня» не меняет недельный план подходов */
 {const план=async easy=>{const p=await br.newPage({viewport:{width:390,height:900}});
   await p.addInitScript(e=>{try{localStorage.setItem('shp_v1_shp_sched',JSON.stringify({1:1,3:1,5:1}));if(e)localStorage.setItem('shp_v1_shp_easy',JSON.stringify(e))}catch(x){}},easy?M.TODAY:null);
   const o=opts('dark');o.hist=журнал;await M.поднять(p,o);await p.waitForTimeout(900);
   const v=await p.locator('.zkrow').evaluateAll(rs=>rs.map(r=>r.querySelector('s').textContent).join('|'));await p.close();return v;};
  const до=await план(false), после=await план(true);
  дано(до===после && /из/.test(до),'облегчение сегодня не уменьшает план недели: '+до+' / '+после);}
 /* ревью Codex P3: «Рабочие веса и объём» при позднем /goal — прокрутка к блоку, когда он нарисован */
 {const p=await br.newPage({viewport:{width:390,height:844}});
  const o=opts('dark');o.hist=журнал;o.goalDelay=2000;o.progress={sila:{verdict:'стоит',up:1,flat:1,down:0,rows:[{name:'Жим лёжа',was:{w:55,r:8},now:{w:55,r:10},pct:7}]}};
  await M.поднять(p,o);await p.locator('.zk [data-zkgo="log"]').click();await p.waitForTimeout(3000);
  const r=await p.evaluate(()=>{const e=document.querySelector('#logsila');return e?e.getBoundingClientRect().top:null;});
  дано(r!=null && r>=-2 && r<844*0.6,'поздний индекс — в видимой области после ссылки: top='+r);
  await p.close();}
 /* ревью Codex Z1: поздний /goal дорисовывает уже открытый Журнал */
 {const p=await br.newPage({viewport:{width:390,height:900}});
  const o=opts('dark');o.hist=журнал;o.goalDelay=2500;o.progress={sila:{verdict:'стоит',up:1,flat:1,down:0,rows:[{name:'Жим лёжа',was:{w:55,r:8},now:{w:55,r:10},pct:7}]}};
  await M.поднять(p,o);await p.click('.l1 [data-page="gym"]');await p.click('#zseg-gym [data-zseg="log"]');
  const рано=await p.locator('#logsila .vzsila2').count();await p.waitForTimeout(3500);
  дано(await p.locator('#p-log:not(.hide) #logsila .vzsila2').count()===1,'Журнал открыт до ответа /goal — рабочие веса появились без повторного входа (до ответа: '+рано+')');
  await p.close();}
 /* новичок: нет записей — честная строка и вход в тренировку; результатов нет */
 {const p=await br.newPage({viewport:{width:320,height:844}});
  await p.addInitScript(()=>{try{localStorage.setItem('shp_v1_shp_sched',JSON.stringify({1:1,3:1,5:1}))}catch(e){}});
  const o=opts('dark');o.hist=[];await M.поднять(p,o);await p.waitForTimeout(900);
  const t=числа(await p.locator('.zk').innerText());
  дано(/Записано занятий 0 из 3/.test(t) && /Пока нет записанных занятий · план 3/.test(t),'новичок: 0 из 3 и строка без красного');
  дано(/Появятся после повторного занятия/.test(t),'новичок: результатов нет — объяснение');
  дано(await p.locator('.zk [data-zkgo="gym"]').count()===1,'новичок: вход в тренировку');
  await p.close();}
 /* только еда — блока нет */
 {const p=await br.newPage({viewport:{width:390,height:844}});
  const o=opts('dark');o.me={...o.me,only:'food'};await M.поднять(p,o);await p.waitForTimeout(700);
  дано(await p.locator('.zk').count()===0,'«только еда» — без зала');await p.close();}
}finally{await br.close()}
 if(плохо){console.error('ПРОВАЛОВ: '+плохо);process.exitCode=1}else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e=>{console.error('УПАЛО:',e);process.exitCode=1});
