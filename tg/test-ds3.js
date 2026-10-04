'use strict';
// 04.10: hero форматирует строку сервера, не создаёт вторую формулу нормы.
const {chromium}=require('playwright'),M=require('./mock');let bad=0;
const дано=(ok,t)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+t);if(!ok)bad++};
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390])for(const state of ['сегодня','прошлый','закрыт','свободный','без профиля','пустой','норма закрыта']){
 const p=await b.newPage({viewport:{width,height:844}});
 // 777 намеренно не равно 2110−1030: отображать нужно ответ сервера.
 let line='До нормы ещё 777 ккал. Белка осталось 56 г.';
 const o={theme,page:'food',time:'19:40',day:{line:'За день: 1030 ккал. '+line}};
 if(state==='прошлый'){line='За вчера: 1030 / 2110 ккал. Не хватило до нормы: 1080 ккал.';o.day={date:M.Д(1),line};o.score={closed:true};}
 if(state==='закрыт')o.score={closed:true};
 if(state==='свободный'){o.free=[M.Д(0)];o.week={days:M.неделя().days.map(d=>({...d,free:d.date===M.Д(0)}))};}
 if(state==='без профиля')o.day.targets={};
 if(state==='пустой'){line='До нормы: 2110 ккал и 165 г белка.';o.day={meals:[],kcal:0,prot:0,line:'За день: 0 ккал. '+line};o.score={r:null};}
 if(state==='норма закрыта'){line='Норма закрыта.';o.day.line='За день: 2110 ккал. '+line;}
 const errors=await M.поднять(p,o),label=theme+'/'+width+'/'+state;
 if(state==='прошлый'){await p.locator('#fnav button').first().click();await p.waitForTimeout(250)}
 const hero=p.locator('.food-hero');
 дано(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'нет прокрутки вбок '+label);
 if(state==='без профиля'){
  дано(await hero.count()===0&&/Заполни профиль/.test(await p.locator('#fday').innerText()),'без нормы остаётся подсказка '+label);
 }else if(state==='свободный'){
  дано(await p.locator('.food-free .svcard').count()===1&&await p.locator('#fday .fbar,#fday .fclose').count()===0,'свободный без нормы и оценки '+label);
  дано(await p.locator('#fweek .fd-today .fb-free').count()===1&&await p.locator('#fweek .fd-today .nb').count()===0,'свободный день недели без коридора '+label);
  дано(await p.locator('#food-add').isHidden(),'в свободный день нет призыва записать еду '+label);
 }else{
  const shown=(await p.locator('.food-hero-copy').textContent()).replace(/\s+/g,' ').trim();
  дано(shown===line,'ровно прежняя строка сервера '+label+' '+shown);
  дано(await p.locator('.fnorm').innerText().then(t=>!t.includes(line)),'строка не дублируется в норме '+label);
  if(state==='сегодня')дано(await p.locator('.food-remaining').textContent()==='777','число из строки, не из вычитания '+label);
  if(['прошлый','закрыт','норма закрыта'].includes(state))дано(await p.locator('.food-remaining').count()===0,'итог не представлен остатком '+label);
  if(state==='прошлый'||state==='закрыт')дано(/итог дня/.test(await hero.innerText()),'прежняя финальная оценка '+label);
  дано(await p.locator('.fnorm .fbar').count()===5&&await p.locator('.fnorm .ds-zone').count()===1,'пять шкал и одна легенда '+label);
 }
 дано(await p.locator('#fmealhead').innerText()==='Приёмы · '+(state==='пустой'?0:2),'счётчик реальных приёмов '+label);
 /* 04.10, его снимок: пунктирная рамка без заливки в строке недели читалась
    пустой при переборе. Сегодня залито по правилу дня; отличает его дата. */
 const chart=await p.locator('#fweek .fd-today .fb').evaluate(e=>{const cs=getComputedStyle(e);return {рамка:cs.borderTopStyle,фон:cs.backgroundColor,узор:cs.backgroundImage};});
 дано(chart.рамка!=='dashed'&&(!/rgba\(0, 0, 0, 0\)|transparent/.test(chart.фон)||chart.узор!=='none'),'сегодня в неделе залито, не пустая рамка '+label+' '+JSON.stringify(chart));
 await p.locator('#coachfab').scrollIntoViewIfNeeded();
 дано(await p.locator('#coachfab').evaluate(e=>e.getBoundingClientRect().top>=document.querySelector('main').getBoundingClientRect().bottom),'тренер в потоке после контента '+label);
 if(state==='сегодня'){await p.locator('#food-add').click();дано(await p.locator('#coachm').isVisible(),'добавить приём открывает прежнего тренера '+label)}
 дано(!errors.length,'нет ошибок JS '+label);await p.close();
}
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
