'use strict';
/* 01.11, макет «Место и тренер (C + D)», его «Да, как в макете»:
   улица в листе сборки («Что есть на площадке», сколько подтягиваний, «Иногда ещё»)
   и «Сегодня не в зале?» на дне — замены только на сегодня, «Вернуть зал». */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),M=require('./mock'),{fixture,start,until}=require('./test-settings-save');
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390]){
 const tag=theme+' '+width;
 /* 1. лист сборки: улица */
 {const f=fixture(),route=f.route;f.route=async r=>{if(new URL(r.request().url()).pathname==='/ai'){await r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,code:'ai_down',error:'fixture'})});return true}return route(r)};
  const {p,errors}=await start(b,f,theme,width);
  await p.click('#pq-gym');await p.click('#progedit');
  assert.deepEqual(await p.locator('#sb-place button').allTextContents(),['в зале','дома','на улице']);
  await p.click('#sb-place [data-v="street"]');
  assert.equal(await p.textContent('#sb-eqlab'),'Что есть на площадке');
  assert.ok(await p.isVisible('#sb-pullrow'),'подтягивания — только для улицы '+tag);
  assert.equal(await p.isVisible('#sb-platerow'),false,'блин на улице не нужен '+tag);
  assert.deepEqual(await p.locator('#sb-also button:not([hidden])').allTextContents(),['в зале','дома'],'«Иногда ещё» без выбранного места');
  await p.click('#sb-eq [data-v="rings"]');await p.click('#sb-pull [data-v="5"]');await p.click('#sb-also [data-v="home"]');
  await p.click('#sb-place [data-v="home"]');assert.equal(await p.textContent('#sb-eqlab'),'Что есть дома');
  await p.click('#sb-eq [data-v="db"]');await p.click('#sb-place [data-v="street"]');
  assert.equal(await p.getAttribute('#sb-eq [data-v="rings"]','aria-pressed'),'true','отметки улицы не теряются при переключении '+tag);
  /* 01.11, его «кнопка собрать не работает»: без двух дней кнопка не молчит, а говорит, чего не хватает */
  const дни=await p.locator('#sb-wd button[aria-pressed="true"]').evaluateAll(bs=>bs.map(x=>x.dataset.v));
  for(const v of дни.slice(1))await p.click('#sb-wd [data-v="'+v+'"]');
  await p.click('#sb-go');
  assert.match(await p.textContent('#sbstate'),/хотя бы два дня/,'без двух дней — понятное сообщение '+tag);
  assert.ok(await p.locator('#sborm.show').count(),'лист не закрылся молча');
  for(const v of дни.slice(1))await p.click('#sb-wd [data-v="'+v+'"]');
  assert.equal(await p.isVisible('#sbstate'),false,'дни отмечены — сообщение ушло');
  await p.click('#sb-go');
  await until(()=>f.me().place==='street','место сохранилось');
  const me=f.me();
  assert.deepEqual([...me.eqs].sort(),['bar','dips','rings']);assert.ok(me.eq.includes('db'),'дома — гантели');assert.equal(me.pull,5);assert.deepEqual(me.also,['home']);
  assert.deepEqual(errors,[]);await p.close();}
 /* 2. «Сегодня дома» на дне */
 {const p=await b.newPage({viewport:{width,height:844}});const errs=await M.поднять(p,{theme,page:'gym'});
  await p.click('.l1 button[data-page="gym"]');await p.waitForSelector('#tplace:not([hidden])');
  assert.match(await p.textContent('#tplace'),/Сегодня не в зале\?/);
  const imena0=await p.locator('#list .exrn b').allTextContents();
  await p.click('#tplace [data-tplgo="h"]');await p.waitForSelector('#tplm.show');
  await p.click('#tplm [data-catinv=""]');
  const ничего=await p.locator('#tplm [data-tplk]').count();assert.ok(ничего>=2,'без снарядов есть что заменить '+tag);
  await p.click('#tplm [data-catinv="db"]');
  const первая=await p.textContent('#tplm [data-tplk]');assert.match(первая,/гантел/i,'с гантелями штангу меняет на гантели: '+первая);
  await p.click('#tplm [data-tplk]');assert.ok(await p.locator('#tplm [data-tplv]').count()>=2,'у замены есть варианты');
  await p.locator('#tplm [data-tplv]').nth(1).click();
  const замен=await p.locator('#tplm [data-tplk]').count();
  await p.click('#tplgo');await p.waitForTimeout(400);
  assert.match(await p.textContent('#nexthint'),/сегодня · дома · вместо зала/);
  assert.equal(await p.locator('#list .exwas').count(),замен,'под каждой заменой — что было');
  assert.match(await p.textContent('#tplace'),/Вернуть зал/);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'без переполнения '+tag);
  await p.click('#tplace [data-tplback]');await p.waitForTimeout(300);
  assert.equal(await p.locator('#list .exwas').count(),0);assert.deepEqual(await p.locator('#list .exrn b').allTextContents(),imena0,'«Вернуть зал» вернул день как был');
  assert.deepEqual(errs,[]);await p.close();}
 /* 3. чат: тренер знает «сегодня дома», карточка «тренировка на сегодня» → «Сделать сегодняшней» */
 {const p=await b.newPage({viewport:{width,height:844}});let тело=null;
  const errs=await M.поднять(p,{theme,page:'gym',onCoach:route=>{тело=JSON.parse(route.request().postData()||'{}');
    return {ok:true,reply:'Всё тело кругом, 3 круга, отдых 60 с.',changes:[{what:'today',text:'Дома · 30 мин',place:'h',min:30,
      items:[{i:'Bodyweight_Squat',n:'Присед',sets:3,reps:'15'},{i:'Pushups',n:'Отжимания',sets:3,reps:'10'},{i:'Plank',n:'Планка',sets:3,reps:'30–40 с'}]}]};}});
  await p.click('.l1 button[data-page="gym"]');await p.waitForSelector('#tplace:not([hidden])');
  await p.click('#tplace [data-tplgo="h"]');await p.waitForSelector('#tplm.show');await p.click('#tplgo');await p.waitForTimeout(300);
  await p.click('#coachnav');await p.waitForTimeout(600);await p.fill('#ctext','я сегодня дома, что сделать?');await p.click('#csend');
  await p.waitForSelector('#chatlog [data-reco2="today"]',{timeout:8000});
  assert.equal(тело.tplace,'h','приложение сказало тренеру «сегодня дома»');
  assert.match(await p.textContent('#chatlog .reco2:has([data-reco2="today"])'),/Дома · 30 мин · 3 упражнения/);
  assert.equal(await p.locator('#chatlog .reco2:has([data-reco2="today"]) .tdrow').count(),3);
  assert.ok(await p.locator('#chatlog .reco2:has([data-reco2="today"]) .tdrow img').count()>=3,'с картинками каталога');
  await p.click('#chatlog [data-reco2="today"]');await p.waitForTimeout(400);
  assert.ok(await p.locator('#chatlog [data-reco2="todayback"]').count(),'встало — можно вернуть');
  await p.keyboard.press('Escape');await p.evaluate(()=>{const m=document.getElementById('coachm');if(m)m.classList.remove('show');});
  await p.waitForTimeout(300);
  assert.equal(await p.locator('#list .exrow').count(),3,'на сегодня — тренировка из карточки');
  assert.match(await p.textContent('#tplace'),/тренировка тренера/);
  await p.click('#tplace [data-tplback]');await p.waitForTimeout(300);
  assert.ok(await p.locator('#list .exrow').count()>3,'«Вернуть» — снова день программы');
  assert.deepEqual(errs,[]);await p.close();}
 console.log('PASS место: улица в сборке, «Сегодня дома» и «Вернуть зал» — '+tag);
}
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
