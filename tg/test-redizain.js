'use strict';
/* 22.10, его выбор — редизайн «Бирюза, но смелее» (макеты
   docs/reviews/2026-10-22-redizain/). Что проверяем:
   1. мелкий текст на бирюзовых витринах читается ПО НАСТОЯЩИМ ПИКСЕЛЯМ:
      contrast-check градиенты пропускает (ревью Codex R4), поэтому здесь
      текст витрины прячем, снимаем её, берём самый светлый и самый тёмный
      пиксель под каждой надписью и считаем WCAG (4,5:1, крупное — 3:1);
   2. песочная карточка следующего приёма: есть в открытом дне и ведёт в чат
      тренера (его выбор «Чат тренера»), нет при закрытом дне (R5), переборе
      и свободном дне;
   3. «свободный день» не раздувается до размера числа (R2), раскрытый
      кружок на витрине читается (R1), скобка отклонения не белая на белом
      графике «Тела» (R3), таймер — плавающая карточка (R6). */
const {chromium}=require('playwright'),M=require('./mock'),zlib=require('zlib');
let плохо=0;const дано=(ok,t)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+t);if(!ok)плохо++};

/* PNG 8 бит RGB/RGBA без чересстрочности — так снимает Chromium */
function png(buf){
 let p=8,w,h,ct,idat=[];
 while(p<buf.length){const n=buf.readUInt32BE(p),t=buf.toString('ascii',p+4,p+8),d=buf.subarray(p+8,p+8+n);
  if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);ct=d[9];}else if(t==='IDAT')idat.push(d);else if(t==='IEND')break;p+=12+n;}
 const bpp=ct===6?4:3,raw=zlib.inflateSync(Buffer.concat(idat)),out=Buffer.alloc(w*h*bpp),st=w*bpp;
 for(let y=0;y<h;y++){const f=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,(y+1)*(st+1));
  for(let x=0;x<st;x++){const a=x>=bpp?out[y*st+x-bpp]:0,b=y?out[(y-1)*st+x]:0,c=(x>=bpp&&y)?out[(y-1)*st+x-bpp]:0;let v=src[x];
   if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);}
   out[y*st+x]=v&255;}}
 return {w,h,bpp,px:(x,y)=>{const i=(y*w+x)*bpp;return [out[i],out[i+1],out[i+2]];}};
}
const лум=c=>c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
const отн=(a,b)=>{const x=лум(a),y=лум(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};

async function витрины(p,корни,tag){
 const тексты=await p.evaluate(корни=>{const out=[];
  for(const к of корни)for(const root of document.querySelectorAll(к))for(const e of root.querySelectorAll('*')){
   if(e.closest('svg,.hbx,[hidden]'))continue;
   const t=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join(' ');if(!t)continue;
   const cs=getComputedStyle(e);if(cs.visibility!=='visible')continue;
   /* надпись на своей непрозрачной подложке (белая пилюля дня, кнопка) — это обычный контраст, его меряет contrast-check */
   let своя=false;for(let n=e;n&&n!==root;n=n.parentElement){const bg=getComputedStyle(n).backgroundColor;if(/rgb\(/.test(bg)){своя=true;break}}if(своя)continue;
   const range=document.createRange();range.selectNodeContents(e);const r=range.getBoundingClientRect();if(r.width<2||r.height<2)continue;
   const m=cs.color.match(/[\d.]+/g).map(Number);
   out.push({t:t.slice(0,30),x:r.x,y:r.y,w:r.width,h:r.height,fg:m.slice(0,3),a:m.length>3?m[3]:1,size:parseFloat(cs.fontSize),bold:+cs.fontWeight>=700});}
  return out;},корни);
 await p.addStyleTag({content:корни.map(к=>к+' *').join(',')+'{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}'});
 await p.waitForTimeout(60);
 const снимок=png(await p.screenshot());const dpr=await p.evaluate(()=>devicePixelRatio);
 const плохие=[];
 for(const т of тексты){let худ=99;
  for(let y=Math.floor(т.y*dpr);y<Math.ceil((т.y+т.h)*dpr);y+=2)for(let x=Math.floor(т.x*dpr);x<Math.ceil((т.x+т.w)*dpr);x+=2){
   if(x<0||y<0||x>=снимок.w||y>=снимок.h)continue;const bg=снимок.px(x,y),fg=т.fg.map((c,i)=>c*т.a+bg[i]*(1-т.a));худ=Math.min(худ,отн(fg,bg));}
  if(худ===99)continue;const мин=(т.size>=24||(т.size>=18.67&&т.bold))?3:4.5;if(худ+.01<мин)плохие.push(т.t+' '+худ.toFixed(2)+'<'+мин);}
 дано(тексты.length>0&&!плохие.length,'текст на витрине читается по пикселям '+tag+' ('+тексты.length+') '+JSON.stringify(плохие.slice(0,6)));
}

(async()=>{const b=await chromium.launch();try{
 const ЕДА=[{id:1,t:'09:26',kind:'завтрак',kcal:520,prot:48,img:'/p/a.jpg'},{id:2,t:'14:35',kind:'обед',kcal:634,prot:60,img:'/p/b.jpg'}];
 const НОРМА={kcal:2110,prot:165,fat:{min:52,max:78},fib:30,sug:50};
 /* 1. контраст витрин по пикселям */
 for(const theme of ['light','dark'])for(const width of [320,390,430])for(const [page,корни,time] of [['home',['.hdaycard'],'19:40'],['food',['.food-hero'],'19:40'],['gym',['.gym-day'],'18:05']]){
  const p=await b.newPage({viewport:{width,height:844},deviceScaleFactor:1});
  await M.поднять(p,{theme,page,time,hist:M.журнал(),meas:M.замеры()});await p.waitForTimeout(500);
  await p.locator(корни[0]).scrollIntoViewIfNeeded();
  await витрины(p,корни,theme+'/'+width+'/'+page);await p.close();}
 /* 2. карточка следующего приёма */
 for(const theme of ['light','dark']){
  let p=await b.newPage({viewport:{width:390,height:844}});
  await M.поднять(p,{theme,time:'19:40',day:{meals:ЕДА,kcal:1154,prot:108,targets:НОРМА}});await p.waitForTimeout(500);
  const к=p.locator('.hnextm');дано(await к.count()===1,'открытый день: карточка следующего приёма есть '+theme);
  const т=await к.innerText();дано(/Ужин/.test(т)&&/ккал/.test(т)&&/мяса или рыбы|белок набран/.test(т),'в карточке — приём, ккал и чем закрыть белок '+theme+': '+т.replace(/\s+/g,' '));
  дано(!(await p.locator('.day-status').innerText()).includes('мяса или рыбы'),'под дугой совет не повторяется '+theme);
  await к.click();await p.waitForTimeout(400);дано(await p.locator('#coachm').isVisible(),'нажатие — чат тренера '+theme);await p.close();
  for(const [имя,o] of [['день закрыт',{score:{closed:true,r:7.2}}],['перебор',{day:{meals:ЕДА,kcal:2600,prot:120,targets:НОРМА}}],['свободный день',{free:[M.Д(0)]}]]){
   p=await b.newPage({viewport:{width:390,height:844}});await M.поднять(p,Object.assign({theme,time:'19:40',day:{meals:ЕДА,kcal:1154,prot:108,targets:НОРМА}},o));await p.waitForTimeout(500);
   дано(await p.locator('.hnextm').count()===0,имя+': карточки следующего приёма нет '+theme);
   if(имя==='свободный день'){const fs=await p.locator('.hctr b.hfree').evaluate(e=>getComputedStyle(e).fontSize);дано(fs==='24px','«свободный день» — 24 px, не размер числа '+theme+' '+fs);}
   await p.close();}
 }
 /* 3. раскрытый кружок на светлой витрине */
 {const p=await b.newPage({viewport:{width:320,height:844}});await M.поднять(p,{theme:'light',time:'19:40'});await p.waitForTimeout(500);
  const g=p.locator('.hclk-svg .hb[data-hx]').first();await p.locator('.hclk').scrollIntoViewIfNeeded();const r=await g.locator('.hbcut').boundingBox();
  await p.mouse.click(r.x+r.width/2,r.y+r.height/2);await p.waitForTimeout(300);
  const c=await p.locator('.hbx-t').evaluate(e=>getComputedStyle(e).color);дано(c!=='rgb(255, 255, 255)','раскрытый кружок: текст не белый на белой карточке ('+c+')');await p.close();}
 /* 4. скобка отклонения на белом графике «Тела» */
 {const p=await b.newPage({viewport:{width:390,height:844}});
  await M.поднять(p,{theme:'light',meas:M.замеры(),goal:{text:'75 кг',wt:'down',rate:-.6,from:M.Д(29),w0:92,by:'2027-02-17'},progress:{anchor:M.Д(14),anchorW:85.5,rate:-.6,gap:4.3,onTrack:false,w0:92,kg:17}});await p.waitForTimeout(600);
  const s=await p.evaluate(()=>{const g=document.querySelector('#homebody .vzgap'),l=document.querySelector('#homebody .vzgapl');return g&&l?[getComputedStyle(g).stroke,getComputedStyle(l).fill]:null});
  дано(s&&s[0]!=='rgb(255, 255, 255)'&&s[1]!=='rgb(255, 255, 255)','скобка и число отклонения не белые на белом графике '+JSON.stringify(s));await p.close();}
 /* 5. таймер отдыха — плавающая карточка над панелью */
 {const p=await b.newPage({viewport:{width:390,height:844}});await M.поднять(p,{theme:'light',page:'gym',time:'18:05'});await p.waitForTimeout(400);
  const t=await p.evaluate(()=>{const e=document.querySelector('.timer'),c=getComputedStyle(e);return [c.left,c.borderTopLeftRadius]});
  дано(t[0]==='12px'&&t[1]==='22px','таймер — с полями и скруглением, как панель '+JSON.stringify(t));await p.close();}
}finally{await b.close()}
console.log(плохо?'ПРОВАЛОВ: '+плохо:'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(плохо?1:0);})();
