'use strict';
// Проверяем геометрию узлов, а не scrollWidth: fixed может не увеличивать его.
const обрезано=require('./obrezano-check');
module.exports=async page=>(await page.evaluate(()=>{
 const bad=[];
 for(const e of document.body.querySelectorAll('*')){
  if(['SCRIPT','STYLE'].includes(e.tagName))continue;
  const r=e.getBoundingClientRect(),c=getComputedStyle(e);
  if(!r.width||!r.height||c.visibility==='hidden'||c.display==='none')continue;
  let hidden=false;for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a);if(+s.opacity===0||s.visibility==='hidden'||s.display==='none'){hidden=true;break;}}
  if(hidden)continue;
  // Содержимое намеренной горизонтальной прокрутки/обрезки не видно за её краем.
  let left=r.left,right=r.right;
  for(let a=e.parentElement;a&&a!==document.body;a=a.parentElement){const s=getComputedStyle(a);if(['hidden','clip','auto','scroll'].includes(s.overflowX)){const ar=a.getBoundingClientRect();left=Math.max(left,ar.left);right=Math.min(right,ar.right);}}
  if(right<=left)continue;
  if(left<-.5||right>innerWidth+.5)bad.push({el:e.id?'#'+e.id:e.tagName+'.'+e.className,left:Math.round(left),right:Math.round(right)});
 }
 /* 28.10: и из своей рамки (карточка, строка, чип, поле со скруглением и фоном/обводкой) — как в обходчике (tg/audit.js, п. 6) */
 const прозрачно=c=>!c||c==='transparent'||/rgba\(\d+, \d+, \d+, 0\)/.test(c),режет=v=>['hidden','clip','auto','scroll'].includes(v);
 const видно=el=>{for(let a=el;a;a=a.parentElement){const s=getComputedStyle(a);if(+s.opacity===0||s.visibility==='hidden'||s.display==='none')return false;}const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
 for(const e of document.body.querySelectorAll('*')){
  if(['SCRIPT','STYLE'].includes(e.tagName)||e.ownerSVGElement||e.closest('[data-audit-free]'))continue;
  const дет=e.closest('details');if(дет&&!дет.open&&!e.closest('summary'))continue;
  const c=getComputedStyle(e);if(c.position==='fixed'||c.display==='none')continue;
  const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;
  if(c.position==='absolute'&&r.width<=44&&r.height<=24)continue;
  let x=true,y=true,рамка=null;
  for(let a=e.parentElement;a&&a!==document.body&&a!==document.documentElement;a=a.parentElement){const s=getComputedStyle(a);if(s.display==='contents')continue;if(режет(s.overflowX))x=false;if(режет(s.overflowY))y=false;if(!x&&!y)break;
   const фон=!прозрачно(s.backgroundColor)||s.backgroundImage!=='none',край=parseFloat(s.borderLeftWidth)>0&&s.borderLeftStyle!=='none'&&!прозрачно(s.borderLeftColor);
   if((фон||край)&&parseFloat(s.borderTopLeftRadius)>0){рамка=a;break;}}
  if(!рамка||(!x&&!y)||!видно(e)||!видно(рамка))continue;
  const b=рамка.getBoundingClientRect(),вылет=Math.max(x?Math.max(b.left-r.left,r.right-b.right):0,y?Math.max(b.top-r.top,r.bottom-b.bottom):0);
  if(вылет>1.5)bad.push({el:e.id?'#'+e.id:e.tagName+'.'+e.className,рамка:рамка.id?'#'+рамка.id:рамка.tagName+'.'+рамка.className,вылет:Math.round(вылет)});
 }
 for(const e of document.querySelectorAll('input[type="date"],input[type="time"],input[type="month"],input[type="week"],input[type="datetime-local"]')){
  if(!e.getClientRects().length)continue;const c=getComputedStyle(e);if(+c.opacity===0)continue;
  if(c.appearance!=='none'&&c.webkitAppearance!=='none')bad.push({el:e.id?'#'+e.id:'input.'+e.className,родное:'системный вид'});
 }
 return bad;
})).concat((await page.evaluate(обрезано)).map(x=>({обрезано:x.т})));
