'use strict';
// 19.10: не только выбранная кнопка — проверяем эффект и повторный запуск.
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean'),assert=require('assert/strict'),{fixture,start,server,until,sleep}=require('./test-settings-save');
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['dark','light'])for(const width of [320,390]){
  const f=fixture();f.sq.exec('CREATE TABLE workouts(uid TEXT,id TEXT,date TEXT,day TEXT,data TEXT,updated INTEGER);');
  const orig=f.route;f.route=async r=>{const u=new URL(r.request().url());
   if(u.pathname==='/day'){
    const me=await server.profileOf(f.env,'svc_settings'),tg=server.targets(me,null,0,0,0);f.reads=(f.reads||[]).concat({sex:me.sex,age:me.age,kid:me.med?.kid,kcal:tg.kcal,prot:tg.prot});
    await r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,day:M.день({date:u.searchParams.get('date')||M.Д(0),targets:tg})})});return true;
   }return orig(r);
  };
  const {p,errors}=await start(b,f,theme,width);f.reads=[];
  // Не меняем вкладку: здоровье → норма в уже открытой главной.
  if(!process.env.GF_EMPTY_ONLY){await p.click('#zdtoggle');await p.click('#zd-dia [data-v="t2"]');await p.click('#zd-osl [data-v="kid"]');await until(()=>f.me().med.kid===1,'ограничение сохранено');
  await until(()=>f.reads?.some(x=>x.kid===1),'норма перечитана после сохранения здоровья без смены вкладки');
  const after=f.reads.find(x=>x.kid===1);assert.match(await p.locator('#fday [data-fk="prot"] .fh b').innerText(),new RegExp('/ '+after.prot+'(?:[– \u00a0]|$)'),'новая граница белка уже отрисована');assert(after.prot<server.targets({...f.me(),med:{}},null,0,0,0).prot);
  await p.click('#pqback');}await p.click('#profclose');await p.click('.l1 [data-page="gym"]');await p.click('#schedbtn');
  // Все семь — отдых. Пустой объект означает выбор, не отсутствие настройки.
  while(await p.locator('#schedlist .schrow.on').count())await p.locator('#schedlist .schrow.on').first().click();
  await until(()=>{const r=f.sq.prepare("SELECT data FROM state WHERE uid='svc_settings' AND key='sched'").get();return r&&Object.keys(JSON.parse(r.data).s||{}).length===0},'пустое расписание на сервере');
  await p.reload();await sleep(1800);await p.click('.l1 [data-page="gym"]');await p.click('#schedbtn');assert.equal(await p.locator('#schedlist .schrow.on').count(),0,'все дни отдыха остаются после перезапуска');
  const remote=f.me();remote.only='food';f.sq.prepare("UPDATE state SET data=?,updated=? WHERE uid='svc_settings' AND key='me'").run(JSON.stringify({me:remote}),Date.now()+1000);
  await p.evaluate(()=>{const D=Date;window.Date=new Proxy(D,{get:(t,k)=>k==='now'?()=>t.now()+21000:Reflect.get(t,k)});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForFunction(()=>document.body.classList.contains('nogym'));
  assert.deepEqual(errors,[]);await p.close();console.log('PASS '+theme+width+': здоровье меняет норму сразу, все дни отдыха переживают reload');
 }
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
