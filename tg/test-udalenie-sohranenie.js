'use strict';
/* B1/B6. Только mock: серверный снимок моделируем целиком, без /meal/add. */
const {chromium}=require('playwright'),M=require('./mock'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),viewport=require('./viewport-check');
const shots=process.env.GF_UNDO_SHOTS;if(shots)fs.mkdirSync(shots,{recursive:true});let fails=0;
const until=async fn=>{for(let i=0;i<500;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Не пришёл запрос');};
const give=(r,d,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(d)});
const meal={id:'original',date:M.Д(1),t:'09:53',kind:'завтрак',text:'Омлет',kcal:300,prot:22,fat:17,fib:3,carb:8,sug:2,img:'/p/a.jpg',note:'Без масла',hide:1,items:[],src:'photo'};
const prog={name:'Своя программа',note:'',days:[{s:'День 1',sub:'Грудь',ex:[{id:'Barbell_Bench_Press_-_Medium_Grip',n:'Жим лёжа',en:'Barbell Bench Press - Medium Grip',m:'chest',q:'barbell',p:'Грудь',sets:3,reps:'8–12',rest:60},{id:'Pushups',n:'Отжимания',en:'Pushups',m:'chest',q:'body only',p:'Грудь',sets:3,reps:'10–15',rest:60}]}]};
async function snap(p,name,theme,width){assert.deepEqual(await viewport(p),[],'Видимые элементы внутри экрана');if(shots)await p.screenshot({path:path.join(shots,`${name}-${theme}-${width}.png`)});}
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390])for(const name of (process.env.GF_UNDO_CASE||'meal,network,edit,gym,gym-day,extra,auto').split(',')){
 const p=await b.newPage({viewport:{width,height:844}});p.setDefaultTimeout(5500);
 try{
 let rows=[structuredClone(meal)],saved=[],ops=[],release=null,delay=name!=='network',restoreBad=name!=='network',saveBad=true;
 const report=date=>M.день({date,meals:rows.filter(x=>x.date===date)});
 const o={theme,page:['gym','gym-day','extra'].includes(name)?'gym':'food',hist:[],...(['gym','gym-day','extra'].includes(name)?{profile:'ai',prog:name==='gym-day'?{...prog,days:[...prog.days,{...prog.days[0],s:'День 2'}]}:prog}:{}),...(name==='extra'?{layer:{extra:{A1:[{id:'bonus',i:'Plank',n:'Планка',e:'Plank',m:'abdominals',sets:2,reps:'30 с',rest:60}]}}}:{}),handleRoute:async r=>{
 const u=new URL(r.request().url()),body=()=>JSON.parse(r.request().postData()||'{}');
 if(u.pathname==='/day'){await give(r,{ok:true,day:report(u.searchParams.get('date'))});return true;}
 if(u.pathname==='/meal/del'){
  const d=body();ops.push(['del',d]);if(delay)await new Promise(res=>release=res);rows=rows.filter(x=>x.id!==d.id);if(name==='network'){await r.abort('failed');return true;}await give(r,{ok:true,day:report(meal.date)});return true;
 }
 if(u.pathname==='/meal/restore'){
  const d=body();ops.push(['restore',d]);if(restoreBad){await give(r,{error:'Временно недоступно'},503);return true;}
  assert.equal(d.operation,ops.find(x=>x[0]==='del')[1].operation);rows=[structuredClone(meal)];await give(r,{ok:true,day:report(meal.date)});return true;
 }
 if(u.pathname==='/meal/upd'){const d=body();saved.push(d);if(saveBad){await give(r,{error:'Не удалось сохранить'},503);return true;}rows=[{...meal,...d}];await give(r,{ok:true,day:report(d.date)});return true;}
 if(u.pathname==='/meal/add')throw new Error('Возврат не должен пересоздавать приём');
 return false;
 }};
 const errors=await M.поднять(p,o);
 if(name==='meal'||name==='edit'||name==='network'){
 await p.click('[data-fnav="-1"]');await p.locator('[data-mid="original"]').waitFor();await p.click('[data-mid="original"] .ft');
 if(name==='network'){
  await p.click('#mv-del');await p.waitForFunction(()=>document.querySelector('.undo-row span')?.textContent.includes('Не удалось подтвердить'));
  await p.click('.undo-row button');await p.locator('[data-mid="original"]').waitFor();await p.waitForFunction(()=>!document.querySelector('.undo-row'));assert.deepEqual(rows,[meal]);assert.equal(ops.length,2);
 }else if(name==='meal'){
  await p.click('#mv-del');assert.equal(await p.locator('[data-mid="original"]').count(),0,'Удаление видно до ответа');
  await until(()=>release);await p.click('.undo-row button');assert.equal(ops.length,1,'Возврат ждёт удаления');release();release=null;
  await p.waitForFunction(()=>document.querySelector('.undo-row button')?.textContent==='Повторить');await snap(p,'restore-error',theme,width);
  restoreBad=false;await p.click('.undo-row button');await p.locator('[data-mid="original"]').waitFor();assert.deepEqual(rows,[meal]);
  assert.equal(ops.filter(x=>x[0]==='restore').length,2);assert((await p.locator('#fday').innerText()).includes('Калории'));
  delay=false;await p.click('[data-mid="original"] .ft');await p.click('#mv-del');await snap(p,'undo',theme,width);
  await p.waitForFunction(()=>!document.querySelector('.undo-row'),null,{timeout:7500});assert.equal(await p.locator('[data-mid="original"]').count(),0,'Пять секунд истекли: не восстановлено автоматически');
 }else{
  await p.click('#mv-edit');await p.fill('#ml-text','Правка омлета');await p.click('#mealclose');assert(await p.locator('#mealquestion').isVisible());assert.equal(saved.length,0);
  await snap(p,'save-question',theme,width);await p.click('#ml-discard');assert(!(await p.locator('#mealm').isVisible()));
  await p.click('[data-mid="original"] .ft');await p.click('#mv-edit');assert.equal(await p.locator('#ml-text').inputValue(),meal.text);
  await p.fill('#ml-note','Новая заметка');await p.click('#mealclose');await p.click('#ml-keep');await p.waitForFunction(()=>document.querySelector('#ml-hint').textContent==='Не удалось сохранить');
  assert(await p.locator('#mealm').isVisible());assert.equal(await p.locator('#ml-note').inputValue(),'Новая заметка');
  saveBad=false;await p.click('#ml-keep');await p.waitForFunction(()=>!document.querySelector('#mealm').classList.contains('show'));assert.equal(saved.length,2);assert.equal(saved[1].date,meal.date);
  await p.click('[data-mid="original"] .ft');await p.click('#mv-edit');await p.click('#mealclose');assert(!(await p.locator('#mealm').isVisible()),'Без правок закрывается без вопроса');
 }
 }else if(name==='extra'){
  const before=await p.evaluate(()=>JSON.parse(localStorage.getItem('shp_v1_ai_extra')));
  await p.locator('[data-pickex="2"]').click();await p.click('[data-drop="2"]');await p.click('.undo-row button');await p.waitForFunction(()=>!document.querySelector('.undo-row'));
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('shp_v1_ai_extra'))),before,'Добавленное упражнение восстановлено с тем же id/позицией/схемой');
 }else if(name==='gym'||name==='gym-day'){
  await p.locator('[data-pickex="0"]').click();
  await p.locator('#list input[data-f="w"]').first().fill('42.5');await p.locator('#list input[data-f="r"]').first().fill('9');await p.locator('#list input[data-f="r"]').first().blur();
  const before=await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('shp_v1_ai_sess_')).map(([k,v])=>[k,JSON.parse(v)])));
  await p.click('[data-drop="0"]');await p.waitForFunction(()=>document.querySelector('#dbnote')?.textContent.includes('Сохранено: правки в облаке'));await snap(p,'exercise-undo',theme,width);if(name==='gym-day')await p.click('[data-day="A2"]');await p.click('.undo-row button');
  await p.waitForFunction(()=>!document.querySelector('.undo-row'));
  const after=await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('shp_v1_ai_sess_')).map(([k,v])=>[k,JSON.parse(v)])));
  const key=Object.keys(before)[0];assert(key);assert.deepEqual(after[key].n,before[key].n);assert.deepEqual(after[key].ex[0],before[key].ex[0],'Вернулись те же числа и подходы');
 }else{
  await p.click('#profbtn');await p.click('#meedit');
  const input=p.locator('#me-age');await input.fill('35');await input.blur();
  await p.waitForFunction(()=>[...document.querySelectorAll('#profm .save-notice')].some(e=>e.textContent==='Сохранено'));await snap(p,'profile-saved',theme,width);
  await p.click('#profclose');await p.click('.l1 [data-page="gym"]');
  await p.click('#schedbtn');await p.locator('[data-wd]').first().click();
  await p.waitForFunction(()=>document.querySelector('#schedm .save-notice')?.textContent==='Сохранено');await snap(p,'schedule-saved',theme,width);
 }
 assert.deepEqual(errors,[]);console.log('ok',name,theme,width);
 }catch(e){fails++;console.error('FAIL',name,theme,width,e.stack);}finally{await p.close();}
}
}finally{await b.close();}process.exitCode=fails?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
