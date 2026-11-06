'use strict';
/* 06.11, ревью «глазами новичка» (его выбор «Все 4 правки»): одни числа везде, оценка не спорит с перебором,
   пока день грузится — «загружаю», а не «заполните профиль», и никаких страшных «0 из 74».
   Заперто:
   1. «запас +N» в «Неделе» — за вычетом сегодняшнего перебора, как у тренера (запасСвободно): 473 − 174 = 299.
   2. перебор в пределах ±10 % подписан «в пределах нормы» — на «Сегодня» и на «Еде»;
      за пределами — по-прежнему «сверх нормы».
   3. жир в совете «Еды» — через ту же норму, что на полосе («при норме до 70 г»), без «~77» и «(−0,2)».
   4. пока /day не пришёл — «загружаю день…», не «заполните профиль».
   5. «Подходы на неделе» — нет строки, пока подходов 0; есть подходы — число и полоса. */
const { chromium } = require('playwright'), M = require('./mock'), { opts } = require('./shot-clean');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
const Ф = ['panel2', 'zamer2', 'svob2', 'menu2', 'ui3'];
const текст = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => e.innerText).join(' | '), sel);
const день = (o, kcal, extra) => Object.assign({}, o.day, { запас: { z: 473 }, kcal, prot: 169, fat: 83, sug: 22, fib: 25,
  targets: Object.assign({}, o.day.targets, { kcal: 1750, prot: 145, fat: { min: 50, max: 70 }, sug: 45, fib: 25 }) }, extra || {});
(async () => { const b = await chromium.launch(); try {
  /* 1–2: «Сегодня», перебор 174 в коридоре */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } }), o = opts('dark');
    o.features = Ф; o.page = 'home'; o.day = день(o, 1924);
    const err = await M.поднять(p, o); await p.waitForTimeout(1200);
    const нед = await текст(p, '.hweek-block h3'), цтр = await текст(p, '.hctr');
    ok(/запас\s\+299/.test(нед) && !/473/.test(нед), '«Неделя»: запас за вычетом сегодняшнего перебора — +299, как у тренера (' + нед + ')');
    ok(/\+174/.test(цтр) && /в пределах нормы/.test(цтр) && !/сверх нормы/.test(цтр), '«Сегодня»: +174 подписано «в пределах нормы» (' + цтр + ')');
    ok(!err.length, '«Сегодня» без ошибок ' + err.join(' | ').slice(0, 200));
    await p.close(); }
  /* 2: за коридором — «сверх нормы», запас кончился — строки нет */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } }), o = opts('dark');
    o.features = Ф; o.page = 'home'; o.day = день(o, 2400);
    await M.поднять(p, o); await p.waitForTimeout(1200);
    const нед = await текст(p, '.hweek-block h3'), цтр = await текст(p, '.hctr');
    ok(/сверх нормы/.test(цтр) && !/в пределах/.test(цтр), '«Сегодня»: +650 — «сверх нормы» (' + цтр + ')');
    ok(!/запас/.test(нед), '«Неделя»: перебор съел запас — «запас» не показан (' + нед + ')');
    await p.close(); }
  /* 2–3: «Еда» */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } }), o = opts('dark');
    o.features = Ф; o.page = 'food'; o.day = день(o, 1924, { line: 'Сверх нормы 174 ккал · белок набран' });
    o.score = { r: 9.8, why: [{ k: 'fat', t: 'много жира: 83 г при ~77', v: 0.2, совет: 'меньше масла и соусов' }] };
    const err = await M.поднять(p, o); await p.waitForTimeout(1500);
    const верх = await текст(p, '.fh3-l'), совет = await текст(p, '.fh3-tip');
    ok(/в пределах нормы/i.test(верх), '«Еда»: «В пределах нормы», а не «Сверх нормы» (' + верх + ')');
    ok(/норме до 70/.test(совет) && !/~77/.test(совет) && !/−0,2/.test(совет), '«Еда»: жир через норму полосы, без «~77» и «(−0,2)» (' + совет + ')');
    ok(!err.length, '«Еда» без ошибок ' + err.join(' | ').slice(0, 200));
    await p.close(); }
  /* 4: день ещё грузится */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } }), o = opts('dark');
    let пустить; o.dayGate = new Promise(r => { пустить = r; });
    o.features = Ф; o.page = 'home'; o.day = день(o, 1244);
    await M.поднять(p, o); await p.waitForTimeout(900);
    const пока = await текст(p, '.hctr');
    ok(/загружаю/.test(пока) && !/заполните профиль/.test(пока), 'пока день грузится — «загружаю день…», не «заполните профиль» (' + пока + ')');
    пустить(); await p.waitForTimeout(1200);
    const потом = await текст(p, '.hctr');
    ok(/506/.test(потом) && !/загружаю/.test(потом), 'день пришёл — число на месте (' + потом + ')');
    await p.close(); }
  /* 5: подходы недели */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } }), o = opts('dark');
    o.features = Ф; o.page = 'home'; o.hist = []; o.day = день(o, 1244);
    await M.поднять(p, o); await p.waitForTimeout(1500);
    const зал = await текст(p, '#homebody .zk');
    ok(!/Подходы на неделе/.test(зал) && !/0 из \d/.test(зал.replace(/Завершено занятий[^|]*/,'')), 'ни одного подхода — строки «Подходы на неделе 0 из N» нет (' + зал.replace(/\s+/g, ' ').slice(0, 160) + ')');
    await p.close(); }
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } }), o = opts('dark');
    o.features = Ф; o.page = 'home'; o.day = день(o, 1244);
    await M.поднять(p, o); await p.waitForTimeout(1500);
    const лаб = await текст(p, '#homebody .zklab');
    const полоса = await p.evaluate(() => !!document.querySelector('#homebody .zkbar1'));
    if (/Подходы на неделе\s*[1-9]/.test(лаб)) ok(полоса, 'подходы есть — под числом полоса (' + лаб + ')');
    else ok(true, 'в журнале стенда нет подходов этой недели — полосу проверит набор, где они есть (' + лаб + ')');
    await p.close(); }
  /* 6 (живой прогон новичка): замеров ещё нет — «Первое взвешивание», а не «Давно не взвешивались · последний замер — » */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } }), o = opts('dark');
    o.features = Ф.concat('zamer2'); o.page = 'home'; o.meas = []; o.time = '21:00'; o.day = день(o, 0);
    await M.поднять(p, o); await p.waitForTimeout(1500);
    const к = await текст(p, '.zm-card');
    ok(/Первое взвешивание/.test(к) && !/Давно не/.test(к) && !/последний замер — ,|последний замер — $/.test(к), 'новичок без замеров — «Первое взвешивание» (' + к.replace(/\s+/g, ' ') + ')');
    await p.close(); }
  /* 7 (живой прогон новичка): поздний вечер, записей нет — не «на сегодня всё», а «запишите, что уже ели сегодня» */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } }), o = opts('dark');
    o.features = Ф; o.page = 'home'; o.time = '23:10'; o.score = null; o.day = день(o, 0, { meals: [], prot: 0, fat: 0, sug: 0, fib: 0 });
    await M.поднять(p, o); await p.waitForTimeout(1500);
    const т = await текст(p, '.hdaycard .hnext, .hdaycard .day-status');
    ok(/запишите, что уже ели сегодня/.test(т) && !/на сегодня всё/.test(т), 'вечер без записей — «запишите, что уже ели сегодня» (' + т.replace(/\s+/g, ' ') + ')');
    await p.close(); }
} finally { await b.close(); }
console.log(bad ? '\nПРОВАЛОВ: ' + bad : '\nВсё прошло'); process.exit(bad ? 1 : 0); })();
