'use strict';
// 19.10: ответ по доступным фактам не означает, что еда записана.
// При отказе моделей сохраняем исходное фото и текст, без скрытого повтора.
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean'),assert=require('assert/strict'),path=require('path');
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['dark','light'])for(const width of [320,390]){
  const p=await b.newPage({viewport:{width,height:844}});const sent=[];let fail=true;
  const o=opts(theme);o.handleRoute=async r=>{if(new URL(r.request().url()).pathname!='/coach')return false;sent.push(JSON.parse(r.request().postData()));await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fail?{ok:true,needsRetry:true,reply:'Фото получил. Состав и порцию пока не подтвердил, поэтому в дневник ничего не добавил.',meals:[]}:{ok:true,reply:'Обед записал.',meals:[{}]})});return true};
  const errors=await M.поднять(p,o);await p.setViewportSize({width,height:844});await p.click('#coachnav');await p.setInputFiles('#cfile',path.join(__dirname,'fixtures/a.jpg'));await p.waitForSelector('#cattach [data-att]');await p.fill('#ctext','Запиши этот обед');await p.click('#csend');
  await p.waitForFunction(()=>document.querySelector('#chatlog').textContent.includes('Состав и порцию пока не подтвердил'));
  await p.waitForFunction(()=>!document.querySelector('#csend').disabled);
  assert.equal(await p.inputValue('#ctext'),'Запиши этот обед');assert.equal(await p.locator('#cattach [data-att]').count(),1);assert.equal(sent.length,1);assert(sent[0].image);assert.equal(sent[0].replyRecovery,1);
  assert.doesNotMatch(await p.locator('#chatlog').innerText(),/Gemini|API|timeout|Пришли ещё раз/);
  if(process.env.GF_RESERVE_SHOTS)await p.screenshot({path:path.join(process.env.GF_RESERVE_SHOTS,`reserve-${theme}-${width}.png`)});
  fail=false;await p.click('#csend');await p.waitForFunction(()=>document.querySelector('#chatlog').textContent.includes('Обед записал.'));await p.waitForFunction(()=>!document.querySelector('#csend').disabled);
  assert.equal(sent.length,2);assert.equal(sent[0].image,sent[1].image);assert.equal(sent[0].date,sent[1].date);assert.equal(await p.inputValue('#ctext'),'');assert.equal(await p.locator('#cattach [data-att]').count(),0);assert.deepEqual(errors,[]);
  if(process.env.GF_RESERVE_SHOTS){await p.screenshot({path:path.join(process.env.GF_RESERVE_SHOTS,`chat-${theme}-${width}.png`)});}
  await p.close();console.log(`PASS ${theme} ${width}: ответ виден, фото/текст/дата целы, без автоповтора; успех очищает черновик`);
 }
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
