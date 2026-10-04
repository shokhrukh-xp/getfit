'use strict';
// Проверка композиции цветов текста; прежний алгоритм test-ds1.
async function контраст(page,root='body'){
return page.evaluate(root=>{
 const ctx=document.createElement('canvas').getContext('2d',{willReadFrequently:true}),cache={};
 function rgba(s){if(cache[s])return cache[s];ctx.clearRect(0,0,1,1);ctx.fillStyle=s;ctx.fillRect(0,0,1,1);const d=ctx.getImageData(0,0,1,1).data;return cache[s]=[d[0],d[1],d[2],d[3]/255]}
 function over(a,b){const al=a[3]+b[3]*(1-a[3]);return al?[0,1,2].map(i=>(a[i]*a[3]+b[i]*b[3]*(1-a[3]))/al).concat(al):[0,0,0,0]}
 function lum(c){const v=c.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]}
 const out=[], skipped=[];let checked=0;
 for(const e of document.querySelectorAll(root+' *')){
  const text=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join(' ');
  if(!text||e.closest('svg,[disabled],[aria-disabled="true"],script,style'))continue;
  const r=e.getBoundingClientRect(),cs=getComputedStyle(e);if(!r.width||!r.height||cs.visibility!=='visible')continue;
  let fg=rgba(cs.color).slice(),bg=[0,0,0,0],skip=false;
  for(let n=e;n;n=n.parentElement){const c=getComputedStyle(n);if(+c.opacity===0){skip=true;break}if(c.backgroundImage!=='none'){skipped.push(text.slice(0,35));skip=true;break}
   const color=rgba(c.backgroundColor);fg=over(fg,color);bg=over(bg,color);fg[3]*=+c.opacity;bg[3]*=+c.opacity;
  }
  if(skip)continue;fg=over(fg,[255,255,255,1]);bg=over(bg,[255,255,255,1]);const a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const size=parseFloat(cs.fontSize),large=size>=24||(size>=18.6666&&+cs.fontWeight>=700),min=large?3:4.5;checked++;
  if(ratio+.005<min)out.push({selector:e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+[...e.classList].join('.'),text:text.slice(0,60),ratio:+ratio.toFixed(2),min,fg:cs.color});
 }
 return {checked,skipped:skipped.length,failures:out};
},root);
}

module.exports=контраст;
