'use strict';
/* 30.10, его слова: «Почему он меня спрашивает заполнить профиль возраст и рост? Почему мои
   изменения в программе не сохраняются? я просто соединил несколько упражнений в суперсэты».
   На сервере профиль полный, а на телефоне: (1) правка суперсета получила 409 «изменено на
   другом устройстве» и висела первой в очереди — «Повторить» в зале её не трогал, свежие
   данные не принимались; (2) копия профиля без возраста и роста. Причина 409 — база правок
   дня без pr (суперсетов). Заперто: база с pr — правка пары уходит как ['pr', день], а не весь
   pr; застрявшая правка дня сама ложится поверх серверной; неполный профиль берётся с сервера;
   суперсеты с сервера принимаются. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),M=require('./mock'),PROG=require('./fixtures/prog-3dnya.json');
const UID='308687648', ME={me:{sex:'m',age:34,ht:178,bw:85.6,wt:'down',gym:'muscle',goal:'fat',level:'mid',only:'all',place:'gym',min:45}};
const СЕРВЕР_SUBS={s:{},adj:{},x:{},sk:{},ord:{},pr:{A3:[{a:'A3:0',b:'A3:1',d:null}]}};
const МОИ_ПАРЫ={A3:[{a:'A3:0',b:'A3:1',d:null}],A2:[{a:'A2:0',b:'A2:1',d:null}]};
async function стенд(browser,засеять,сервер){
  const page=await browser.newPage({viewport:{width:390,height:844}}), posts=[];
  if(засеять)await page.addInitScript(засеять,{UID,МОИ_ПАРЫ,СЕРВЕР_SUBS});
  await M.поднять(page,{wait:0,prog:PROG,profile:'ai',me:сервер.локМе||ME.me,handleRoute:async route=>{
    const u=new URL(route.request().url());
    if(u.pathname==='/s'&&route.request().method()==='POST'){const b=JSON.parse(route.request().postData()||'{}');posts.push(b);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:b.data,updated:Date.now()})}).then(()=>true,()=>true);}
    if(u.pathname!=='/all')return false;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:[
      {key:'aiprog',data:PROG,updated:1},{key:'prof',data:{p:'ai',at:'2026-10-28T15:03:00.163Z',start:'2026-09-06'},updated:2},
      {key:'me',data:ME,updated:3},{key:'subs',data:сервер.subs||СЕРВЕР_SUBS,updated:4}],workouts:[],meals:[],measures:[]})});
    return true;}});
  return {page,posts};
}
(async()=>{
  const browser=await chromium.launch();
  try{
    /* 1. застрявшая правка суперсета с 409 — сама уходит, его пары поверх серверных */
    let {page,posts}=await стенд(browser,({UID,МОИ_ПАРЫ,СЕРВЕР_SUBS})=>{
      if(sessionStorage.getItem('seeded'))return; sessionStorage.setItem('seeded','1');
      localStorage.setItem('shp_v1_ai_pairs',JSON.stringify(МОИ_ПАРЫ));
      localStorage.setItem('shp_v1_sync_dirty',JSON.stringify({subs:1}));
      localStorage.setItem('shp_v1_settings_queue_'+UID,JSON.stringify({subs:[{id:'op_old',at:Date.now()-3600e3,epoch:0,
        data:{s:{},adj:{},x:{},sk:{},ord:{},pr:МОИ_ПАРЫ},changes:[{path:['pr'],before:{set:false},after:{set:true,value:МОИ_ПАРЫ}}],
        conflict:СЕРВЕР_SUBS,conflictPaths:[['pr']]}]}));
    },{});
    await page.waitForTimeout(4500);
    const subsPost=posts.find(b=>b.key==='subs');
    assert.ok(subsPost,'застрявшая правка дня отправлена: '+JSON.stringify(posts.map(b=>b.key)));
    assert.deepEqual(subsPost.data.pr,МОИ_ПАРЫ,'его суперсеты ушли на сервер');
    const q=await page.evaluate(u=>JSON.parse(localStorage.getItem('shp_v1_settings_queue_'+u)||'{}'),UID);
    assert.ok(!(q.subs||[]).length,'очередь правок дня пуста: '+JSON.stringify(q).slice(0,300));
    await page.close();
    console.log('PASS застрявшая правка суперсета (409) — сама ложится поверх серверной, очередь пуста');

    /* 2. копия профиля без возраста и роста — берётся с сервера, плашки нет */
    ({page,posts}=await стенд(browser,null,{локМе:{bw:85,wt:'down',gym:'muscle',goal:'fat',only:'all'}}));
    await page.waitForTimeout(4000);
    const me=await page.evaluate(()=>JSON.parse(localStorage.getItem('shp_v1_me')||'{}'));
    assert.equal(me.age,34); assert.equal(me.ht,178);
    assert.ok(!/Заполните профиль/.test(await page.evaluate(()=>document.body.innerText)),'плашки «Заполните профиль» нет');
    await page.close();
    console.log('PASS неполный профиль на телефоне — берётся с сервера, плашки нет');

    /* 3. суперсеты с сервера принимаются; база правок дня при запуске — с pr */
    ({page,posts}=await стенд(browser,null,{}));
    await page.waitForTimeout(3500);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('shp_v1_ai_pairs')||'null')),СЕРВЕР_SUBS.pr,'суперсеты с сервера приняты');
    await page.close();
    const src=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
    assert.match(src,/settingsRemember\('subs',\{s:SUBS,adj:ADJ,x:EXTRA,sk:SKIP,ord:ORD,pr:PAIRS\}\)/,'база правок дня при запуске знает суперсеты');
    console.log('PASS суперсеты с сервера принимаются; база правок дня — с pr');
  }finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
