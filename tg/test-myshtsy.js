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
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
