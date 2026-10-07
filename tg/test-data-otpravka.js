'use strict';
/* 07.10: A1/A2/A3/A6. Настоящие клики; сеть удерживаем до нужного шага,
   чтобы проверять порядок ответов, а не скорость общей машины. */
const {chromium}=require('playwright'), M=require('./mock'), assert=require('assert/strict'), path=require('path'), fs=require('fs');
const shots=process.env.GF_DATA_SHOTS;
if(shots)fs.mkdirSync(shots,{recursive:true});
async function shot(p,name,theme,width){if(shots)await p.screenshot({path:path.join(shots,name+'-'+theme+'-'+width+'.png')});}
const cases=(process.env.GF_DATA_CASE||'date,race,retry,load,inflight,guards').split(',');
let failed=0;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(fn())return;await pause(20)}throw Error('Не дождались запроса стенда');}
const give=(r,d,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(d)});
const day=date=>M.день({date,meals:[{id:date,t:'12:00',kind:'обед',text:'Запись '+date,kcal:500,prot:30}]});
const score=(r)=>({ok:true,closed:true,r,n:2,why:[],приёмы:[]});
async function settled(p){await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function meal(p,date){await p.waitForFunction(d=>document.querySelector('#fmeals').textContent.includes('Запись '+d),date);}
async function header(p,date){assert.equal(await p.locator('#coachdate').getAttribute('data-date'),date,'В чате видна дата записи');assert((await p.locator('#coachdate').innerText()).includes(date.split('-').reverse().join('.')));}
(async()=>{const browser=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390])for(const name of cases){
const p=await browser.newPage({viewport:{width,height:844}});p.setDefaultTimeout(4000);
try{
 let sent=[], held=[], hold=false, broken=true, reads=0;
 const handleRoute=async r=>{
  const u=new URL(r.request().url()), d=u.searchParams.get('date')||M.TODAY;
  if(u.pathname==='/coach/act'&&name==='guards'){
   await give(r,broken?{error:'Действие не отправлено'}:{ok:true,reply:'Самочувствие принято.'},broken?503:200);return true;
  }
  if(u.pathname==='/coach'){
   sent.push(JSON.parse(r.request().postData()));
   if(name==='retry' && broken==='network'){await r.abort('failed');return true;}
   if(name==='retry' && broken){await give(r,{error:'Нет связи с тренером'},503);return true;}
   if(name==='date'||name==='inflight'){held.push(r);return true;}
   await give(r,{ok:true,reply:'Записал ужин.',day:day(sent.at(-1).date),meals:[{}]});return true;
  }
  if(u.pathname==='/day'||u.pathname==='/day/score'){
   if(name==='load'&&d===M.Д(1)&&u.pathname==='/day'){
    reads++;if(broken==='network'){await r.abort('failed');return true;}
    if(broken==='invalid'){await give(r,{ok:true});return true;}
    if(broken){await give(r,{error:'Ошибка дня'},503);return true;}
   }
   if(name==='race'&&hold&&d===M.Д(1)){held.push({r,path:u.pathname});return true;}
   await give(r,u.pathname==='/day'?{ok:true,day:day(d)}:score(d===M.Д(2)?8.2:6.1));return true;
  }
  return false;
 };
 const errors=await M.поднять(p,{page:'food',theme,handleRoute,chat:name==='guards'?[{role:'assistant',ts:Date.now(),text:'Как ты?',act:[{k:'wb',v:'норм',t:'Нормально',d:M.TODAY}]}]:[]});
 await meal(p,M.TODAY);
 if(name==='guards'){
  await p.click('#coachnav');
  await p.setInputFiles('#cfile',{name:'bad.jpg',mimeType:'image/jpeg',buffer:Buffer.from('not an image')});
  await p.waitForFunction(()=>document.querySelector('#chatlog').textContent.includes('Не смог прочитать фото'));
  assert.equal(await p.locator('#chatretry').count(),0,'Ошибка чтения файла не предлагает отправить пустое сообщение');
  assert(!(await p.locator('#ctext').isDisabled()));
  await p.locator('[data-cact]').first().click();
  await p.waitForFunction(()=>document.querySelector('#chatlog').textContent.includes('Действие не отправлено'));
  await settled(p);assert(!(await p.locator('#ctext').isDisabled()),'Отказ кнопки самочувствия не блокирует ввод');
  assert.equal(await p.locator('#chatretry').count(),0,'Ошибка действия не повторяется как обычный текст');
  broken=false;await p.locator('[data-cact]').first().click();
  await p.waitForFunction(()=>document.querySelector('#chatlog').textContent.includes('Самочувствие принято.'));
  await settled(p);assert(!(await p.locator('#ctext').isDisabled()),'Успех кнопки самочувствия возвращает ввод');
  await p.fill('#ctext','Вопрос после самочувствия');await p.click('#csend');await until(()=>sent.length===1);
  assert.equal(sent[0].text,'Вопрос после самочувствия');
 }
 if(name==='date'){
  await p.click('[data-fnav="-1"]');await meal(p,M.Д(1));await p.click('#food-add');
  await p.fill('#ctext','Вчерашний ужин');await p.click('#csend');await until(()=>sent.length===1);
  assert.equal(sent[0].date,M.Д(1),'A1: еда отправлена за выбранный день');await header(p,M.Д(1));
  await shot(p,'chat-date',theme,width);
  await p.click('#coachclose');await p.click('[data-fnav="1"]');await meal(p,M.TODAY);
  await give(held.shift(),{ok:true,reply:'Вчера записано.',day:day(M.Д(1)),meals:[{}]});
  await p.waitForFunction(()=>!document.querySelector('#csend').disabled);await settled(p);
  assert((await p.locator('#fmeals').innerText()).includes(M.TODAY),'Ответ за вчера не подменяет сегодня');
  await p.click('.l1 [data-page="home"]');
  assert(!(await p.locator('#p-home').innerText()).includes('Запись '+M.Д(1)),'Главная не подменена прошлым днём');
  await p.click('#coachnav');await header(p,M.TODAY);
  await p.fill('#ctext','Сегодняшний вопрос');await p.click('#csend');await until(()=>sent.length===2);
  assert.equal(sent[1].date,M.TODAY,'Обычная вкладка тренера отправляет за сегодня');
  await give(held.shift(),{ok:true,reply:'Понял.'});
 }
 if(name==='race'){
  hold=true;await p.click('[data-fnav="-1"]');await until(()=>held.length===2);
  await p.click('[data-fnav="-1"]');await meal(p,M.Д(2));
  for(const q of held.splice(0))await give(q.r,q.path==='/day'?{ok:true,day:day(M.Д(1))}:score(1.1));
  await settled(p);assert((await p.locator('#fmeals').innerText()).includes(M.Д(2)),'A2: старый день не подменяет выбранный');
  assert((await p.locator('#fday').innerText()).includes('8,2'),'A2: старая оценка не подменяет выбранную');
  // A → B → A: устаревший ответ той же даты тоже не должен победить.
  await p.click('[data-fnav="1"]');await until(()=>held.length===2);
  await p.click('[data-fnav="-1"]');await meal(p,M.Д(2));
  await p.click('[data-fnav="1"]');await until(()=>held.length===4);
  const fresh=held.splice(2);for(const q of fresh)await give(q.r,q.path==='/day'?{ok:true,day:day(M.Д(1))}:score(9.4));
  await meal(p,M.Д(1));await p.waitForFunction(()=>document.querySelector('#fday').textContent.includes('9,4'));
  for(const q of held.splice(0))await give(q.r,q.path==='/day'?{ok:true,day:M.день({date:M.Д(1),meals:[]})}:score(1.1));
  await settled(p);assert((await p.locator('#fmeals').innerText()).includes(M.Д(1)),'A2: поколение дня защищает A → B → A');
  assert((await p.locator('#fday').innerText()).includes('9,4'),'A2: поколение оценки защищает A → B → A');
 }
 if(name==='retry'){
  await p.click('[data-fnav="-1"]');await meal(p,M.Д(1));await p.click('#food-add');
  await p.fill('#ctext','Ужин с фото');await p.setInputFiles('#cfile',path.join(__dirname,'fixtures/a.jpg'));
  await p.waitForFunction(()=>!document.querySelector('#cattach').hidden&&!document.querySelector('#csend').disabled);
  const image=await p.locator('#cattach img').getAttribute('src');
  await p.click('#csend');await until(()=>sent.length===1);
  await p.waitForFunction(()=>!document.querySelector('#csend').disabled);
  assert.equal(await p.locator('#ctext').inputValue(),'Ужин с фото','A3: после отказа текст не потерян');
  assert.equal(await p.locator('#cattach img').getAttribute('src'),image,'A3: фото не потеряно');
  assert(await p.locator('#chatretry').isVisible(),'Есть ручной Повторить');await header(p,M.Д(1));
  await shot(p,'chat-retry',theme,width);
  await p.click('#coachclose');await p.click('#coachnav');await header(p,M.TODAY);
  assert.equal(await p.locator('#ctext').inputValue(),'','Вчерашний черновик не стал сегодняшним');
  await p.fill('#ctext','Отдельный сегодняшний черновик');await p.click('#coachclose');await p.click('#food-add');
  assert.equal(await p.locator('#ctext').inputValue(),'Ужин с фото','Возврат восстанавливает черновик нужной даты');
  assert.equal(await p.locator('#cattach img').getAttribute('src'),image);
  await p.waitForTimeout(350);assert.equal(sent.length,1,'Автоповтора нет');
  broken='network';await p.click('#chatretry');await until(()=>sent.length===2);
  await p.waitForFunction(()=>!document.querySelector('#csend').disabled);
  assert.equal(await p.locator('#ctext').inputValue(),'Ужин с фото','Обрыв сети тоже сохраняет текст');
  assert.equal(await p.locator('#cattach img').getAttribute('src'),image,'Обрыв сети тоже сохраняет фото');
  assert.deepEqual(sent[1],sent[0]);
  broken=false;await p.click('#chatretry');await until(()=>sent.length===3);
  await p.waitForFunction(()=>!document.querySelector('#csend').disabled);
  assert.deepEqual(sent[2],sent[0],'Ручной повтор сохраняет текст, фото, дату и MIME');
  assert.equal(await p.locator('#ctext').inputValue(),'');assert(await p.locator('#cattach').isHidden());
  assert.equal(await p.locator('#chatretry').count(),0,'После успеха повтор исчез');
  await p.click('#coachclose');await p.click('#coachnav');assert.equal(await p.locator('#ctext').inputValue(),'Отдельный сегодняшний черновик');
 }
 if(name==='inflight'){
  await p.click('[data-fnav="-1"]');await meal(p,M.Д(1));await p.click('#food-add');
  await p.fill('#ctext','Неотправленный ужин');await p.click('#csend');await until(()=>sent.length===1);
  assert(await p.locator('#ctext').isDisabled(),'Во время отправки ввод не теряется из-за повторного Enter');
  await p.locator('#ctext').dispatchEvent('keydown',{key:'Enter'});assert.equal(sent.length,1);
  await p.click('#coachclose');await p.click('#coachnav');await header(p,M.TODAY);
  assert((await p.locator('.msg.sent').innerText()).includes(M.Д(1).split('-').reverse().join('.')),'У сообщения в пути видна его собственная дата');
  await give(held.shift(),{error:'Нет связи с тренером'},503);
  await p.waitForFunction(()=>!document.querySelector('#csend').disabled);
  assert.equal(await p.locator('#ctext').inputValue(),'','Отказ вчерашнего запроса не заполняет сегодняшнее поле');
  await p.click('#coachclose');await p.click('#food-add');
  assert.equal(await p.locator('#ctext').inputValue(),'Неотправленный ужин','Ошибка после закрытия листа тоже сохраняет черновик');
  assert(await p.locator('#chatretry').isVisible());
  await p.fill('#ctext','');assert(await p.locator('#chatretry').isDisabled(),'Пустой черновик нельзя повторить');
  await p.fill('#ctext','Исправленный ужин');assert(!(await p.locator('#chatretry').isDisabled()),'Исправленный черновик можно отправить');
 }
 if(name==='load'){
  await p.click('[data-fnav="-1"]');await until(()=>reads===1);await settled(p);
  assert((await p.locator('#fday').innerText()).includes('Не удалось загрузить день'),'A6: вместо бесконечной загрузки — понятная ошибка');
  assert(await p.locator('[data-day-retry]').isVisible());
  await shot(p,'day-retry',theme,width);
  await p.waitForTimeout(250);assert.equal(reads,1,'Загрузка не повторяется сама');
  for(const type of ['invalid','network']){
   broken=type;await p.click('[data-day-retry]');
   await p.locator('[data-day-retry]').waitFor();
   assert((await p.locator('#fday').innerText()).includes('Не удалось загрузить день'),'Некорректный ответ и обрыв сети не оставляют вечную загрузку');
  }
  broken=false;await p.click('[data-day-retry]');await meal(p,M.Д(1));assert.equal(reads,4);
  assert.equal(await p.locator('[data-day-retry]').count(),0,'После успешного повтора ошибка исчезла');
 }
 assert.equal(errors.length,0,'Нет ошибок JavaScript');
 console.log('  ok  '+name+' '+width+' '+theme);
}catch(e){failed++;console.error('  ПРОВАЛ '+name+' '+width+' '+theme+': '+e.message);}
finally{await p.close();}
}
}finally{await browser.close();}if(failed)process.exitCode=1;})().catch(e=>{console.error(e);process.exitCode=1});
