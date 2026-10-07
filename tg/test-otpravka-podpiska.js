'use strict';
const {chromium}=require('playwright'),M=require('./mock'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),viewport=require('./viewport-check');
const shots=process.env.GF_SUB_SHOTS;if(shots)fs.mkdirSync(shots,{recursive:true});
let failures=0;
const until=async fn=>{for(let i=0;i<500;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Стенд не получил запрос');};
const give=(r,d,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(d)});
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390])for(const kind of ['send','subscription']){
 const p=await b.newPage({viewport:{width,height:844}});p.setDefaultTimeout(5000);
 try{
 let sent=[],release,mode='http';
 const menu={ok:true,span:'day',from:M.Д(-1),дни:[],покупки:{отделы:[],дома:[]}};
 const o={theme,page:kind==='send'?'eat':'home',sub:'нет',menu:{day:menu},handleRoute:async r=>{
  if(new URL(r.request().url()).pathname!=='/menu/send')return false;
  sent.push(JSON.parse(r.request().postData()));await new Promise(resolve=>release=resolve);
  await give(r,mode==='ok'?{ok:true}:{ok:false,error:'Отправка недоступна'},mode==='http'?503:200);return true;
 }};
 const errors=await M.поднять(p,o);
 if(kind==='send'){
  await p.click('[data-eseg="buy"]');
  const btn=p.locator('[data-msend="day:buy"]');await btn.click();
  await p.waitForFunction(()=>document.querySelector('[data-msend="day:buy"]').disabled);
  await until(()=>sent.length===1);assert.equal(sent.length,1);assert.equal(sent[0].span,'day');assert.equal(sent[0].what,'buy');
  await btn.dispatchEvent('click');assert.equal(sent.length,1,'Нет повторного запроса в полёте');
  await until(()=>release);release();release=null;await p.waitForFunction(()=>document.querySelector('[data-msend="day:buy"]').textContent==='Повторить');
  assert((await p.locator('#eatbody').innerText()).includes('Не удалось отправить'));
  await p.click('[data-eseg="day"]');await p.click('[data-eseg="buy"]');assert.equal(await btn.innerText(),'Повторить');assert.equal(sent.length,1);
  if(shots)await p.screenshot({path:path.join(shots,`send-error-${theme}-${width}.png`)});
  mode='logical';await btn.click();await p.waitForFunction(()=>document.querySelector('[data-msend="day:buy"]').disabled);await until(()=>release);release();release=null;
  await p.waitForFunction(()=>document.querySelector('[data-msend="day:buy"]').textContent==='Повторить');assert.equal(sent.length,2,'HTTP 200 с ok:false тоже отказ');
  mode='ok';await btn.click();await p.waitForFunction(()=>document.querySelector('[data-msend="day:buy"]').disabled);await until(()=>release);release();release=null;
  await p.waitForFunction(()=>document.querySelector('[data-msend="day:buy"]').textContent==='Отправил ✓');assert.equal(sent.length,3);assert.equal(await p.locator('#eatbody .mwarn').count(),0);
 }else{
  await p.evaluate(()=>{window.__invoices=0;Telegram.WebApp.openInvoice=(link,cb)=>{window.__invoices++;window.__invoiceLink=link;cb('cancelled');};});
  await p.click('#profbtn');await p.click('#sub-on');await p.locator('#sub-buy').waitFor();
  await p.waitForFunction(()=>!document.querySelector('#sub-buy').disabled);
  await p.click('#sub-buy');assert.equal(await p.evaluate(()=>window.__invoices),1);assert.equal(await p.evaluate(()=>window.__invoiceLink),'https://t.me/$invoice_mock');
  await p.locator('#sub-code').scrollIntoViewIfNeeded();
  const css=await p.locator('#sub-code').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {height:r.height,font:parseFloat(s.fontSize),bg:s.backgroundColor,text:s.color};});
  assert(css.height>=44&&css.font>=16,'Промокод: размер касания и шрифта');assert.notEqual(css.bg,css.text);
  await p.fill('#sub-code','TEST');assert.equal(await p.locator('#sub-code').inputValue(),'TEST');
  assert.deepEqual(await viewport(p),[]);
  if(shots)await p.screenshot({path:path.join(shots,`subscription-${theme}-${width}.png`)});
  await p.click('#subclose');assert(await p.locator('#profm').isVisible());assert.equal(await p.evaluate(()=>document.activeElement.id),'sub-on');assert.equal(await p.locator('#profm').evaluate(e=>e.inert),false);
  await p.click('#sub-on');await p.click('#subclose');assert(await p.locator('#profm').isVisible());
 }
 assert.deepEqual(errors,[]);console.log('ok',kind,theme,width);
 }catch(e){failures++;console.error('FAIL',kind,theme,width,e.message);}finally{await p.close();}
}
}finally{await b.close();}process.exitCode=failures?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
