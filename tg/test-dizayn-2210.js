'use strict';
/* 22.10, дизайн-аудит (его выбор «Глубокая полировка», делать всё: пакеты А, Б,
   В и Р1–Р5; аудит Claude + Codex D1–D20 + Gemini G1–G20). Стиль «Фокус ·
   бирюза» не меняется — проверяем детали, которые чинили. */
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const где=theme+' '+width+': ';
  /* главная: неделя значками, подписи на графике, плашка одной строкой */
  {const p=await b.newPage({viewport:{width,height:844}});
   const err=await M.поднять(p,{theme,page:'home',time:'19:40',meas:M.замеры(),hist:M.журнал(),wait:2500});
   const h=await p.evaluate(()=>({легенда:!!document.querySelector('.hweek-legend'),еда:document.querySelectorAll('.hwd b svg').length,
     дней:document.querySelectorAll('.hwd:not([disabled])').length,зал:document.querySelectorAll('.hwd-gym svg').length,подписи:[...document.querySelectorAll('svg .vzlab')].map(x=>x.textContent),vzlg:!!document.querySelector('.vzlg'),
     тнум:getComputedStyle(document.body).fontVariantNumeric,
     onb:(()=>{const e=document.getElementById('onbbar');if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return {h:r.height,t:e.innerText.replace(/\s+/g,' ')};})()}));
   ok(!h.легенда&&h.дней>0&&h.еда===h.дней,где+'«Неделя»: значок еды под днём, строки «● еда в норме…» нет');
   ok(!h.vzlg&&h.подписи.some(x=>/среднее за 7 дней/.test(x)),где+'«Тело»: подписи на графике вместо легенды: '+h.подписи.join(' · '));
   ok(/tabular-nums/.test(h.тнум),где+'цифры одной ширины');
   ok(!h.onb||(h.onb.h>=44&&h.onb.t.split('\n').length===1&&/Продолжить|Собрать|Ответить/.test(h.onb.t)),где+'плашка знакомства — строкой с действием: '+JSON.stringify(h.onb));
   const пр=await p.evaluate(()=>{const e=document.querySelector('.fmeasq input');return e?getComputedStyle(e,'::placeholder').fontStyle:'';});
   ok(пр==='italic',где+'образцы «Нового замера» курсивом');
   const пз=await p.evaluate(()=>{const e=document.querySelector('.fmeasq input');return e?getComputedStyle(e,'::placeholder').opacity:'';});
   ok(пз==='1',где+'образцы не прозрачные (ревью Codex R4: при .55 контраст 2,1:1)');
   ok(!err.length,где+'без ошибок '+err.join(' | '));
   await p.close();}
  /* зал: значки SVG, «Убрать» тихо, дни на 320 не вылезают */
  {const p=await b.newPage({viewport:{width,height:844}});
   await M.поднять(p,{theme,page:'gym',time:'18:05',hist:M.журнал(),wait:2500});
   await p.click('#list .exrow');await p.waitForTimeout(300);
   const g=await p.evaluate(()=>{const a=document.querySelector('.exfoot a.ebtn'),d=document.querySelector('.exfoot .drop'),r=a.getBoundingClientRect();
     const чипы=[...document.querySelectorAll('.gym-day .dayseg button')].map(x=>{const i=x.querySelector('i');return i?i.scrollWidth<=x.clientWidth+1:true;});
     return {svg:!!a.querySelector('svg'),текст:a.textContent.trim(),h:r.height,dropBg:getComputedStyle(d).backgroundColor,чипы};});
   ok(g.svg&&g.текст==='Видео'&&g.h<=50,где+'«Видео» — значок SVG и одна строка ('+g.h+' px)');
   ok(/rgba\(0, 0, 0, 0\)|transparent/.test(g.dropBg),где+'«Убрать» — тихой кнопкой без заливки');
   ok(g.чипы.every(Boolean),где+'подписи дней программы помещаются в чипы');
   await p.close();}
  /* знакомство: «Далее» внизу, «в зале» 2×2 */
  {const p=await b.newPage({viewport:{width,height:844}});
   await M.поднять(p,{theme,newbie:true,wait:2500});await M.шаги(p,{до:'goal'});
   const z=await p.evaluate(()=>{const g=document.getElementById('g-go').getBoundingClientRect(),кн=[...document.querySelectorAll('#g-gym button')].map(x=>x.getBoundingClientRect());
     return {низ:innerHeight-g.bottom,колонки:new Set(кн.map(r=>Math.round(r.left))).size,ряды:new Set(кн.map(r=>Math.round(r.top))).size};});
   ok(z.низ>=0&&z.низ<=40,где+'«Так и делаем» прижата к низу экрана и видна (до края '+Math.round(z.низ)+' px)');
   ok(await p.locator('#g-muscle').isVisible() && await p.locator('#g-fat').isVisible(),где+'общая цель: жир необязателен, мышцы сохранить/развивать');
   await p.close();}
 }
 /* ревью Codex R1: свободный день в начале ряда — подписи графика не ложатся на 🍕 */
 for(const width of [320,390]){const p=await b.newPage({viewport:{width,height:844}});const мс=M.замеры();
  await M.поднять(p,{theme:'light',page:'home',time:'19:40',meas:мс,free:[мс[мс.length-1].date],wait:2500});
  const пер=await p.evaluate(()=>{const лаб=[...document.querySelectorAll('svg .vzlab')].map(e=>e.getBoundingClientRect()),пиц=[...document.querySelectorAll('svg .vzsvp')].map(e=>e.getBoundingClientRect());
    const x=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;let n=0;лаб.forEach((a,i)=>{пиц.forEach(b=>{if(x(a,b))n++;});лаб.forEach((b,j)=>{if(j>i&&x(a,b))n++;});});return {n,лаб:лаб.length,пиц:пиц.length};});
  ok(пер.пиц>0&&пер.n===0,width+': подписи графика не пересекают 🍕 и друг друга '+JSON.stringify(пер));
  await p.close();}
 /* ревью Codex R3: короткое окно — кнопка цели не закрывает варианты «в зале» */
 for(const width of [320,390]){const p=await b.newPage({viewport:{width,height:420}});await M.поднять(p,{theme:'light',newbie:true,wait:2500});await M.шаги(p,{до:'goal'});
  const пк=await p.evaluate(()=>{const g=document.getElementById('g-go').getBoundingClientRect();return [...document.querySelectorAll('#g-gym button, #g-wt button')].some(e=>{const r=e.getBoundingClientRect();return r.left<g.right&&g.left<r.right&&r.top<g.bottom&&g.top<r.bottom;});});
  ok(!пк,width+'×420: кнопка цели не закрывает варианты');await p.close();}
 /* ревью Codex R2: статус дня недели — и формой (✓ / !), не только цветом */
 /* 26.10: в понедельник прошлых дней этой недели нет. Задаём статусы явно,
    чтобы каждый из трёх знаков проверялся независимо от дня запуска. */
 for(const kcal of [2110,2700]){const p=await b.newPage({viewport:{width:390,height:844}});
  const hist=M.журнал();hist.push({...hist[0],id:M.TODAY+'_done',date:M.TODAY});
  await M.поднять(p,{theme:'light',page:'home',time:'19:40',meas:M.замеры(),hist,week:{days:[{date:M.TODAY,kcal,n:3}]},wait:2500});
  const cls=kcal===2110?'good':'bad';
  const ф=await p.evaluate(cls=>{const food=document.querySelector('.hwd.on b.'+cls),gym=document.querySelector('.hwd.on .hwd-gym.done');
    return {food:food&&getComputedStyle(food,'::after').content,gym:gym&&getComputedStyle(gym,'::after').content};},cls);
  ok(!!ф.food&&ф.food.includes(cls==='good'?'✓':'!')&&!!ф.gym&&ф.gym.includes('✓'),'неделя: '+cls+' и зал записан — правильные знаки формы');await p.close();}
 /* рейтинг: без строки легенды, у точек подсказка; шестерёнка значком */
 {const p=await b.newPage({viewport:{width:390,height:844}});
  await M.поднять(p,{theme:'light',page:'circle',time:'19:40',wait:2500});
  const r=await p.evaluate(()=>({key:!!document.querySelector('#cirbody .lbkey2'),title:document.querySelectorAll('#cirbody .lbdots s[title]').length,gear:!!document.querySelector('.cirgear svg')}));
  ok(!r.key&&r.title>0&&r.gear,'рейтинг: легенды нет, у точек подсказка дня, шестерёнка значком');
  await p.close();}
 /* срез: изменения нейтральным цветом */
 {const p=await b.newPage({viewport:{width:390,height:844}});
  await M.поднять(p,{theme:'light',page:'home',time:'19:40',meas:M.замеры(),base:M.БАЗА+'?srez=1',wait:2500});
  const c=await p.evaluate(()=>{const t=getComputedStyle(document.body).color;return [...document.querySelectorAll('.srgrid .srr s')].map(x=>getComputedStyle(x).color===getComputedStyle(document.querySelector('.srgrid')).color||getComputedStyle(x).color);});
  ok(c.length&&c.every(x=>x===true),'срез: числа изменений — цветом текста, не зелёным');
  await p.close();}
 /* тёмная тема: у карточек тонкий край */
 {const p=await b.newPage({viewport:{width:390,height:844}});
  await M.поднять(p,{theme:'dark',page:'food',time:'19:40',wait:2500});
  /* 22.10, редизайн: итог дня на «Еде» — витрина со своим краем, край у
     карточки норм (.fnorm) — та же Р4 */
  const s=await p.evaluate(()=>getComputedStyle(document.querySelector('.fday .fnorm')).boxShadow);
  ok(/inset/.test(s),'тёмная: у карточки «Еды» тонкий край ('+s+')');
  await p.close();}
 /* движение: лист выезжает (o.motion), заготовка вместо «Загружаю…» */
 {const p=await b.newPage({viewport:{width:390,height:844}});
  await M.поднять(p,{theme:'light',page:'home',time:'19:40',motion:true,wait:2500});
  await p.click('#profbtn');
  const a=await p.evaluate(()=>getComputedStyle(document.querySelector('#profm .modalbox')).animationName);
  ok(/gfsheet/.test(a),'лист профиля выезжает снизу ('+a+')');
  const sk=await p.evaluate(()=>fetch(location.pathname).then(r=>r.text()).then(t=>(t.match(/<div id="(eatbody|cirbody)"><div class="skel"/g)||[]).length));
  ok(sk===2,'«Что съесть» и «Рейтинг» до загрузки — заготовкой, а не «Загружаю…»');
  await p.close();}
}finally{await b.close();}
console.log(bad?'ПРОВАЛОВ: '+bad:'всё ок');process.exit(bad?1:0);})();
