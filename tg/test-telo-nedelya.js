'use strict';
// 07.10 B4/B7: подписи, один день меню, переход из недели и один честный статус.
const {chromium}=require('playwright'),M=require('./mock'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),viewport=require('./viewport-check'),contrast=require('./contrast-check');
const shots=process.env.GF_WEEK_SHOTS;if(shots)fs.mkdirSync(shots,{recursive:true});let bad=0;
const give=(r,d,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(d)});
const days=Array.from({length:7},(_,i)=>({date:M.Д(-i-1),зал:i%2===0,спорт:[],норма:{kcal:2100,prot:160},kcal:1900+i*10,prot:150,приёмы:[{id:'meal'+i,kind:'обед',text:'Меню дня '+i,kcal:1900+i*10,prot:150,items:[]}]}));
const menu={span:'week',from:days[0].date,дни:days,note:'Комментарий сервера',покупки:{отделы:[],дома:[]}};
async function snap(p,n,t,w){assert.deepEqual(await viewport(p),[]);const c=await contrast(p);assert.deepEqual(c.failures,[]);if(shots)await p.screenshot({path:path.join(shots,`${n}-${t}-${w}.png`)});}
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390])for(const name of (process.env.GF_WEEK_CASE||'labels,menu,week,save').split(',')){
 const p=await b.newPage({viewport:{width,height:844}});p.setDefaultTimeout(5000);
 try{
 let reads=[],sent=[],held=[],hold=false;
 const errors=await M.поднять(p,{theme,page:name==='menu'?'eat':name==='week'?'food':name==='save'?'gym':'home',meas:M.замеры().map(m=>({...m,waist:95})),menu:{завтра:days[0].date,week:menu},handleRoute:async r=>{
  const u=new URL(r.request().url()),date=u.searchParams.get('date');
  if(u.pathname==='/day'||u.pathname==='/day/score'){
   reads.push([u.pathname,date]);if(hold&&date===M.Д(1)){held.push(r);return true;}
   await give(r,u.pathname==='/day'?{ok:true,day:M.день({date,meals:[{id:date,text:'Запись '+date,kcal:500,prot:30,t:'12:00'}]})}:{ok:true,date,r:8,n:2,closed:date<M.TODAY,why:[],приёмы:[]});return true;
  }
  if(u.pathname==='/coach'){const d=JSON.parse(r.request().postData());sent.push(d);await give(r,{ok:true,reply:'Записал'});return true;}return false;
 }});
 if(name==='labels'){
  assert.equal(await p.locator('[data-vzv="prot"]').innerText(),'белок тела');await p.click('[data-vzv="prot"]');await p.locator('.vzhd').scrollIntoViewIfNeeded();await snap(p,'body-protein',theme,width);
  await p.goto(M.БАЗА+'?srez=1');await p.locator('#srezm.show').waitFor();assert.equal(await p.locator('#srtitle').innerText(),'Изменения тела');await snap(p,'body-changes',theme,width);
 }else if(name==='menu'){
  await p.click('[data-eseg="week"]');await p.locator('[data-menu-day]').first().waitFor();assert.equal(await p.locator('[data-menu-day]').count(),7);assert.equal(await p.locator('#eatbody .mnrow').count(),1);
  const dates=await p.locator('[data-menu-day]').evaluateAll(bs=>bs.map(b=>b.dataset.menuDay));assert.deepEqual(dates,days.map(d=>d.date));
  assert.deepEqual(await p.locator('[data-menu-day] b').allTextContents(),days.map(d=>['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][new Date(d.date+'T12:00:00').getDay()].toLowerCase()));
  await snap(p,'menu-week-first',theme,width);
  for(let i=0;i<7;i++){await p.click(`[data-menu-day="${days[i].date}"]`);assert.equal(await p.locator('#eatbody .mnrow').count(),1);assert((await p.locator('#eatbody .mnrow').innerText()).includes('Меню дня '+i));assert.equal(await p.locator(`[data-menu-day="${days[i].date}"]`).getAttribute('aria-pressed'),'true');}
  await p.click('[data-eseg="buy"]');await p.click('[data-eseg="week"]');assert.equal(await p.locator(`[data-menu-day="${days[6].date}"]`).getAttribute('aria-pressed'),'true');await snap(p,'menu-week-last',theme,width);
 }else if(name==='week'){
  const rows=p.locator('#fweek button[data-food-day]');assert.equal(await rows.count(),7);await rows.first().scrollIntoViewIfNeeded();await snap(p,'food-week',theme,width);
  reads=[];hold=true;await p.click(`[data-food-day="${M.Д(1)}"]`);await p.click(`[data-food-day="${M.Д(2)}"]`);await p.waitForFunction(d=>document.querySelector('#fmeals').textContent.includes('Запись '+d),M.Д(2));
  assert(reads.some(([u,d])=>u==='/day'&&d===M.Д(2)));assert(reads.some(([u,d])=>u==='/day/score'&&d===M.Д(2)));
  for(const r of held){const u=new URL(r.request().url());await give(r,u.pathname==='/day'?{ok:true,day:M.день({date:M.Д(1),meals:[]})}:{ok:true,date:M.Д(1),r:1,n:2,why:[]});}hold=false;
  await p.waitForTimeout(100);assert((await p.locator('#fmeals').innerText()).includes('Запись '+M.Д(2)),'Поздний ответ не откатывает дату');
  await snap(p,'food-selected',theme,width);await p.click('#food-add');assert.equal(await p.locator('#coachdate').getAttribute('data-date'),M.Д(2));await p.fill('#ctext','Ужин за выбранный день');await p.click('#csend');await p.waitForFunction(()=>document.querySelector('#chatlog').textContent.includes('Записал'));assert.equal(sent[0].date,M.Д(2));await p.click('#coachclose');
  await p.click('[data-fnav="1"]');await p.waitForFunction(d=>document.querySelector('#fmeals').textContent.includes('Запись '+d),M.Д(1));
 }else{
  await p.click('#ordopen');await p.click('[data-orddn="0"]');await p.click('#orddone');await p.waitForFunction(()=>document.querySelector('#dbnote').textContent.includes('Сохранено: правки в облаке'));
  assert.equal(await p.locator('#day-save-status .save-notice').count(),0);await p.locator('#dbnote').scrollIntoViewIfNeeded();await snap(p,'save-cloud',theme,width);
  /* 09.10, его выбор «Статус по серверу»: копия в Telegram не легла, а сервер
     принял — строка зелёная; красное — только когда не принял сервер */
  await p.evaluate(()=>{window.__oldSet=Telegram.WebApp.CloudStorage.setItem;Telegram.WebApp.CloudStorage.setItem=(k,v,cb)=>cb('temporary failure',false);});
  await p.click('#ordopen');await p.click('[data-orddn="0"]');await p.click('#orddone');await p.waitForFunction(()=>document.querySelector('#dbnote').textContent.includes('Сохранено: правки в облаке'));
  assert(!(await p.locator('#dbnote').innerText()).includes('не дошли'),'сбой копии в Telegram не красит строку');
  const сбойS=u=>u.pathname==='/s', ответ503=r=>r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});
  await p.route(сбойS,ответ503);
  await p.click('#ordopen');await p.click('[data-orddn="0"]');await p.click('#orddone');await p.waitForFunction(()=>document.querySelector('#dbnote').textContent.includes('правки не дошли в облако'));await p.locator('#dbnote').scrollIntoViewIfNeeded();await snap(p,'save-error',theme,width);
  await p.unroute(сбойS,ответ503);await p.evaluate(()=>Telegram.WebApp.CloudStorage.setItem=window.__oldSet);await p.click('#ordopen');await p.click('[data-orddn="0"]');await p.click('#orddone');await p.waitForFunction(()=>document.querySelector('#dbnote').textContent.includes('Сохранено: правки в облаке'));assert(!(await p.locator('#dbnote').innerText()).includes('не дошли'));await p.waitForTimeout(3200);assert((await p.locator('#dbnote').innerText()).includes('сохранено на телефоне'));
  await p.route(сбойS,ответ503);
  await p.locator('#list [data-pickex]').filter({hasNot:p.locator('.sstag')}).first().click();await p.locator('[data-nope]').first().click();await p.locator('[data-noped]').first().click();await p.locator('[data-selfpick]').waitFor();
  await p.waitForFunction(()=>document.querySelector('#dbnote .db-save-tail')?.textContent.includes('правки не дошли в облако'));assert(await p.locator('[data-selfpick]').isVisible(),'Ошибка сохранения не убирает выбор замены');

 }
 assert.deepEqual(errors,[]);console.log('ok',name,theme,width);
 }catch(e){bad++;console.error('FAIL',name,theme,width,e.stack);}finally{await p.close();}
}
}finally{await b.close();}process.exitCode=bad?1:0;})().catch(e=>{console.error(e);process.exitCode=1});
