'use strict';
// 19.10: первое открытие на компьютере не выдаёт недогруженную анкету за пустую.
const {chromium}=require('playwright'),assert=require('assert/strict'),M=require('./mock'),{opts}=require('./shot-clean'),bounds=require('./viewport-check'),contrast=require('./contrast-check'),fs=require('fs'),path=require('path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const actual={sex:'f',age:32,ht:164,bw:53.3,wt:'keep',gym:'health',only:'food',voice:'fun',med:{bp:1,at:Date.now()},byt:{cook:'семья',where:['дома'],family:2}};
const goal={wt:'keep',gym:'health',text:'Сохранять вес 53,3 кг'};
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const p=await b.newPage({viewport:{width,height:844}});let mode='slow',delay=1800,writes=0;
  const errors=await M.поднять(p,{...opts(theme),me:{bw:53.3},meas:[],goal,progress:null,handleRoute:async r=>{
   const u=new URL(r.request().url());if(u.pathname==='/s'){writes++;const body=JSON.parse(r.request().postData()||'{}');if(body.key==='me'){await r.fulfill({json:{ok:true,data:{me:actual},updated:Date.now()}});return true;}}
   if(u.pathname!=='/all')return false;
   const m=mode;await sleep(delay);
   if(m==='fail'){await r.fulfill({status:503,body:'unavailable'});return true;}
   if(m==='invalid'){await r.fulfill({json:{state:[{key:'me',data:{me:null}}]}});return true;}
   await r.fulfill({json:{state:[{key:'me',updated:Date.now(),data:{me:actual}}],workouts:[],deleted:[]}});return true;
  }});
  await p.click('#profbtn');await p.locator('#profileload').waitFor();
  assert.match(await p.locator('#profileloadtext').innerText(),/Загружаем профиль/);
  assert.equal(await p.locator('#profilecontent').isVisible(),false);
  assert.equal(await p.locator('#meedit').isVisible(),false);
  assert.equal(await p.locator('#goalcard').isVisible(),false);
  assert.equal(await p.locator('#profm').getAttribute('aria-busy'),'true');
  assert.deepEqual(await bounds(p),[]);assert.deepEqual((await contrast(p,'#profm')).failures,[]);
  if(process.env.GF_PROFILE_SHOTS){fs.mkdirSync(process.env.GF_PROFILE_SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.GF_PROFILE_SHOTS,`loading-${theme}-${width}.png`)});}
  await p.locator('#profilecontent').waitFor();assert.match(await p.locator('#mesumt').innerText(),/жен.*32.*164.*53,3/);assert.match(await p.locator('#goalcard').innerText(),/Сохранять вес/);assert.match(await p.locator('#zdsum').innerText(),/давление/);
  await p.click('#zdtoggle');assert.equal(await p.locator('#zd-more [data-v="bp"]').getAttribute('aria-pressed'),'true');await p.click('#pqback');
  assert.deepEqual(errors,[]);
  if(theme==='light'&&width===390){
   // При каждом новом открытии сверяем данные; 5xx не показывает старую анкету.
   await p.click('#profclose');mode='fail';delay=10;await p.click('#profbtn');await p.locator('#profileretry').waitFor();assert.equal(await p.locator('#profilecontent').isVisible(),false);
   assert.match(await p.locator('#profileloadtext').innerText(),/Не удалось загрузить профиль/);
   mode='invalid';await p.click('#profileretry');await p.locator('#profileretry').waitFor();assert.equal(await p.locator('#profilecontent').isVisible(),false);
   mode='ok';await p.click('#profileretry');await p.locator('#profilecontent').waitFor();assert.match(await p.locator('#mesumt').innerText(),/жен/);
   // Исправление реально пришло с сервера без перезапуска окна.
   await p.click('#profclose');actual.age=33;await p.click('#profbtn');await p.locator('#profilecontent').waitFor();assert.match(await p.locator('#mesumt').innerText(),/33/);
   if(process.env.GF_PROFILE_SHOTS)await p.screenshot({path:path.join(process.env.GF_PROFILE_SHOTS,'ready.png')});
   console.log('PASS ошибка, повреждённый ответ, повтор и новые данные при следующем открытии');
  }
  actual.age=32;await p.close();console.log(`PASS ${theme} ${width}: ожидание скрывает поля; подтверждённые анкета, цель и здоровье показаны без повторного открытия`);
 }
 // Новичок: только подтверждённое отсутствие данных разрешает пустую анкету.
 {const p=await b.newPage();await M.поднять(p,{...opts('light'),me:{},meas:[],goal:null});await p.click('#profbtn');await p.locator('#profilecontent').waitFor();assert.equal(await p.locator('#mesumt').innerText(),'');await p.click('#meedit');assert.equal(await p.locator('#me-sex').inputValue(),'');assert.match(await p.locator('#goalcard').innerText(),/Цель не задана/);await p.close();console.log('PASS настоящая пустая анкета после ответа сервера; неизвестный пол не превращается в мужской');}
 // Запоздалая старая анкета Telegram не перезаписывает подтверждённую сервером.
 {const p=await b.newPage();let wrapped=false;const confirmed={sex:'f',age:30,ht:164,bw:53.3};
  await M.поднять(p,{...opts('light'),me:{bw:53.3},meas:[],goal:null,handleRoute:async r=>{
   const u=new URL(r.request().url());
   if(u.pathname==='/session'&&!wrapped){wrapped=true;await p.evaluate(()=>{const cs=window.Telegram.WebApp.CloudStorage,read=cs.getItem;cs.getItem=function(k,cb){if(/state_me$/.test(k)){setTimeout(()=>cb(null,JSON.stringify({me:{sex:'m',age:40,ht:180,bw:70}})),4000);return;}return read.call(cs,k,cb);};});}
   if(u.pathname!=='/all')return false;await r.fulfill({json:{state:[{key:'me',updated:Date.now(),data:{me:confirmed}}],workouts:[]}});return true;
  }});
  await p.click('#profbtn');await p.locator('#profilecontent').waitFor();assert.match(await p.locator('#mesumt').innerText(),/жен.*30/);await sleep(4300);assert.match(await p.locator('#mesumt').innerText(),/жен.*30/);
  // Следующая перерисовка тоже использует подтверждённую анкету.
  await p.click('#meedit');assert.equal(await p.locator('#me-sex').inputValue(),'f');assert.equal(await p.locator('#me-age').inputValue(),'30');await p.close();console.log('PASS запоздалая старая анкета Telegram не затирает серверную даже без цели');
 }
 // Цель — часть профиля: медленный ответ и её отдельная ошибка не выглядят как отсутствие цели.
 {const p=await b.newPage();let fail=true;await M.поднять(p,{...opts('light'),goalDelay:1800,handleRoute:async r=>{if(new URL(r.request().url()).pathname!=='/goal'||!fail)return false;await sleep(1800);await r.fulfill({status:503,json:{ok:false}});return true;}});
  await p.click('#profbtn');assert.equal(await p.locator('#profilecontent').isVisible(),false);await p.locator('#profileretry').waitFor();fail=false;await p.click('#profileretry');assert.equal(await p.locator('#goalcard').isVisible(),false);await p.locator('#profilecontent').waitFor();assert.match(await p.locator('#goalcard').innerText(),/75 кг/);await p.close();console.log('PASS медленная цель, отдельный отказ и успешный повтор');
 }
 // Старая отметка синхронизации из прошлого запуска не делает кеш достоверным.
 {const p=await b.newPage();await M.поднять(p,{...opts('light'),preserveReload:true,goal:null,handleRoute:async r=>{if(new URL(r.request().url()).pathname!=='/all')return false;await r.fulfill({json:{state:[{key:'me',updated:100,data:{me:actual}}],workouts:[]}});return true;}});
  await p.evaluate(()=>{for(const k of Object.keys(localStorage)){if(k.endsWith('sync_marks'))localStorage.setItem(k,JSON.stringify({me:Date.now()+86400000}));if(k.endsWith('_me')&&!k.startsWith('cs_'))localStorage.setItem(k,JSON.stringify({sex:'m',age:60,ht:180,bw:80}));}});
  await p.reload();await p.click('#profbtn');await p.locator('#profilecontent').waitFor();assert.match(await p.locator('#mesumt').innerText(),/жен.*32.*164/);await p.close();console.log('PASS старая отметка синхронизации не скрывает актуальную серверную анкету');
 }
 // Зависший запрос имеет предел ожидания; поздний ответ не открывает ошибочный экран.
 {const p=await b.newPage();p.setDefaultTimeout(30000);let delayed=true;await M.поднять(p,{...opts('light'),handleRoute:async r=>{const routePath=new URL(r.request().url()).pathname;if(routePath==='/s'){await r.fulfill({json:{ok:true,data:{me:actual},updated:Date.now()}});return true;}if(routePath!=='/all')return false;const old=delayed,updated=Date.now();if(old)await sleep(24000);try{await r.fulfill({json:{state:[{key:'me',updated,data:{me:old?{sex:'m',age:90}:actual}}],workouts:[]}});}catch(e){}return true;}});
  await p.click('#profbtn');await p.locator('#profileretry').waitFor();assert.equal(await p.locator('#profilecontent').isVisible(),false);delayed=false;await p.click('#profileretry');await p.locator('#profilecontent').waitFor();await sleep(4500);assert.match(await p.locator('#mesumt').innerText(),/жен.*32/);await p.close();console.log('PASS предел ожидания, повтор и защита от запоздалого ответа');
 }
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
