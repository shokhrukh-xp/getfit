'use strict';
// 07.10: снимки зала — ✓ на сделанных днях, итог вчерашнего дня, «Вне зала».
// GF_PORT=8941 node tg/shot-dni-galochki.js /tmp/dg   → /tmp/dg-1.png, /tmp/dg-2.png
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
const зап=(сдвиг,day,ex)=>({id:M.Д(сдвиг)+'_'+day,date:M.Д(сдвиг),day,dur:52,updated:new Date(M.Д(сдвиг)+'T19:10:00').toISOString(),ex});
const ex1=[{n:'Жим лёжа (наклон вверх, штанга)',unit:'reps',sets:[{w:80,r:8},{w:80,r:8},{w:80,r:7}]},
 {n:'Тяга верхнего блока',unit:'reps',sets:[{w:65,r:10},{w:65,r:10},{w:65,r:9}]},
 {n:'Жим гантелей сидя',unit:'reps',sets:[{w:22,r:10},{w:22,r:10},{w:22,r:9}]},
 {n:'Лестница',unit:'min',int:'mod',sets:[{w:null,r:15}]}];
const ex2=[{n:'Присед (штанга, глубокий)',unit:'reps',sets:[{w:60,r:12},{w:60,r:12},{w:60,r:12}]}];
(async()=>{const b=await chromium.launch();try{
 const o=opts('dark');o.page='gym';o.hist=[зап(1,'D1',ex1),зап(0,'D2',ex2)];
 const ТЕН=[{kind:'теннис',min:120,intensity:'mod',kcal:1226,plan:1}];o.todayPlan=ТЕН;o.day={...o.day,gymPlan:false,plan:ТЕН};
 const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 const err=await M.поднять(p,o);await p.waitForTimeout(500);
 const out=process.argv[2]||'/tmp/dg';
 await p.click('#dayseg button[data-day="D2"]');await p.waitForTimeout(200);
 await p.locator('#gym-work').screenshot({path:out+'-1.png',clip:undefined}).catch(async()=>{await p.screenshot({path:out+'-1.png'})});
 await p.click('#dayseg button[data-day="D1"]');await p.waitForTimeout(200);
 await p.screenshot({path:out+'-2.png',fullPage:true});
 console.log('ошибки:',err.join('|')||'нет');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
