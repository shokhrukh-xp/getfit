'use strict';
// Геометрия этапа 4: реальные состояния, обе темы и две ширины.
const viewport=require('./viewport-check');
const {chromium}=require('playwright'),M=require('./mock');let failures=0;
const ok=(v,t)=>{console.log((v?'  ok  ':'  ПРОВАЛ  ')+t);if(!v)failures++};
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390]){
 const p=await b.newPage({viewport:{width,height:844}}),tag=theme+'/'+width;
 const errors=await M.поднять(p,{theme,page:'gym',hist:M.журнал()});
 ok(await p.locator('.gym-day #nexthint').count()===1,'день и прогресс в общей поверхности '+tag);
 ok(await p.locator('#dayseg b').evaluateAll(ns=>ns.every(n=>n.scrollWidth<=n.clientWidth)),'дни читаются без обрезания '+tag);
 await p.locator('#list .exrow').first().click();
 await p.locator('.setrow .ok').first().click();await p.waitForTimeout(400);
 ok(await p.locator('.setrow.done').count()>0,'подход отмечен '+tag);
 ok(await p.locator('#timer').isVisible(),'таймер открыт после первого подхода '+tag);
 // Прокрутка к последнему подходу не прячет его под таймером/навигацией.
 const safe=async selector=>{await p.locator(selector).last().scrollIntoViewIfNeeded();return p.locator(selector).last().evaluate(e=>{const a=e.getBoundingClientRect(),nav=document.querySelector('.l1').getBoundingClientRect(),t=document.querySelector('#timer'),limit=t.classList.contains('show')?Math.min(nav.top,t.getBoundingClientRect().top):nav.top;return a.top>=0&&a.bottom<=limit&&getComputedStyle(document.querySelector('#finish')).position==='static';});};
 ok(await safe('.setrow'),'последний подход доступен над таймером '+tag);
 ok(await safe('#finish'),'Завершить доступна над таймером и навигацией '+tag);
 await p.locator('#tskip').click();await p.waitForTimeout(400);
 ok(await safe('#finish'),'Завершить доступна без таймера '+tag);
 await p.locator('.card.exact .allb').click();await p.locator('#finish').click();await M.ответитьДлительность(p,45);
 await p.locator('#finish.ok').waitFor();ok(await safe('#finish'),'сохранённое занятие доступно '+tag);
 await p.locator('#coachfab').scrollIntoViewIfNeeded();
 ok(await p.locator('#coachfab').evaluate(e=>{const a=e.getBoundingClientRect(),n=document.querySelector('.l1').getBoundingClientRect(),f=document.querySelector('#finish').getBoundingClientRect();return a.top>=f.bottom&&a.bottom<=n.top;}),'тренер после сохранения и выше навигации '+tag);
 await p.close();
 const q=await b.newPage({viewport:{width,height:844}});await M.поднять(q,{theme,page:'log',hist:M.журнал()});
 const map=await q.locator('.bodymap').evaluateAll(svgs=>svgs.map(svg=>{const box=svg.getBoundingClientRect(),texts=[...svg.querySelectorAll('text')],rects=texts.map(x=>x.getBoundingClientRect()),bad=[];rects.forEach((a,i)=>{if(a.left<box.left-.5||a.right>box.right+.5||a.top<box.top-.5||a.bottom>box.bottom+.5)bad.push('обрезано '+texts[i].textContent);for(let j=i+1;j<rects.length;j++){const c=rects[j];if(Math.min(a.right,c.right)-Math.max(a.left,c.left)>.5&&Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top)>.5)bad.push(texts[i].textContent+' / '+texts[j].textContent);}});return {n:texts.length,bad};}));
 ok(map.length===2&&map.every(x=>x.n>10&&!x.bad.length),'подписи и числа карты без наложений и обрезания '+tag+' '+JSON.stringify(map));
 ok((await q.locator('.muskey').textContent()).includes('подходов за 7 дней'),'единица карты явно указана '+tag);
 await q.locator('.bodymap .mnm[data-m="quad"]').click();ok(await q.locator('[data-catmus="quadriceps"]').isVisible(),'нажатие подписи открывает прежнее действие '+tag);
 ok(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'журнал без переполнения '+tag);await q.close();
 const r=await b.newPage({viewport:{width,height:844}});await M.поднять(r,{theme,page:'ref'});
 const h=r.locator('.catgrp h4').first();await h.evaluate(e=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY+45));await r.waitForTimeout(100);
 ok(await h.evaluate(e=>Math.abs(e.getBoundingClientRect().top)<1&&getComputedStyle(e).position==='sticky'),'заголовок закреплён при прокрутке '+tag);
 await h.locator('button').click();ok(await r.locator('.catgrp').count()===0,'все N открывает группу '+tag);
 ok(await r.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'каталог без переполнения '+tag);
 ok(!errors.length,'ошибок запуска нет '+tag);await r.close();
}
// Все пять ширин: таймер, нижняя навигация, сохранение и чат.
for(const theme of ['light','dark'])for(const width of [320,360,375,390,430]){
 const p=await b.newPage({viewport:{width,height:844}}),tag=theme+'/'+width;
 await M.поднять(p,{theme,page:'gym'});await p.locator('#list .exrow').first().click();
 await p.locator('.setrow .ok').first().click();await p.waitForTimeout(400);
 const buttons=await p.locator('#tskip,#tplus').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {id:e.id,l:r.left,r:r.right,w:r.width,h:r.height};}));
 ok(buttons.length===2&&buttons.every(r=>r.l>=0&&r.r<=width&&r.w>=44&&r.h>=44),'обе кнопки таймера целиком и >=44 px '+tag+' '+JSON.stringify(buttons));
 let bad=await viewport(p);ok(!bad.length,'границы с таймером '+tag+' '+JSON.stringify(bad));
 const before=await p.locator('#tcount').textContent();await p.locator('#tplus').click();ok(await p.locator('#tcount').textContent()!==before,'+30с работает '+tag);
 await p.locator('#tskip').click();await p.waitForTimeout(400);ok(!await p.locator('#timer').isVisible(),'Пропустить закрывает таймер '+tag);
 await p.locator('#finish').scrollIntoViewIfNeeded();bad=await viewport(p);ok(!bad.length,'границы у сохранения '+tag+' '+JSON.stringify(bad));
 await p.locator('#coachfab').click();await p.waitForTimeout(400);bad=await viewport(p);ok(!bad.length,'границы в чате '+tag+' '+JSON.stringify(bad));await p.close();
}
}finally{await b.close()}if(failures)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');})().catch(e=>{console.error(e);process.exitCode=1});
