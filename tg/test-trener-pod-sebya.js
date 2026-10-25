'use strict';
/* 24.10, этап 4 «тренер под себя». Его идея: имя тренеру, образ, характер,
   обращение; его правка макетов: «очевиднее пиши, например „Дайте имя своему
   тренеру“»; его решение по текущим: «карточка + пока „ты“».
   Заперто: (1) у того, кто уже пользуется, на главной карточка «Настройте своего
   тренера»; (2) четыре шага: имя (подсказки), образ, характер с примером,
   обращение с примером; (3) «Готово» пишет в профиль coach_name, coach_sex,
   addr, coach_at и характер; (4) карточка уходит, в чате подпись — имя тренера;
   (5) в профиле строка «Имя, образ, обращение» показывает выбор; (6) «Позже»
   прячет карточку навсегда. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const МЕ = { sex: 'm', age: 38, ht: 178, bw: 88.1, wt: 'down', goal: 'fat', voice: 'hard' };
const ЦЕЛЬ = { text: '75 кг к январю', wt: 'down', rate: -0.5, from: M.Д(20), w0: 90, by: '2027-01-30', kg: 15 };

(async () => {
  const br = await chromium.launch();
  try {
    for (const тема of ['dark', 'light']) {
      const page = await br.newPage({ viewport: { width: 390, height: 844 } });
      const ош = await M.поднять(page, { page: 'home', time: '19:40', theme: тема, goal: ЦЕЛЬ, me: МЕ,
        chat: [{ role: 'assistant', text: 'Записал завтрак.', ts: Date.now() - 3600e3 }] });
      await page.waitForTimeout(600);
      const к = page.locator('#trcard');
      дано(await к.isVisible(), тема + ': карточка «Настройте своего тренера» на главной');
      if (!(await к.isVisible())) { await page.close(); continue; }
      дано(/Настройте своего тренера/.test(await к.innerText()), тема + ': текст карточки');
      await page.click('#trcard [data-tr="open"]'); await page.waitForTimeout(300);
      const лист = page.locator('#trenm');
      дано(await лист.isVisible(), тема + ': открылся лист знакомства');
      дано(/Дайте имя своему тренеру/.test(await лист.innerText()), тема + ': шаг 1 — «Дайте имя своему тренеру»');
      await page.click('#trenm [data-trname="Лола"]');
      дано((await page.inputValue('#trname')) === 'Лола', тема + ': подсказка вписывает имя');
      await page.click('#trenm [data-tr="next"]');
      дано(/Выберите образ тренера/.test(await лист.innerText()), тема + ': шаг 2 — образ');
      await page.click('#trenm [data-trsex="f"]');
      /* 24.10: аватар — шесть на образ, выбранный уходит в профиль и в чат */
      дано((await page.locator('#trenm [data-trav]').count()) === 12 && (await page.getAttribute('#trenm [data-trav="fn"]', 'aria-pressed')) === 'true', тема + ': 11 женских и персонаж из знака — он по умолчанию');
      дано((await page.getAttribute('#trenm [data-trav]:last-child', 'data-trav')) === 'fn', тема + ': персонаж из знака — последним');
      дано((await page.getAttribute('#trenm [data-trav]:first-child', 'data-trav')) !== 'f1', тема + ': светлокожая — не первой');
      await page.click('#trenm [data-trsex="m"]');
      дано((await page.locator('#trenm [data-trav]').count()) === 12 && (await page.getAttribute('#trenm [data-trav="mn"]', 'aria-pressed')) === 'true', тема + ': у мужского столько же и свой персонаж из знака');
      await page.click('#trenm [data-trsex="f"]');
      /* 25.10, его снимок с iPhone: «картинки персонажей там овальные» — каждая кнопка и картинка квадратны */
      const кв = await page.$$eval('#trenm .travbtn', bs => bs.map(b => { const r = b.getBoundingClientRect(), i = b.querySelector('img').getBoundingClientRect(); return [Math.round(r.width - r.height), Math.round(i.width - i.height)]; }));
      дано(кв.every(([a, b]) => Math.abs(a) <= 1 && Math.abs(b) <= 1), тема + ': аватары круглые, не овальные ' + JSON.stringify(кв.slice(0, 3)));
      await page.click('#trenm [data-trav="f3"]');
      дано((await page.getAttribute('#trenm [data-trav="f3"]', 'aria-pressed')) === 'true', тема + ': выбран аватар f3');
      await page.click('#trenm [data-tr="next"]');
      дано(/Выберите характер тренера/.test(await лист.innerText()), тема + ': шаг 3 — характер');
      await page.click('#trenm [data-trvoice="hard"]');
      дано(/Записала 610 ккал/.test(await лист.innerText()), тема + ': пример в женском роде');
      await page.click('#trenm [data-tr="next"]');
      дано(/Выберите обращение/.test(await лист.innerText()), тема + ': шаг 4 — обращение');
      await page.click('#trenm [data-traddr="vy"]');
      дано(/вам ещё 98 г/.test(await лист.innerText()), тема + ': пример на «вы»');
      await page.screenshot({ path: '/tmp/gf-trener-' + тема + '.png' });
      await page.click('#trenm [data-tr="next"]'); await page.waitForTimeout(300);
      const me = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));
      дано(me.coach_av === 'f3', тема + ': в профиле coach_av=f3');
      дано(me.coach_name === 'Лола' && me.coach_sex === 'f' && me.addr === 'vy' && me.voice === 'hard' && !!me.coach_at,
        тема + ': в профиле ' + JSON.stringify({ n: me.coach_name, s: me.coach_sex, a: me.addr, v: me.voice }));
      дано(!(await лист.isVisible()) && !(await к.isVisible()), тема + ': лист закрыт, карточки нет');
      await page.click('#coachnav'); await page.waitForTimeout(500);
      дано(/Лола/.test(await page.locator('.turn .who').first().innerText().catch(() => '')), тема + ': в чате подпись — имя тренера');
      дано(/img\/av\/f3\.jpg/.test(await page.locator('.turn .who img').first().getAttribute('src').catch(() => '')), тема + ': в чате аватар f3');
      дано(await page.evaluate(() => { const i = document.querySelector('.turn .who img'); return !!i && i.complete && i.naturalWidth > 0; }), тема + ': аватар загрузился');
      await page.evaluate(() => { const b = document.getElementById('coachclose') || document.querySelector('#coachm .xbtn'); if (b) b.click(); });
      await page.click('#profbtn'); await page.waitForTimeout(400);
      дано(/Лола · на «вы»/.test(await page.locator('#pv-tren').innerText()), тема + ': строка в профиле');
      дано(ош.length === 0, тема + ': без ошибок JS ' + ош.slice(0, 2).join(' | '));
      await page.close();
    }
    /* «Позже» — карточка больше не появляется */
    const p2 = await br.newPage({ viewport: { width: 390, height: 844 } });
    await M.поднять(p2, { page: 'home', time: '19:40', goal: ЦЕЛЬ, me: МЕ, одинРаз: true });
    await p2.waitForTimeout(500);
    if (await p2.locator('#trcard').isVisible()) {
      await p2.click('#trcard [data-tr="later"]'); await p2.waitForTimeout(200);
      дано(!(await p2.locator('#trcard').isVisible()), '«Позже» прячет карточку');
      await p2.reload(); await p2.waitForTimeout(1200);
      дано(!(await p2.locator('#trcard').isVisible()), 'после перезапуска карточки нет');
    } else дано(false, 'карточка для «Позже» не показалась');
    await p2.close();
  } finally { await br.close(); }
  console.log(плохо ? 'ПРОГОН: провалов ' + плохо : 'ПРОГОН: всё зелёное');
  process.exit(плохо ? 1 : 0);
})();
