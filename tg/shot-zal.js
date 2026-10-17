'use strict';
/* 17.10: снимки «Зала на неделе» на стенде. NODE_PATH=~/pw/node_modules node tg/shot-zal.js <папка> */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
const OUT=process.argv[2]||'/tmp/gfk-shot';require('fs').mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch();
 for(const theme of ['dark','light'])for(const width of [320,390]){
  const p=await b.newPage({viewport:{width,height:844},deviceScaleFactor:2});
  const err=await M.поднять(p,opts(theme));await p.waitForTimeout(900);
  const z=p.locator('.vzbottom').first();await z.scrollIntoViewIfNeeded();await z.screenshot({path:OUT+'/zal-'+theme+'-'+width+'.png'});
  console.log('снято',theme,width,err.join(' | ').slice(0,200));
  if(theme==='dark'&&width===390){await p.click('[data-zkgo="log"]');await p.waitForTimeout(900);const j=p.locator('#logsila');await j.scrollIntoViewIfNeeded();await j.screenshot({path:OUT+'/journal-sila.png'}).catch(e=>console.log('журнал',e.message.slice(0,100)));}
  await p.close();}
 await b.close();})();
