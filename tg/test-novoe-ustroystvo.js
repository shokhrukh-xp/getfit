'use strict';
/* 30.10, его слова: «Я когда вхожу с личного аккаунта, у меня уже который раз
   открывается страница с самого начала — выбор, что отслеживать… Я уже подумал,
   что все мои данные сбросились». Устройство без своих данных (новый адрес,
   почищенное хранилище Telegram), а на сервере профиль, своя программа (p:'ai')
   и анкета есть. Заперто: знакомство не показывается, пока сервер не ответил;
   ответ пришёл с данными — сразу приложение, анкеты не было ни на миг; пока ждём —
   «Загружаю ваши данные…». Новичок (на сервере пусто) и сбой сервера — знакомство, как раньше. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),M=require('./mock'),PROG=require('./fixtures/prog-3dnya.json');
const ME={me:{sex:'m',age:34,ht:178,bw:85.6,wt:'down',gym:'muscle',goal:'fat',level:'mid',only:'all',place:'gym',min:45}};
async function прогон(browser,задержка,ответ){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const t0=Date.now(),лог=[];
  await M.поднять(page,{newbie:true,wait:0,handleRoute:async route=>{
    const u=new URL(route.request().url());
    if(u.pathname!=='/all')return false;
    await new Promise(r=>setTimeout(r,задержка));
    if(ответ==='пусто')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:[],workouts:[],meals:[],measures:[]})}).then(()=>true,()=>true);
    if(ответ==='еда')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:[{key:'me',data:{me:Object.assign({},ME.me,{only:'food'})},updated:3}],workouts:[],meals:[],measures:[]})}).then(()=>true,()=>true);
    if(ответ==='сбой')return route.fulfill({status:500,contentType:'application/json',body:'{"error":"сбой"}'}).then(()=>true,()=>true);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:[
      {key:'aiprog',data:PROG,updated:1},{key:'prof',data:{p:'ai',at:'2026-10-28T15:03:00.163Z',start:'2026-09-06'},updated:2},{key:'me',data:ME,updated:3}],workouts:[],meals:[],measures:[]})}).catch(()=>{});
    return true;}});
  for(let i=0;i<20;i++){
    const v=await page.evaluate(()=>{const p=document.getElementById('picker'),w=document.getElementById('cloudwait');
      return (p&&p.classList.contains('show')&&getComputedStyle(p).display!=='none')?'АНКЕТА':(w&&!w.hidden)?'жду':'приложение';}).catch(()=>null);
    лог.push(((Date.now()-t0)/1000).toFixed(1)+'с '+v);
    await page.waitForTimeout(250);
  }
  await page.close();
  return лог;
}
(async()=>{
  const browser=await chromium.launch();
  try{
    for(const з of [0,3000]){
      const лог=await прогон(browser,з);
      console.log('сервер отвечает через '+з+' мс: '+лог.join(' · '));
      assert.ok(!лог.some(x=>/АНКЕТА/.test(x)),'существующему человеку анкета не показывается ни на миг (задержка '+з+' мс)');
      assert.ok(/приложение/.test(лог[лог.length-1]),'в конце — приложение');
      if(з)assert.ok(лог.some(x=>/жду/.test(x)),'пока сервер молчит — «Загружаю ваши данные…»');
    }
    console.log('PASS новое устройство с данными на сервере — «Загружаю ваши данные…», потом приложение, без анкеты');
    let лог=await прогон(browser,0,'пусто');
    assert.ok(лог.slice(-4).every(x=>/АНКЕТА/.test(x)),'новичок — знакомство: '+лог.join(' · '));
    лог=await прогон(browser,0,'сбой');
    assert.ok(лог.slice(-4).every(x=>/АНКЕТА/.test(x)),'сервер ответил ошибкой — знакомство, как раньше: '+лог.join(' · '));
    console.log('PASS новичок и сбой сервера — знакомство');
    лог=await прогон(browser,0,'еда');
    assert.ok(!лог.some(x=>/АНКЕТА/.test(x))&&/приложение/.test(лог[лог.length-1]),'«только еда» с анкетой, но без указателя программы — приложение: '+лог.join(' · '));
    console.log('PASS «только еда» без указателя программы на сервере — приложение, без анкеты');
  }finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
