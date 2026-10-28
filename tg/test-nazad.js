'use strict';
/* 17.10: открытие и закрытие — всегда шаг назад. Его слова: «с профиля открыл
   программу, а когда закрываю — переходит на главную страницу, а не на
   предыдущую профиля, откуда я её открыл. Проверь все страницы и логику их
   открытия и закрытия». Его выбор: «Крестик в листе» и «Шаг назад везде»
   (системная «назад» Telegram). */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const назад=p=>p.evaluate(()=>{(window.__назадФ||[]).forEach(f=>f());});
const видна=p=>p.evaluate(()=>!!window.__назадВидна);
const открыт=(p,id)=>p.$eval('#'+id,e=>e.classList.contains('show'));
const лист=p=>p.evaluate(()=>{const m=document.getElementById('profm');return !m.classList.contains('show')?'закрыт':(document.getElementById('pqmain').hidden?document.getElementById('proftitle').textContent:'список');});
(async()=>{const b=await chromium.launch();try{
 for(const width of [320,390]){
  const где=width+': ';
  const p=await b.newPage({viewport:{width,height:844}});
  const o=opts('dark');o.admin={про:[],промо:[]};
  const err=await M.поднять(p,o);await p.waitForTimeout(400);
  ok(!(await видна(p)),где+'на «Сегодня» стрелки «назад» нет');

  /* 1. ✕ на листе профиля — в список, ✕ в списке — закрыть */
  await p.click('#profbtn');await p.waitForTimeout(300);
  ok(await видна(p),где+'профиль открыт — стрелка есть');
  await p.click('#pq-gym');await p.waitForTimeout(200);
  await p.click('#profclose');await p.waitForTimeout(200);
  ok(await лист(p)==='список',где+'«Программа» → ✕ → список профиля, а не главная');
  await p.click('#pq-gym');await p.mouse.click(width/2,20);await p.waitForTimeout(200);
  ok(await лист(p)==='список',где+'«Программа» → тап мимо листа → тоже список');
  await p.click('#profclose');await p.waitForTimeout(200);
  ok(await лист(p)==='закрыт'&&!(await видна(p)),где+'✕ в списке закрывает профиль, стрелка пропала');

  /* 2. «назад» Telegram по шагам */
  await p.click('#profbtn');await p.click('#pq-voice');await p.waitForTimeout(200);
  await назад(p);await p.waitForTimeout(200);
  ok(await лист(p)==='список',где+'«назад» на листе — в список');
  await назад(p);await p.waitForTimeout(200);
  ok(await лист(p)==='закрыт'&&!(await видна(p)),где+'«назад» в списке — профиль закрыт, стрелки нет');

  /* 3. листы, открытые из профиля поверх него, возвращают в профиль */
  await p.click('#profbtn');await p.click('#pq-gym');await p.click('#progedit');await p.waitForTimeout(400);
  ok(await открыт(p,'sborm'),где+'«Изменить и пересобрать» открыл сборку');
  await p.click('#sborclose');await p.waitForTimeout(300);
  ok(await лист(p)==='Программа',где+'закрыл сборку — снова «Программа» в профиле: '+await лист(p));
  await p.click('#progedit');await p.waitForTimeout(300);await назад(p);await p.waitForTimeout(300);
  ok(await лист(p)==='Программа',где+'то же «назад» Telegram');
  await p.click('#pqback');await p.click('#profreset');await p.waitForTimeout(300);
  ok(await открыт(p,'resetm'),где+'«Начать заново» открыл выбор');
  await p.click('#resetclose');await p.waitForTimeout(300);
  ok(await лист(p)==='список',где+'«Отмена» — снова список профиля');
  await p.click('#goalcard [data-bodygoal]');await p.waitForTimeout(400);   /* 28.10: «Изменить цель» — экран цели */
  ok(await открыт(p,'coachm'),где+'«Обсудить цель» открыл тренера');
  await p.click('#coachclose');await p.waitForTimeout(400);
  ok(await лист(p)==='список',где+'закрыл тренера — снова профиль');

  /* 4. Админ панель: «назад» — в профиль */
  await p.click('#profboss');await p.waitForTimeout(500);
  ok(await p.isVisible('#p-admin')&&await видна(p),где+'в Админ панели стрелка есть');
  await назад(p);await p.waitForTimeout(400);
  ok(await p.isVisible('#p-home')&&await лист(p)==='список',где+'«назад» из админки — откуда пришёл, и профиль');
  await p.click('#profclose');await p.waitForTimeout(200);

  /* 5. фото на дуге → «Подробнее» → приём на «Еде»; закрыл — снова «Сегодня» */
  {await p.locator('.hclk').scrollIntoViewIfNeeded();const r=await p.locator('.hb-meal').last().locator('.hbcut').boundingBox();await p.mouse.click(r.x+r.width/2,r.y+r.height/2);}
  await p.locator('.hbx-go').click();await p.waitForTimeout(400);
  ok(await p.isVisible('#p-food')&&await открыт(p,'mealm'),где+'«Подробнее» — приём на «Еде»');
  ok(await видна(p),где+'стрелка есть');
  await назад(p);await p.waitForTimeout(400);
  ok(await p.isVisible('#p-home')&&!(await открыт(p,'mealm')),где+'закрыл — снова «Сегодня», откуда пришёл');

  /* 6. любой лист сверху закрывается «назад», вкладки — без стрелки */
  await p.click('#coachnav');await p.waitForTimeout(400);
  ok(await открыт(p,'coachm')&&await видна(p),где+'тренер открыт — стрелка есть');
  await назад(p);await p.waitForTimeout(400);
  ok(!(await открыт(p,'coachm'))&&!(await видна(p)),где+'«назад» закрыл тренера');
  for(const t of ['food','gym','home']){await p.click('.l1 [data-page="'+t+'"]');await p.waitForTimeout(200);
   ok(!(await видна(p)),где+'вкладка '+t+': стрелки нет');}
  ok(await p.evaluate(()=>document.querySelectorAll('.modal.show').length===0),где+'в конце ни одного открытого листа');
  ok(!err.length,где+'без ошибок'+(err.length?': '+err.join(' | '):''));
  await p.close();
 }
}finally{await b.close();}
 if(bad){console.log('\n  провалов: '+bad);process.exit(1);}console.log('\n  test-nazad: всё зелёное');})();
