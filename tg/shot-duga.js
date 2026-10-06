'use strict';
// 06.10: дуга без наложений и раскрытый кружок. Снимки трёх дней:
//   «06.10» — его день со скриншота: вес, зал 06:57, завтрак 08:19, планы;
//   «плотный» — вес, зал, семь приёмов и теннис;
//   «кучка» — пять фото за шесть минут (10:26–10:32) и зал.
// node tg/shot-duga.js <папка>
const {chromium}=require('playwright'),M=require('./mock'),fs=require('fs'),path=require('path'),{opts}=require('./shot-clean');
const ts=t=>new Date(M.TODAY+'T'+t+':00').getTime();
const еда=(t,kind,i,kcal,text)=>({id:100+i,t,kind,img:'/p/'+(i%2?'b':'a')+'.jpg',kcal,prot:Math.round(kcal/14),text});
function день(theme,вид){
  const o=opts(theme);
  const зал=t0=>[{...M.журнал()[0],id:M.TODAY+'_D1',day:'D1',date:M.TODAY,t0:ts(t0),updated:new Date(ts(t0)+75*6e4).toISOString()},...o.hist];
  const вес=(w,t)=>[{date:M.TODAY,w,created:ts(t)},...M.замеры().filter(m=>m.date!==M.TODAY)];
  if(вид==='06.10'){o.time='11:00';o.hist=зал('06:57');o.meas=вес(88.2,'06:50');
    o.day={...o.day,meals:[еда('08:19','завтрак',1,520,'Омлет из трёх яиц, хлеб, огурец')],kcal:520,prot:37,targets:{...o.day.targets,kcal:1850,prot:160}};}
  if(вид==='плотный'){o.time='21:30';o.hist=зал('07:00');o.meas=вес(88.0,'06:40');
    const m=[['08:10','завтрак',420],['10:00','перекус',180],['13:10','обед',610],['14:00','перекус',150],['16:30','перекус',200],['19:00','ужин',540],['20:15','перекус',120]].map(([t,k,c],i)=>еда(t,k,i,c,k+' '+t));
    o.day={...o.day,meals:m,acts:[{id:7,t:'17:30',kind:'теннис',min:120,kcal:1160}],kcal:2220,prot:170,targets:{...o.day.targets,kcal:3010,prot:160}};o.acts=o.day.acts;}
  if(вид==='кучка'){o.time='16:00';o.hist=зал('08:39');
    o.day={...o.day,meals:['10:26','10:28','10:29','10:31','10:32'].map((t,i)=>еда(t,'перекус',i,200,'Приём '+t)),kcal:1000,prot:70};}
  return o;
}
module.exports={день,ts};
if(require.main===module)(async()=>{const out=process.argv[2];fs.mkdirSync(out,{recursive:true});const b=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const вид of ['06.10','плотный','кучка'])for(const width of [320,390]){
  const p=await b.newPage({viewport:{width,height:844},deviceScaleFactor:2});await M.поднять(p,день(theme,вид));
  const clk=p.locator('.hclk');await clk.screenshot({path:path.join(out,`duga-${вид}-${theme}-${width}.png`)});
  if(theme==='light'||width===390){
   const g=p.locator('.hclk-svg .hb[data-hx]');const n=await g.count();
   // палец — в центр кружка, как у человека (круги касания соседей могут лежать сверху)
   if(n){const r=await g.nth(вид==='06.10'?Math.min(2,n-1):1).locator('.hbcut').boundingBox();await p.mouse.click(r.x+r.width/2,r.y+r.height/2);await p.waitForTimeout(350);
    await clk.screenshot({path:path.join(out,`otkryt-${вид}-${theme}-${width}.png`)});}
  }
  await p.close();
 }}finally{await b.close()}})();
