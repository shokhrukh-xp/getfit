'use strict';
/* 18.10: полный проход профиля и реальные ответы /s вместо обещания от
   CloudStorage. Проверяем разделы, независимость настроек, отказ/повтор,
   быстрые правки и загрузку того же профиля в новом контексте браузера. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean'),assert=require('assert/strict'),bounds=require('./viewport-check'),contrast=require('./contrast-check'),fs=require('fs'),path=require('path');
const initial=()=>({...opts('dark').me,when:'evening',voice:'standard',med:null,focus:['back'],
 byt:{cook:'сам',family:2,where:['кафе'],rules:['без арахиса'],source_tag:'из разговора'}});
const copy=x=>JSON.parse(JSON.stringify(x)),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,t){for(let i=0;i<500;i++){if(await fn())return;await sleep(15)}throw Error('Не дождался: '+t)}
function backend(me=initial()){
 const state={me:copy(me),updated:1,fail:false,delay:0,writes:[],active:0,max:0};
 state.route=async r=>{const u=new URL(r.request().url());
  if(u.pathname==='/all'){await r.fulfill({contentType:'application/json',body:JSON.stringify({state:[{key:'me',data:{me:state.me},updated:state.updated}],workouts:[],meals:[],measures:[]})});return true}
  if(u.pathname!=='/s')return false;const b=JSON.parse(r.request().postData());if(b.key!=='me')return false;
  state.writes.push(copy(b.data.me));state.active++;state.max=Math.max(state.max,state.active);
  if(state.delay)await sleep(state.delay);const fail=state.fail;if(!fail){state.me=copy(b.data.me);state.updated=Date.now()}
  state.active--;await r.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{error:'Проверка: сервер недоступен'}:{ok:true,updated:state.updated})});return true;};return state;
}
async function start(b,s,theme='dark',width=390,extra={}){const p=await b.newPage({viewport:{width,height:844}});p.setDefaultTimeout(8000);
 const o={...opts(theme),me:initial(),meas:[],hist:[],preserveReload:true,handleRoute:s.route,...extra};
 const errors=await M.поднять(p,o);await sleep(1200);await until(()=>s.active===0,'начальная синхронизация');s.writes=[];s.max=0;
 await p.click('#profbtn');return{p,errors};}
const shot=async(p,name)=>{if(process.env.GF_PROFILE_SHOTS){fs.mkdirSync(process.env.GF_PROFILE_SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.GF_PROFILE_SHOTS,name+'.png')});}};
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['dark','light'])for(const width of [320,390]){
  const s=backend(),{p,errors}=await start(b,s,theme,width),tag=theme+'-'+width;
  const check=async label=>{assert.deepEqual(await bounds(p),[],label+': viewport');assert.deepEqual((await contrast(p,'#profm')).failures,[],label+': contrast');};
  await check('список');await shot(p,'profile-'+tag);
  // Характер не заполняет здоровье и не стирает время/быт/предпочтения программы.
  await p.click('#pq-voice');await p.click('#me-voice [data-v="fun"]');await until(()=>s.me.voice==='fun','характер');
  assert.equal(s.me.when,'evening');assert.equal(s.me.med,null);assert.deepEqual(s.me.byt,initial().byt);assert.deepEqual(s.me.focus,['back']);
  await check('характер');await shot(p,'voice-'+tag);await p.click('#pqback');
  // Здоровье: один тап, дополнительные ответы, текст; остальные разделы прежние.
  await p.click('#zdtoggle');await p.click('#zd-dia [data-v="t2"]');await p.click('#zd-ins [data-v="0"]');await p.click('#zd-low [data-v="1"]');await p.click('#zd-more [data-v="bp"]');await p.fill('#zd-no','орехи');
  await until(()=>s.me.med?.no==='орехи'&&s.me.med.bp===1,'здоровье');assert.equal(s.me.med.dia,'t2');assert.equal(s.me.med.ins,0);assert.equal(s.me.med.low,1);assert.equal(s.me.when,'evening');assert.deepEqual(s.me.byt,initial().byt);
  await check('здоровье');await shot(p,'health-'+tag);await p.click('#pqback');
  // Значения, записанные тренером словами, видны и редактируются как остальные.
  await p.click('#bttoggle');assert.equal(await p.locator('#bt-where [data-v="кафе"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#bt-rules [data-v="без арахиса"]').getAttribute('aria-pressed'),'true');
  await p.fill('#bt-family','3');await p.locator('#bt-family').blur();await p.fill('#bt-home','рис, яйца');await p.locator('#bt-home').blur();await p.click('#bt-bud [data-v="эконом"]');
  await until(()=>s.me.byt.family===3&&s.me.byt.home==='рис, яйца'&&s.me.byt.budget==='эконом','быт');assert.deepEqual(s.me.byt.where,['кафе']);assert.equal(s.me.byt.source_tag,'из разговора');assert.equal(s.me.med.no,'орехи');
  await check('быт');await shot(p,'household-'+tag);await p.click('#pqback');
  await p.click('#pq-only');await p.click('#me-only [data-v="food"]');await until(()=>s.me.only==='food','только еда');await p.click('#pqback');assert.equal(await p.locator('#pq-gym').isVisible(),false);
  await p.click('#pq-only');await p.click('#me-only [data-v="all"]');await until(()=>s.me.only==='all','еда и зал');await p.click('#pqback');assert(await p.locator('#pq-gym').isVisible());
  // Программа, сборка, справка, цель, приглашение, админка и сброс: переходы назад.
  await p.click('#pq-gym');await p.click('#progedit');assert(await p.locator('#sborm').isVisible());await p.click('#sborclose');await p.waitForTimeout(100);assert(await p.locator('#profm').isVisible());await p.click('#pqback');
  await p.click('#pq-ref');assert((await p.locator('#reflink').inputValue()).includes('t.me'));await p.click('#refshare');assert((await p.evaluate(()=>window.__ссылки||[])).length>0);await check('друзья');await p.click('#pqback');
  assert.equal(await p.locator('#profhow').count(),0);  /* 22.10: справку убрали — подсказки по месту */
  await p.click('#goalcard [data-bodygoal]');assert(await p.locator('#coachm').isVisible());await p.waitForFunction(()=>document.getElementById('goalconversation').dataset.state==='screen');assert.match(await p.locator('#goalconversation').innerText(),/Чего хотите/i);await p.click('#coachclose');await p.locator('#profm').waitFor({state:'visible'});assert.equal(await p.evaluate(()=>document.getElementById('coachtitle').textContent),'Тренер');
  await p.click('#profreset');assert(await p.locator('#resetm').isVisible());await p.click('#resetclose');await p.locator('#profm').waitFor({state:'visible'});
  // Базовые параметры: ошибочное значение не сохраняется даже при правке другого раздела.
  await p.click('#meedit');const age=s.me.age;await p.fill('#me-age','');await p.locator('#me-age').blur();assert(await p.locator('#me-error').isVisible());assert.equal(s.me.age,age);
  await p.click('#pq-voice');await p.click('#me-voice [data-v="hard"]');await until(()=>s.me.voice==='hard','характер при пустом возрасте');assert.equal(s.me.age,age);await p.click('#pqback');
  await p.fill('#me-age','40');await p.locator('#me-age').blur();await until(()=>s.me.age===40,'корректный возраст');assert.equal(await p.locator('#me-error').count(),0);
  await p.selectOption('#me-sex','f');await p.fill('#me-ht','176');await p.locator('#me-ht').blur();await p.fill('#me-bw','83,5');await p.locator('#me-bw').blur();await until(()=>s.me.sex==='f'&&s.me.ht===176&&s.me.bw===83.5,'пол рост вес');
  assert.equal(s.me.when,'evening');assert.equal(s.me.med.no,'орехи');assert.equal(s.me.byt.family,3);await check('параметры');await shot(p,'parameters-'+tag);
  await p.reload();await p.waitForTimeout(1200);await p.click('#profbtn');assert.match(await p.locator('#mesumt').innerText(),/40/);assert.equal(await p.locator('#pv-voice').innerText(),'саркастичный');assert.deepEqual(errors,[]);await p.close();
  const second=await start(b,s,theme,width);assert.match(await second.p.locator('#mesumt').innerText(),/40/);assert.equal(await second.p.locator('#pv-voice').innerText(),'саркастичный');await second.p.close();
  console.log('PASS '+tag+': все разделы, кнопки, независимость настроек, параметры, перезапуск и другой контекст');
 }
 // На телефоне: полноэкранный Telegram, короткое окно при клавиатуре и имя без букв.
 for(const theme of ['dark','light'])for(const width of [320,390]){
  const s=backend(),{p}=await start(b,s,theme,width);
  await p.evaluate(()=>{Telegram.WebApp.initDataUnsafe.user.first_name='';const st=document.documentElement.style;st.setProperty('--tg-safe-area-inset-top','59px');st.setProperty('--tg-content-safe-area-inset-top','46px');});
  await p.click('#profclose');await p.click('#profbtn');assert.equal(await p.locator('#pqava svg').count(),1,'без имени — значок профиля');assert.equal(await p.locator('#pqname').innerText(),'Профиль');
  for(const id of ['zdtoggle','bttoggle','pq-only','pq-voice','pq-gym','pq-ref']){
   await p.click('#'+id);const box=await p.locator('#profm .modalbox').boundingBox();assert(box.y>=105,'лист ниже кнопок Telegram');assert.deepEqual(await bounds(p),[]);
   if(id==='zdtoggle'||id==='bttoggle'){
    await p.setViewportSize({width,height:400});const field=p.locator(id==='zdtoggle'?'#zd-no':'#bt-home');await field.focus();await field.scrollIntoViewIfNeeded();
    const r=await field.boundingBox();assert(r.y>=105&&r.y+r.height<=400,'поле доступно при уменьшенном окне');await shot(p,(id==='zdtoggle'?'keyboard-health-':'keyboard-household-')+theme+'-'+width);await p.setViewportSize({width,height:844});
   }
   await p.click('#pqback');
  }await p.close();
 }console.log('PASS оба размера/темы: Telegram safe-area, короткое окно полей, аватар без имени');
 // «Обычно хожу» тоже подтверждается сервером, а не резервной копией.
 {const s=backend(),{p}=await start(b,s);await p.click('#profclose');await p.click('.l1 [data-page="gym"]');await p.click('#schedbtn');s.fail=true;
  await p.click('#schedwhen [data-v="morning"]');await p.locator('#schedm .save-notice').filter({hasText:'отправлю сам'}).waitFor();assert.equal(s.me.when,'evening');s.fail=false;
  await p.click('#schedwhen [data-v="day"]');await until(()=>s.me.when==='day','обычно хожу');await p.waitForFunction(()=>document.querySelector('#schedm .save-notice').textContent==='Сохранено');await p.close();console.log('PASS обычно хожу: отказ виден, успех только по серверу');}
 // Сервер отказал (503), Telegram подтвердил: 22.10 — спокойное «отправлю сам», очередь досылает сама, данные не теряются.
 {const s=backend(),{p}=await start(b,s);s.fail=true;await p.click('#pq-voice');await p.click('#me-voice [data-v="fun"]');await p.locator('.pqpage[data-pp="voice"] .save-notice').filter({hasText:'отправлю сам'}).waitFor();assert.equal(await p.locator('.pqpage[data-pp="voice"] .save-notice.bad').count(),0);
  assert.equal(s.me.voice,'standard');await shot(p,'save-error-dark-390');s.fail=false;await p.evaluate(()=>window.dispatchEvent(new Event('online')));await until(()=>s.me.voice==='fun','повтор');await p.waitForFunction(()=>document.querySelector('.pqpage[data-pp="voice"] .save-notice').textContent==='Сохранено');await shot(p,'save-success-dark-390');await p.close();console.log('PASS отказ /s, сохранность выбора, повтор сам и честный успех');}
 // Ошибка только резервной копии Telegram не превращает серверный успех в отказ.
 {const s=backend(),{p,errors}=await start(b,s);await p.evaluate(()=>{window.Telegram.WebApp.CloudStorage.setItem=(k,v,cb)=>cb('fixture',false)});await p.click('#pq-voice');await p.click('#me-voice [data-v="fun"]');await until(()=>s.me.voice==='fun','сервер при сбое CS');await p.waitForFunction(()=>document.querySelector('.pqpage[data-pp="voice"] .save-notice').textContent==='Сохранено');assert.equal(await p.locator('.pqpage[data-pp="voice"] .save-notice.bad').count(),0);assert.deepEqual(errors,[]);await p.close();console.log('PASS Telegram-копия недоступна, /s ok — Сохранено');}
 // Медленный первый запрос не может перезаписать самый новый выбор.
 {const s=backend(),{p}=await start(b,s);s.delay=500;await p.click('#pq-voice');await p.click('#me-voice [data-v="fun"]');await p.click('#me-voice [data-v="hard"]');await until(()=>s.me.voice==='hard'&&s.active===0,'последний выбор');assert.equal(s.max,1);assert.equal(s.me.when,'evening');await p.close();console.log('PASS быстрые правки: последовательно, последнее значение hard остаётся в облаке');}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
