'use strict';
/* 04.10: серверный вердикт и условный срок под планом. Не вычисляем их
   снова по замерам; отсутствие новых полей совместимо со старым ответом.
   17.10, его слова про низ «Тела» «выглядит ужасно и не понятно» и «у нас
   уже есть хороший график веса … отклонение от плана лучше там и
   показывать»: отклонение — скобкой на графике, под ним две строки —
   темп недели словами и срок цели («примерно» на дальнем горизонте).
   28.10, его «текста должно быть минимум… визуальные элементы»: неделя — плиткой
   «За неделю −0,4 кг» с цветной отметкой, срок — полосой времени и одной
   отметкой «Успеваете / Отстаёте» вместо строки «Цель — к …». */
const {chromium}=require('playwright');
const M=require('./mock');
let плохо=0;
const дано=(ok,text)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+text);if(!ok)плохо++};
const цель={text:'75 кг',wt:'down',rate:-.6,from:M.Д(29),w0:92,by:'2027-02-17'};
const план={anchor:M.Д(14),anchorW:89,rate:-.6,gap:.4,onTrack:false,w0:92,kg:17};
const ПЛИТКА={'план':['в темпе плана','ok'],'быстрее':['быстрее плана','ok'],'медленнее':['медленнее плана','edge'],'стоит':['без снижения','warn'],'плато':['две недели без снижения','warn']};
const слова={'план':/^Средний вес за неделю −0,4 кг — в темпе плана ✓$/,'быстрее':/быстрее плана ✓$/,'медленнее':/— медленнее плана$/,
 'стоит':/— без снижения$/,'плато':/^Две недели без снижения веса$/,'мало':/^Мало замеров, чтобы судить о темпе$/};
/* подпись скобки согласована с рисунком: «выше» — средняя над пунктиром плана в той же точке */
const сверить=async(page,где)=>{
 /* 17.10, его выбор «Плашка на графике веса»: фраза — строкой над графиком, у скобки только «+1,7» без плашки */
 const r=await page.evaluate(()=>{const sv=document.querySelector('#homebody .vzsvg svg');const line=document.querySelector('#homebody .vzgapline');if(!line)return null;
  const t=sv.querySelector('.vzgapl');let м=line.textContent.replace(/\u00a0/g,' ');м=м==='Идёшь по плану'?'по плану':м.charAt(0).toLowerCase()+м.slice(1);
  const к=[...sv.querySelectorAll('circle')].find(c=>c.getAttribute('r')==='4.5'),пл=sv.querySelector('.vzpl');
  const cx=+к.getAttribute('cx'),cy=+к.getAttribute('cy'),x1=+пл.getAttribute('x1'),y1=+пл.getAttribute('y1'),x2=+пл.getAttribute('x2'),y2=+пл.getAttribute('y2');
  const yп=y1+(y2-y1)*(cx-x1)/(x2-x1);return {м,к:t?t.textContent:null,над:cy<yп,dy:Math.abs(cy-yп),скобка:sv.querySelectorAll('.vzgap').length,плашка:sv.querySelectorAll('.vzgapl rect, g.vzgapl').length};});
 дано(!!r,'метка отклонения на графике '+где);if(!r)return '';
 дано(r.м==='по плану' ? r.скобка===0 : (r.м.startsWith('выше')===r.над && (r.скобка===1||r.dy<8)),'подпись не спорит с рисунком: «'+r.м+'» '+где);
 дано(r.плашка===0,'плашки на графике нет '+где);
 дано(r.м==='по плану' ? r.к===null : (r.скобка===0 || (r.к && r.к.charAt(0)===(r.м.startsWith('выше')?'+':'−') && r.м.includes(r.к.slice(1)))),'у скобки — коротко и тем же числом: «'+r.к+'» '+где);
 return r.м;
};
(async()=>{
 const br=await chromium.launch();
 try{
  for(const state of ['стоит','плато','мало','план','медленнее','быстрее']){
   const page=await br.newPage({viewport:{width:390,height:900}});
   const progress={...план,verdict:{state,d0:state==='мало'?null:-0.4,text:'Вердикт: '+state},eta:{date:M.Д(-30),pace:-.45}};
   if(state==='мало'){delete progress.anchor;delete progress.gap;progress.eta=null;}
   const errors=await M.поднять(page,{theme:state==='плато'?'light':'dark',meas:M.замеры(),goal:цель,progress});
   дано(await page.locator('#homebody .vzverdict, #homebody .trend-sign').count()===0,'нет «▶ •» и раскрывашки вердикта');
   if(state==='мало'){
    const p=page.locator('#homebody .vztemp p').first(),первая=(await p.innerText()).replace(/\u00a0/g,' ').trim();
    дано(слова[state].test(первая)&&(await p.getAttribute('class')).includes('muted'),'мало замеров — серой строкой: '+первая);
    дано(await page.locator('#homebody .vzweek, #homebody .pth').count()===0,'без плитки недели и без полосы, когда eta нет');
   } else {
    const ж=ПЛИТКА[state], w=page.locator('#homebody .vzweek');
    const t=(await w.innerText()).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim(), cls=await w.locator('em').getAttribute('class');
    дано(/^За неделю −0,4 кг/.test(t)&&t.endsWith(ж[0])&&cls===ж[1],'неделя плиткой: «'+t+'» · '+cls);
    дано(await page.locator('#homebody .pth .pth-band, #homebody .pth .pth-dot').count()===1&&await page.locator('#homebody .pth-flag').count()===1,'срок — полосой: темп и флажок срока');
    дано(/^Успеваете/.test((await page.locator('#homebody .pth-st').innerText()).trim()),'одна отметка: успеваете');
   }
   дано(!(await page.locator('#homebody').innerText()).includes('Вердикт:'),'длинный серверный текст — тренеру, не сюда');
   if(state!=='мало') await сверить(page,'состояние '+state);
   дано(errors.length===0,'без ошибок браузера: '+state);
   if(state==='стоит'){await page.click('[data-vzv="fat"]');дано(await page.locator('.vztemp, .vzweek, #homebody .pth, .vzgapl, .vzgapline').count()===0,'темп и отклонение веса не появляются у жира');}
   await page.close();
  }
  /* дальний срок — «примерно к месяцу»; ниже / выше плана; редкие замеры (ревью Codex U1): подпись
     и скобка — из одних и тех же двух точек, знак не противоречит рисунку */
  const редкие=[{date:M.Д(14),w:89.2},{date:M.Д(8),w:90},{date:M.Д(6),w:88},{date:M.Д(2),w:87}];
  for(const [anchorW,meas,ждём] of [[92,M.замеры(),/^ниже плана на \d/],[85.5,M.замеры(),/^выше плана на \d/],[89.2,редкие,/^(по плану|выше)/]]){
   const page=await br.newPage({viewport:{width:320,height:800}});
   await M.поднять(page,{meas,goal:цель,progress:{...план,anchorW,gap:-0.5,onTrack:false,verdict:{state:'план',d0:-0.6},eta:{date:'2027-08-24',pace:-.3}}});
   const м=await сверить(page,'якорь '+anchorW);
   дано(ждём.test(м),'метка на графике: '+м);
   дано(/^Отстаёте на \d+ недел/.test((await page.locator('#homebody .pth-st').innerText()).replace(/\s+/g,' ').trim())&&await page.locator('#homebody .pth-flag.late').count()===1,'дальний срок: темп правее флажка — «Отстаёте»');
   дано(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'помещается на 320');
   await page.close();
  }
  /* ревью Codex U2: цель «набрать» — без прибавки; вывод по талии — словами сервера, не «темп веса» */
  for(const [goal,v,ждём] of [[{...цель,rate:.5},{state:'плато',d0:0.05},/две недели без прибавки$/],[{...цель,rate:.5},{state:'стоит',d0:0.0},/^без прибавки$/],
   [цель,{state:'план',by:'талия',text:'По талии: −1,2 см за 14 дн. (95 → 93,8) — жир уходит. Весов мало, поэтому вывод по сантиметру.'},/^По талии: −1,2 см за 14 дн\. \(95 → 93,8\) — жир уходит( ✓)?$/]]){
   const page=await br.newPage({viewport:{width:320,height:800}});
   await M.поднять(page,{meas:M.замеры(),goal,progress:{...план,rate:goal.rate,verdict:v}});
   const т=(await page.locator('.vzweek em, .vztemp p').first().innerText()).replace(/\u00a0/g,' ').trim();
   дано(ждём.test(т),'направление и источник вывода: '+т);await page.close();
  }
  for(const item of [
   {progress:план,visible:false},
   {progress:{...план,verdict:{state:'план',d0:-0.6,text:'<img src=x onerror=alert(1)>'},eta:{date:'2027-02-31'}},visible:true}
  ]){
   const page=await br.newPage({viewport:{width:320,height:800}});
   const errors=await M.поднять(page,{meas:M.замеры(),goal:цель,progress:item.progress});
   дано((await page.locator('.vztemp, .vzweek').count()>0)===item.visible,'старый ответ без новых полей не рисует пустую строку');
   дано(await page.locator('.vztemp img,.vztemp .vzeta,#homebody .pth').count()===0,'текст экранирован; невозможная дата не показана');
   дано(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'карточка помещается на узком экране');
   дано(errors.length===0,'без ошибок на неполном ответе');await page.close();
  }
 }finally{await br.close()}
 if(плохо){console.error('ПРОВАЛОВ: '+плохо);process.exitCode=1}else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e=>{console.error('УПАЛО:',e);process.exitCode=1});
