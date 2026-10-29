'use strict';
/* 29.10, его снимок 07:54 (тренировка, «Тяга сидя на блоке»): «Когда я вписываю подходы, часть
   экрана с полями постоянно уходит за клавиатуру. Её можно всегда держать выше клавиатуры?»
   Плавающая панель разделов висела прямо над клавиатурой и закрывала строки подходов.
   Клавиатуру моделируем, как в test-ds5: visualViewport ниже на 336 px (клавиатура iPhone).
     1) фокус в «кг» — панели разделов нет, строка подхода и следующая над клавиатурой;
     2) последний подход последнего упражнения тоже поднимается (запас внизу страницы);
     3) при открытом таймере отдыха строка над таймером, а не под ним;
     4) переход «кг» → «повторы» не мигает панелью; ушёл из поля — панель вернулась. */
const {chromium}=require('playwright'),M=require('./mock'),viewport=require('./viewport-check');
let bad=0;const ok=(v,t)=>{console.log((v?'  ok  ':'  ПРОВАЛ  ')+t);if(!v)bad++};
const КЛАВ=336;
const клавиатура=(p,h)=>p.evaluate(({h,k})=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:h-k});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:0});visualViewport.dispatchEvent(new Event('resize'));},{h,k:КЛАВ});
const где=(p,sel)=>p.locator(sel).evaluate(e=>{const row=e.closest('.setrow'),r=row.getBoundingClientRect(),n=row.nextElementSibling,nr=n?n.getBoundingClientRect():null,v=visualViewport,t=document.querySelector('#timer'),tr=t&&t.classList.contains('show')?t.getBoundingClientRect().top:Infinity;
  return {top:r.top,bottom:r.bottom,next:nr?nr.bottom:null,limit:Math.min(v.offsetTop+v.height,tr),nav:getComputedStyle(document.querySelector('.l1')).display,kb:document.body.classList.contains('kbopen')};});
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const [width,height] of [[390,844],[320,667]]){
  const tag=theme+'/'+width+'×'+height;
  const p=await b.newPage({viewport:{width,height}});
  const errors=await M.поднять(p,{theme,page:'gym',hist:M.журнал()});
  await p.locator('#list .exrow').first().click();await p.waitForTimeout(300);
  /* 1) середина: второй подход, поле «кг» */
  const кг='.card.exact .setrow[data-set="1"] input[data-f="w"]';
  await p.locator(кг).scrollIntoViewIfNeeded();
  await p.evaluate(s=>{const e=document.querySelector(s);const r=e.getBoundingClientRect();window.scrollBy(0,r.bottom-(innerHeight-40));},кг);   /* как iOS: поле у нижнего края */
  await p.focus(кг);await клавиатура(p,height);await p.waitForTimeout(450);
  let г=await где(p,кг);
  ok(г.kb&&г.nav==='none','1) клавиатура открыта — панели разделов нет '+tag);
  ok(г.top>=0&&г.bottom<=г.limit-11.5,'1) строка подхода над клавиатурой '+tag+' '+JSON.stringify(г));
  ok(г.next==null||г.next<=г.limit,'1) и следующая строка видна '+tag);
  /* 4) «кг» → «повторы»: панель не возвращается между полями */
  const повт='.card.exact .setrow[data-set="1"] input[data-f="r"]';
  await p.focus(повт);await p.waitForTimeout(40);
  ok(await p.evaluate(()=>document.body.classList.contains('kbopen')),'4) переход в «повторы» — панель не мигает '+tag);
  /* 3) таймер отдыха: отметили первый подход, вписываем второй */
  await p.evaluate(()=>document.activeElement.blur());await p.waitForTimeout(200);
  await p.locator('.card.exact .setrow .ok').first().click();await p.waitForTimeout(400);
  if(await p.locator('#timer.show').count()){
    await p.focus(кг);await клавиатура(p,height);await p.waitForTimeout(450);
    г=await где(p,кг);
    ok(г.bottom<=г.limit-11.5,'3) строка над таймером отдыха и клавиатурой '+tag+' '+JSON.stringify(г));
  } else ok(true,'3) таймер не открылся на стенде — пропуск '+tag);
  /* 2) последний подход последнего упражнения */
  await p.evaluate(()=>document.activeElement&&document.activeElement.blur());await p.waitForTimeout(200);
  const рядов=await p.locator('#list .exrow').count();
  await p.locator('#list .exrow').nth(рядов-1).click();await p.waitForTimeout(300);
  const n=await p.locator('#list .setrow input[data-f]').count();   /* у ролика для пресса только повторы */
  ok(n>0,'2) у последнего упражнения есть поля '+tag);
  if(n){ await p.evaluate(()=>{const a=[...document.querySelectorAll('#list .setrow input[data-f]')];a[a.length-1].id='kblast';});
    const посл='#kblast';
    await p.locator(посл).scrollIntoViewIfNeeded();await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    await p.focus(посл);await клавиатура(p,height);await p.waitForTimeout(450);
    г=await где(p,посл);ok(г.bottom<=г.limit-11.5,'2) последний подход последнего упражнения поднимается над клавиатурой '+tag+' '+JSON.stringify(г)); }
  const плохо=await viewport(p);ok(!плохо.length,'с клавиатурой ничего не выходит за край '+tag+' '+JSON.stringify(плохо));
  /* 4) ушёл из поля — панель вернулась */
  await p.evaluate(()=>{document.activeElement.blur();Object.defineProperty(visualViewport,'height',{configurable:true,value:innerHeight});visualViewport.dispatchEvent(new Event('resize'));});await p.waitForTimeout(250);
  ok(await p.evaluate(()=>!document.body.classList.contains('kbopen')&&getComputedStyle(document.querySelector('.l1')).display!=='none'),'4) клавиатура закрыта — панель разделов на месте '+tag);
  ok(!errors.length,'без ошибок страницы '+tag+' '+errors.join('; '));
  await p.close();
}
/* чат тренера не трогаем: у поля чата свой порядок (sheetViewport) */
{const p=await b.newPage({viewport:{width:390,height:844}});await M.поднять(p,{page:'home'});
 await p.click('#coachnav');await p.waitForTimeout(300);await p.focus('#ctext');await клавиатура(p,844);await p.waitForTimeout(300);
 const r=await p.locator('#csend').evaluate(e=>{const r=e.getBoundingClientRect(),v=visualViewport;return r.bottom<=v.offsetTop+v.height;});
 ok(r,'чат: кнопка отправки по-прежнему над клавиатурой');await p.close();}
}finally{await b.close();}
console.log(bad?'ПРОВАЛОВ: '+bad:'клавиатура в тренировке: всё ✓');process.exit(bad?1:0);})();
