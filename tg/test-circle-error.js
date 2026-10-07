'use strict';
const {chromium}=require('playwright'),M=require('./mock'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),viewport=require('./viewport-check'),contrast=require('./contrast-check');
const shots=process.env.GF_CIRCLE_SHOTS; if(shots)fs.mkdirSync(shots,{recursive:true});
(async()=>{const b=await chromium.launch();let bad=0;try{
for(const theme of ['light','dark'])for(const width of [320,390]){
 const p=await b.newPage({viewport:{width,height:844}});p.setDefaultTimeout(4000);let mode=500,held=[],requests=0;
 try{
 await M.поднять(p,{theme,page:'circle',handleRoute:async r=>{
  const u=new URL(r.request().url());if(u.pathname!='/circle')return false;requests++;
  if(mode==='hold'){held.push(r);return true;}
  if(mode==='network'){await r.abort();return true;}
  const d=M.круг();d.circle=u.searchParams.get('id')||'family';d.board[1].name=d.circle==='family'?'Семья участник':'Зал участник';
  await r.fulfill({status:mode==='bad'?200:mode,contentType:'application/json',body:JSON.stringify(mode===200?d:{ok:false,error:'failure'})});return true;
 }});
 p.setDefaultTimeout(4000);
 const error=async()=>{await p.locator('[data-circle-retry]').waitFor();assert((await p.locator('#cirbody').innerText()).includes('Не удалось загрузить рейтинг'));assert(!(await p.locator('#cirbody').innerText()).includes('Загружаю'));};
 await error();
 for(const failure of [403,'network','bad']){mode=failure;await p.click('[data-circle-retry]');await error();}
 mode=200;await p.click('[data-circle-retry]');await p.locator('.lbrow').first().waitFor();const table=await p.locator('.lb').innerText();
 mode=500;await p.click('[data-page="food"]');await p.click('#fseg-food [data-zseg="circle"]');await error();assert.equal(await p.locator('.lb').innerText(),table,'Кэш не исчезает при отказе обновления');
 if(shots)await p.screenshot({path:path.join(shots,`rating-cache-error-${theme}-${width}.png`)});
 await p.click('[data-cir="c_zal"]');await error();assert.equal(await p.locator('.lbrow').count(),0,'Таблица семьи не выдается за таблицу зала');assert.equal(await p.locator('[data-cir="c_zal"]').getAttribute('class'),'mchip on');
 if(shots)await p.screenshot({path:path.join(shots,`rating-switch-error-${theme}-${width}.png`)});
 assert.deepEqual(await viewport(p),[]);assert.deepEqual((await contrast(p)).failures,[]);
 mode='hold';const n=requests;await p.click('[data-circle-retry]');await p.waitForTimeout(100);assert.equal(await p.locator('[data-circle-retry]').count(),0,'Повтор недоступен в пути');
 mode=200;await p.click('[data-cir="family"]');await p.waitForTimeout(100);await p.locator('.lbrow').first().waitFor();
 for(const r of held)await r.fulfill({status:500,contentType:'application/json',body:'{"ok":false}'});held=[];
 await p.waitForTimeout(100);assert.equal(await p.locator('[data-circle-retry]').count(),0,'Старый отказ не портит новый круг');assert.equal(await p.locator('.lb').innerText(),table);assert(requests>=n+2);
 mode=200;await p.click('[data-cir="c_zal"]');await p.waitForFunction(()=>document.querySelector('.lb')?.textContent.includes('Зал участник'));assert((await p.locator('.lb').innerText()).includes('Зал участник'));
 mode=500;await p.click('[data-cir="family"]');await error();assert.equal(await p.locator('.lb').innerText(),table,'Кэш выбранного круга сохраняется и при неудачной смене');
 console.log('ok rating failures/cache/switch/race',theme,width);
 }catch(e){bad++;console.error('FAIL',theme,width,e.stack);}finally{await p.close();}
}
}finally{await b.close();}process.exitCode=bad?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
