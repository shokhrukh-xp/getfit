'use strict';
/* 04.10: серверный вердикт и условный срок под планом. Не вычисляем их
   снова по замерам; отсутствие новых полей совместимо со старым ответом.
   17.10, его слова про низ «Тела» «выглядит ужасно и не понятно» и «у нас
   уже есть хороший график веса … отклонение от плана лучше там и
   показывать»: отклонение — скобкой на графике, под ним две строки —
   темп недели словами и срок цели («примерно» на дальнем горизонте). */
const {chromium}=require('playwright');
const M=require('./mock');
let плохо=0;
const дано=(ok,text)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+text);if(!ok)плохо++};
const цель={text:'75 кг',wt:'down',rate:-.6,from:M.Д(29),w0:92,by:'2027-02-17'};
const план={anchor:M.Д(14),anchorW:89,rate:-.6,gap:.4,onTrack:false,w0:92,kg:17};
const слова={'план':/^Средний вес за неделю −0,4 кг — в темпе плана ✓$/,'быстрее':/быстрее плана ✓$/,'медленнее':/— медленнее плана$/,
 'стоит':/— без снижения$/,'плато':/^Две недели без снижения веса$/,'мало':/^Мало замеров, чтобы судить о темпе$/};
(async()=>{
 const br=await chromium.launch();
 try{
  for(const state of ['стоит','плато','мало','план','медленнее','быстрее']){
   const page=await br.newPage({viewport:{width:390,height:900}});
   const progress={...план,verdict:{state,d0:state==='мало'?null:-0.4,text:'Вердикт: '+state},eta:{date:M.Д(-30),pace:-.45}};
   if(state==='мало'){delete progress.anchor;delete progress.gap;progress.eta=null;}
   const errors=await M.поднять(page,{theme:state==='плато'?'light':'dark',meas:M.замеры(),goal:цель,progress});
   const v=page.locator('#homebody .vztemp');
   дано(await page.locator('#homebody .vzverdict, #homebody .trend-sign').count()===0,'нет «▶ •» и раскрывашки вердикта');
   const первая=(await v.locator('p').first().innerText()).replace(/ /g,' ').trim();
   дано(слова[state].test(первая),'темп словами: '+первая);
   const cls=await v.locator('p').first().getAttribute('class');
   дано(cls.includes('warn')===['стоит','плато'].includes(state) && cls.includes('muted')===(state==='мало'),'выделение по состоянию: '+state);
   const срок=state==='мало' ? null : (await v.locator('.vzeta').innerText()).replace(/ /g,' ');
   дано(state==='мало' ? await v.locator('.vzeta').count()===0 : /^Цель 75 кг — к \d+ [а-я]+ при −0,5 кг в неделю$/.test(срок),'срок с целью и темпом, без eta скрыт: '+срок);
   дано(!(await v.innerText()).includes('Вердикт:'),'длинный серверный текст — тренеру, не сюда');
   if(state!=='мало'){
    const п=await page.locator('#homebody .vzgapl text').textContent();
    дано(п.replace(/ /g,' ')==='выше плана на 0,4 кг','отклонение от плана — на графике: '+п);
    дано(await page.locator('#homebody .vzgap').count()===1,'скобка между средней линией и планом');
   }
   дано(errors.length===0,'без ошибок браузера: '+state);
   if(state==='стоит'){await page.click('[data-vzv="fat"]');дано(await page.locator('.vztemp, .vzgapl').count()===0,'темп и отклонение веса не появляются у жира');}
   await page.close();
  }
  /* дальний срок — «примерно к месяцу»; «по плану» — без скобки, одной меткой; впереди — «ниже плана» */
  for(const [gap,onTrack,ждём,скобка] of [[0.2,true,'по плану',0],[-1.1,false,'ниже плана на 1,1 кг',1]]){
   const page=await br.newPage({viewport:{width:320,height:800}});
   await M.поднять(page,{meas:M.замеры(),goal:цель,progress:{...план,gap,onTrack,verdict:{state:'план',d0:-0.6},eta:{date:'2027-08-24',pace:-.3}}});
   дано((await page.locator('.vzgapl text').textContent()).replace(/ /g,' ')===ждём,'метка на графике: '+ждём);
   дано(await page.locator('.vzgap').count()===скобка,'скобка только при отклонении');
   дано(/^Цель 75 кг — примерно к августу 2027 при −0,3 кг в неделю$/.test((await page.locator('.vztemp .vzeta').innerText()).replace(/ /g,' ')),'дальний срок — месяц и «примерно»');
   дано(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'помещается на 320');
   await page.close();
  }
  for(const item of [
   {progress:план,visible:false},
   {progress:{...план,verdict:{state:'план',d0:-0.6,text:'<img src=x onerror=alert(1)>'},eta:{date:'2027-02-31'}},visible:true}
  ]){
   const page=await br.newPage({viewport:{width:320,height:800}});
   const errors=await M.поднять(page,{meas:M.замеры(),goal:цель,progress:item.progress});
   дано((await page.locator('.vztemp').count()>0)===item.visible,'старый ответ без новых полей не рисует пустую строку');
   дано(await page.locator('.vztemp img,.vztemp .vzeta').count()===0,'текст экранирован; невозможная дата не показана');
   дано(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'карточка помещается на узком экране');
   дано(errors.length===0,'без ошибок на неполном ответе');await page.close();
  }
 }finally{await br.close()}
 if(плохо){console.error('ПРОВАЛОВ: '+плохо);process.exitCode=1}else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e=>{console.error('УПАЛО:',e);process.exitCode=1});
