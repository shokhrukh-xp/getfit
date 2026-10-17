'use strict';
const{chromium}=require('playwright'),M=require('./mock'),contrast=require('./contrast-check'),bounds=require('./viewport-check');let bad=0;const ok=(x,t)=>{console.log((x?'ok ':'ПРОВАЛ ')+t);if(!x)bad++};
(async()=>{const b=await chromium.launch();try{for(const theme of['dark','light'])for(const width of[320,390]){const p=await b.newPage({viewport:{width,height:844}});const errors=await M.поднять(p,{theme,page:'gym',hist:M.журнал()});await p.locator('#list .exrow').first().click();const card=p.locator('.card.exact');
 ok(await card.locator('.today-label').count()===1&&/прошлый раз/.test(await card.locator('.lastline').textContent()),theme+width+' «Сегодня» отдельно от даты факта');
 const muscles=card.locator('details.exhelp-muscles'),warm=card.locator('details.exhelp-warm');ok(await muscles.count()===1&&await warm.count()===1,theme+width+' два пояснения раскрытием');
 if(await muscles.count()){ok(!(await muscles.getAttribute('open')),theme+width+' мышцы свёрнуты');await muscles.locator('summary').click();ok(await muscles.locator('.mmore').isVisible(),theme+width+' мышцы доступны');}
 if(await warm.count()){await warm.locator('summary').click();ok(/в подходы и объём не идут/.test(await warm.textContent()),theme+width+' пояснение разминки доступно');}
 const before=await card.locator('.setrow').count();await card.locator('.setrow .ok').first().click();ok(await card.locator('.setrow').count()===before&&await card.locator('.setrow.done').count()===1,theme+width+' подход отмечается, строки сохранены');
 ok(await muscles.getAttribute('open')!==null&&await warm.getAttribute('open')!==null,theme+width+' раскрытые пояснения сохранены после отметки подхода');
 const geom=await card.locator('.settbl').evaluate(t=>[...t.querySelectorAll('tbody tr')].every(r=>{const a=r.querySelector('.cb').getBoundingClientRect(),k=r.querySelector('.cw').getBoundingClientRect();return a.width>=38&&a.right<=k.left+.5}));ok(geom,theme+width+' колонка «было» не обрезана');
 ok(!errors.length&&!(await bounds(p)).length,theme+width+' ошибок и выхода за края нет');const c=await contrast(p,'#p-gym');ok(!c.failures.length,theme+width+' контраст');await p.close();
}}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
