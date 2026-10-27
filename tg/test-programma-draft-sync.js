'use strict';
/* Два независимых браузерных устройства, настоящий /s + SQLite из общего
   стенда настроек: перезапуск, обрыв, конфликт, удаление/принятие. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean'),assert=require('node:assert/strict');
const {fixture,until,sleep}=require('./test-settings-save');
const PROG=require('./fixtures/prog-3dnya.json');
(async()=>{const br=await chromium.launch(),f=fixture();let builds=0;const pages=[];
const row=()=>{const r=f.sq.prepare("SELECT data FROM state WHERE uid='svc_settings' AND key='program_draft'").get();return r?JSON.parse(r.data):{draft:[]}};
const setup=async(theme='dark',width=320)=>{const p=await br.newPage({viewport:{width,height:844}});p.setDefaultTimeout(10000);pages.push(p);const errors=await M.поднять(p,{...opts(theme),page:'gym',me:f.initial,profile:'ai',prog:{...PROG,name:'Действующая'},rbo:{stamp:'draft-check',why:'Цель'},preserveReload:true,handleRoute:f.route,onAi:()=>{builds++;return {ok:true,prog:PROG}}});await sleep(700);return {p,errors}};
const open=async p=>{await p.click('#profbtn');await p.click('#pq-gym')};
const build=async p=>{await open(p);await p.click('#recobox [data-rb="go"]');await p.waitForSelector('#aibox .aiex')};
const edit=async(p,sets)=>{await p.click('#aibox [data-aiedit="params"][data-aiindex="0"]');await p.fill('#aibox .aiparams [name="sets"]',String(sets));await p.fill('#aibox .aiparams [name="reps"]','6–8');await p.click('#aibox .aiparams button')};
const count=()=>row().draft[0]?.prog.days[0].ex[0].sets;
try{
 const A=await setup();await build(A.p);await until(()=>row().draft.length===1,'первый черновик на сервере');
 await edit(A.p,4);await A.p.click('#aibox [data-aiedit="down"][data-aiindex="0"]');
 await A.p.click('#aibox [data-aiedit="remove"][data-aiindex="2"]');
 await until(()=>row().draft[0]?.prog.days[0].ex.length===6,'порядок, параметры и удаление');
 const expected=JSON.parse(JSON.stringify(row()));
 const B=await setup('light',390);await open(B.p);await B.p.waitForSelector('#aibox .aiex');assert.equal(await B.p.locator('#aibox .aiex').count(),6);
 assert.match(await B.p.locator('#aibox .aien').nth(1).innerText(),/4 × 6–8/);assert.equal(builds,1);
 await A.p.reload();await sleep(900);await open(A.p);assert.equal(await A.p.locator('#aibox .aiex').count(),6);assert.match(await A.p.locator('#aibox .aien').nth(1).innerText(),/4 × 6–8/);
 assert.deepEqual(row(),expected);console.log('PASS серверный черновик: два устройства, перезапуск, параметры, порядок, удаление, без повторной генерации');
 // Ввод без «Готово» тоже уходит в черновик.
 await A.p.click('#aibox [data-aiedit="params"][data-aiindex="0"]');await A.p.fill('#aibox .aiparams [name="sets"]','5');await until(()=>count()===5,'ввод без Готово');
 await A.p.reload();await sleep(900);await open(A.p);assert.match(await A.p.locator('#aibox .aien').first().innerText(),/5 ×/);
 // B хранит старую версию. A пишет 6, B — 7: никакого тихого затирания.
 await edit(A.p,6);await until(()=>count()===6,'версия A');await edit(B.p,7);
 const notice=B.p.locator('#aibox [data-aidraft-status]');await notice.filter({hasText:'Какой оставить'}).waitFor();assert.equal(count(),6);
 await notice.getByRole('button',{name:'С другого устройства',exact:true}).click();await until(()=>B.p.locator('#aibox .aien').first().innerText().then(t=>/6 ×/.test(t)),'выбрана серверная версия');
 await edit(A.p,9);await until(()=>count()===9,'новая версия A');await edit(B.p,10);await notice.filter({hasText:'Какой оставить'}).waitFor();
 await notice.getByRole('button',{name:'Мои правки',exact:true}).click();await until(()=>count()===10,'явно выбранная моя версия');
 console.log('PASS конфликт двух устройств виден; обе явные стратегии выбора версии работают');
 let releasePull;const pullGate=new Promise(r=>releasePull=r),holdPull=async r=>{await pullGate;await r.fallback();};await A.p.route(/\/all\?/,holdPull);
 await B.p.click('#aidrop');await until(()=>row().draft.length===0,'удаление черновика');await A.p.click('#aiapply');releasePull();await until(()=>A.p.locator('#aibox .aiex').count().then(n=>n===0),'старую версию нельзя принять после удаления на другом устройстве');await A.p.unroute(/\/all\?/,holdPull);assert.equal(f.sq.prepare("SELECT data FROM state WHERE uid='svc_settings' AND key='aiprog'").get(),undefined);await A.p.reload();await sleep(700);await open(A.p);await until(()=>A.p.locator('#aibox .aiex').count().then(n=>n===0),'старый черновик снят после сверки сервера');assert.equal(row().draft.length,0);
 console.log('PASS удалённый черновик не воскресает из старой копии телефона');
 // Сеть пропала именно при сохранении; очередь и локальный черновик живут после reload.
 f.fail=true;await A.p.click('#recobox [data-rb="go"]');await A.p.waitForSelector('#aibox .aiex');await edit(A.p,8);await A.p.reload();await sleep(900);await open(A.p);assert.match(await A.p.locator('#aibox .aien').first().innerText(),/8 ×/);assert.equal(row().draft.length,0);
 f.fail=false;await A.p.evaluate(()=>window.dispatchEvent(new Event('online')));await until(()=>count()===8,'досылка очереди');
 const C=await setup('light',390);await open(C.p);await C.p.waitForSelector('#aibox .aiex');assert.match(await C.p.locator('#aibox .aien').first().innerText(),/8 ×/);
 const failProgram=async r=>{const body=JSON.parse(r.request().postData()||'{}');if(body.key==='aiprog')await r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'fixture program save failed'})});else await r.fallback();};
 await C.p.route(/\/s$/,failProgram);await C.p.click('#aiapply');await until(()=>C.p.locator('#profm').evaluate(e=>!e.classList.contains('show')),'локальное принятие при сбое записи');await sleep(250);
 assert.equal(row().draft.length,1,'нет подтверждения действующей программы — серверный черновик не удаляем');
 await C.p.unroute(/\/s$/,failProgram);await open(C.p);await C.p.click('#aiapply');await until(()=>row().draft.length===0,'принятие убрало черновик после подтверждения');
 await C.p.reload();await sleep(900);await open(C.p);assert.equal(await C.p.locator('#aibox .aiex').count(),0);
 assert.equal(f.sq.prepare("SELECT data FROM state WHERE uid='svc_settings' AND key='aiprog'").get()!=null,true);
 console.log('PASS офлайн-перезапуск, автоматическая досылка, второй компьютер и принятие без остаточного черновика');
 const fresh=fixture(),newPages=[];
 const newbie=async()=>{const p=await br.newPage({viewport:{width:390,height:844}});newPages.push(p);await M.поднять(p,{newbie:true,preserveReload:true,handleRoute:fresh.route,onOnboard:()=>({ok:true,prog:PROG,wt:'down',gym:'muscle',goal:'lose_muscle',goalObj:null,ask:null,options:[],left:0,hint:'',likes:[],dislikes:[],sports:null})});return p;};
 const n1=await newbie();await M.шаги(n1,{});await n1.click('#wz-go');await n1.waitForSelector('#wzchat .aiex');
 await n1.click('#wzchat [data-aiedit="params"][data-aiindex="0"]');await n1.fill('#wzchat .aiparams [name="sets"]','5');
 await until(()=>{const r=fresh.sq.prepare("SELECT data FROM state WHERE uid='svc_settings' AND key='program_draft'").get();return r&&JSON.parse(r.data).draft[0]?.prog.days[0].ex[0].sets===5;},'черновик знакомства');
 const n2=await newbie();await n2.waitForSelector('#wzchat .aiex',{timeout:10000});assert.match(await n2.locator('#wzchat .aien').first().innerText(),/5 ×/);
 await n1.reload();await n1.locator('#onbbar').waitFor();await n1.click('#onbbar');await n1.waitForSelector('#wzchat .aiex');assert.match(await n1.locator('#wzchat .aien').first().innerText(),/5 ×/);
 console.log('PASS первое знакомство: черновик с набранными подходами восстанавливается на другом устройстве и после reload');
 for(const x of [A,B,C])assert.deepEqual(x.errors,[]);
}finally{await br.close();}})().catch(e=>{console.error(e);process.exitCode=1});
