'use strict';
// 09.10, его снимок: «Подсказки к упражнениям конфликтуют между собой. В тексте
// написан один вес, а в самой ячейке совсем другое» — «Оставь 20 кг», а в ячейке
// 25; «прошлый раз · 18.09», хотя после были 25.09 и 01.10. Причина: совет
// считался по журналу, а «было», дата и ячейки — по устаревшей записи LAST.
// Его выбор кнопкой «Совет»: в ячейках — вес и повторы на сегодня, как в тексте.
//  1) его случай: журнал 18.09 / 25.09 / 01.10, LAST застрял на 18.09 —
//     дата, «было», совет и ячейки про одно занятие (последнее до сегодня);
//  2) совет поднимает вес — в ячейках новый вес, «было» — факт прошлого раза;
//  3) сегодняшняя запись LAST (её пишет галочка) прошлым разом не считается.
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;function ok(c,t){console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++}
const ПРИСЕД='Приседания со штангой', ID='Barbell_Squat';
const зап=(сдвиг,sets)=>({id:M.Д(сдвиг)+'_D1',date:M.Д(сдвиг),day:'D1',name:'День 1',week:1,dur:45,
 t0:new Date(M.Д(сдвиг)+'T18:00:00').toISOString(),updated:new Date(M.Д(сдвиг)+'T19:10:00').toISOString(),
 ex:[{n:ПРИСЕД,id:ID,unit:'reps',sets:sets.map(([w,r])=>({w,r}))}]});
const ру=d=>d.slice(8,10)+'.'+d.slice(5,7);
async function открыть(b,hist,last){
 const p=await b.newPage({viewport:{width:390,height:844}});
 if(last)await p.addInitScript(l=>{try{localStorage.setItem('shp_v1_shp_last',JSON.stringify(l))}catch(e){}},last);
 const o=opts('dark');o.page='gym';o.hist=hist;
 const err=await M.поднять(p,o);await p.waitForTimeout(500);
 await p.click('#dayseg button[data-day="D1"]');await p.waitForTimeout(300);
 await p.click('#list .exrow[data-pickex="0"]');await p.waitForTimeout(400);
 const к=await p.evaluate(()=>{const c=document.querySelector('#list .card.exact')||document;
  const rows=[...c.querySelectorAll('.setrow')];
  return {имя:(c.querySelector('h3,.exn,.exname')||{}).textContent||'',текст:c.innerText,
   дата:(c.querySelector('.lastline')||{}).textContent||'',совет:(c.querySelector('.rec')||{}).textContent||'',
   было:rows.map(r=>r.querySelector('.cb').textContent.trim()),
   w:rows.map(r=>(r.querySelector('input[data-f="w"]')||{}).placeholder),r:rows.map(r=>(r.querySelector('input[data-f="r"]')||{}).placeholder)}});
 return {p,err,к};
}
(async()=>{const b=await chromium.launch();try{
 // диапазон повторов приседа в программе стенда
 let {p,к}=await открыть(b,[],null);
 const m=к.текст.match(/(\d+)\s*×\s*(\d+)\s*[–-]\s*(\d+)/);const N=m?+m[1]:3,bot=m?+m[2]:8,top=m?+m[3]:12;await p.close();
 ok(!!m,'диапазон повторов прочитан: '+(m&&m[0]));

 // 1) его случай
 const стар={w:55,r:8,d:M.Д(21)};
 // как у него: 18.09 тяжелее, потом два занятия на 50, во втором повторов меньше
 ({p,к}=await открыть(b,[зап(21,[[60,top],[55,top],[55,bot]]),зап(14,[[50,top],[50,top],[50,top]]),зап(8,[[50,top-2],[50,top-2],[50,top-2]])],{['#'+ID]:стар,[ПРИСЕД]:стар}));
 ok(к.дата==='прошлый раз · '+ру(M.Д(8)),'дата прошлого раза — последнее занятие до сегодня, а не застрявшая запись: '+к.дата);
 ok(к.было.length===N&&к.было.slice(0,3).every(x=>x==='50×'+(top-2))&&к.было.slice(3).every(x=>x==='·'),'«было» — то же занятие (три подхода из '+N+'): '+JSON.stringify(к.было));
 ok(/Оставь 50 кг/.test(к.совет),'совет по тому же занятию: '+к.совет);
 ok(к.w.every(x=>x==='50')&&к.r.every(x=>x===String(top)),'в ячейках то же, что в совете — 50 кг × '+top+': '+JSON.stringify([к.w,к.r]));
 await p.close();

 // 2) совет поднимает вес: в ячейке новый вес, в «было» — факт
 ({p,к}=await открыть(b,[зап(7,Array.from({length:N},()=>[50,top]))],null));
 ok(/50\s*→\s*52,5 кг/.test(к.совет),'совет «50 → 52,5 кг»: '+к.совет);
 ok(к.w.every(x=>x==='52,5')&&к.r.every(x=>x===String(bot)),'ячейки — 52,5 × '+bot+', как в совете (его выбор «Совет»): '+JSON.stringify([к.w,к.r]));
 ok(к.было.every(x=>x==='50×'+top),'«было» — факт прошлого раза 50×'+top+': '+JSON.stringify(к.было));
 await p.close();

 // 3) сегодняшняя запись LAST — не «прошлый раз»
 ({p,к}=await открыть(b,[зап(8,[[50,top-2],[50,top-2],[50,top-2]])],{['#'+ID]:{w:70,r:5,d:M.TODAY,s:[[70,5]]},[ПРИСЕД]:{w:70,r:5,d:M.TODAY,s:[[70,5]]}}));
 ok(к.дата==='прошлый раз · '+ру(M.Д(8))&&к.было[0]==='50×'+(top-2),'сегодняшняя запись не считается прошлым разом: '+к.дата+' '+к.было[0]);
 await p.close();
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
