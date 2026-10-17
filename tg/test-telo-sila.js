'use strict';
/* 04.10: силу сообщает сервер. Проценты и направления не пересчитываем.
   17.10: его слова «выглядит ужасно и не понятно», выбор «индекс + объём» и
   «добавь, что это по тренировкам»: индекс силы по тренировкам линией (сервер
   /goal → sila.index), объём отдельной полосой, строка о снижении и список
   упражнений по нажатию. Плашек-«фильтров» растёт/стоит/падает больше нет. */
const {chromium}=require('playwright'), M=require('./mock');
let плохо=0;
const дано=(ok,text)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+text);if(!ok)плохо++};
const цель={text:'75 кг',wt:'down',rate:-.6,from:M.Д(29),w0:92};
const ряд=[{name:'Жим лёжа',now:{w:62.5,r:8,date:M.Д(1)},was:{w:60,r:8,date:M.Д(15)},pct:9},
 {name:'Тяга',now:{w:70,r:10,date:M.Д(1)},was:null,pct:null}];
const пн=k=>{const t=new Date(M.TODAY+'T12:00:00');const x=new Date(t);x.setDate(t.getDate()-((t.getDay()+6)%7)-7*k);return x.toISOString().slice(0,10);};
const индекс=(o)=>{const i=[null,100,101.5,null,103,102.4,104,103.2,o&&o.part!=null?o.part:null];
 return {base:пн(7),now:103.2,nowWeek:пн(1),ch:3.2,enough:true,weeks:i.map((v,k)=>({from:пн(8-k),i:v,t:k?12+k/2:null,n:5,pairs:4,partial:k===8}))};};
(async()=>{
 const br=await chromium.launch();
 try{
  for(const verdict of ['растёт','стоит','падает','мало']){
   const p=await br.newPage({viewport:{width:390,height:900}});
   const errors=await M.поднять(p,{theme:verdict==='падает'?'light':'dark',meas:M.замеры(),goal:цель,
    progress:{sila:{verdict,up:3,flat:2,down:verdict==='мало'?0:1,rows:ряд}}});
   const box=p.locator('.vzsila2'), list=box.locator('details.sxlist'), summary=list.locator('summary');
   дано(await box.count()===1,'блок силы есть и без линии плана: '+verdict);
   дано((await box.locator('.sxhd').innerText()).includes('Сила по тренировкам'),'заголовок говорит, что это по тренировкам');
   дано(await p.locator('.sila-counts, .sila-up').count()===0,'плашек-«фильтров» нет');
   const нет=(await box.locator('.sxnone').innerText()).trim();
   дано(verdict==='мало' ? /Мало тренировок/.test(нет) : /Индекс появится/.test(нет),'без индекса — честная строка: '+нет);
   дано(await box.locator('.sxdown').count()===(verdict==='мало'?0:1) && (verdict==='мало' || (await box.locator('.sxdown').innerText())==='Ниже прошлого раза — в 1 упражнении'),'строка о снижении — числом с сервера');
   дано(!await list.evaluate(e=>e.open),'список упражнений изначально свёрнут');
   await summary.click();
   дано(await list.evaluate(e=>e.open) && await list.locator('li').count()===2,'по тапу видны упражнения');
   const text=(await list.innerText()).replace(/\u00a0/g,' ');
   дано(text.includes('62,5×8') && text.includes('+9 %'),'процент взят с сервера, не рассчитан из 60 → 62,5');
   дано(/Пока без сравнения/i.test(text) && !text.includes('null') && !text.includes('undefined'),'первая тренировка — «пока без сравнения»');
   дано((await summary.boundingBox()).height>=44,'область нажатия не меньше 44 px');
   await summary.focus();await p.keyboard.press('Enter');дано(!await list.evaluate(e=>e.open),'раскрытие доступно с клавиатуры');
   дано(errors.length===0,'нет ошибок браузера');await p.close();
  }
  /* индекс: линия, база с датой, пропуск рвёт линию, текущая неделя пунктиром, объём своей подписью */
  for(const [part,theme,width] of [[null,'dark',390],[103.9,'light',320],[104.5,'dark',320]]){
   const p=await br.newPage({viewport:{width,height:900}});
   const errors=await M.поднять(p,{theme,meas:M.замеры(),goal:цель,progress:{sila:{verdict:'растёт',up:3,flat:1,down:0,rows:ряд,index:индекс({part})}}});
   const box=p.locator('.vzsila2'), где=theme+' '+width+': ';
   const крупно=(await box.locator('.sxhd b').innerText()).replace(/\s+/g,'');
   дано(крупно==='103,2+3,2%','крупно — последняя законченная неделя и изменение к базе '+где);
   дано(await box.locator('.sxhd b s.up').count()===1,'рост — цветом «хорошо»');
   дано(/^Неделя с \d\d\.\d\d · 100 — неделя с \d\d\.\d\d$/.test(await box.locator('.sxbase').innerText()),'подписаны неделя числа и что такое 100');
   дано(await box.locator('svg.sxsvg path[stroke="var(--accent)"]:not(.sxpart)').count()===2,'пропуск недели рвёт линию на два куска');
   дано(await box.locator('.sxpart').count()===(part!=null?1:0),'текущая неделя — пунктиром, только если в ней есть точка');
   дано((await box.locator('svg.sxsvg').innerHTML()).includes('неделя идёт'),'ось подписывает идущую неделю');
   дано(/^объём · 15,5\s?т за неделю с \d\d\.\d\d$/.test(await box.locator('.sxvol span').innerText()),'объём — своей строкой с датой недели');
   дано(await box.locator('.sxnone').count()===0,'с индексом нет строки «появится»');
   дано(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'помещается '+где);
   const hd=await box.locator('.sxhd b').boundingBox();дано(hd && hd.height<40,'число и процент — одной строкой '+где);
   дано(errors.length===0,'нет ошибок браузера');await p.close();
  }
  /* ревью Codex U3: идущая неделя после пропуска — отдельной точкой, без моста; её объём — контуром */
  {const p=await br.newPage({viewport:{width:390,height:900}});
   const ix=индекс({part:105});ix.weeks[7].i=null;ix.now=104;ix.nowWeek=ix.weeks[6].from;
   await M.поднять(p,{meas:M.замеры(),goal:цель,progress:{sila:{verdict:'растёт',up:3,flat:1,down:0,rows:ряд,index:ix}}});
   дано(await p.locator('.sxpart').count()===0 && await p.locator('.sxpartpt').count()===1,'через пропуск — отдельная точка идущей недели, без пунктира-моста');
   дано(await p.locator('.sxvol rect[fill="none"]').count()===1,'объём идущей недели — контуром, не бледной заливкой');
   await p.close();}
  for(const sila of [undefined,{verdict:'мало',rows:[]},{verdict:'падает',up:0,flat:0,down:1,rows:[{name:'<img src=x onerror=alert(1)>',now:{w:50,r:8},was:{w:55,r:8},pct:-7}]}]){
   const p=await br.newPage({viewport:{width:320,height:800}});
   await M.поднять(p,{meas:M.замеры(),goal:цель,progress:{sila}});
   дано(await p.locator('.vzsila2').count()===(sila?1:0),'без sila — нет блока и пустого места');
   if(sila && sila.rows.length){await p.locator('.sxlist summary').click();дано((await p.locator('.sxlist').innerText()).includes('<img') && await p.locator('.sxlist img').count()===0,'имя упражнения экранировано');}
   дано(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'помещается на 320 px');await p.close();
  }
 }finally{await br.close()}
 if(плохо){console.error('ПРОВАЛОВ: '+плохо);process.exitCode=1}else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e=>{console.error('УПАЛО:',e);process.exitCode=1});
