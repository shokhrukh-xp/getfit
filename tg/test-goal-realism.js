/* 27.10: четыре нереалистичных запроса через настоящий сервер консультации. */
const {chromium}=require('playwright'),assert=require('assert/strict'),M=require('./mock');
async function ready(p){await p.waitForFunction(()=>document.getElementById('goalconversation').getAttribute('aria-busy')==='false');}
async function answer(p,v){await p.locator('[data-gta="answer"][data-value="'+v+'"]').click();await ready(p);}
(async()=>{
 const browser=await chromium.launch();try{
 for(const width of [320,390])for(const test of [
  {target:84.2,fat:5,muscle:'develop',reason:/5%.*восстановление/s,ids:['strength','habit']},
  {target:90.9,fat:12,muscle:'develop',reason:/16,8 кг.*63,2.*80 кг/s,ids:['strength','habit']},
  {target:50,muscle:'preserve',reason:/ИМТ около 15,8.*не диагноз/s,ids:['stage','habit']},
  {target:70,muscle:'preserve',days:14,reason:/15,8 кг за 14 дней.*7,9 кг в неделю.*37 недель/s,ids:['rescheduled','stage','habit']}
 ]){
  const p=await browser.newPage({viewport:{width,height:844}});
  const old={text:'80 кг · мышцы сохранить',wt:'down',gym:'strength',w0:85.8,kg:5.8,rate:-.3,from:M.TODAY,body:{v:1,target:80,fat:null,muscle:'preserve'}};
  const o={theme:width===320?'light':'dark',page:'home',me:{sex:'m',age:34,ht:178,bw:85.8,only:'all'},meas:[{date:M.TODAY,w:85.8,fat:26.3}],goal:old};
  const errors=await M.поднять(p,o);await p.click('#profbtn');await p.locator('#goalcard [data-bodygoal]').click();await ready(p);
  await answer(p,'custom');await answer(p,'clear');await p.fill('#gtalk-form [name="target"]',String(test.target));if(test.fat)await p.fill('#gtalk-form [name="fat"]',String(test.fat));await p.selectOption('#gtalk-form [name="muscle"]',test.muscle);await p.locator('#gtalk-form [type="submit"]').click();await ready(p);
  if(test.fat)await answer(p,'scales');await answer(p,'new');await answer(p,'regular');await answer(p,'training');await answer(p,test.days?'date':'flexible');
  if(test.days){const date=new Date(M.TODAY+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+test.days);await p.fill('#gtalk-form [name="date"]',date.toISOString().slice(0,10));await p.locator('#gtalk-form [type="submit"]').click();await ready(p);}
  assert.match(await p.textContent('#goalconversation'),test.reason);assert.deepEqual(await p.locator('[data-gta="select"]').evaluateAll(es=>es.map(e=>e.dataset.option)),test.ids);
  assert.equal(o.goal.text,old.text);assert.equal(await p.locator('[data-gta="image"]').count(),0);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.getElementById('goalconversation').scrollWidth<=document.getElementById('goalconversation').clientWidth),true,'объяснения читаемы без горизонтального скролла');
  const id=test.days?'rescheduled':test.ids[0];await p.locator('[data-gta="select"][data-option="'+id+'"]').click();await ready(p);assert.equal(o.goal.text,old.text);
  if(test.days)assert.match(await p.textContent('#goalconversation'),/без прежнего дедлайна.*отказываемся от срока/s);
  await p.locator('[data-gta="confirm"]').click();await ready(p);assert.equal(o.goal.consultation.option,id);assert.equal(await p.locator('[data-gta="image"]').count(),1);assert.equal((o.vizAsked?.render||[]).length,0);assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS четыре запроса на 320/390: объяснения, разные альтернативы, отдельное подтверждение, образ только после сохранения');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
