'use strict';
const {chromium}=require('playwright'),M=require('./mock'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),viewport=require('./viewport-check'),contrast=require('./contrast-check');
const shots=process.env.GF_BAR_SHOTS;if(shots)fs.mkdirSync(shots,{recursive:true});
const targets={kcal:1900,prot:135,protMax:165,fat:{min:45,max:75},fib:31,fibMax:50,sug:50,sugIdeal:25};
const scenes=[{name:'friend',kcal:2356,prot:137,fat:124,fib:12,sug:60},{name:'below',kcal:1000,prot:80,fat:30,fib:12,sug:10},{name:'inside',kcal:1900,prot:165,fat:75,fib:31,sug:50},{name:'excess',kcal:9999,prot:250,fat:200,fib:90,sug:90}];
async function check(p,loc,v,lo,hi,max,kind){
 const d=await loc.evaluate(e=>{const fill=e.querySelector('i,.hfill'),c=getComputedStyle(fill),r=e.getBoundingClientRect();const probe=document.createElement('span');document.body.appendChild(probe);let tokens={};for(const t of ['accent','done','warn','dim','mid','text','surface']){probe.style.color='var(--'+t+')';tokens[t]=getComputedStyle(probe).color;}probe.remove();return {tokens,bg:c.backgroundColor,img:c.backgroundImage,width:r.width,fillWidth:fill.getBoundingClientRect().width,overflow:getComputedStyle(e).overflow,fillZ:+c.zIndex,edges:[...e.querySelectorAll('.norm-edge')].map(n=>{const x=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:x.x-r.x+1,w:x.width,top:x.top-r.top,bottom:x.bottom-r.bottom,z:+s.zIndex,color:s.backgroundColor,shadow:s.boxShadow};})};});
 const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);const a=lum(d.tokens.text),b=lum(d.tokens.surface);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'Контраст черты с окантовкой ≥4,5');
 assert.equal(d.edges.length,2);assert.equal(d.overflow,'visible');
 for(let i=0;i<2;i++){const e=d.edges[i];assert(Math.abs(e.x-d.width*Math.min(1,[lo,hi][i]/max))<.3);assert.equal(e.w,2);assert(e.top<0&&e.bottom>0);assert(e.z>d.fillZ);assert.equal(e.color,d.tokens.text);assert(e.shadow.includes(d.tokens.surface),'Контрастная окантовка черты поверх любого цвета');}
 assert(Math.abs(d.fillWidth-d.width*Math.min(1,v/max))<.4,'Факт и границы на одной шкале');
 /* 08.10, ревью: у сахара меньше — лучше: до первой черты зелёное, между чертами жёлтое, сверх — красный участок */
 const ниже=kind==='max'?d.tokens.done:d.tokens.accent, внутри=kind==='max'?d.tokens.mid:d.tokens.done;
 if(v<=hi){assert.equal(d.img,'none');assert.equal(d.bg,(kind==='max'?v<=lo:v<lo)?ниже:внутри,'цвет зоны '+kind+' при '+v);}else{assert(d.img.includes(внутри));assert(d.img.includes(d.tokens[kind==='min'?'dim':'warn']));const stop=hi/Math.min(v,max)*100;assert(d.img.includes(parseFloat(stop.toFixed(3))+'%'),'Цвет меняется ровно на верхней границе');}
}
(async()=>{const b=await chromium.launch();let bad=0;try{for(const theme of ['light','dark'])for(const width of [320,390]){
try{for(const day of scenes){const p=await b.newPage({viewport:{width,height:844}});try{const errors=await M.поднять(p,{theme,day:{...day,targets,line:'За день: '+day.kcal+' ккал, белка '+day.prot+' г. '+(day.kcal>1900?'Сверх нормы '+(day.kcal-1900)+' ккал.':'До нормы ещё '+(1900-day.kcal)+' ккал.')}});await p.waitForTimeout(650);
await check(p,p.locator('.hrow .htr').nth(0),day.kcal,1710,2090,2660,'range');await check(p,p.locator('.hrow .htr').nth(1),day.prot,135,165,189,'min');
if(shots&&day.name==='friend')await p.screenshot({path:path.join(shots,`bars-home-${theme}-${width}.png`)});
await p.click('.l1 [data-page="food"]');await p.waitForTimeout(350);const bars=p.locator('#fday .fbar .tr');const spec=[[day.kcal,1710,2090,2660,'range'],[day.prot,135,165,189,'min'],[day.fat,45,75,105,'band'],[day.fib,31,50,55,'min'],[day.sug,25,50,70,'max']];for(let i=0;i<5;i++)await check(p,bars.nth(i),...spec[i]);
await p.locator('.fnorm').scrollIntoViewIfNeeded();assert.deepEqual(await viewport(p),[]);assert.deepEqual((await contrast(p)).failures,[]);assert.deepEqual(errors,[]);
if(shots&&day.name==='friend')await p.screenshot({path:path.join(shots,`bars-food-${theme}-${width}.png`)});
}finally{await p.close();}}console.log('ok черты, цвет и общая шкала',theme,width);}catch(e){bad++;console.error('FAIL',theme,width,e.stack);}
}}finally{await b.close();}process.exitCode=bad?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
