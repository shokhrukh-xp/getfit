'use strict';
/* 01.11, его «пройди сам весь путь пользователя разными сценариями» → разбор и выбор
   «Место везде, Без Pro, Цель и здоровье, Перерыв и мелочи» + «пару готовых программ
   для дома и улицы … для бесплатного тарифа». */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),M=require('./mock');
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390]){
 const tag=theme+' '+width;
 /* 1. знакомство: в разные дни — разные места, «что есть» — по месту, шаг 3 из 3 */
 {const p=await b.newPage({viewport:{width,height:844}});const errs=await M.поднять(p,{theme,newbie:true,wait:2500});
  await M.шаги(p,{});await p.waitForSelector('#wz-place');
  assert.equal((await p.textContent('#wzstep')).trim(),'шаг 3 из 3','счётчик не пропадает после цели '+tag);
  await p.click('#wz-place button[data-v="home"]');
  assert.ok(await p.isVisible('#wz-eqrow'),'дома — спрашиваем, что есть');
  await p.click('#wz-dplopen');
  const д=await p.locator('[data-wzdpl]').evaluateAll(a=>a.map(x=>x.dataset.wzdpl));
  assert.ok(д.length>=2,'строка на каждый день');
  await p.click('[data-wzdpl="'+д[0]+'"] button[data-pl="street"]');
  assert.ok(await p.isVisible('#wz-eqsrow'),'есть день на улице — спрашиваем про площадку');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'без переполнения '+tag);
  assert.deepEqual(errs,[]);await p.close();}
 /* 2. без Pro: готовые для дома и улицы, дом — первым; выбрал — место «дома» */
 {const p=await b.newPage({viewport:{width,height:844}});const errs=await M.поднять(p,{theme,newbie:true,sub:'нет',wait:2500});
  await M.шаги(p,{});await p.waitForSelector('#wz-place');
  assert.equal(await p.locator('#wzhave:visible').count(),0,'без Pro — одна кнопка к готовым');
  await p.click('#wz-place button[data-v="home"]');await p.click('#wz-go');await p.waitForSelector('#picklist .pbtn');
  const имена=await p.locator('#picklist .pbtn b').allTextContents();
  assert.match(имена[0],/^Дома/,'дома первой — домашняя: '+имена.join(' | '));
  assert.ok(имена.some(x=>/^Улица/.test(x)),'и уличная есть');
  await p.locator('#picklist .pbtn').first().click();await p.waitForTimeout(1500);
  assert.equal((await p.textContent('#hctx .ds-eyebrow')).trim(),'Дома');
  assert.ok(await p.locator('#list .exrow').count()>=5,'день домашней программы');
  assert.deepEqual(errs,[]);await p.close();}
 /* 3. лист «Собрать» без Pro: сказано сверху, кнопка честная */
 {const p=await b.newPage({viewport:{width,height:844}});const errs=await M.поднять(p,{theme,page:'gym',sub:'нет'});
  await p.click('#profbtn');await p.click('#pq-gym');await p.click('#progedit');await p.waitForSelector('#sborm.show');
  await p.waitForFunction(()=>!document.getElementById('sbnote').hidden,null,{timeout:6000});
  assert.match(await p.textContent('#sbnote'),/Сначала цель|в Pro/);
  assert.notEqual((await p.textContent('#sb-go')).trim(),'Собрать','без цели или Pro кнопка говорит, что будет');
  assert.deepEqual(errs,[]);await p.close();}
 /* 4. перерыв 2 недели — веса легче */
 {const p=await b.newPage({viewport:{width,height:844}});
  const h=M.журнал().map((w,i)=>({...w,date:M.Д(14+i*2),id:M.Д(14+i*2)+'_A',updated:new Date(M.Д(14+i*2)+'T19:10:00').toISOString()}));
  const errs=await M.поднять(p,{theme,page:'gym',hist:h});await p.click('.l1 button[data-page="gym"]');await p.waitForTimeout(800);
  await p.locator('#list .exrow',{hasText:'Приседания со штангой'}).first().click();await p.waitForTimeout(500);
  assert.match(await p.textContent('#list'),/После перерыва — [\d,]+ кг, не 70/,'после двух недель — легче прошлых 70 кг '+tag);
  assert.deepEqual(errs,[]);await p.close();}
 console.log('PASS путь пользователя: места в знакомстве, готовые для дома и улицы, лист без Pro, перерыв — '+tag);
}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
