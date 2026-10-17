'use strict';
/* 17.10: полировка, пакет 2 (Claude). Его вопрос «что ещё можно улучшить в
   дизайне?», проход Claude и Codex, его выбор буквами по макетам:
   B шапка дня и приёмы, C меню, D шаги и сон, F карта тела и каталог,
   G изменения тела и снимок весов, H итог под дугой, I пустой чат,
   J подписка, K админка, L рейтинг. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean'),bounds=require('./viewport-check'),contrast=require('./contrast-check');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const вкладка=async(p,t,z)=>{await p.click('.l1 [data-page="'+t+'"]');await p.waitForTimeout(400);if(z){await p.click(z);await p.waitForTimeout(500);}};
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['dark','light'])for(const width of [320,390]){
  const где=theme+' '+width+': ';
  const p=await b.newPage({viewport:{width,height:844}});
  const o=opts(theme);o.admin={про:[],промо:[]};o.score={r:5.6,why:[{t:'калории: перебор'}]};
  const err=await M.поднять(p,o);await p.waitForTimeout(400);
  const чист=async(имя,root)=>{const bb=await bounds(p),cc=await contrast(p,root||'body');
   ok(!bb.length,где+имя+': ничего не вылезает '+JSON.stringify(bb).slice(0,140));ok(cc.checked>0&&!cc.failures.length,где+имя+': контраст '+JSON.stringify(cc.failures).slice(0,140));};

  /* H · итог под дугой: три плитки в ряд */
  const h=await p.evaluate(()=>{const r=document.querySelector('.hdaycard .hrows'),rows=[...r.querySelectorAll('.hrow')];
   return {cols:getComputedStyle(r).gridTemplateColumns.split(' ').length,n:rows.length,top:new Set(rows.map(x=>Math.round(x.getBoundingClientRect().top))).size}});
  ok(h.n===3&&h.cols===3&&h.top===1,где+'H: калории, белок, оценка — одним рядом '+JSON.stringify(h));

  /* B · шапка «Моего дня» и приёмы */
  await вкладка(p,'food');
  const hero=await p.evaluate(()=>{const s=document.querySelector('section.food-hero');const sc=s.querySelector('.fsc'),n=s.querySelector('.food-remaining'),sm=s.querySelector('.fdone small');
   return {t:s.textContent,num:n&&parseFloat(getComputedStyle(n).fontSize),score:sc&&sc.textContent.trim(),right:sc&&sc.getBoundingClientRect().left>n.getBoundingClientRect().right,
    foot:sm&&Math.round(sm.getBoundingClientRect().width)>=Math.round(s.getBoundingClientRect().width*0.7)}});
  ok(hero.num>=36,где+'B: число до нормы крупно ('+hero.num+' px)');
  ok(/оценка дня\s*5,6\s*\/ 10/.test(hero.score)&&hero.right,где+'B: «оценка дня 5,6 / 10» справа от числа: '+hero.score);
  ok(hero.foot&&/день идёт/.test(hero.t),где+'B: как идёт день — строкой во всю ширину');
  ok(!/\(−—\)/.test(hero.t),где+'B: без «(−—)» у причины без числа');
  ok(await p.locator('#fmeals .fx, #fmeals [data-fdel]').count()===0,где+'B: «×» у приёмов нет — удалить можно в листе приёма');
  /* D · шаги и сон */
  const w=await p.evaluate(()=>{const g=document.querySelector('.wear-surface .wrnone');return g&&g.textContent});
  ok(w==='Пришли тренеру скриншот шагов и сна — числа появятся здесь.',где+'D: одна строка вместо абзаца');
  await чист('Еда');
  /* C · меню */
  await p.click('[data-zseg="eat"]:visible');await p.waitForTimeout(300);const дн=p.locator('[data-eseg="day"]');if(await дн.count()){await дн.click();await p.waitForTimeout(500);}
  const m=await p.evaluate(()=>{const r=document.querySelector('#eatbody .mnrow');if(!r)return null;const b=r.querySelector('.mrecb');
   return {kp:(r.querySelector('.mkp')||{}).textContent||'',hd:(r.querySelector('.mhd')||{}).textContent||'',btn:b?b.getBoundingClientRect().height:0}});
  ok(m&&/ккал · \d+ г белка/.test(m.kp)&&!/ккал/.test(m.hd),где+'C: ккал и белок — строкой под блюдом, не в шапке: '+JSON.stringify(m));
  ok(m&&(m.btn===0||m.btn>=44),где+'C: «Рецепт» — кнопка не ниже 44 px');
  await чист('меню');
  /* L · рейтинг */
  await p.click('[data-zseg="circle"]:visible');await p.waitForTimeout(600);
  const l=await p.evaluate(()=>({why:document.querySelectorAll('#cirbody .cirwhy').length,key:(document.querySelector('#cirbody .lbkey2')||{}).textContent||'',
   chips:[...document.querySelectorAll('.cirsw .mchip')].map(x=>x.textContent.trim())}));
  ok(l.why===0,где+'L: висящей строки «за что сняты баллы» нет');
  ok(/7\+/.test(l.key)&&/ниже 7/.test(l.key)&&/сегодня/.test(l.key)&&l.key.length<60,где+'L: легенда точек — одной строкой: '+l.key);
  ok(l.chips.includes('⚙ круг')&&l.chips.includes('+ новый'),где+'L: у кнопок круга есть слова');
  await чист('рейтинг');
  /* F · карта тела и каталог */
  await вкладка(p,'gym','[data-zseg="log"]');
  const f=await p.evaluate(()=>({sub:(document.querySelector('#logmusbox .chartsub')||{}).textContent||'',attr:document.querySelectorAll('#logmusbox .attr').length,
   how:(document.querySelector('#howm .howattr')||{}).textContent||''}));
  ok(f.sub.length<90&&/обводка/.test(f.sub),где+'F: подпись карты — одной строкой: '+f.sub);
  ok(f.attr===0&&/body-muscles/.test(f.how),где+'F: лицензия анатомии — в «Как пользоваться»');
  /* G · снимок весов подписан */
  await вкладка(p,'home');
  ok(/Снимок весов/.test(await p.textContent('#fmphoto')),где+'G: кнопка снимка весов подписана');
  /* I · пустой чат */
  await p.click('#coachnav');await p.waitForTimeout(500);
  const ч=await p.evaluate(()=>({q:[...document.querySelectorAll('#chatlog [data-cq]')].map(x=>({t:x.textContent,h:x.getBoundingClientRect().height})),
   cam:(document.querySelector('#cphoto')||{}).textContent||''}));
  ok(ч.q.length===4&&ч.q.every(x=>x.h>=44),где+'I: в пустом чате четыре начала, кнопки ≥44: '+ч.q.map(x=>x.t).join(' · '));
  ok(/Фото/.test(ч.cam),где+'I: у камеры подпись «Фото»');
  await чист('чат','#coachm');
  await p.click('#chatlog [data-cq="Разбери мой день"]');await p.waitForTimeout(600);
  ok(await p.evaluate(()=>/Разбери мой день/.test(document.getElementById('chatlog').textContent)&&!document.querySelector('#chatlog [data-cq]')),где+'I: нажатие отправляет как сообщение, начала уходят');
  await p.click('#coachclose');await p.waitForTimeout(300);
  /* K · админка */
  await p.click('#profbtn');await p.click('#profboss');await p.waitForTimeout(700);
  const k=await p.evaluate(()=>{const d=document.querySelector('.adhero .adcalc');const s=document.querySelector('.adstrip');
   return {det:!!d&&!d.open,cols:s?getComputedStyle(s).gridTemplateColumns.split(' ').length:0,over:s?s.scrollWidth>s.clientWidth+1:true}});
  ok(k.det,где+'K: расчёт и расходы на ИИ — по нажатию, свёрнуты');
  ok(k.cols===3&&!k.over,где+'K: числа сеткой 3 в ряд, без прокрутки вбок');
  ok(!err.length,где+'без ошибок'+(err.length?': '+err.join(' | '):''));
  await p.close();
 }
 /* J · подписка и G · изменения тела сеткой */
 {const p=await b.newPage({viewport:{width:390,height:844}});const o=opts('dark');o.sub='нет';await M.поднять(p,o);await p.waitForTimeout(400);
  await p.click('#profbtn');await p.waitForTimeout(300);await p.click('#sub-on');await p.waitForTimeout(400);
  const j=await p.evaluate(()=>{const b=document.querySelector('#subm .subprice b');return {p:b&&b.textContent,fs:b&&parseFloat(getComputedStyle(b).fontSize),
   terms:(document.querySelector('#subm .subterms')||{}).textContent||''}});
  ok(j.p==='500 ★'&&j.fs>=30&&/отменить можно/.test(j.terms),'J: цена крупно, условия рядом: '+JSON.stringify(j));
  await p.close();}
 {const p=await b.newPage({viewport:{width:390,height:844}});const o=opts('dark');o.base=M.БАЗА+'?srez=1';await M.поднять(p,o);await p.waitForTimeout(1200);
  const g=await p.evaluate(()=>{const s=document.querySelector('#srezm .srgrid');if(!s)return null;
   return {cols:getComputedStyle(s).gridTemplateColumns.split(' ').length,wide:!!s.querySelector('.srwide')}});
  ok(g===null||(g.cols===2),'G: изменения тела — сеткой 2×2'+(g?'':' (на стенде среза нет — пропуск)'));
  await p.close();}
}finally{await b.close();}
 if(bad){console.log('\n  провалов: '+bad);process.exit(1);}console.log('\n  test-dizayn-2: всё зелёное');})();
