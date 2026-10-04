'use strict';
/* 04.10: силу сообщает сервер. Проценты и направления не пересчитываем;
   детали раскрываются, у питания без sila нет пустой строки. */
const {chromium}=require('playwright'), M=require('./mock');
let плохо=0;
const дано=(ok,text)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+text);if(!ok)плохо++};
const цель={text:'75 кг',wt:'down',rate:-.6,from:M.Д(29),w0:92};
const ряд=[{name:'Жим лёжа',now:{w:62.5,r:8,date:M.Д(1)},was:{w:60,r:8,date:M.Д(15)},pct:9},
 {name:'Тяга',now:{w:70,r:10,date:M.Д(1)},was:null,pct:null}];
(async()=>{
 const br=await chromium.launch();
 try{
  for(const verdict of ['растёт','стоит','падает','мало']){
   const p=await br.newPage({viewport:{width:390,height:900}});
   const errors=await M.поднять(p,{theme:verdict==='падает'?'light':'dark',meas:M.замеры(),goal:цель,
    progress:{sila:{verdict,up:3,flat:2,down:1,rows:ряд}}});
   const box=p.locator('.vzsila'), summary=box.locator('summary');
   дано(await box.count()===1,'строка силы есть и без линии плана: '+verdict);
   дано((await summary.innerText())===(verdict==='мало'?'Сила: мало занятий за две недели':'Сила за 2 недели: растёт 3 · стоит 2 · падает 1'),'счётчики и подпись с сервера: '+verdict);
   const cls=await box.getAttribute('class');
   дано(cls.includes('warn')===(verdict==='падает') && cls.includes('muted')===(verdict==='мало'),'цвет состояния: '+verdict);
   дано(!await box.evaluate(e=>e.open),'детали изначально свёрнуты');
   await summary.click();
   дано(await box.evaluate(e=>e.open) && await box.locator('li').count()===2,'по тапу видны упражнения');
   const text=await box.innerText();
   дано(text.includes('62,5×8') && text.includes('+9 %'),'процент взят с сервера, не рассчитан из 60 → 62,5');
   дано(text.includes('нет прошлого сравнения') && !text.includes('null'),'первая тренировка без прошлого сравнения');
   дано((await summary.boundingBox()).height>=44,'область нажатия не меньше 44 px');
   await summary.focus();await p.keyboard.press('Enter');дано(!await box.evaluate(e=>e.open),'раскрытие доступно с клавиатуры');
   дано(errors.length===0,'нет ошибок браузера');await p.close();
  }
  for(const sila of [undefined,{verdict:'мало',rows:[]},{verdict:'падает',up:0,flat:0,down:1,text:'<img src=x onerror=alert(1)>',rows:[]}]){
   const p=await br.newPage({viewport:{width:320,height:800}});
   await M.поднять(p,{meas:M.замеры(),goal:цель,progress:{sila}});
   дано(await p.locator('.vzsila').count()===(sila?1:0),'без sila — нет строки и пустого места');
   if(sila && sila.text){await p.locator('.vzsila summary').click();дано((await p.locator('.vzsila').innerText()).includes('<img') && await p.locator('.vzsila img').count()===0,'резервный текст экранирован');}
   дано(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'помещается на 320 px');await p.close();
  }
 }finally{await br.close()}
 if(плохо){console.error('ПРОВАЛОВ: '+плохо);process.exitCode=1}else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e=>{console.error('УПАЛО:',e);process.exitCode=1});
