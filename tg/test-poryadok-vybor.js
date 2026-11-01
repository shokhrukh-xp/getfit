'use strict';
const {chromium}=require('playwright'),M=require('./mock'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),viewport=require('./viewport-check'),contrast=require('./contrast-check'),cat=require('../catalog.json');
const shots=process.env.GF_PICK_SHOTS;if(shots)fs.mkdirSync(shots,{recursive:true});let bad=0;
const give=(r,d,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(d)});
async function snap(p,name,theme,width){assert.deepEqual(await viewport(p),[]);const c=await contrast(p);assert(c.checked>0);assert.deepEqual(c.failures,[]);if(shots)await p.screenshot({path:path.join(shots,`${name}-${theme}-${width}.png`)});}
/* 01.11: набор упирался в потолок 6 мин в общем прогоне — GF_PART=k/n (tg/run-fast.js) делит его на части */
const ЧАСТЬ=(process.env.GF_PART||'').match(/^(\d+)\/(\d+)$/), моё=i=>!ЧАСТЬ||i%+ЧАСТЬ[2]===+ЧАСТЬ[1];let проход=0;
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390])for(const name of (process.env.GF_PICK_CASE||'order,picker,404,410,503').split(',')){
 if(!моё(проход++))continue;
 const p=await b.newPage({viewport:{width,height:844}});p.setDefaultTimeout(15000); // 20.10: под нагрузкой ответ стенда идёт дольше 4,5 с
 try{
 if(name==='503')await p.addInitScript(()=>{window.__паузыОтправки=[200,200];}); /* 22.10: 5xx возврат повторяет сам, два раза */
 const meal={id:'meal',date:M.TODAY,text:'Омлет',kcal:300,prot:20,t:'09:00',kind:'завтрак'};let restored=0;
 const errors=await M.поднять(p,{theme,page:/^\d/.test(name)?'food':'gym',day:{meals:[meal]},handleRoute:async r=>{
  const url=new URL(r.request().url());
  if(url.pathname==='/meal/del'){await give(r,{ok:true,day:M.день({meals:[]})});return true;}
  if(url.pathname==='/meal/restore'){restored++;await give(r,{error:'Отказ стенда'},+name);return true;}return false;
 }});
 if(name==='order'){
  const add=p.locator('#addex'),order=p.locator('#ordopen');await order.scrollIntoViewIfNeeded();
  const a=await add.boundingBox(),o=await order.boundingBox();assert(a.height>=44&&o.height>=44);assert(Math.abs(a.y-o.y)<2,'Кнопки рядом');await snap(p,'order-entry',theme,width);
  const before=await p.locator('#list [data-pickex]').allTextContents();
  await order.click();assert(await p.locator('#orddone').isVisible());await p.click('[data-orddn="0"]');await p.click('#orddone');
  const after=await p.locator('#list [data-pickex]').allTextContents();assert.notDeepEqual(after,before,'Перестановка выполнена');
  const row=p.locator('#list .exrow,#list .card').first();await row.scrollIntoViewIfNeeded();await p.waitForTimeout(250);await row.dispatchEvent('pointerdown',{pointerId:1,clientX:50,clientY:200});
  await p.waitForFunction(()=>document.body.classList.contains('ordmode'));await row.dispatchEvent('pointerup');await snap(p,'order-mode',theme,width);await p.click('#orddone');
 }else if(name==='picker'){
  /* 01.11 (макет «Каталог: доработка»): окно «Добавить» — как каталог. Открывается на мышцах дня
     (чип группы с ✕), без группы — плитки «Что тренируем»; сначала популярное и то, чего в дне ещё нет. */
  await p.click('#addex');await p.locator('#catalog .catchips [data-catchip="grp"]').waitFor();
  assert((await p.locator('#catsearch').boundingBox()).y<(await p.locator('#catalog .catchips').boundingBox()).y,'Поиск сверху');
  assert.equal(await p.locator('#catalog [data-pick]').count(),40);
  const вДне=await p.locator('#list [data-pickex]').allTextContents();
  const first=await p.locator('#catalog [data-pick]').evaluateAll(a=>a.map(x=>+x.dataset.pick));
  assert(!вДне.some(t=>t.trim()&&t.includes(cat.ex[first[0]].n)),'Первым — то, чего в дне ещё нет');
  await snap(p,'picker',theme,width);await p.click('#catalog #catmore');assert.equal(await p.locator('#catalog [data-pick]').count(),80);
  await p.click('#catalog .catchips [data-catchip="grp"]');
  assert.deepEqual(await p.locator('#catalog [data-grp] b').allTextContents(),['Ноги','Ягодицы','Спина','Грудь','Плечи','Руки','Пресс','Растяжка','Кардио']);
  await p.click('#catalog [data-grp="cardio"]');const ids=await p.locator('#catalog [data-pick]').evaluateAll(a=>a.map(x=>+x.dataset.pick));assert(ids.length>0&&ids.every(i=>cat.ex[i].c==='cardio'));
  await p.click('#catalog .catchips [data-catchip="grp"]');await p.click('#catalog [data-grp="legs"]');await p.fill('#catsearch','невозможныйпоиск');assert(await p.locator('.catempt').isVisible());assert(await p.locator('#catalog .catchips [data-catchip="grp"]').isVisible(),'Группу видно и при пустом поиске — её можно снять');await snap(p,'picker-empty',theme,width);
  await p.fill('#catsearch','');await p.click('#catalog .catchips [data-catchip="grp"]');await p.click('#catalog [data-grp="arms"]');await p.fill('#catsearch','бицепс');assert(await p.locator('#catalog [data-pick]').count()>0);
  const num=await p.locator('#list [data-pickex]').count();await p.locator('#catalog [data-pick]').first().click();assert(!(await p.locator('#catalog').isVisible()));assert.equal(await p.locator('#list [data-pickex]').count(),num+1);
  await p.locator('#list [data-pickex]').first().click();await p.locator('[data-nope]').first().click();await p.locator('[data-noped]').first().click();await p.locator('[data-selfpick]').first().click();await p.locator('#catalog.show .catchips').waitFor();assert.equal(await p.locator('#catsearch').inputValue(),'');if(await p.locator('#catalog .catchips [data-catchip="grp"]').count())await p.click('#catalog .catchips [data-catchip="grp"]');await p.click('#catalog [data-grp="chest"]');assert(await p.locator('#catalog [data-pick]').count()>0);await snap(p,'picker-replace',theme,width);
 }else{
  await p.click('[data-mid="meal"] .ft');await p.click('#mv-del');await p.click('.undo-row button');
  await p.waitForFunction(()=>document.querySelector('.undo-row span')?.textContent!=='Возвращаю…');assert.equal(restored,name==='503'?3:1);
  if(name==='503'){
   assert.equal(await p.locator('.undo-row button').innerText(),'Повторить');await p.waitForTimeout(3800);assert(await p.locator('.undo-row').isVisible());await p.click('.undo-row button');
   /* 20.10: под нагрузкой кнопка ещё «Повторить», а второй запрос до стенда не
      дошёл — ждём сам запрос, потом надпись после отказа */
   for(const до=Date.now()+15000;restored<6&&Date.now()<до;)await p.waitForTimeout(50);
   await p.waitForFunction(()=>document.querySelector('.undo-row button')?.textContent==='Повторить');assert.equal(restored,6);
  }else{
   assert.equal(await p.locator('.undo-row span').innerText(),'Вернуть уже нельзя');assert(!(await p.locator('.undo-row button').isVisible()));await snap(p,'restore-'+name,theme,width);await p.waitForFunction(()=>!document.querySelector('.undo-row'),null,{timeout:5500});assert.equal(restored,1);
  }
 }
 assert.deepEqual(errors,[]);console.log('ok',name,theme,width);
 }catch(e){bad++;console.error('FAIL',name,theme,width,e.stack);}finally{await p.close();}
}
}finally{await b.close();}process.exitCode=bad?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
