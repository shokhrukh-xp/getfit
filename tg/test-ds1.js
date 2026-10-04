'use strict';
/* 04.10: выбран «Тихий тренер». Проверяем контракт тем/полос/вкладок,
   а не снимок всех деклараций: данные и дуга не должны меняться из-за CSS. */
const {chromium}=require('playwright'),M=require('./mock');let плохо=0;
function дано(ok,t){console.log((ok?'  ok  ':'  ПРОВАЛ  ')+t);if(!ok)плохо++}
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390]){
const p=await b.newPage({viewport:{width,height:844}});const err=await M.поднять(p,{theme});
const tokens=await p.evaluate(()=>{const c=getComputedStyle(document.documentElement);return ['--bg','--card','--text','--shadow'].map(k=>c.getPropertyValue(k).trim())});
дано(tokens[0]===(theme==='light'?'#F3F4F7':'#0F1115'),'фон выбранной темы '+theme+' '+width);
дано(theme!=='dark'||tokens[3]==='none','в тёмной теме карточки без тени');
дано(await p.locator('.hclk svg').count()===1,'дуга дня сохранена');
дано(await p.locator('.hctr b').first().evaluate(e=>getComputedStyle(e).fontSize)==='42px','метрика числа дуги не менялась');
дано(await p.locator('#p-home .ds-zone').count()===1,'на главной одна легенда');
дано(await p.locator('.hrow:last-of-type .hfill').evaluate(e=>getComputedStyle(e).backgroundColor)===(theme==='light'?'rgb(31, 157, 99)':'rgb(47, 208, 128)'),'полоса оценки зелёная');
дано(await p.locator('.htr').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).height==='8px')),'дорожки главной 8px');
дано(await p.locator('.htr .hdot').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).display==='none')),'у полос нет видимых ручек');
await p.click('.l1 button[data-page="food"]');await p.waitForTimeout(400);
дано(await p.locator('#fday .fbar').count()===5,'пять показателей еды сохранены');
дано(await p.locator('#fday .ds-zone').count()===1,'на Еде одна легенда');
дано(await p.locator('#fday .tr').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).height==='8px')),'полосы еды 8px');
дано(await p.locator('#fday .fcor').count()>=5,'границы целевых зон сохранены');
const tab=await p.locator('.zseg button[aria-pressed="true"]:visible').evaluate(e=>{let c=getComputedStyle(e);return [c.borderBottomWidth,c.backgroundColor,c.fontSize]});
дано(tab[0]==='3px'&&tab[1]==='rgba(0, 0, 0, 0)'&&tab[2]==='16px','активная вкладка подчёркнута, без капсулы');
дано(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'экран помещается в '+width);
дано(!err.length,'нет ошибок JS');await p.close();
}
const p=await b.newPage();await M.поднять(p,{theme:'light',themeParams:{bg_color:'#abcdef',text_color:'#123456',button_color:'#ff0000'}});
дано(await p.evaluate(()=>getComputedStyle(document.body).backgroundColor)==='rgb(171, 205, 239)','фон Telegram принят');
дано(await p.evaluate(()=>getComputedStyle(document.body).color)==='rgb(18, 52, 86)','текст Telegram принят');
дано(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())==='#2F6BFF','button_color не подменяет свою палитру');
дано(await p.evaluate(()=>window.__headerColor)==='#abcdef','шапка Telegram совпадает с фоном');
await p.evaluate(()=>{Telegram.WebApp.colorScheme='dark';Telegram.WebApp.themeParams={bg_color:'url(invalid)',text_color:null};window.__tgEvents.themeChanged()});
дано(await p.evaluate(()=>getComputedStyle(document.body).backgroundColor)==='rgb(15, 17, 21)','смена темы очищает прежнее переопределение, неверный цвет отклоняется');await p.close();
}finally{await b.close()}if(плохо)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
