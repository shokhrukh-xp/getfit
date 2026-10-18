'use strict';
const {chromium}=require('playwright'),M=require('./mock'),assert=require('assert/strict'),fs=require('fs');
const ME={sex:'m',age:34,ht:178,bw:88,goal:'fat',wt:'down',gym:'muscle',level:'mid',place:'gym',only:'all',lim:[],eq:[],voice:'fun'};
(async()=>{const b=await chromium.launch();try{for(const theme of ['light','dark'])for(const width of [320,390]){
 const p=await b.newPage({viewport:{width,height:900}}),sent=[];
 p.on('request',r=>{if(new URL(r.url()).pathname==='/s'){const x=JSON.parse(r.postData()||'{}');if(x.key==='me')sent.push(x.data.me);}});
 const errors=await M.поднять(p,{theme,me:ME,preserveReload:true});await p.click('#profbtn');await p.click('#pq-voice');
 const buttons=p.locator('#me-voice button');assert.equal(await buttons.count(),3);
 const text=await p.textContent('#me-voice');for(const label of ['спокойный','дружеский','саркастичный'])assert(text.includes(label));assert(!text.includes('в каждом ответе'));
 for(const key of ['standard','hard','fun']){await p.click('#me-voice button[data-v="'+key+'"]');await p.waitForTimeout(350);assert(sent.some(x=>x.voice===key),'выбор дошёл до сервера '+key);}
 const boxes=await buttons.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,height:r.height,scroll:e.scrollWidth,width:e.clientWidth}}));assert(boxes.every(r=>r.x>=0&&r.right<=width&&r.height>=44&&r.scroll<=r.width+1),'все подписи и касания помещаются');
 await p.screenshot({path:'/tmp/coach-three-'+theme+'-'+width+'.png'});
 await p.reload();await p.waitForTimeout(600);await p.click('#profbtn');await p.click('#pq-voice');assert.equal(await p.locator('#me-voice [aria-pressed="true"]').getAttribute('data-v'),'fun','выбор пережил перезапуск');assert(!errors.length);await p.close();console.log('PASS три названия, сохранение/перезапуск, 44px, без обрезки: '+theme+' '+width);
 }}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
