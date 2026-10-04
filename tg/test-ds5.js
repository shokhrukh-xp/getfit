'use strict';
const {chromium}=require('playwright'),M=require('./mock'),S=require('./ds5-scenes'),viewport=require('./viewport-check');
let failures=0;const ok=(v,t)=>{console.log((v?'  ok  ':'  ПРОВАЛ  ')+t);if(!v)failures++};
const progress={verdict:{state:'мало',text:'Мало замеров для сравнения.'},sila:{verdict:'растёт',up:1,flat:0,down:0,rows:[{name:'Подтягивания',now:{w:0,r:8,date:M.Д(1)},was:{w:0,r:6,date:M.Д(15)},pct:33},{name:'Жим',now:{w:60,r:8},was:{w:55,r:8},pct:9}]}};
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390]){
 for(const n of [0,1,3]){
  const p=await b.newPage({viewport:{width,height:844}});await M.поднять(p,{theme,meas:M.замеры().slice(0,n),goal:{text:"75 кг",wt:"down",rate:-.6,from:M.Д(29),w0:92},progress});
  ok(await p.locator('.vzverdict.muted').count()===1,'F1: вердикт мало виден при '+n+' замерах '+theme+'/'+width);
  ok(await p.locator('.vzsila').count()===1,'F1: сила независима от графика');
  await p.locator('.vzsila summary').click();const text=await p.locator('.vzsila').innerText();
  ok(text.includes('6 повт.')&&text.includes('8 повт.')&&!/(^|[^0-9])0×/.test(text),'F2: без веса — повторы');ok(text.includes('60×8')&&text.includes('33 %'),'вес снаряда и серверный процент сохранены');
  if(n===3)for(const metric of ['fat','prot','w']){await p.locator('[data-vzv="'+metric+'"]').click();ok(await p.locator('.vzsila').evaluate(e=>e.open),'F3: раскрытие сохранено на '+metric);}
  await p.click('.l1 [data-page="food"]');await p.click('.l1 [data-page="home"]');ok(await p.locator('.vzsila').evaluate(e=>e.open),'F3: раскрытие сохранено после возвращения');
  await p.locator('.vzsila summary').click();await p.click('.l1 [data-page="food"]');await p.click('.l1 [data-page="home"]');ok(!await p.locator('.vzsila').evaluate(e=>e.open),'явное сворачивание тоже сохранено');await p.close();
 }
 for(const name of ['profile','srez','meal-edit','coach','subscription','catalog-picker','schedule','onboard-filled']){
  const p=await b.newPage({viewport:{width,height:844}}),root=await S.open(p,name,theme);
  const geo=await p.locator(root+' .modalbox').evaluate(e=>{let c=getComputedStyle(e),h=e.querySelector('h3'),r=e.getBoundingClientRect();return {bg:c.backgroundColor,title:getComputedStyle(h).fontSize,weight:getComputedStyle(h).fontWeight,handle:getComputedStyle(e,'::before').display,left:r.left,right:r.right};});
  ok(geo.bg===(theme==='light'?'rgb(255, 255, 255)':'rgb(14, 20, 22)')&&geo.title==='20px'&&geo.weight==='700','лист по токенам '+name+'/'+theme+'/'+width);
  ok(geo.left>=0&&geo.right<=width,'лист в экране '+name);
  ok(await p.locator(root+' .xbtn').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44;})),'крестики >=44 '+name);
  if(name==='onboard-filled'){await p.locator('#wz-one').scrollIntoViewIfNeeded();ok(await p.locator('#wz-one').evaluate(e=>getComputedStyle(e).position==='static'&&e.getBoundingClientRect().top>=document.querySelector('#wz-text').getBoundingClientRect().bottom),'Собрать программу после полей, не перекрывает их');}
  await p.close();
 }
}
// Клавиатура: высота layout viewport и отдельно уменьшенный visual viewport.
for(const theme of ['light','dark'])for(const width of [320,430])for(const height of [844,667]){
 const p=await b.newPage({viewport:{width,height}});await S.open(p,'coach',theme);ok(await p.locator('#ctext').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16),'поле чата не вызывает увеличение из-за мелкого шрифта');await p.focus('#ctext');
 await p.evaluate(({height})=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:height-300});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:20});visualViewport.dispatchEvent(new Event('resize'));}, {height});
 await p.waitForTimeout(150);
 const r=await p.locator('#csend').evaluate(e=>{const r=e.getBoundingClientRect(),v=visualViewport;return {top:r.top,bottom:r.bottom,limit:v.offsetTop+v.height,width:r.width,height:r.height};});
 ok(r.top>=20&&r.bottom<=r.limit&&r.width>=44&&r.height>=44,'отправка над клавиатурой '+theme+'/'+width+'/'+height+' '+JSON.stringify(r));
 const bad=await viewport(p);ok(!bad.length,'чат с клавиатурой без выхода за край '+JSON.stringify(bad));
 const request=p.waitForRequest(r=>new URL(r.url()).pathname==='/coach');await p.click('#csend');ok(JSON.parse((await request).postData()).text==='Что лучше съесть после тренировки?','отправка действительно работает');await p.close();
}
// Отказ по HTTP, по JSON и сети; успешный повтор, затем отказ снять реакцию.
for(const theme of ['light','dark']){
 let mode='http',calls=0;const p=await b.newPage({viewport:{width:320,height:844}});
 await M.поднять(p,{theme,page:'circle',handleRoute:async route=>{if(new URL(route.request().url()).pathname!=='/react')return false;calls++;await new Promise(r=>setTimeout(r,150));if(mode==='network')await route.abort();else await route.fulfill({status:mode==='http'?503:200,contentType:'application/json',body:JSON.stringify(mode==='success'?{ok:true,likes:9,liked:true}:{ok:false})});return true;}});
 await p.locator('[data-lbwho]:not(.lbme)').first().click();await p.locator('.plate').first().click();
 const button=p.locator('[data-like]').first(),initial=await button.innerText();
 for(const failure of ['http','json','network']){mode=failure;const was=calls;await button.evaluate(e=>{e.click();e.click()});await p.locator('.reaction-error').waitFor();ok(calls===was+1,'повтор во время запроса не отправляется '+failure);ok(await button.innerText()===initial&&!await button.evaluate(e=>e.classList.contains('on')),'F4: откат реакции '+failure);ok((await p.locator('.reaction-error').innerText()).includes('Не удалось сохранить'),'отказ объяснён');}
 mode='success';await button.click();await p.waitForFunction(()=>document.querySelector('[data-like]').textContent.includes('9'));ok(await p.locator('.reaction-error').count()===0&&await button.evaluate(e=>e.classList.contains('on')),'успешный повтор подтверждён сервером');
 mode='http';await button.click();await p.locator('.reaction-error').waitFor();ok((await button.innerText()).includes('9')&&await button.evaluate(e=>e.classList.contains('on')),'отказ снять реакцию возвращает подтверждённое состояние');await p.close();
}
}finally{await b.close()}if(failures)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');})().catch(e=>{console.error(e);process.exitCode=1});
