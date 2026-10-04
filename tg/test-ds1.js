'use strict';
/* 04.10: выбран «Фокус · бирюза». Проверяем контракт тем/полос/вкладок,
   а не снимок всех деклараций: данные и дуга не должны меняться из-за CSS. */
const {chromium}=require('playwright'),M=require('./mock');let плохо=0;
function дано(ok,t){console.log((ok?'  ok  ':'  ПРОВАЛ  ')+t);if(!ok)плохо++}
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390]){
const p=await b.newPage({viewport:{width,height:844}});const err=await M.поднять(p,{theme});
const tokens=await p.evaluate(()=>{const c=getComputedStyle(document.documentElement);return ['--bg','--card','--text','--shadow'].map(k=>c.getPropertyValue(k).trim())});
дано(tokens[0]===(theme==='light'?'#EAF0F1':'#000000'),'фон выбранной темы '+theme+' '+width);
дано(theme!=='dark'||tokens[3]==='none','в тёмной теме карточки без тени');
дано(await p.locator('.hclk svg').count()===1,'дуга дня сохранена');
дано(await p.locator('.hctr b').first().evaluate(e=>getComputedStyle(e).fontSize)==='42px','метрика числа дуги не менялась');
дано(await p.locator('#p-home .ds-zone').count()===1,'на главной одна легенда');
дано(await p.locator('.hrow:last-of-type .hfill').evaluate(e=>getComputedStyle(e).backgroundColor)===(theme==='light'?'rgb(23, 103, 117)':'rgb(59, 163, 181)'),'полоса оценки использует акцент');
дано(await p.locator('.htr').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).height==='8px')),'дорожки главной 8px');
дано(await p.locator('.htr .hdot').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).display==='none')),'у полос нет видимых ручек');
await p.click('.l1 button[data-page="food"]');await p.waitForTimeout(400);
дано(await p.locator('#fday .fbar').count()===5,'пять показателей еды сохранены');
дано(await p.locator('#fday .ds-zone').count()===1,'на Еде одна легенда');
дано(await p.locator('#fday .tr').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).height==='8px')),'полосы еды 8px');
дано(await p.locator('#fday .fcor').count()>=5,'границы целевых зон сохранены');
дано(await p.locator('#fday .tr i').evaluateAll(ns=>ns.every(e=>getComputedStyle(e).backgroundColor===getComputedStyle(document.querySelector('.zseg button[aria-pressed="true"]')).borderBottomColor)),'заполнение всех шкал акцентное, включая состояние сахара');
const tab=await p.locator('.zseg button[aria-pressed="true"]:visible').evaluate(e=>{let c=getComputedStyle(e);return [c.borderBottomWidth,c.backgroundColor,c.fontSize]});
дано(tab[0]==='3px'&&tab[1]==='rgba(0, 0, 0, 0)'&&tab[2]==='16px','активная вкладка подчёркнута, без капсулы');
дано(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'экран помещается в '+width);
дано(!err.length,'нет ошибок JS');await p.close();
}
const scalePage=await b.newPage();await M.поднять(scalePage,{theme:'light',day:{kcal:1115,prot:109,targets:{...M.день().targets,protMax:205}}});
const homeScale=await scalePage.locator('.hrow').evaluateAll(rows=>rows.slice(0,2).map(row=>{const fill=row.querySelector('.hfill'),cor=row.querySelector('.hcor');return [+(fill.dataset.w),parseFloat(cor.style.left),parseFloat(cor.style.width)];}));
await scalePage.click('.l1 button[data-page="food"]');await scalePage.waitForTimeout(400);
const foodScale=await scalePage.locator('#fday .fbar').evaluateAll(rows=>rows.slice(0,2).map(row=>{const fill=row.querySelector('.tr i'),cor=row.querySelector('.fcor');return [parseFloat(fill.style.width),parseFloat(cor.style.left),parseFloat(cor.style.width)];}));
дано(JSON.stringify(homeScale[0])===JSON.stringify(foodScale[0])&&Math.abs(homeScale[0][0]-1115/(2110*1.4)*100)<.06&&Math.abs(homeScale[0][1]-90/1.4)<.06,'калории: заполнение и коридор на одной шкале, одинаково на двух экранах');
дано(JSON.stringify(homeScale[1])===JSON.stringify(foodScale[1]),'белок: одна шкала с верхней границей на двух экранах');
дано(await scalePage.evaluate(()=>getComputedStyle(document.body).fontFamily.startsWith('Manrope')),'сохранился локальный Manrope');
дано(await scalePage.locator('.hctx>b').evaluate(e=>getComputedStyle(e).fontSize)==='32px','заголовок страницы 32 px');
await scalePage.close();
const p=await b.newPage();await M.поднять(p,{theme:'light',themeParams:{bg_color:'#abcdef',text_color:'#123456',button_color:'#ff0000'}});
дано(await p.evaluate(()=>getComputedStyle(document.body).backgroundColor)==='rgb(234, 240, 241)','фон приложения не зависит от themeParams');
дано(await p.evaluate(()=>getComputedStyle(document.body).color)==='rgb(31, 45, 48)','текст приложения не зависит от themeParams');
дано(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())==='#176775','button_color не подменяет свою палитру');
дано(await p.evaluate(()=>window.__headerColor)==='#EAF0F1','шапка Telegram совпадает с фоном');
await p.evaluate(()=>{Telegram.WebApp.colorScheme='dark';Telegram.WebApp.themeParams={bg_color:'url(invalid)',text_color:null};window.__tgEvents.themeChanged()});
дано(await p.evaluate(()=>getComputedStyle(document.body).backgroundColor)==='rgb(0, 0, 0)','смена colorScheme включает тёмные токены');дано(await p.evaluate(()=>window.__headerColor)==='#000000','тёмная шапка Telegram получает наш фон');
дано(await p.locator('meta[name="theme-color"]').getAttribute('content')==='#000000','meta theme-color совпадает с тёмной темой');
дано(await p.evaluate(()=>window.__backgroundColor)==='#000000','фон Telegram тоже чёрный');
const layers=await p.evaluate(()=>{
 const css=e=>{const c=getComputedStyle(e);return [c.backgroundColor,c.borderTopWidth,c.borderTopColor,c.boxShadow]};
 return {nav:css(document.querySelector('.l1')),sheet:css(document.querySelector('.modalbox')),field:getComputedStyle(document.documentElement).getPropertyValue('--field').trim()};
});
дано(layers.nav[0]==='rgb(14, 20, 22)'&&layers.nav[1]==='1px'&&layers.nav[2]==='rgb(27, 36, 39)'&&layers.nav[3]==='none','навигация отделена поверхностью и линией, без тени');
дано(layers.sheet[0]==='rgb(14, 20, 22)'&&layers.sheet[1]==='1px'&&layers.sheet[2]==='rgb(27, 36, 39)'&&layers.sheet[3]==='none','модальный лист отделён поверхностью и линией, без тени');
дано(layers.field==='#151D20','поля имеют отдельный тёмный фон');
// Системная тема должна давать те же токены без data-theme Telegram.
await p.emulateMedia({colorScheme:'dark'});
const system=await p.evaluate(()=>{document.documentElement.removeAttribute('data-theme');const c=getComputedStyle(document.documentElement);return ['--bg','--surface','--line','--tab-line','--warn-bg','--on-accent-muted'].map(k=>c.getPropertyValue(k).trim())});
дано(JSON.stringify(system)===JSON.stringify(['#000000','#0E1416','#1B2427','#1F2A2E','#22160E','#CDE7EC']),'системная тёмная тема повторяет явную палитру');
await p.close();
// Удаляем только поддерживаемое улучшение, моделируя путь старого WebView.
for(const theme of ['light','dark']){
const q=await b.newPage();await M.поднять(q,{theme});
const fallback=await q.evaluate(()=>{
 for(const sheet of document.styleSheets){for(let i=sheet.cssRules.length-1;i>=0;i--){const r=sheet.cssRules[i];if(r.conditionText&&r.conditionText.includes('color-mix'))sheet.deleteRule(i)}}
 return ['--accent-ghost','--corr','--corr-mid'].map(token=>{const d=document.createElement('div');d.style.backgroundColor='var('+token+')';document.body.appendChild(d);const c=getComputedStyle(d).backgroundColor;d.remove();return c});
});
дано(JSON.stringify(fallback)===JSON.stringify(theme==='light'?['rgba(23, 103, 117, 0.1)','rgba(51, 116, 89, 0.22)','rgba(224, 160, 48, 0.22)']:['rgba(59, 163, 181, 0.1)','rgba(63, 191, 138, 0.22)','rgba(242, 181, 68, 0.22)']),'без color-mix три полупрозрачных цвета сохраняются: '+theme);
await q.close();
}
for(const [page,label] of [['gym','Зал'],['log','Зал'],['ref','Зал'],['food','Питание'],['eat','Питание'],['circle','Питание'],['admin','']]){
const q=await b.newPage();await M.поднять(q,{page});
дано(await q.locator('#hctx .ds-eyebrow').allTextContents().then(a=>a.join(''))===label,'капитель раздела '+page+': '+(label||'нет'));
await q.close();
}
}finally{await b.close()}if(плохо)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
