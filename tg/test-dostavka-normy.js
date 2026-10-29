'use strict';
// 20.10, его слова: «посмотри что он подобрал мне на обед: это подходит моей цели?
// Это подходит по белку, жирам, углеводам и сахару. Я бы хотел видеть как хорошо
// каждый из вариантов соответствует моим нормам». Его выбор — «балл + 4 строки»:
// карточка подбора в чате приложения показывает их строками, балл — жирным, без
// горизонтальной прокрутки на 320.
const {chromium}=require('playwright'),M=require('./mock'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch();try{
 for(const width of [320,390]){
  const p=await b.newPage({viewport:{width,height:900}}),id='55555555-5555-5555-5555-555555555555';
  const card='Подходит к цели (снижение веса): 9 из 10\nБелок ~42 из 50 г · жиры ~21 из 22 г\nУглеводы ~2 из 70 г · сахар ~2 из 16 г\n~374 из 700 ккал на приём. По справочнику Wellböl (200–620 ккал за 220 г), рецепт ресторана может отличаться.';
  const result={address:'Тестовая точка',note:'Меню «Подушечная» прочитано целиком.',venue:{name:'Подушечная',found:true},recommendations:[
   {name:'Шашлык из курицы',restaurant:'Podushechnaya',priceUZS:40000,restaurantURL:'https://eats.yandex.com/en-uz/r/pod',imageURL:'https://eda.yandex/images/t1.jpeg',reason:card,fit:{score:9,kcal:[374,700],prot:[42,50],fat:[21,22],carb:[2,70],sug:[2,16]}},
   {name:'Старое блюдо',restaurant:'Podushechnaya',priceUZS:30000,restaurantURL:'https://eats.yandex.com/en-uz/r/pod',imageURL:'https://eda.yandex/images/t2.jpeg',reason:'Оценка 200–450 ккал за 200 г; остаток дня 900 из 2000 ккал. Цель: снижение веса.'}]};
  await p.route('https://eda.yandex/images/*',r=>r.fulfill({path:path.join(__dirname,'fixtures/a.jpg'),contentType:'image/jpeg'}));
  const errors=await M.поднять(p,{chat:[{role:'assistant',text:'Подобрал варианты',ts:Date.now(),act:[{type:'delivery',id,phase:'done'}]}],handleRoute:async r=>{const u=new URL(r.request().url());if(!u.pathname.startsWith('/delivery'))return false;
   await r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,delivery:{id,phase:'done',result:{...result,restaurantsChecked:1,restaurantsTotal:1,complete:true}}})});return true;}});
  await p.click('#coachnav');await p.waitForSelector('.deliverydish',{timeout:12000});
  const first=p.locator('.deliverydish').first();
  assert.equal(await first.locator('.dreason b').textContent(),'Подходит к цели (снижение веса): 9 из 10','балл — отдельной жирной строкой');
  const lines=(await first.locator('.dreason').innerText()).split('\n').map(x=>x.trim()).filter(Boolean);
  assert.equal(lines.length,4,'четыре строки, а не один абзац: '+JSON.stringify(lines));assert.match(lines[1],/^Белок ~42 из 50 г · жиры/);assert.match(lines[2],/сахар ~2 из 16 г/);
  assert.equal(await p.locator('.deliverydish').nth(1).locator('.dreason b').count(),0,'старая карточка без балла — как была');
  assert(!await p.locator('.delivery').first().evaluate(e=>e.scrollWidth>e.clientWidth+1),'на '+width+' без горизонтальной прокрутки');
  assert.deepEqual(errors,[]);await p.close();console.log('PASS доставка '+width+': балл и строки нормы в карточке');
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
