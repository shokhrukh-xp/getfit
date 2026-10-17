'use strict';
/* 17.10: снимки низа «Тела» — отклонение на графике, темп и срок, сила по
   тренировкам. NODE_PATH=~/pw/node_modules node tg/shot-telo.js <папка> */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
const OUT=process.argv[2]||'/tmp/gft-shot';require('fs').mkdirSync(OUT,{recursive:true});
const пн=k=>M.Д(0)&&(()=>{const t=new Date(M.TODAY+'T12:00:00');const d=(t.getDay()+6)%7;const x=new Date(t);x.setDate(t.getDate()-d-7*k);return x.toISOString().slice(0,10);})();
function данные(theme,вар){
  const o=opts(theme);
  o.goal={text:'75 кг · мышцы и силу сохраняем',wt:'down',rate:-.6,from:M.Д(42),w0:92.3,kg:17.3};
  const idx=[null,100,102,104,105,104,103,101,102.4], t=[null,14.2,15.1,16,15.4,16.8,15.9,13.2,6.1];
  const weeks=idx.map((v,i)=>({from:пн(8-i),to:'',i:v,t:t[i],n:8,pairs:6,partial:i===8}));
  weeks[8].i=вар==='part'?103.1:null;
  o.progress={anchor:M.Д(14),anchorW:88.0,rate:-.6,gap:вар==='ok'?0.2:1.8,onTrack:вар==='ok',w0:92.3,now:87.0,fact:-5.3,plan:-7.1,kg:17.3,left:12,
   verdict:{state:вар==='ok'?'план':'медленнее',d0:-0.3,text:'x'},eta:{date:'2027-08-24',pace:-.3},
   sila:{verdict:'стоит',up:8,flat:6,down:5,rows:[
    {name:'Присед (штанга, глубокий)',was:{w:80,r:10},now:{w:70,r:12},pct:-8.1},{name:'Жим лёжа (узкий хват)',was:{w:70,r:10},now:{w:70,r:10},pct:0},
    {name:'Выпады (гантели)',was:{w:15,r:16},now:{w:20,r:10},pct:15.9},{name:'Подтягивания',was:{w:0,r:8},now:{w:0,r:10},pct:25},{name:'Шраги',was:null,now:{w:40,r:12},pct:null}],
    index:вар==='few'?{weeks:weeks.map(w=>({...w,i:null})),enough:false}:{base:пн(7),weeks,now:102.4,nowWeek:пн(1),ch:2.4,enough:true}}};
  return o;
}
(async()=>{const b=await chromium.launch();
 for(const theme of ['dark','light'])for(const width of [320,390])for(const вар of ['main','ok','part','few']){
  if(width===320&&вар!=='main') continue;
  const p=await b.newPage({viewport:{width,height:844},deviceScaleFactor:2});
  try{await M.поднять(p,данные(theme,вар));await p.waitForTimeout(500);
   if(вар==='main'){const d=p.locator('details.sxlist');if(await d.count())await d.evaluate(e=>e.open=true);}
   const z=p.locator('.vz').first();await z.scrollIntoViewIfNeeded();await z.screenshot({path:OUT+'/telo-'+вар+'-'+theme+'-'+width+'.png'});console.log('снято',вар,theme,width);
  }catch(e){console.log('УПАЛО',вар,theme,width,e.message.slice(0,200));}
  await p.close();}
 await b.close();})();
