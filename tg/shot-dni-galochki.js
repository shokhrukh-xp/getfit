'use strict';
// 07.10: снимки зала — вчерашний и сегодняшний сделанные дни выглядят одинаково.
// GF_PORT=8941 node tg/shot-dni-galochki.js /tmp/dg   → /tmp/dg-1.png (вчера), /tmp/dg-2.png (сегодня)
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
const зап=(сдвиг,day,ex)=>({id:M.Д(сдвиг)+'_'+day,date:M.Д(сдвиг),day,dur:45,t0:new Date(M.Д(сдвиг)+'T18:00:00').toISOString(),updated:new Date(M.Д(сдвиг)+'T19:10:00').toISOString(),ex});
const три=(w,r)=>[{w,r},{w,r},{w,r}];
const d1=[{n:'Приседания со штангой',id:'Barbell_Squat',unit:'reps',sets:три(60,12)},{n:'Румынская тяга с гантелями',id:'Stiff-Legged_Dumbbell_Deadlift',unit:'reps',sets:три(26,10)},
 {n:'Жим ногами в тренажёре',unit:'reps',sets:три(95,12)}];
const d2=[{n:'Жим лёжа',id:'Barbell_Bench_Press_-_Medium_Grip',unit:'reps',sets:три(55,8)},{n:'Жим гантелей стоя',unit:'reps',sets:три(24,10)}];
(async()=>{const b=await chromium.launch();try{
 const o=opts('dark');o.page='gym';o.hist=[зап(1,'D1',d1),зап(0,'D2',d2)];
 const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 const err=await M.поднять(p,o);await p.waitForTimeout(500);
 const out=process.argv[2]||'/tmp/dg';
 await p.click('#dayseg button[data-day="D1"]');await p.waitForTimeout(200);
 await p.locator('#gym-work').scrollIntoViewIfNeeded();await p.screenshot({path:out+'-1.png'});
 await p.click('#dayseg button[data-day="D2"]');await p.waitForTimeout(200);
 await p.screenshot({path:out+'-2.png'});
 console.log('ошибки:',err.join('|')||'нет');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
