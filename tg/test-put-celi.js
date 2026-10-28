'use strict';
/* 28.10, его слова: «слишком много не понятного текста вроде "по весу: 17.01-12.03.2027"…
   Текста должно быть минимум. используй визуальные элементы» и «срок 30 марта… снова не было».
   Цель с телом и сроком: в профиле и в «Теле» — флажок срока чипом, полоса времени
   (сегодня → «по вашему темпу» → флажок) и одна отметка: успеваете / впритык / отстаёте.
   Подписи на полосе не наезжают друг на друга и не обрезаются; на английском — без кириллицы. */
const {chromium}=require('playwright');
const M=require('./mock'),обрезано=require('./obrezano-check');
let плохо=0;
const дано=(у,т)=>{console.log((у?'  ok  ':'  ПРОВАЛ  ')+т);if(!у)плохо++;};
const OUT=process.env.PUT_SHOTS||'/tmp/gf-put-celi';require('fs').mkdirSync(OUT,{recursive:true});
const срок=M.Д(-150);
const цель={text:'75 кг · 15% жира · мышцы развивать',wt:'down',gym:'muscle',w0:92.3,kg:17.3,rate:-.6,from:M.Д(60),date:срок,body:{v:1,target:75,fat:15,muscle:'develop'}};
const база={w0:92.3,now:85.8,fact:-6.5,rate:-.6,kg:17.3,left:10.8,verdict:{state:'план',d0:-0.4}};
const СЛУЧАИ=[
 ['ok',{from:M.Д(-100),to:M.Д(-130)},/^Успеваете/],
 ['edge',{from:M.Д(-120),to:M.Д(-170)},/^Впритык$/],
 ['late',{from:M.Д(-170),to:M.Д(-220)},/^Отстаёте на \d+ недел/],
];
/* подписи полосы: видны целиком и не пересекаются */
const подписи=sel=>`(()=>{const r=[...document.querySelectorAll('${sel} .pth-l, ${sel} .pth-m')].filter(e=>getComputedStyle(e).visibility!=='hidden').map(e=>{const b=e.getBoundingClientRect();return {t:e.textContent,l:b.left,r:b.right,top:b.top,b:b.bottom};});
 const pth=document.querySelector('${sel} .pth').getBoundingClientRect();
 const наезд=[];for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){const a=r[i],c=r[j];if(a.l<c.r-1&&c.l<a.r-1&&a.top<c.b-1&&c.top<a.b-1)наезд.push(a.t+' / '+c.t);}
 const важные=[...document.querySelectorAll('${sel} .pth-l.flag, ${sel} .pth-l.dot')].filter(e=>getComputedStyle(e).visibility==='hidden').map(e=>e.textContent);
 const вне=r.filter(x=>x.l<pth.left-1||x.r>pth.right+1).map(x=>x.t);return {наезд,вне,важные,n:r.length};})()`;
(async()=>{
 const br=await chromium.launch();
 try{
  for(const [width,theme] of [[320,'light'],[390,'dark']]) for(const [к,f,ждём] of СЛУЧАИ){
   const где=width+' '+к+': ';
   const page=await br.newPage({viewport:{width,height:900}});
   const ош=await M.поднять(page,{theme,page:'home',me:{sex:'m',age:34,ht:178,bw:85.8,coach_at:'x'},meas:M.замеры(),goal:цель,progress:{...база,forecast:{state:'forecast',source:'progress',...f,text:'По прогрессу: …'}}});
   /* «Тело» на главной */
   const тело=await page.evaluate(()=>{const s=document.querySelector('#homebody .pth-st');return s?s.innerText.replace(/\s+/g,' ').trim():'';});
   дано(ждём.test(тело),где+'«Тело»: одна отметка — '+тело);
   дано(await page.locator('#homebody .pth-band').count()===1&&await page.locator('#homebody .pth-flag').count()===1,где+'«Тело»: полоса темпа и флажок срока');
   { const т=await page.evaluate(()=>[...document.querySelectorAll('#homebody .vzweek, #homebody .vztemp, #homebody .pth, #homebody .pth-st')].map(e=>e.innerText).join(' | ')), м=т.match(/.{0,40}\b\d{2}\.\d{2}\b.{0,20}/); дано(!м,где+'«Тело»: без дат вида 17.01 '+(м?JSON.stringify(м[0]):'')); }
   const пт=await page.evaluate(подписи('#homebody'));
   дано(!пт.наезд.length&&!пт.вне.length&&!пт.важные.length,где+'«Тело»: подписи полосы не наезжают и в рамке '+JSON.stringify(пт));
   if(width===390) await page.locator('#homebody .pth').first().screenshot({path:OUT+'/telo-'+к+'.png'});
   /* профиль */
   await page.click('#profbtn');await page.waitForSelector('#goalcard .pth');
   const чип=(await page.locator('#goalcard .gdate').innerText()).trim();
   дано(чип==='к '+(+срок.slice(8))+' '+['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][+срок.slice(5,7)-1],где+'срок чипом в шапке: '+чип);
   const ст=(await page.locator('#goalcard .pth-st').innerText()).replace(/\s+/g,' ').trim();
   дано(ждём.test(ст)&&ст===тело,где+'профиль и «Тело» говорят одно: '+ст);
   дано(await page.locator('#goalcard .pth-flag'+(к==='late'?'.late':':not(.late)')).count()===1,где+'флажок '+(к==='late'?'красный':'обычный'));
   const пп=await page.evaluate(подписи('#goalcard'));
   дано(!пп.наезд.length&&!пп.вне.length&&!пп.важные.length,где+'профиль: подписи не наезжают и в рамке '+JSON.stringify(пп));
   const обр=await page.evaluate(обрезано);
   дано(!обр.length,где+'ничего не обрезано: '+JSON.stringify(обр).slice(0,300));
   дано(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),где+'без горизонтальной прокрутки');
   await page.locator('#goalcard').screenshot({path:OUT+'/profil-'+width+'-'+к+'.png'});
   дано(!ош.length,где+'без ошибок JS '+ош.slice(0,2).join(' | '));
   await page.close();
  }
  /* английский: полоса и отметка без кириллицы */
  { const page=await br.newPage({viewport:{width:390,height:900}});
    await M.поднять(page,{page:'home',tgLang:'en',me:{lang:'en',sex:'m',age:34,ht:178,bw:85.8,coach_at:'x'},meas:M.замеры(),goal:цель,progress:{...база,forecast:{state:'forecast',source:'progress',from:M.Д(-170),to:M.Д(-220),text:'…'}}});
    await page.waitForTimeout(1200);await page.click('#profbtn');await page.waitForSelector('#goalcard .pth');await page.waitForTimeout(800);
    const т=await page.evaluate(()=>[...document.querySelectorAll('#goalcard .gdate, #goalcard .pth, #goalcard .pth-st, #homebody .pth, #homebody .pth-st, #homebody .vzweek')].map(e=>e.innerText.replace(/\s+/g,' ').trim()).join(' | '));
    дано(т&&!/[А-Яа-яЁё]/.test(т),'en: полоса, срок и отметка по-английски: '+т);
    await page.locator('#goalcard').screenshot({path:OUT+'/profil-en.png'});
    await page.close(); }
 }finally{await br.close();}
 console.log(плохо?'ПРОВАЛОВ: '+плохо:'ВСЁ ПРОШЛО');process.exit(плохо?1:0);
})();
