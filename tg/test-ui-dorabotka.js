'use strict';
// 04.10: реальные времена на фото, навигация тренера и условные ключи графика.
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean'),bounds=require('./viewport-check'),contrast=require('./contrast-check');
let bad=0;function ok(c,t){console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++}
function fixture(theme){const o=opts(theme);o.hist=[{...M.журнал()[0],id:M.TODAY+'_D1',day:'D1',date:M.TODAY,t0:new Date(M.TODAY+'T08:39:00').getTime(),updated:new Date(M.TODAY+'T09:30:00').toISOString()},...o.hist];o.free=[M.Д(3)];o.week.days=o.week.days.map(d=>d.date===M.Д(3)?{...d,free:true}:d);return o}
// Прямоугольник бейджа против круга фото (не пустых углов его bounding box).
async function geometry(p){return p.evaluate(()=>{
 const rect=e=>e.getBoundingClientRect(),over=(a,b)=>a.left<b.right-.2&&a.right>b.left+.2&&a.top<b.bottom-.2&&a.bottom>b.top+.2;
 const glyph=e=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect()};
 const badges=[...document.querySelectorAll('.hbtime')],bubbles=[...document.querySelectorAll('.hb')],issues=[];
 badges.forEach((e,i)=>{const a=rect(e),name=e.textContent;
  badges.slice(i+1).forEach(f=>{if(over(a,rect(f)))issues.push(name+' / '+f.textContent)});
  // 04.10, вечер: плашка — у группы фото (веер); свои фото под ней допустимы, чужие — нет.
  const own=String(e.getAttribute('data-m')||'').split(',').filter(Boolean).map(Number);
  bubbles.filter((b,ix)=>own.indexOf(ix)<0).forEach(b=>{const r=rect(b.querySelector('.hbcut')),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2,rad=r.width/2;
   const dx=x-Math.max(a.left,Math.min(x,a.right)),dy=y-Math.max(a.top,Math.min(y,a.bottom));if(dx*dx+dy*dy<(rad-.5)**2)issues.push(name+' / фото '+b.getAttribute('aria-label'))});
  [...document.querySelectorAll('.hctr>b,.hch,.hcw')].forEach(f=>{if(over(a,glyph(f)))issues.push(name+' / '+f.textContent)});
 });
 return {issues,times:badges.map(e=>e.textContent),font:badges.map(e=>parseFloat(getComputedStyle(e.querySelector('text')).fontSize)*document.querySelector('.hclk-svg').getBoundingClientRect().width/350),targets:bubbles.map(e=>rect(e.querySelector('.hbtap')).height),x:bubbles.map(e=>rect(e.querySelector('.hbcut')).x)};
})}
async function badgeContrast(p){return p.evaluate(()=>{
 const lum=c=>{let a=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722};
 return [...document.querySelectorAll('.hbtime')].map(e=>{const a=lum(getComputedStyle(e.querySelector('text')).fill),b=lum(getComputedStyle(e.querySelector('rect')).fill);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
})}
// 04.10, вечер, его слова: «дуга должна пропорционально показывать отрезки как
// стрелочные часы». Угол каждого фото = его время; веер почти одновременных
// (ближе 7°) держит среднее группы на среднем настоящем времени.
async function clock(p){return p.evaluate(()=>{
 const svg=document.querySelector('.hclk-svg'),w0=+svg.dataset.w0,w1=+svg.dataset.w1;
 const bub=[...document.querySelectorAll('.hb')].map((g,ix)=>{const m=g.getAttribute('transform').match(/translate\(([\d.-]+) ([\d.-]+)\)/),h=+g.dataset.h;
  return {ix,lab:g.getAttribute('aria-label'),h,a:Math.atan2(+m[1]-175,214-+m[2])*180/Math.PI,ex:-90+(h-w0)/(w1-w0)*180}});
 const badges=[...document.querySelectorAll('.hbtime')].map(e=>({t:e.textContent,m:String(e.dataset.m).split(',').map(Number)}));
 return {bub,badges};
})}
function proportional(c){
 const s=c.bub.slice().sort((a,b)=>a.ex-b.ex),bad=[];
 for(let i=0;i<s.length;){let j=i;while(j+1<s.length&&s[j+1].ex-s[j].ex<7)j++;
  const g=s.slice(i,j+1),ma=g.reduce((x,y)=>x+y.a,0)/g.length,me=g.reduce((x,y)=>x+y.ex,0)/g.length;
  if(Math.abs(ma-me)>0.6)bad.push('группа '+g.map(x=>x.lab).join(',')+' '+ma.toFixed(1)+'/'+me.toFixed(1));
  g.forEach(x=>{if(Math.abs(x.a-x.ex)>(g.length===1?0.6:3.5*(g.length-1)+0.6))bad.push(x.lab+' '+x.a.toFixed(1)+'/'+x.ex.toFixed(1))});
  i=j+1}
 const timed=c.bub.filter(x=>/^≈?\d\d:\d\d/.test(x.lab));
 timed.forEach(x=>{const own=c.badges.find(b=>b.m.indexOf(x.ix)>=0);if(!own)bad.push('нет плашки у '+x.lab);
  else{const tm=x.lab.match(/\d\d:\d\d/)[0],[a,z]=own.t.replace(/≈/g,'').split('–');if(tm<a||tm>(z||a))bad.push(x.lab+' вне плашки '+own.t)}});
 c.badges.forEach(b=>{if(!/^≈?\d\d:\d\d(–\d\d:\d\d)?$/.test(b.t))bad.push('формат '+b.t)});
 return bad;
}
module.exports={fixture,geometry,badgeContrast,clock,proportional};
if(require.main===module)(async()=>{const b=await chromium.launch();try{
 // Ревью 18:50: учитываем всю высоту центра, а не только число калорий.
 for(const theme of ['light','dark'])for(const state of ['обычный','плотный','свободный']){
  const p=await b.newPage({viewport:{width:390,height:844}}),o=state==='обычный'?opts(theme):fixture(theme);
  if(state==='плотный'){o.day.kcal=1000;o.day.meals=o.day.meals.map((m,i)=>({...m,t:['10:26','10:28','10:29','10:31','10:32'][i]}));}
  if(state==='свободный')o.free.push(M.TODAY);
  await M.поднять(p,o);
  for(const width of [320,340,360,375,390,430]){
   await p.setViewportSize({width,height:844});await p.waitForTimeout(60);
   const gap=await p.evaluate(()=>{const rs=[...document.querySelector('.hctr').children].filter(e=>getComputedStyle(e).visibility!=='hidden').map(e=>e.getBoundingClientRect()).filter(r=>r.height);return document.querySelector('.day-status').getBoundingClientRect().top-Math.max(...rs.map(r=>r.bottom))});
   ok(gap>=12,'центр отделён от совета >=12 px '+theme+'/'+state+'/'+width+': '+gap.toFixed(1));
   const g=await geometry(p);ok(!g.issues.length,'бейджи не пересекаются после отступа '+theme+'/'+state+'/'+width+' '+JSON.stringify(g.issues));
   await p.locator('#coachnav').click();
   const hint=await p.locator('#ctext').evaluate(e=>{const s=getComputedStyle(e),c=document.createElement('canvas').getContext('2d');c.font=s.font;return {text:e.placeholder,w:c.measureText(e.placeholder).width,space:e.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)}});
   ok(hint.w<=hint.space,'подсказка чата помещается одной строкой '+theme+'/'+state+'/'+width+' '+JSON.stringify(hint));
   await p.locator('#coachclose').click();
  }
  await p.close();
 }
 for(const theme of ['light','dark'])for(const width of [320,360,375,390,430]){
  const p=await b.newPage({viewport:{width,height:844}}),tag=theme+'/'+width,o=fixture(theme),err=await M.поднять(p,o);
  const g=await geometry(p),cl=await clock(p),pr=proportional(cl);
  ok(!pr.length,'фото на своём времени, как на стрелочных часах; плашки покрывают все времена '+tag+' '+JSON.stringify(pr)+' '+g.times.join('|'));
  const обед=cl.bub.find(x=>/^14:48/.test(x.lab));ok(обед&&Math.abs(обед.a-обед.ex)<0.6&&обед.a<20,'обед 14:48 сразу за полуднем, не у 22:00 '+tag+' '+(обед&&обед.a.toFixed(1)));
  ok(!g.issues.length,'бейджи не пересекают фото, друг друга, число и часы '+tag+' '+JSON.stringify(g.issues));
  ok(g.font.every(v=>v>=10&&v<=11)&&g.targets.every(v=>v>=44),'шрифт 10–11 px и касание >=44 '+tag+' '+JSON.stringify({font:g.font,targets:g.targets}));
  ok(g.x.every((v,i)=>!i||v>g.x[i-1]),'хронологический порядок пузырей '+tag);
  ok((await badgeContrast(p)).every(v=>v>=4.5),'контраст бейджей >=4,5 '+tag);
  ok(await p.locator('.hcpast,.hchand,.day-events,#coachfab').count()===0,'нет старых отметок, списка событий и капсулы '+tag);
  ok(await p.locator('.hwd-free').count()===1&&await p.locator('.hweek-free').innerText()==='🍕 свободный день','пицца в дне и легенде '+tag);
  ok(await p.locator('.vzsvl').count()>0&&await p.locator('.vzwet').count()>0&&await p.locator('.free-key').innerText()==='┆ свободный день'&&await p.locator('.water-key').innerText()==='◌ утро после него — вода, не в среднем','легенда совпадает с видимыми отметками графика '+tag);
  ok(await p.evaluate(()=>{const a=document.querySelector('.vz-today').getBoundingClientRect(),svg=document.querySelector('.vzsvg svg').getBoundingClientRect();return Math.abs(a.right-svg.right)<4&&[...document.querySelectorAll('.vzsvl')].every(e=>e.getBoundingClientRect().bottom<a.top)}),'сегодня справа и отдельно от вертикалей '+tag);
  const bb=await bounds(p),cc=await contrast(p);ok(!bb.length&&!cc.failures.length,'главная: контраст и границы '+tag+' '+JSON.stringify({bb,failures:cc.failures}));
  for(const page of ['home','gym','food']){
   await p.locator('.l1 [data-page="'+page+'"]').click();
   const nav=await p.locator('.l1 button:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=e.querySelector('span').getBoundingClientRect();return {w:r.width,h:r.height,l:r.left,r:r.right,text:s.width<=r.width}}));
   ok(nav.length===4&&nav.every(r=>r.l>=0&&r.r<=width&&r.w>=44&&r.h>=44&&r.text),'четыре полных цели касания '+tag+'/'+page);
   await p.locator('#coachnav').click();ok(await p.locator('#coachm').isVisible()&&await p.locator('.l1 [aria-selected="true"]').getAttribute('data-page')===page,'чат поверх прежней страницы '+tag+'/'+page);
   await p.locator('#coachclose').click();ok(!await p.locator('#coachm').isVisible()&&await p.locator('.l1 [aria-selected="true"]').getAttribute('data-page')===page,'закрытие сохраняет вкладку '+tag+'/'+page);
  }
  ok(!err.length,'без ошибок JS '+tag+' '+err.join('|'));await p.close();
 }
 // Пять записей за шесть минут + зал, вес и два плановых приёма.
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const p=await b.newPage({viewport:{width,height:844}}),o=fixture(theme);
  o.day.meals=o.day.meals.map((m,i)=>({...m,t:['10:26','10:28','10:29','10:31','10:32'][i]}));o.day.kcal=1000;
  await M.поднять(p,o);const g=await geometry(p);
  const pr=proportional(await clock(p));
  ok(!g.issues.length&&!pr.length,'плотная группа + планы: веер на своём времени, плашки без наложений '+theme+'/'+width+' '+JSON.stringify(g.issues)+' '+JSON.stringify(pr)+' '+g.times.join('|'));
  ok(!(await bounds(p)).length,'насыщенный день внутри экрана '+theme+'/'+width);
  await p.locator('.hb-meal').first().focus();await p.keyboard.press('Enter');ok(await p.locator('#p-food').isVisible(),'пузырь доступен клавиатурой');
  await p.close();
 }
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const p=await b.newPage({viewport:{width,height:844}}),o=opts(theme);o.me.only='food';o.day.kcal=1000;await M.поднять(p,o);
  ok(await p.locator('.l1 button:visible').count()===3,'три кнопки без зала '+theme+'/'+width);
  ok(await p.locator('.hwd-free,.hweek-free,.free-key,.water-key').count()===0,'без свободных дней нет легенд '+theme+'/'+width);
  const g=await geometry(p);ok(g.times.some(t=>/^≈\d\d:\d\d$/.test(t))&&!g.issues.length,'плановый приём с ≈, без пересечений '+theme+'/'+width+' '+JSON.stringify(g.issues));
  ok((await badgeContrast(p)).every(v=>v>=4.5),'приглушённый плановый бейдж контрастен '+theme+'/'+width);
  // Реальный ответ сервера после закрытия чата должен поставить точку.
  await p.route('**/coach',async r=>{await new Promise(resolve=>setTimeout(resolve,600));await r.fulfill({json:{ok:true,reply:'Записал.',day:M.день()}})});
  await p.locator('#coachnav').click();await p.locator('#ctext').fill('Обед');await p.locator('#csend').click();await p.locator('#coachclose').click();await p.waitForTimeout(850);
  ok(await p.locator('#coachnav').evaluate(e=>e.classList.contains('attn')&&getComputedStyle(e,'::after').content!== 'none'),'точка непрочитанного ответа '+theme+'/'+width);
  await p.locator('#coachnav').click();await p.locator('#coachclose').click();ok(!await p.locator('#coachnav').evaluate(e=>e.classList.contains('attn')),'точка снялась после чтения');
  await p.close();
 }
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
