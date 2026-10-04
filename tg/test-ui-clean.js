'use strict';
// 04.10: по снимкам — меньше текста, прежние данные и все раскрытия доступны.
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean'),bounds=require('./viewport-check'),contrast=require('./contrast-check');
let bad=0;function ok(c,t){console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++}
(async()=>{const b=await chromium.launch();try{for(const theme of ['light','dark'])for(const width of [320,390]){
 const p=await b.newPage({viewport:{width,height:844}}),o=opts(theme);const errs=await M.поднять(p,o);
 async function check(name,root='body'){const bb=await bounds(p),cc=await contrast(p,root);ok(!bb.length,`${name} ${theme}/${width} границы: ${JSON.stringify(bb)}`);ok(cc.checked>0&&!cc.failures.length,`${name} контраст: ${JSON.stringify(cc.failures)}`)}
 ok(await p.locator('.hclk .hbl').count()===0,'время не нагромождается над дугой');
 ok(await p.locator('.hb-meal').count()===5,'все пять фото остались на дуге');
 ok(await p.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('.hctr>b'));const n=range.getBoundingClientRect();return [...document.querySelectorAll('.hb-meal .hbcut')].every(e=>{const r=e.getBoundingClientRect();return n.right<=r.left||n.left>=r.right||n.top>=r.bottom||n.bottom<=r.top})}),'число калорий не накладывается на фото');
 await p.locator('.day-events summary').click();
 const labels=await p.locator('.day-events button').allTextContents();
 ok(labels.slice(0,5).join('|')===['09:53 · завтрак','10:26 · обед','10:28 · перекус','14:03 · перекус','14:48 · перекус'].join('|'),'настоящие времена не подменены раздвинутыми позициями фото');
 ok(await p.locator('.day-events button').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44)),'события доступны пальцем');
 await check('главная');await p.locator('.body-explain summary').click();
 ok(await p.locator('.vzvtext').innerText()===o.progress.verdict.text,'полный ответ сервера сохранён');
 await p.locator('.vzsila summary').click();ok((await p.locator('.vzsila').innerText()).includes('8 повт.'),'подробности силы доступны');
 await check('раскрытое тело');await p.locator('[data-vzv="fat"]').click();await p.locator('[data-vzv="w"]').click();
 ok(await p.locator('.day-events').evaluate(e=>e.open),'раскрытые события переживают обновление главной');
 await p.locator('.day-events button').first().click();ok(await p.locator('#p-food').isVisible(),'событие открывает еду');
 const rows=await p.locator('#fweek .fd').evaluateAll(es=>es.map(e=>({date:e.querySelector('u').textContent,fact:e.querySelector('.week-fact').textContent,target:e.querySelector('.week-target').textContent})));
 ok(rows.length===7&&rows[0].fact==='2050'&&rows[0].target==='2110','даты, факт и норма отдельными колонками');
 await check('еда');await p.locator('[data-zseg="eat"]:visible').click();await p.locator('[data-eseg="day"]').click();await p.waitForTimeout(400);
 ok(await p.locator('.menu-stats strong').allTextContents().then(xs=>xs.join('|')==='2050 ккал|162 г'),'меню показывает исходные числа');
 ok(await p.locator('.ingredient-chips>span').count()===9,'ингредиенты с граммами отдельными элементами');
 await p.locator('.menu-note summary').first().click();ok((await p.locator('.menu-note').first().innerText()).includes('привычные блюда'),'пояснение меню раскрывается');await check('меню');
 await p.locator('#profbtn').click();await check('профиль','#profm');
 await p.locator('.goal-progress summary').click();ok((await p.locator('.goal-progress .gp').innerText()).includes('92,3'),'стартовый вес в деталях цели');
 await p.locator('#zdtoggle').click();await check('здоровье','#profm');await p.locator('#bttoggle').click();await check('быт','#profm');
 await p.locator('#meedit').click();ok(await p.locator('#me-age').isVisible(),'личные данные редактируются');
 ok(!errs.length,'без ошибок приложения: '+errs.join('|'));await p.close();
 }}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
