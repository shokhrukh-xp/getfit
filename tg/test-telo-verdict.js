'use strict';
/* 04.10: серверный вердикт и условный срок под планом. Не вычисляем их
   снова по замерам; отсутствие новых полей совместимо со старым ответом. */
const {chromium}=require('playwright');
const M=require('./mock');
let плохо=0;
const дано=(ok,text)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+text);if(!ok)плохо++};
const цель={text:'75 кг',wt:'down',rate:-.6,from:M.Д(29),w0:92,by:'2027-02-17'};
const план={anchor:M.Д(14),anchorW:89,rate:-.6,gap:.4,onTrack:false};
(async()=>{
 const br=await chromium.launch();
 try{
  for(const state of ['стоит','плато','мало','план','медленнее','быстрее']){
   const page=await br.newPage({viewport:{width:390,height:900}});
   const progress={...план,verdict:{state,text:'Вердикт: '+state},eta:{date:'2027-02-17',pace:.45}};
   if(state==='мало'){delete progress.anchor;delete progress.gap;progress.eta=null;}
   const errors=await M.поднять(page,{theme:state==='плато'?'light':'dark',meas:M.замеры(),goal:цель,progress});
   const v=page.locator('#homebody .vzverdict');
   дано(!await v.locator('details').evaluate(e=>e.open),'подробный вердикт сначала свёрнут');
   await v.locator('summary').click();
   дано(await v.count()===1 && (await v.innerText()).includes('Вердикт: '+state),'серверный вердикт виден: '+state);
   const cls=await v.getAttribute('class');
   дано((cls.includes('warn'))===['стоит','плато'].includes(state) && cls.includes('muted')===(state==='мало'),'выделение по состоянию: '+state);
   дано(state==='мало' ? await v.locator('.vzeta').count()===0 : (await v.innerText()).includes('при текущем темпе — к 17 февраля 2027'),'срок условный, не обещание; без eta скрыт: '+state);
   дано(errors.length===0,'без ошибок браузера: '+state);
   if(state==='стоит'){await page.click('[data-vzv="fat"]');дано(await page.locator('.vzverdict').count()===0,'вердикт веса не появляется у жира');}
   await page.close();
  }
  for(const item of [
   {progress:план,visible:false},
   {progress:{...план,verdict:{state:'план',text:'<img src=x onerror=alert(1)>'},eta:{date:'2027-02-31'}},visible:true}
  ]){
   const page=await br.newPage({viewport:{width:320,height:800}});
   const errors=await M.поднять(page,{meas:M.замеры(),goal:цель,progress:item.progress});
   дано((await page.locator('.vzverdict').count()>0)===item.visible,'старый ответ без новых полей не рисует пустую строку');
   дано(await page.locator('.vzverdict img,.vzeta').count()===0,'текст экранирован; невозможная дата не показана');
   дано(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'карточка помещается на узком экране');
   дано(errors.length===0,'без ошибок на неполном ответе');await page.close();
  }
 }finally{await br.close()}
 if(плохо){console.error('ПРОВАЛОВ: '+плохо);process.exitCode=1}else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e=>{console.error('УПАЛО:',e);process.exitCode=1});
