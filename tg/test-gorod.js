'use strict';
/* 02.11: «Где вы» в профиле. Его слова: «будем определять местоположение или чтобы пользователь сам
   указал, где он»; «заведения не должны путаться между городами и странами». Строка и страница — только
   за gorod (сначала ему); город вручную, по геолокации и сброс на часовой пояс уходят на /place;
   ответ сервера (город, страна, откуда) — на экране; ошибка — понятной строкой. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
(async()=>{const b=await chromium.launch();try{
  /* без gorod — строки нет */
  {const p=await b.newPage({viewport:{width:390,height:844}});const o=opts('dark');o.features=[];
   await M.поднять(p,o);await p.click('#profbtn');await p.waitForTimeout(300);
   ok(!(await p.isVisible('#pq-gorod')),'без gorod строки «Где вы» нет');await p.close();}
  /* с gorod */
  for(const width of [320,390]){
   const p=await b.newPage({viewport:{width,height:844}});const o=opts('light');o.features=['gorod'];
   const тела=[];let место={city:'Ташкент',cc:'UZ',country:'Узбекистан',src:'по умолчанию'};
   o.handleRoute=async r=>{const u=new URL(r.request().url());if(u.pathname!=='/place')return false;
     if(r.request().method()==='GET'){await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,place:место})});return true;}
     const т=r.request().postDataJSON();тела.push(т);
     if(т.city==='Атлантида'){await r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,code:'not_found',error:'Не нашёл такой город. Напишите иначе, например «Лиссабон» или «Lisbon».'})});return true;}
     место=т.reset?{city:'Ташкент',cc:'UZ',country:'Узбекистан',src:'по умолчанию'}:т.point?{city:'Лиссабон',cc:'PT',country:'Португалия',src:'гео'}:{city:'Лиссабон',cc:'PT',country:'Португалия',src:'ручное'};
     await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,place:место})});return true;};
   await p.addInitScript(()=>{navigator.geolocation.getCurrentPosition=(ok)=>ok({coords:{latitude:38.72,longitude:-9.14,accuracy:30}});});
   const err=await M.поднять(p,o);const где=width+': ';
   ok(err.length===0,где+'страница без ошибок '+(err[0]||''));
   await p.click('#profbtn');await p.waitForTimeout(300);
   ok(await p.isVisible('#pq-gorod'),где+'в профиле есть «Где вы»');
   await p.click('#pq-gorod');await p.waitForTimeout(400);
   ok(/Ташкент, Узбекистан/.test(await p.textContent('#gorod-cur')),где+'показан город с сервера: '+(await p.textContent('#gorod-cur')));
   ok(await p.isHidden('#gorod-reset'),где+'по умолчанию — кнопки сброса нет');
   await p.fill('#gorod-city','Атлантида');await p.click('#gorod-save');await p.waitForTimeout(300);
   ok(/Не нашёл такой город/.test(await p.textContent('#gorod-err')),где+'незнакомый город — понятная строка');
   await p.fill('#gorod-city','Lisbon');await p.press('#gorod-city','Enter');await p.waitForTimeout(300);
   ok(тела.some(x=>x.city==='Lisbon'&&x.uid),где+'город уходит на сервер');
   ok(/Лиссабон, Португалия/.test(await p.textContent('#gorod-cur'))&&/указали сами/.test(await p.textContent('#gorod-cur')),где+'после сохранения — город, страна и «указали сами»');
   ok(await p.textContent('#pv-gorod')==='Лиссабон',где+'в строке профиля — город');
   ok(await p.textContent('#gorod-err')==='',где+'ошибка ушла');
   await p.click('#gorod-reset');await p.waitForTimeout(300);
   ok(тела.some(x=>x.reset===true),где+'сброс уходит на сервер');
   await p.click('#gorod-geo');await p.waitForTimeout(600);
   const гео=тела.find(x=>x.point);
   ok(гео&&Math.abs(гео.point.latitude-38.72)<0.01,где+'геолокация уходит точкой');
   ok(/по геолокации/.test(await p.textContent('#gorod-cur')),где+'«по геолокации» на экране');
   await p.close();}
}catch(e){console.error('УПАЛО:',e.stack);bad++;}
await b.close();console.log(bad?'\nПРОВАЛОВ: '+bad:'\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(bad?1:0);})();
