'use strict';
// 04.10: этап 2 переставляет оболочки; данные, дуга и ввод замера сохраняются.
const {chromium}=require('playwright'),M=require('./mock');let failures=0;
function дано(ok,t){console.log((ok?'  ok  ':'  ПРОВАЛ  ')+t);if(!ok)failures++}
(async()=>{const br=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390])for(const state of ['обычно','без зала','мало замеров','утро','новичок']){
 const p=await br.newPage({viewport:{width,height:844}});
 const o={theme,meas:M.замеры(),hist:M.журнал(),progress:{sila:{verdict:'растёт',up:2,flat:1,down:1}}};
 if(state==='обычно')o.goal={text:'75 кг',wt:'down',rate:-.6,from:M.Д(29),w0:92};
 if(state==='без зала')o.me={only:'food',sex:'m',age:38,ht:178,bw:88.1};
 if(state==='мало замеров')o.meas=[M.замеры()[0]];
 if(state==='утро')Object.assign(o,{time:'08:10',day:{meals:[],kcal:0,prot:0},score:null});
 if(state==='новичок')Object.assign(o,{newbie:true,day:null,score:null,meas:[]});
 const err=await M.поднять(p,o);const label=theme+'/'+width+'/'+state;
 const d=await p.evaluate(()=>{
  const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],r=e=>e.getBoundingClientRect();
  const today=q('.hdaycard'),week=q('.hweek-block'),rows=all('.hdaycard .hrow'),fab=q('#coachfab');
  return {overflow:document.documentElement.scrollWidth>innerWidth,arc:all('.hdaycard .hclk svg').length,
   rows:rows.length,grid:getComputedStyle(q('.hrows')).gridTemplateColumns.split(' ').length,
   scoreFull:Math.abs(r(rows.at(-1)).width-r(q('.hrows')).width+32)<2,
   week:all('.hweek').length,dates:all('.hwd-date').map(e=>e.textContent),after:r(week).top>=r(today).bottom,
   legend:all('.hdaycard .ds-zone').length,fields:!!q('.vzbottom #hmeas #fw'),
   body:!!q('.vztop .vzhd'),plot:all('.vzsvg svg').length,
   fabAfter:r(fab).top>=r(q('main')).bottom,fabHeight:r(fab).height,
   reserve:parseFloat(getComputedStyle(document.body).paddingBottom),nav:r(q('.l1')).height};
 });
 дано(!d.overflow&&d.arc===1&&d.grid===2&&d.legend===1,'дуга, сетка и ширина '+label);
 дано(d.rows===(state==='без зала'?3:4)&&(state!=='без зала'||d.scoreFull),'показатели и широкая оценка без зала '+label);
 дано(d.week===1&&d.dates.length===7&&d.dates.every(x=>/^\d{1,2}$/.test(x))&&d.after,'единственная неделя с датами после Сегодня '+label);
 дано(d.body&&d.fields&&d.plot===(['мало замеров','новичок'].includes(state)?0:1),'Тело и доступный новый замер '+label);
 дано(d.fabAfter&&d.fabHeight>=44&&d.reserve>=d.fabHeight+d.nav,'капсула после контента и запас под навигацию '+label);
 if(state==='обычно'){
  дано(await p.locator('.sila-up,.sila-flat,.sila-down').evaluateAll(ns=>ns.length===3&&ns.every(n=>{const r=document.createRange();r.selectNodeContents(n);return getComputedStyle(n).whiteSpace==='nowrap'&&r.getClientRects().length===1})), 'каждая группа силы целиком на одной строке '+label);
  await p.locator('#fw').fill('87.4');
  for(const metric of ['fat','prot','w']){
   const chip=p.locator('[data-vzv="'+metric+'"]');if(await chip.count()){
    await chip.click();дано(await p.locator('#fw').inputValue()==='87.4','ввод замера не теряется при '+metric+' '+label);
    дано(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'переключатель '+metric+' помещается '+label);
   }
  }
  await p.locator('.hwd:not([disabled])').first().click();
  дано(await p.locator('#p-food').isVisible(),'переход к дню еды сохранён '+label);
 }
 дано(!err.length,'нет ошибок JS '+label);await p.close();
}
}finally{await br.close()}if(failures)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
