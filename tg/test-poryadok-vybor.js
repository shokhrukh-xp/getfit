'use strict';
const {chromium}=require('playwright'),M=require('./mock'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),viewport=require('./viewport-check'),contrast=require('./contrast-check'),cat=require('../catalog.json');
const shots=process.env.GF_PICK_SHOTS;if(shots)fs.mkdirSync(shots,{recursive:true});let bad=0;
const give=(r,d,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(d)});
async function snap(p,name,theme,width){assert.deepEqual(await viewport(p),[]);const c=await contrast(p);assert(c.checked>0);assert.deepEqual(c.failures,[]);if(shots)await p.screenshot({path:path.join(shots,`${name}-${theme}-${width}.png`)});}
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390])for(const name of (process.env.GF_PICK_CASE||'order,picker,404,410,503').split(',')){
 const p=await b.newPage({viewport:{width,height:844}});p.setDefaultTimeout(4500);
 try{
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
  await p.click('#addex');await p.locator('#catalog [data-pickgroup="legs"]').waitFor();
  assert.deepEqual(await p.locator('#catalog [data-pickgroup]').allTextContents(),['Все','Ноги','Спина','Грудь','Плечи','Руки','Пресс','Кардио']);
  assert((await p.locator('#catsearch').boundingBox()).y<(await p.locator('.pickgroups').boundingBox()).y,'Поиск сверху');
  assert.equal(await p.locator('#catalog [data-pick]').count(),40);const first=await p.locator('#catalog [data-pick]').evaluateAll(a=>a.map(x=>+x.dataset.pick));assert.deepEqual(first,Array.from({length:40},(_,i)=>i),'Без ранжирования');
  await snap(p,'picker',theme,width);await p.click('#catalog #catmore');assert.equal(await p.locator('#catalog [data-pick]').count(),80);
  await p.click('[data-pickgroup="cardio"]');const ids=await p.locator('#catalog [data-pick]').evaluateAll(a=>a.map(x=>+x.dataset.pick));assert(ids.length>0&&ids.every(i=>cat.ex[i].c==='cardio'));
  await p.click('[data-pickgroup="legs"]');await p.fill('#catsearch','невозможныйпоиск');assert(await p.locator('.catempt').isVisible());assert(await p.locator('[data-pickgroup="arms"]').isVisible(),'Группы доступны и при пустом поиске');await snap(p,'picker-empty',theme,width);
  await p.fill('#catsearch','');await p.click('[data-pickgroup="arms"]');await p.fill('#catsearch','бицепс');assert(await p.locator('#catalog [data-pick]').count()>0);
  const num=await p.locator('#list [data-pickex]').count();await p.locator('#catalog [data-pick]').first().click();assert(!(await p.locator('#catalog').isVisible()));assert.equal(await p.locator('#list [data-pickex]').count(),num+1);
  await p.locator('#list [data-pickex]').first().click();await p.locator('[data-nope]').first().click();await p.locator('[data-noped]').first().click();await p.locator('[data-selfpick]').first().click();await p.locator('.pickgroups').waitFor();assert.equal(await p.locator('#catsearch').inputValue(),'');await p.click('[data-pickgroup="chest"]');assert(await p.locator('#catalog [data-pick]').count()>0);await snap(p,'picker-replace',theme,width);
 }else{
  await p.click('[data-mid="meal"] .ft');await p.click('#mv-del');await p.click('.undo-row button');
  await p.waitForFunction(()=>document.querySelector('.undo-row span')?.textContent!=='Возвращаю…');assert.equal(restored,1);
  if(name==='503'){
   assert.equal(await p.locator('.undo-row button').innerText(),'Повторить');await p.waitForTimeout(3800);assert(await p.locator('.undo-row').isVisible());await p.click('.undo-row button');await p.waitForFunction(()=>document.querySelector('.undo-row button')?.textContent==='Повторить');assert.equal(restored,2);
  }else{
   assert.equal(await p.locator('.undo-row span').innerText(),'Вернуть уже нельзя');assert(!(await p.locator('.undo-row button').isVisible()));await snap(p,'restore-'+name,theme,width);await p.waitForFunction(()=>!document.querySelector('.undo-row'),null,{timeout:5500});assert.equal(restored,1);
  }
 }
 assert.deepEqual(errors,[]);console.log('ok',name,theme,width);
 }catch(e){bad++;console.error('FAIL',name,theme,width,e.stack);}finally{await p.close();}
}
}finally{await b.close();}process.exitCode=bad?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
