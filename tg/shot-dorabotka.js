'use strict';
// Синтетический стенд; реальные аккаунты и фотографии не используются.
const{chromium}=require('playwright'),M=require('./mock'),{fixture}=require('./test-ui-dorabotka'),{opts}=require('./shot-clean'),fs=require('fs'),path=require('path');
const out=process.argv[2];if(!out)throw Error('Нужна папка снимков');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch();try{for(const theme of ['light','dark'])for(const width of [320,390]){
 const p=await b.newPage({viewport:{width,height:844},deviceScaleFactor:2});const home=fixture(theme);home.chat=[{role:'assistant',text:'Могу помочь с едой, тренировкой или новым замером. Напиши, что хочешь обсудить.'}];await M.поднять(p,home);
 const shot=async name=>p.screenshot({path:path.join(out,`${name}-${theme}-${width}.png`)});
 await shot('home');await p.locator('.hweek-block').scrollIntoViewIfNeeded();await shot('week');
 await p.locator('.vz').scrollIntoViewIfNeeded();await shot('body');
 await p.locator('#coachnav').click();await p.locator('#chatlog').getByText('Могу помочь с едой', {exact:false}).waitFor();await shot('coach');await p.close();
 const q=await b.newPage({viewport:{width,height:844},deviceScaleFactor:2}),o=fixture(theme);o.day.kcal=1000;o.score={r:8.4,why:[{t:'калории',совет:'по оставшимся калориям'}]};
 o.day.meals=o.day.meals.map((m,i)=>({...m,kcal:200,prot:38.2,t:['10:26','10:28','10:29','10:31','10:32'][i]}));await M.поднять(q,o);
 await q.locator('.hdaycard').screenshot({path:path.join(out,`cluster-plans-${theme}-${width}.png`)});await q.close();
 for(const state of ['ordinary','free']){
  const r=await b.newPage({viewport:{width,height:844},deviceScaleFactor:2}),f=opts(theme);if(state==='free')f.free=[M.TODAY];
  await M.поднять(r,f);await r.screenshot({path:path.join(out,`home-${state}-${theme}-${width}.png`)});await r.close();
 }
}}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
