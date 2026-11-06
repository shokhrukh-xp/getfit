'use strict';
/* 06.11, его слова: «Уменьши количество текста, нужно убрать всё, что не ключевое… и проверь ещё раз логику, что где
   показывать». Его выбор (за ui3): «Сегодня: карточка дня», «Сегодня: шаги и сон, тело», «Еда». Профиль — как был.
   Заперто: на «Сегодня» нет плиток «Калории» и «Белок» (повторяли «N до нормы» и «белка ещё N г»), нет «целевая зона»
   и «день идёт ·», оценка — кольцом у совета, «запас недели» — в «Неделе»; в «Теле» нет темпа, шкалы до цели и
   «Отстаёте» (они в «Цели» профиля), подписей графика, подходы — одной строкой; на «Еде» калории и белок — только
   в верхней карточке, без «целевая зона», «Закроется сам в 00:00», абзаца «Свободного дня» и подписи под кнопкой.
   Без ui3 — всё как было. */
const { chromium } = require('playwright'), M = require('./mock'), { opts } = require('./shot-clean');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
const Ф = ['panel2', 'zamer2', 'svob2', 'menu2'];
const виден = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].some(e => getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0), sel);
const текст = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => e.innerText).join(' | '), sel);
(async () => { const b = await chromium.launch(); try {
  for (const ui3 of [true, false]) {
    const т = ui3 ? 'ui3' : 'без ui3';
    /* «Сегодня» */
    { const p = await b.newPage({ viewport: { width: 390, height: 844 } }), o = opts('dark');
      o.features = ui3 ? Ф.concat('ui3') : Ф; o.page = 'home';
      o.day = Object.assign({}, o.day, { запас: { z: 473 }, kcal: 1244, prot: 108, targets: Object.assign({}, o.day.targets, { kcal: 1750, prot: 145 }) });
      const err = await M.поднять(p, o); await p.waitForTimeout(1200);
      const ряды = await текст(p, '.hdaycard .hrow u');
      const полоса = await текст(p, '.hdaycard .hnext');
      if (ui3) {
        ok(!/Калории|Белок/.test(ряды), т + ': плиток «Калории» и «Белок» на карточке дня нет (' + ряды + ')');
        ok(/506/.test(await текст(p, '.hctr')) && /белка ещё/.test(await текст(p, '.hctr')), т + ': «506 ккал до нормы» и «белка ещё» — на месте');
        ok(await виден(p, '.hdaycard .hsc') && !/день идёт/.test(полоса), т + ': оценка кольцом, без «день идёт ·»: ' + полоса);
        ok(!(await виден(p, '.ds-zone')), т + ': «целевая зона» не видна');
        ok(!/запас недели/.test(await текст(p, '.hctr')) && /запас\s\+473/.test(await текст(p, '.hweek-block h3')), т + ': «запас недели» — в заголовке «Недели»');
        ok(!(await виден(p, '#homebody .pth')) && !(await виден(p, '#homebody .pth-st')) && !(await виден(p, '#homebody .vztemp')), т + ': в «Теле» нет темпа, шкалы до цели и «Отстаёте»');
        ok(!(await виден(p, '.vzlab-ln')) && !(await виден(p, '.vzlab-cor')), т + ': подписей графика «среднее за 7 дней» и «разброс» нет');
        ok(!(await виден(p, '#homebody .zkrows')) && /Подходы на неделе\s*\d/.test(await текст(p, '#homebody .zklab')), т + ': подходы — одной строкой');
      } else {
        ok(/Калории/.test(ряды) && /Белок/.test(ряды), т + ': плитки «Калории» и «Белок» на месте');
        ok(/день идёт/.test(полоса) || /оценка/.test(полоса), т + ': строка под дугой как была');
        ok(/запас недели/.test(await текст(p, '.hctr')), т + ': «запас недели» под числом');
      }
      ok(!err.length, т + ': «Сегодня» без ошибок ' + err.join(' | ').slice(0, 200));
      await p.close(); }
    /* «Еда» */
    { const p = await b.newPage({ viewport: { width: 390, height: 844 } }), o = opts('dark');
      o.features = ui3 ? Ф.concat('ui3') : Ф; o.page = 'food';
      const err = await M.поднять(p, o); await p.waitForTimeout(1200);
      const норма = await текст(p, '.fnorm');
      if (ui3) {
        ok(!/Калории|Белок/.test(await текст(p, '.fnorm .fb-name, .fnorm b, .fnorm .fbn')) && !/^Съедено/.test(норма) && /Жир/.test(норма), т + ': в блоке нормы нет калорий и белка, жир на месте');
        ok(!/Закроется сам/.test(норма), т + ': без «Закроется сам в 00:00»');
        ok(!(await виден(p, '.ds-zone')) && !(await виден(p, '.week-key')), т + ': без «целевая зона»');
        ok(!(await виден(p, '.sv2')), т + ': «Свободный день» — одной строкой');
        ok(!(await текст(p, '#food-add small')), т + ': под «Добавить …» нет подписи');
      } else {
        ok(/Калории/.test(норма) && /Белок/.test(норма), т + ': в блоке нормы калории и белок как были');
      }
      ok(!err.length, т + ': «Еда» без ошибок ' + err.join(' | ').slice(0, 200));
      await p.close(); }
  }
} finally { await b.close(); }
console.log(bad ? '\nПРОВАЛОВ: ' + bad : '\nВсё прошло'); process.exit(bad ? 1 : 0); })();
