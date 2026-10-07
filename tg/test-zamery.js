'use strict';
/* 07.10 A4/A5/A8/B5: только стенд. Частичный /measure моделирует новый
   контракт Claude: отсутствующие поля не заменяют существующие значения. */
const {chromium}=require('playwright'),M=require('./mock'),assert=require('assert/strict'),path=require('path'),fs=require('fs'),viewport=require('./viewport-check');
const shots=process.env.GF_MEAS_SHOTS; if(shots)fs.mkdirSync(shots,{recursive:true});
const cases=(process.env.GF_MEAS_CASE||'validation,failure,waist,empty').split(',');let failures=0;
const frame=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function shot(p,name,theme,width){if(shots)await p.screenshot({path:path.join(shots,name+'-'+theme+'-'+width+'.png')});}
const give=(r,d,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(d)});
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const width of [320,390])for(const name of cases){
  const p=await b.newPage({viewport:{width,height:844}});p.setDefaultTimeout(4500);
  try{
   let sent=[],bad=name==='failure';
   const o={theme,meas:name==='empty'?[]:M.замеры().filter(m=>m.date!==M.TODAY)};
   o.handleRoute=async r=>{
    const u=new URL(r.request().url());
    if(u.pathname==='/coach'&&name==='failure'){await give(r,{error:'Не удалось прочитать отчёт весов'},503);return true;}
    if(u.pathname!=='/measure')return false;
    const body=JSON.parse(r.request().postData());sent.push(body);
    if(bad){await give(r,{error:'Не удалось сохранить замер'},503);return true;}
    const was=o.meas.find(m=>m.date===M.TODAY)||{date:M.TODAY,w:null,fat:null};
    const row={...was};for(const k of ['w','fat','waist'])if(body[k]!=null)row[k]=body[k];
    o.meas=[row,...o.meas.filter(m=>m.date!==M.TODAY)];
    await give(r,{ok:true,measures:o.meas});return true;
   };
   const errors=await M.поднять(p,o);
   await p.locator('#fw').scrollIntoViewIfNeeded();
   if(name==='validation'){
    for(const value of ['', 'abc', '20', '-3', '88кг']){
     await p.fill('#fw',value);await p.click('#fmsave');await frame(p);
     assert.equal(sent.length,0,'Неверное значение не отправляется');
     assert.equal(await p.locator('#fw').getAttribute('aria-invalid'),'true','A5: вес отмечен как неверный');
     assert(await p.locator('#fw-error').isVisible(),'A5: подсказка видна у поля');
     assert.equal(await p.evaluate(()=>document.activeElement.id),'fw','A5: фокус у поля веса');
     assert.equal(await p.locator('#fw').inputValue(),value,'Введённое значение не потеряно');
    }
    await shot(p,'validation',theme,width);
    await p.fill('#fw','88,2');assert.equal(await p.locator('#fw').getAttribute('aria-invalid'),null);
    await p.fill('#fwaist','неч');await p.click('#fmsave');assert(await p.locator('#fwaist-error').isVisible());assert.equal(sent.length,0);
    await p.fill('#fwaist','95,5');await p.fill('#ffat','101');await p.click('#fmsave');assert(await p.locator('#ffat-error').isVisible());assert.equal(sent.length,0);
    await p.fill('#ffat','26,5');await p.click('#fmsave');await p.waitForFunction(()=>!document.querySelector('#fmsave').disabled);
    assert.equal(sent.length,1);assert.equal(sent[0].w,88.2);assert.equal(sent[0].fat,26.5);assert.equal(sent[0].waist,95.5);
   }
   if(name==='failure'){
    await p.fill('#fw','88,2');await p.fill('#ffat','26,5');await p.fill('#fwaist','95,5');
    await p.click('#fmsave');await p.waitForFunction(()=>!document.querySelector('#fmsave').disabled);
    assert.equal(sent.length,1);
    assert((await p.locator('#hmeas').innerText()).includes('Не удалось сохранить замер'),'A4: ошибка рядом с формой, не на скрытой Еде');
    assert(await p.locator('#fmreply').isVisible(),'A4: сообщение видно');
    for(const [id,value] of [['fw','88,2'],['ffat','26,5'],['fwaist','95,5']])assert.equal(await p.locator('#'+id).inputValue(),value);
    await shot(p,'save-error',theme,width);
    await p.setInputFiles('#fmfile',path.join(__dirname,'fixtures/a.jpg'));
    await p.waitForFunction(()=>document.querySelector('#fmreply').textContent.includes('Не удалось прочитать отчёт'));
    assert(await p.locator('#fmreply').isVisible(),'Ошибка скриншота тоже у формы');
    await p.waitForFunction(()=>!document.querySelector('#fmphoto').disabled);
    assert.equal(await p.locator('#fw').inputValue(),'88,2');assert.equal(await p.locator('#fwaist').inputValue(),'95,5');
    await shot(p,'photo-error',theme,width);
    bad=false;await p.click('#fmsave');await p.waitForFunction(()=>document.querySelector('#fmreply').textContent==='Замер записан');
    assert.equal(sent.length,2);assert.equal(await p.locator('#fw').inputValue(),'');assert.equal(await p.locator('#fwaist').inputValue(),'');
   }
   if(name==='waist'||name==='empty'){
    if(name==='empty'){
     await p.click('.l1 [data-page="gym"]');await p.click('#zseg-gym [data-zseg="log"]');
     await p.waitForFunction(()=>document.querySelector('#logmeas').textContent.includes('Замеров нет'));
     assert((await p.locator('#logmeas').innerText()).includes('Сегодня → Тело → Новый замер'),'A8: верный путь в пустом журнале');
     await p.click('[data-new-measure]');await frame(p);
     assert(await p.locator('#p-home').isVisible());assert.equal(await p.evaluate(()=>document.activeElement.id),'fw');
     const r=await p.locator('#fw').boundingBox();assert(r.y>=0&&r.y+r.height<=844,'Переход прокручивает к полю');
    }
    const weights=o.meas.map(m=>[m.date,m.w]);
    await p.fill('#fwaist','95,5');await p.click('#fmsave');await p.waitForFunction(()=>document.querySelector('#fmreply').textContent==='Замер записан');await frame(p);
    assert.equal(sent.length,1,'B5: талия без веса отправлена');
    assert.equal(sent[0].waist,95.5);assert(!('w' in sent[0]),'Вес не подставлен, не переданы ни 0, ни старый вес');assert(!('fat' in sent[0]));
    assert.equal(o.meas[0].w,null);assert.deepEqual(o.meas.slice(1).map(m=>[m.date,m.w]),weights);
    assert((await p.locator('.vznum').innerText()).includes('95,5'),'Тело показывает отдельную талию');
    assert.equal(await p.locator('[data-vzv="waist"]').getAttribute('aria-selected'),'true');
    await p.locator('.vz').scrollIntoViewIfNeeded();await shot(p,name,theme,width);
    await p.click('.l1 [data-page="gym"]');await p.click('#zseg-gym [data-zseg="log"]');
    await p.waitForFunction(()=>document.querySelector('#logmeas').textContent.includes('талия'));
    assert((await p.locator('#logmeas').innerText()).includes('95,5'),'Журнал не теряет талию без веса');
    // Дополнение в день уже существующего веса: не обнуляет состав.
    await p.click('.l1 [data-page="home"]');
    o.meas[0]={...o.meas[0],w:88.2,fat:26.5,fatkg:23.4,prot:17.2};
    await p.fill('#fwaist','94,5');await p.click('#fmsave');await p.waitForFunction(()=>!document.querySelector('#fmsave').disabled);await frame(p);
    assert.equal(sent.length,2);assert(!('w' in sent[1]));assert.equal(o.meas[0].w,88.2);assert.equal(o.meas[0].fat,26.5);assert.equal(o.meas[0].prot,17.2);
   }
   assert.equal(errors.length,0,errors.join('\n'));assert.deepEqual(await viewport(p),[],'Нет выхода за края экрана');
   console.log('  ok  '+name+' '+theme+'/'+width);
  }catch(e){failures++;console.error('  ПРОВАЛ '+name+' '+theme+'/'+width+': '+e.message);}
  finally{await p.close();}
 }
}finally{await b.close()}if(failures)process.exitCode=1;})().catch(e=>{console.error(e);process.exitCode=1});
