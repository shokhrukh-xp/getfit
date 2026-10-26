'use strict';
/* 26.10: одна цель хранится на сервере и используется в другом сеансе и в фото. */
const {chromium}=require('playwright'),assert=require('assert/strict'),M=require('./mock'),path=require('path');
(async()=>{
 const br=await chromium.launch();let goal={text:'75 кг · 15% жира · мышцы сохранить',wt:'down',gym:'strength',w0:86.1,kg:11.1,rate:-.43,from:'2026-09-01',body:{v:1,target:75,fat:15,muscle:'preserve'}},last,error=false;
 const progress={forecast:{text:'Предварительно: 01.03 — 01.05. Это прогноз достижения веса.'}};
 try{for(const [width,theme] of [[320,'light'],[390,'dark']]){
  const page=await br.newPage({viewport:{width,height:844}});
  const calc={ok:true,w0:86.1,w1:75,fat0:24,fat1:15,dl:-1.7,dlMin:-3,dlMax:3,пол:64,sex:'m',талияД:10,талияОт:7,талияДо:13,срез:[]};
  const o={page:'home',theme,goal,progress,viz:{ok:true,allowed:true,consent:true,adult:true,photo:1,goalLinked:true,goal,calc,result:{k:'saved',calc:{...calc,w1:78,fat1:18,visualVersion:5}}},onVizCalc:()=>calc,vizImg:()=>path.join(__dirname,'fixtures/viz-0-ishod.jpg'),me:{sex:'m',age:34,ht:178,bw:86.1,wt:'down',gym:'strength',coach_at:'x'},onGoalSave:b=>{last=b;if(error)return {ok:false,error:'Нет связи — повторите'};goal={...goal,text:b.target+' кг · мышцы '+(b.muscle==='develop'?'развивать':'сохранить'),body:{v:1,target:b.target,fat:b.fat,muscle:b.muscle}};o.goal=goal;return {ok:true,goal,progress};}};
  const errors=await M.поднять(page,o);await page.waitForTimeout(900);await page.click('[data-vzv="fat"]');await page.waitForTimeout(200);assert.match(await page.textContent('#homebody .vzg-goal'),/15/);assert.match(await page.textContent('#homebody .vzg-goal'),/11,3/);await page.click('#profbtn');await page.waitForTimeout(600);
  await page.click('#goalcard [data-bodygoal]');assert.equal(await page.inputValue('#bodygoalweight'),'75');
  await page.screenshot({path:'/tmp/gf-goal-body/goal-initial-'+width+'.png'});
  await page.fill('#bodygoalweight','76');await page.fill('#bodygoalfat','');await page.selectOption('#bodygoalmuscle','develop');
  error=true;await page.click('#bodygoalsave');await page.waitForTimeout(300);assert.match(await page.textContent('#bodygoalerror'),/Нет связи/);assert.equal(goal.body.target,75);
  error=false;await page.click('#bodygoalsave');await page.waitForTimeout(400);
  assert.equal(last.bodyGoal,true);assert.equal(last.fat,null);assert.equal(goal.body.muscle,'develop');assert.equal(await page.locator('#bodygoalm').evaluate(x=>x.classList.contains('show')),false);
  await page.click('#goalcard [data-bodygoal]');assert.equal(await page.inputValue('#bodygoalweight'),'76');assert.equal(await page.inputValue('#bodygoalfat'),'');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'/tmp/gf-goal-body/goal-'+width+'.png'});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#bodygoalm').evaluate(x=>x.classList.contains('show')),false);
  await page.click('#vizopen');await page.waitForTimeout(800);
  assert.equal(await page.locator('#vizcontrols').isVisible(),false);assert.equal(await page.locator('#vizgoaledit').isVisible(),true);
  assert.match(await page.textContent('#vizmsg'),/прежней цели/);assert.match(await page.textContent('#viznums'),/75/);
  await page.screenshot({path:'/tmp/gf-goal-body/photo-goal-'+width+'.png'});
  await page.click('#vizgoaledit');assert.equal(await page.inputValue('#bodygoalweight'),'76');
  assert.deepEqual(errors,[]);await page.close();
  goal={...goal,body:{v:1,target:75,fat:15,muscle:'preserve'}};
 }
 const newbie=await br.newPage({viewport:{width:390,height:844}});
 await M.поднять(newbie,{newbie:true,onGoalSave:()=>({ok:false,error:'Выберите поддержание без цели по жиру'})});
 await M.шаги(newbie,{до:'goal',age:34,ht:178,bw:86});await newbie.click('#g-go');await newbie.waitForTimeout(400);
 assert.match(await newbie.textContent('#g-why'),/поддержание без цели/);await newbie.close();
 console.log('PASS общая цель: обе темы 320/390, сохранение и отказ, жир необязателен, мышцы, повторное открытие и Escape');
 }finally{await br.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
