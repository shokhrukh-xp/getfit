'use strict';
// Проверяем геометрию узлов, а не scrollWidth: fixed может не увеличивать его.
module.exports=async page=>page.evaluate(()=>{
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
 return bad;
});
