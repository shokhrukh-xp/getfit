/* 27.10: настоящее дерево сервера на SQLite, браузер — реальное приложение.
   Ни один ответ/выбор не сохраняет цель; после подтверждения фото только по желанию. */
const {chromium}=require('playwright'),assert=require('assert/strict'),M=require('./mock'),fs=require('fs'),path=require('path');
const OUT=process.env.GOAL_SCREENSHOTS||'/tmp/getfit-goal-dialog';fs.mkdirSync(OUT,{recursive:true});
async function click(page,action,value){const s='#goalconversation [data-gta="'+action+'"]'+(value?'[data-value="'+value+'"]':'');await page.locator(s).first().click();await page.waitForFunction(()=>document.getElementById('goalconversation').getAttribute('aria-busy')==='false');}
(async()=>{
 const br=await chromium.launch();try{
 for(const [width,theme] of [[320,'light'],[390,'dark']]){
  const page=await br.newPage({viewport:{width,height:844}});await page.route('**://cdn.jsdelivr.net/**',r=>r.abort());
  const old={text:'80 кг · мышцы сохранить',wt:'down',gym:'strength',w0:85.8,kg:5.8,rate:-.3,from:M.TODAY,body:{v:1,target:80,fat:null,muscle:'preserve'}};
  const o={theme,page:'home',me:{sex:'m',age:34,ht:178,bw:85.8,only:'all'},meas:[{date:M.TODAY,w:85.8,fat:26.3}],goal:old,viz:{ok:true,allowed:true,adult:true,consent:false,photo:null,goal:old}};
  const errors=await M.поднять(page,o);await page.click('#profbtn');await page.locator('#goalcard [data-bodygoal]').click();await page.waitForFunction(()=>document.getElementById('goalconversation').dataset.state!=='loading'&&document.getElementById('goalconversation').getAttribute('aria-busy')==='false');
  assert.equal(await page.locator('#goalconversation').isVisible(),true);assert.equal(await page.locator('#vizm').isVisible(),false);
  await click(page,'answer','loss');assert.equal(await page.evaluate(()=>document.getElementById('goalconversation').dataset.question),'health','заполненный профиль пропущен');
  await click(page,'answer','clear');await click(page,'answer','shape');
  await page.click('#coachclose');await page.locator('#profm').waitFor({state:'visible'});await page.locator('#goalcard [data-bodygoal]').click();await page.waitForFunction(()=>document.getElementById('goalconversation').dataset.state!=='loading'&&document.getElementById('goalconversation').getAttribute('aria-busy')==='false');assert.equal(await page.evaluate(()=>document.getElementById('goalconversation').dataset.question),'capacity','возвращение продолжает разговор');
  await click(page,'answer','regular');await click(page,'answer','steady');await click(page,'answer','flexible');
  assert.equal(o.goal.text,old.text);await page.locator('#goalconversation').screenshot({path:path.join(OUT,'options-'+width+'.png')});
  /* 28.10: у вариантов — темп, норма, белок и «сейчас …» (его просьба) */
  const строка=await page.locator('#goalconversation .gtalk-impact').first().textContent();
  assert.match(строка,/кг\/нед · [\d\u00a0]+ ккал · белок \d+ г \(сейчас /,'строка было → станет у варианта: '+строка);
  await click(page,'select');assert.equal(o.goal.text,old.text,'выбор ещё не сохранение');assert.equal(await page.evaluate(()=>document.getElementById('goalconversation').dataset.state),'confirm');
  /* 28.10: на шаге подтверждения — таблица было → станет, объяснение и итог на кнопке */
  const таблица=await page.locator('#goalconversation .gtalk-diff').textContent();
  for(const t of ['Темп','Норма в обычный день','Белок','→'])assert.ok(таблица.includes(t),'в блоке «Что изменится» есть «'+t+'»');
  assert.ok(await page.locator('#goalconversation .gtalk-why li').count()>=1,'есть объяснение «почему»');
  assert.match(await page.locator('[data-gta="confirm"]').textContent(),/^Сохранить: [\d\u00a0]+ ккал, (−|\+)?[\d,]+ кг\/нед|вес держим/,'кнопка называет итог');
  await page.locator('#goalconversation .gtalk-option').first().screenshot({path:path.join(OUT,'confirm-'+width+'.png')});
  await click(page,'confirm');assert.equal(o.goal.body.target,83.2);assert.equal((o.vizAsked?.render||[]).length,0,'сохранение не запустило генерацию');
  await page.locator('#goalconversation').screenshot({path:path.join(OUT,'saved-'+width+'.png')});
  assert.equal(await page.locator('#goalconversation [data-gta="image"]').count(),1);
  await click(page,'finish');assert.equal(await page.locator('#coachm').isVisible(),false);
  await page.locator('#profm').waitFor({state:'visible'});await page.click('#vizopen');assert.equal(await page.locator('#bodygoalm').isVisible(),false);assert.equal(await page.textContent('#viztitle'),'Образ выбранной цели');assert.equal((o.vizAsked?.render||[]).length,0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);await page.close();
 }
 const p=await br.newPage({viewport:{width:390,height:844}});const o={newbie:true,me:{only:'food'},meas:[],goal:null};await M.поднять(p,o);await p.locator('#wz-only [data-only="food"]').click();await p.click('#wz-only-go');await p.waitForFunction(()=>document.getElementById('goalconversation').dataset.state!=='loading'&&document.getElementById('goalconversation').getAttribute('aria-busy')==='false');await click(p,'answer','wellbeing');assert.equal(await p.evaluate(()=>document.getElementById('goalconversation').dataset.question),'age');await p.fill('#gtalk-form [name="age"]','31');await p.locator('#gtalk-form [type="submit"]').click();await p.waitForFunction(()=>document.getElementById('goalconversation').getAttribute('aria-busy')==='false');await click(p,'answer','clear');await click(p,'answer','routine');await click(p,'answer','food');await click(p,'answer','steady');await click(p,'answer','flexible');await click(p,'select');await click(p,'confirm');assert.equal(o.goal.kind,'habit');assert.equal(await p.locator('[data-gta="image"]').count(),0);await click(p,'finish');assert.equal(await p.locator('#picker').isVisible(),false);await p.close();
 console.log('PASS консультация в приложении: продолжение, выбор, подтверждение, необязательное фото, новичок без весовой цели');
 }finally{await br.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
