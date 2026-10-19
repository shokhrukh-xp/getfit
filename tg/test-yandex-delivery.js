'use strict';
// 19.10: кнопки и результат в настоящем чате; никаких вызовов внутренних функций.
const {chromium}=require('playwright'),M=require('./mock'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch();try{
 for(const width of [320,390]){
 const p=await b.newPage({viewport:{width,height:900}}),starts=[];const id='11111111-1111-1111-1111-111111111111',id2='22222222-2222-2222-2222-222222222222';let phase='location';
 const result={address:'Тестовая точка',note:'Проверена часть меню. Цены без доставки.',recommendations:Array.from({length:5},(_,i)=>({name:'Курица '+i,restaurant:'Кафе '+i,priceUZS:30000+i*1000,restaurantURL:'https://eats.yandex.com/en-uz/r/cafe'+i,imageURL:'https://eda.yandex/images/test'+i+'.jpeg',reason:'По вашему запросу'}))};
 await p.route('https://eda.yandex/images/test*',r=>r.fulfill({path:path.join(__dirname,'fixtures/a.jpg'),contentType:'image/jpeg'}));
 await p.addInitScript(()=>{window.testGPS=0;Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok,fail,opts){testGPS++;window.testGPSOptions=opts;ok({coords:{latitude:41.3+testGPS/100,longitude:69.2,accuracy:20}});}}});});
 const o={chat:[{role:'assistant',text:'Предпочтения понял',ts:Date.now(),act:[{type:'delivery',id,phase:'location'}]}],onCoach:()=>({ok:true,reply:'Новый подбор',meals:[],act:[{type:'delivery',id:id2,phase:'location'}]}),handleRoute:async r=>{
  const u=new URL(r.request().url());if(!u.pathname.startsWith('/delivery'))return false;let which=u.searchParams.get('id');
  if(u.pathname==='/delivery/start'){const body=JSON.parse(r.request().postData());starts.push(body);which=body.id;phase='search';}
  await r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,delivery:{id:which,phase,stage:'Проверяю доступные меню',preview:phase==='search'?{...result,restaurantsChecked:8,restaurantsTotal:30}:null,result:phase==='done'?{...result,restaurantsChecked:30,restaurantsTotal:30}:null}})});return true;
 }};
 if(width===390)o.base=M.БАЗА+'?delivery='+id;
 const errors=await M.поднять(p,o);if(width!==390){await p.click('#coachnav');await p.getByRole('button',{name:'Найти рядом',exact:true}).click();}
 await p.waitForFunction(()=>document.querySelector('#chatlog').textContent.includes('Проверяю доступные меню'));
 assert.equal(starts.length,1);assert(Math.abs(starts[0].point.latitude-41.31)<1e-8);assert.equal(await p.evaluate(()=>testGPSOptions.maximumAge),0,'кеш геолокации не используется');
 await p.waitForSelector('.deliverydish',{timeout:12000});assert.equal(await p.locator('.deliverydish').count(),5);assert((await p.locator('#chatlog').textContent()).includes('поиск продолжается'));phase='done';await p.waitForFunction(()=>!document.querySelector('#chatlog').textContent.includes('Первые варианты'));
 await p.waitForSelector('.deliverydish',{timeout:12000});
 assert.equal(await p.locator('.deliverydish').count(),5);assert.equal(await p.locator('.deliverydish img').count(),5);
 assert(!await p.locator('.delivery').evaluate(e=>e.scrollWidth>e.clientWidth+1),'карточки помещаются на телефоне');
 if(width===390)await p.screenshot({path:'/tmp/getfit-yandex-coach-cards.png'});
 phase='location';await p.fill('#ctext','Хочу заказать ещё, до 80 тыс, курицу, без свинины');await p.click('#csend');await p.locator('[data-delivery="'+id2+'"] [data-delivery-start]').click();await p.waitForFunction(()=>testGPS===2);await p.waitForTimeout(150);assert(Math.abs(starts[1].point.latitude-41.32)<1e-8,'следующий поиск использует новую точку');
 assert.deepEqual(errors,[]);await p.close();console.log('PASS Яндекс '+width+': статус, свежая локация для каждого поиска, пять фото, без горизонтальной прокрутки');
 }
 // Telegram использует horizontal_accuracy: плохая точность не должна молча пройти.
 {const p=await b.newPage({viewport:{width:390,height:900}}),id='33333333-3333-3333-3333-333333333333',starts=[];
 const errors=await M.поднять(p,{chat:[{role:'assistant',text:'Найти рядом',ts:Date.now(),act:[{type:'delivery',id,phase:'location'}]}],handleRoute:async r=>{const u=new URL(r.request().url());if(!u.pathname.startsWith('/delivery'))return false;if(u.pathname==='/delivery/start')starts.push(JSON.parse(r.request().postData()));await r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,delivery:{id,phase:starts.length?'search':'location',stage:'Проверяю меню'}})});return true;}});
 await p.evaluate(()=>{window.nativeAccuracy=3000;Telegram.WebApp.LocationManager={isLocationAvailable:true,init(cb){cb();},getLocation(cb){cb({latitude:41.3,longitude:69.2,horizontal_accuracy:window.nativeAccuracy});}};Telegram.WebApp.isVersionAtLeast=()=>true;});
 await p.click('#coachnav');await p.getByRole('button',{name:'Найти рядом',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#chatlog').textContent.includes('Место определено неточно'));assert.equal(starts.length,0);
 await p.evaluate(()=>{window.nativeAccuracy=15;});await p.getByRole('button',{name:'Повторить',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#chatlog').textContent.includes('Проверяю меню'));assert.equal(starts.length,1);assert.equal(starts[0].point.accuracy,15);assert.deepEqual(errors,[]);await p.close();console.log('PASS Telegram LocationManager: horizontal_accuracy, отказ от неточной точки и повтор');}
 // Из кнопки бота приложение закрывается только после подтверждённого старта.
 for(const mode of ['tg','legacy','denied','rejected','browser','app']){
 const p=await b.newPage({viewport:{width:390,height:900}}),id='44444444-4444-4444-4444-444444444444';let started=false;
 const o={chat:[{role:'assistant',text:'Найти рядом',ts:Date.now(),act:[{type:'delivery',id,phase:'location'}]}],handleRoute:async r=>{const u=new URL(r.request().url());if(!u.pathname.startsWith('/delivery'))return false;if(u.pathname==='/delivery/start'){started=true;await r.fulfill({contentType:'application/json',body:JSON.stringify(mode==='rejected'?{ok:false,error:'Сначала уточни пожелания'}:{ok:true,delivery:{id,src:'tg',phase:'search'}})});return true;}await r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,delivery:{id,src:'tg',phase:started?'search':'location',stage:'Ищу'}})});return true;}};
 if(mode!=='app')o.base=M.БАЗА+'?delivery='+id+(mode==='legacy'?'':'&return=tg');
 await p.addInitScript(({mode})=>{window.closeCalls=0;window.allowCalls=0;window.__deliveryMode=mode;Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok,no){if(mode==='denied')no({code:1});else ok({coords:{latitude:41.3,longitude:69.2,accuracy:10}});}}});},{mode});
 // Mock и приложение загружаются до автоматического запроса, поэтому задаём native API в init-script через setter.
 await p.addInitScript(({mode})=>{let original;Object.defineProperty(window,'Telegram',{configurable:true,get(){return original;},set(v){original=v;if(v?.WebApp){v.WebApp.close=()=>{window.closeCalls++;};v.WebApp.disableClosingConfirmation=()=>{window.allowCalls++;};if(mode==='browser')v.WebApp.initData='';}}});},{mode});
 await M.поднять(p,o);if(mode==='app'){await p.click('#coachnav');await p.getByRole('button',{name:'Найти рядом',exact:true}).click();}
 if(['tg','legacy'].includes(mode)){await p.waitForFunction(()=>closeCalls===1);assert(started);assert((await p.evaluate(()=>allowCalls))>=1);}else{await p.waitForTimeout(800);assert.equal(await p.evaluate(()=>closeCalls),0,'не закрывать при отказе, ошибке, обычном браузере или входе из приложения');if(mode==='denied')assert(!started);}
 await p.close();console.log('PASS возврат в бот: '+mode);
 }
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
