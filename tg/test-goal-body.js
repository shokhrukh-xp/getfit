'use strict';
/* Образ выбранной цели: параметры только для чтения; генерация явным действием.
   Несовпадающее старое фото не становится образом новой цели. */
const {chromium}=require('playwright'),assert=require('assert/strict'),M=require('./mock'),path=require('path'),fs=require('fs');
const OUT=process.env.GOAL_SCREENSHOTS||'/tmp/gf-goal-unified';fs.mkdirSync(OUT,{recursive:true});
(async()=>{const br=await chromium.launch();try{
 for(const [width,theme] of [[320,'light'],[390,'dark']]){
  const goal={text:'75 кг · 15% жира · мышцы сохранить',wt:'down',gym:'strength',w0:86.1,kg:11.1,rate:-.43,from:'2026-09-01',body:{v:1,target:75,fat:15,muscle:'preserve'}};
  const calc={ok:true,w0:86.1,w1:75,fat0:24,fat1:15,dl:-1.7,dlMin:-3,dlMax:3,пол:64,sex:'m',талия0:100,талия1:90,отношение:.9,талияД:10,талияОт:7,талияДо:13,срез:[]};
  const o={page:'home',theme,goal,me:{sex:'m',age:34,ht:178,bw:86.1,coach_at:'x'},viz:{ok:true,allowed:true,consent:true,adult:true,photo:1793001600000,goalLinked:true,goal,calc,result:{k:'saved',calc:{...calc,w1:78,fat1:18,visualVersion:5}}},onVizCalc:()=>o.viz.calc,vizImg:()=>path.join(__dirname,'fixtures/viz-0-ishod.jpg'),onVizRender:()=>({ok:false,error:'Пробный отказ генератора'})};
  const p=await br.newPage({viewport:{width,height:844}}),errors=await M.поднять(p,o);
  await p.click('#profbtn');assert.equal(await p.locator('#goalcard [data-bodygoal]').count(),1);await p.click('#vizopen');await p.waitForSelector('#vizph');
  assert.equal(await p.textContent('#viztitle'),'Образ выбранной цели');assert.equal(await p.locator('#bodygoalm').isVisible(),false);assert.equal(await p.locator('#vizcontrols').isVisible(),false);assert.equal(await p.locator('#vizgoaledit').isVisible(),true);
  assert.match(await p.textContent('#viznowmetrics'),/86,1 кг.*24% жира.*65,4 кг без жира/);assert.match(await p.textContent('#vizgoalmetrics'),/75 кг.*15% жира.*63,8 кг без жира/);
  assert.equal(await p.locator('#viznew').isVisible(),false);assert.match(await p.textContent('#vizph'),/Образ текущей цели ещё не создан/);assert.equal((o.vizAsked?.render||[]).length,0);
  await p.locator('#vizm .modalbox').screenshot({path:path.join(OUT,'image-'+width+'.png')});await p.click('#vizgo');await p.waitForFunction(()=>/Пробный отказ/.test(document.getElementById('vizmsg').textContent));assert.equal(o.goal.body.target,75);assert.equal(o.vizAsked.render.length,1);
  await p.click('#vizgoaledit');await p.waitForSelector('#goalconversation');assert.equal(await p.locator('#vizm').isVisible(),false);assert.equal(o.goal.body.target,75,'обсуждение изменения не сохраняет новую цель');await p.click('#coachclose');
  await p.locator('#profm').waitFor({state:'visible'});o.viz.left=0;o.viz.unlimited=false;await p.click('#vizopen');await p.waitForSelector('#vizquota:not([hidden])');assert.equal(await p.locator('#vizgo').isDisabled(),true);assert.equal(await p.locator('#vizgoaledit').isEnabled(),true,'лимит образов не мешает обсудить цель');
  await p.click('#vizclose');o.viz.left=5;o.viz.calc={ok:false,error:'Для образа нужно уточнить состав тела.'};await p.click('#vizopen');await p.waitForSelector('#bodygoalerror:visible');assert.match(await p.textContent('#bodygoalerror'),/уточнить состав/);assert.equal(await p.locator('#vizgo').isDisabled(),true);assert.equal(await p.locator('#vizgoaledit').isEnabled(),true);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);await p.close();
 }
 /* 27.10: полный путь кнопки при отказе проверки вида; ответы моделей подставные,
    сохранение/запросы/показ результата выполняет настоящий код страницы. */
 const retryPage=await br.newPage({viewport:{width:390,height:844}});
 const retryCalc={ok:true,w0:85.8,w1:75,fat0:26.3,fat1:12,fatTarget:12,lean0:63.23,lean1:66,dl:2.77,отношение:.842,срез:[],visualVersion:5};
 const retryGoal={text:'75 кг · 12% жира · мышцы развивать',body:{v:1,target:75,fat:12,muscle:'develop'}};
 let retryRenders=0,retrySelects=0;
 const retryOptions={page:'home',goal:retryGoal,me:{sex:'m',age:34,ht:178,bw:85.8,coach_at:'x'},viz:{ok:true,allowed:true,consent:true,adult:true,photo:1,goalLinked:true,goal:retryGoal,calc:retryCalc,left:8},onVizCalc:()=>retryCalc,vizImg:k=>k==='orig'?path.join(__dirname,'fixtures/viz-0-ishod.jpg'):path.join(OUT,'retry-image.jpg'),onVizRender:b=>{fs.writeFileSync(path.join(OUT,'retry-image.jpg'),Buffer.from(b.target,'base64'));return {ok:true,k:'retry'+(++retryRenders),calc:retryCalc,left:8-retryRenders};}};
 const retryErrors=await M.поднять(retryPage,retryOptions);
 await retryPage.route('**/viz/select',async route=>{retrySelects++;await route.fulfill({status:retrySelects===1?422:200,contentType:'application/json',body:JSON.stringify(retrySelects===1?{error:'Новый вариант не прошёл проверку тела и позы.',code:'viz_appearance'}:{ok:true})});});
 await retryPage.click('#profbtn');await retryPage.click('#vizopen');await retryPage.waitForSelector('#vizph');
 await retryPage.click('#vizgo');
 await retryPage.waitForFunction(()=>!document.getElementById('vizgo').disabled&&!document.getElementById('viznew').hidden);
 assert.equal(retryRenders,2);assert.equal(retrySelects,2);
 assert.match(await retryPage.textContent('#vizgoalmetrics'),/75 кг.*12% жира.*66 кг без жира/);
 assert.equal(await retryPage.locator('#viznew').isVisible(),true);assert.equal(await retryPage.locator('#vizph').isVisible(),false);
 assert.ok(retryOptions.vizAsked.render.every(b=>b.w===75&&b.fat===12));assert.equal(retryOptions.vizAsked.render[1].prev,'retry1');
 assert.deepEqual(retryErrors,[]);await retryPage.close();
 console.log('PASS образ после выбора: метрики, старое фото, явная генерация, повтор проверки, ошибка, лимит и изменение цели');
 }finally{await br.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
