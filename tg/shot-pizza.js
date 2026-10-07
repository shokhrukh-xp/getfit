'use strict';
// 07.10: снимок «Тела» — свободный день 🍕 над пунктиром, легенда без строк о нём.
// GF_PORT=8941 node tg/shot-pizza.js /tmp/pizza.png [дней назад, по умолчанию 6]
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
(async()=>{const b=await chromium.launch();try{
 const o=opts('dark');o.free=[M.Д(+(process.argv[3]||6))];
 const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 const err=await M.поднять(p,o);
 const vz=p.locator('.vztop').first();await vz.scrollIntoViewIfNeeded();
 console.log('легенда:',(await p.locator('.vzlg').innerText()).replace(/\n/g,' | '));
 console.log('пицц:',await p.locator('svg .vzsvp').count(),'бледных:',await p.locator('svg .vzwet').count(),'ошибки:',err.join('|')||'нет');
 await vz.screenshot({path:process.argv[2]||'/tmp/pizza.png'});
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
