'use strict';
// 09.10, его слова: «мне не хватает информации, на какие мышцы каждое упражнение».
// Его выбор кнопкой «В списке дня»: в строке списка — главная мышца, в раскрытой
// карточке — она же над названием и строкой ниже вспомогательные (не больше трёх,
// самые нагруженные первыми).
// Главная — мышца, а не движение: «Присед», «Горизонтальная тяга» — не мышцы.
// Проверяем все дни программы, ширину 320 и 390, обе темы; снимки — в /tmp.
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;function ok(c,t){console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++}
const ДВИЖЕНИЕ=/^(присед|наклон|горизонтальн|вертикальн|задняя цепь|корпус|ноги|спина|антиротац)/;
async function поднять(b,w,theme){
 const p=await b.newPage({viewport:{width:w,height:844}});
 const o=opts(theme);o.page='gym';
 const err=await M.поднять(p,o);await p.waitForTimeout(700);
 return {p,err};
}
const строки=p=>p.evaluate(()=>[...document.querySelectorAll('#list .exrow')].map(r=>{
 const n=r.querySelector('.exrn'),i=r.querySelector('.exrn i'),ri=i.getBoundingClientRect();
 return {имя:r.querySelector('.exrn b').textContent,под:i.textContent,влез:n.scrollWidth<=n.clientWidth+1,
  строк:Math.round(ri.height/parseFloat(getComputedStyle(i).lineHeight||16)||1)}}));
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['dark','light'])for(const w of [320,390]){
  const {p,err}=await поднять(b,w,theme);
  const дни=await p.evaluate(()=>[...document.querySelectorAll('#dayseg button[data-day]')].map(x=>x.dataset.day));
  let все=[];
  for(const d of дни){await p.click('#dayseg button[data-day="'+d+'"]');await p.waitForTimeout(350);
   (await строки(p)).forEach(r=>все.push(Object.assign({д:d},r)));}
  const где=theme+' '+w+': ';
  ok(все.length>=10,где+'строк упражнений во всех днях: '+все.length);
  const без=все.filter(r=>!/^[а-яё][а-яё ]+ · \d+ × /.test(r.под));
  ok(!без.length,где+'в каждой строке сначала мышца, потом подходы'+(без.length?': '+JSON.stringify(без.slice(0,3)):''));
  const движ=все.filter(r=>ДВИЖЕНИЕ.test(r.под));
  ok(!движ.length,где+'вместо мышцы нигде не стоит движение'+(движ.length?': '+JSON.stringify(движ.slice(0,3)):''));
  const не=все.filter(r=>!r.влез);
  ok(!не.length,где+'подпись влезает в строку'+(не.length?': '+JSON.stringify(не.slice(0,3)):''));
  const стр=Math.max(...все.map(r=>r.строк));
  ok(стр<=2,где+'подпись не длиннее двух строк: '+стр);
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),где+'страница не ездит вбок');
  await p.click('#dayseg button[data-day="D1"]');await p.waitForTimeout(350);
  const пр=(await строки(p))[0];
  ok(/^Приседания со штангой/.test(пр.имя)&&/^квадрицепс · 4 × 6–10/.test(пр.под),где+'присед — «квадрицепс · 4 × 6–10»: '+пр.под);
  await p.screenshot({path:'/tmp/gf-myshtsy-list-'+theme+'-'+w+'.png'});
  await p.click('#list .exrow[data-pickex="0"]');await p.waitForTimeout(900);
  const шапка=await p.evaluate(()=>{const c=document.querySelector('#list .card.exact');const e=c&&c.querySelector('.eyebrow'),m=c&&c.querySelector('.mmore');
   const lh=m?parseFloat(getComputedStyle(m).lineHeight):16;
   return e?{т:e.textContent.replace(/\s+/g,' ').trim(),ещё:m?m.textContent.replace(/\s+/g,' ').trim():'',
    строк:m?Math.round(m.getBoundingClientRect().height/lh):0,доПрошлого:!!(m&&m.nextElementSibling&&m.nextElementSibling.classList.contains('lastline'))}:null});
  ok(шапка&&/^квадрицепс$/i.test(шапка.т),где+'над названием — главная мышца: '+(шапка&&шапка.т));
  ok(шапка&&шапка.ещё==='помогают ягодицы, бицепс бедра, поясница',где+'строкой ниже — вспомогательные, самые нагруженные первыми: '+(шапка&&шапка.ещё));
  ok(шапка&&шапка.строк<=(w<=320?2:1),где+'вспомогательные — '+(w<=320?'не больше двух строк':'одной строкой')+': '+(шапка&&шапка.строк));
  ok(шапка&&шапка.доПрошлого,где+'строка мышц стоит над «прошлым разом»');
  await p.screenshot({path:'/tmp/gf-myshtsy-card-'+theme+'-'+w+'.png'});
  ok(!err||!err.length,где+'без ошибок на странице'+(err&&err.length?': '+err.join(' | '):''));
  await p.close();
 }

 /* программа от тренера-ИИ (подходов у него 2–3 — фаза цели, их не проверяем): p — «подпись мышцы или движения». «Верх груди»
    точнее каталожного «Грудь» и остаётся как есть (выпуск 09.10 09:00 её
    подменял: у него «Разведение» стало «ГРУДЬ»); движение — мышца из каталога;
    своё упражнение без каталога и подписи — без мышцы. */
 const у=(id,n,en,m,q,p)=>({id,n,en,m,q,p,sets:3,reps:'10–12',rest:60,ss:null,why:''});
 const ПРОГ={name:'Верх · 1 день',note:'Один день.',focus:['chest'],days:[{s:'Грудь',sub:'верх груди',ex:[
  у('Incline_Dumbbell_Flyes','Разведение (наклон вверх, гантели, обычная)','Incline Dumbbell Flyes','chest','dumbbell','Верх груди'),
  у('Incline_Dumbbell_Press','Жим (наклон вверх, гантели)','Incline Dumbbell Press','chest','dumbbell','Горизонтальный жим'),
  у(null,'Моё упражнение','My exercise',null,null,'')]}]};
 const МЕ={sex:'m',age:34,ht:178,bw:87.6,goal:'fat',wt:'down',gym:'muscle',level:'mid',place:'gym',only:'all',lim:[],eq:[]};
 for(const w of [320,390]){
  const p=await b.newPage({viewport:{width:w,height:900}});
  const err=await M.поднять(p,{theme:'dark',page:'gym',wait:2800,prog:ПРОГ,profile:'ai',hist:[],me:МЕ});
  const где='ИИ '+w+': ';
  const с=await строки(p);
  const по=имя=>с.find(r=>r.имя.indexOf(имя)>=0);
  ok(по('Разведение')&&/^верх груди · \d+ × 10–12$/.test(по('Разведение').под),где+'подпись тренера «Верх груди» осталась: '+JSON.stringify(по('Разведение')));
  ok(по('Жим (наклон')&&/^грудь · \d+ × 10–12$/.test(по('Жим (наклон').под),где+'вместо движения — мышца из каталога: '+JSON.stringify(по('Жим (наклон')));
  const моё=по('Моё упражнение');
  ok(!моё||/^\d+ × 10–12$/.test(моё.под),где+'своё без каталога — без мышцы: '+JSON.stringify(моё||'нет в списке'));
  const i=await p.evaluate(()=>{const n=[...document.querySelectorAll('#list .exrow')].find(x=>/Разведение/.test(x.textContent));return n?n.dataset.pickex:null});
  await p.click('#list .exrow[data-pickex="'+i+'"]');await p.waitForTimeout(900);
  const к=await p.evaluate(()=>{const c=document.querySelector('#list .card.exact');return c?{над:(c.querySelector('.eyebrow')||{}).textContent||'',ещё:((c.querySelector('.mmore')||{}).textContent||'').replace(/\s+/g,' ').trim()}:null});
  ok(к&&/верх груди/i.test(к.над)&&к.ещё==='помогают плечи',где+'в карточке «ВЕРХ ГРУДИ» и «помогают плечи»: '+JSON.stringify(к));
  await p.screenshot({path:'/tmp/gf-myshtsy-ai-'+w+'.png'});
  ok(!err||!err.length,где+'без ошибок на странице'+(err&&err.length?': '+err.join(' | '):''));
  await p.close();
 }
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
