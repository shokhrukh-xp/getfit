'use strict';
/* ── ПРОФИЛЬ, НИЖНЯЯ ПОЛОСА И СПОРТ ВНЕ ЗАЛА ──────────────────────────
   17.09, три его замечания подряд:
   «почему нижняя навигация смещена всё ещё налево, мы же убрали Приборную
   оттуда?» — класс boss раздвигал полосу на четыре колонки, кнопки не стало,
   а класс остался, и три оставшиеся жались влево.
   «Зачем нужна часть "Спорт вне зала" в профиле, если мы её можем фиксировать
   на странице тренировки?» — план переехал туда же, где кнопка разового
   занятия. У тех, кто ведёт только еду, зала нет вовсе, и блок обязан
   переехать к еде: иначе единственный учёт движения пропадёт у тех, кому он
   нужнее всех.
   «Часть про тренер сам меняет или спрашивает тоже убери. У всех сам меняет» —
   выбора нет ни на экране, ни в воркере. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const ЧЕЛОВЕК = { sex: 'm', age: 38, ht: 178, bw: 88.1, goal: 'fat', wt: 'cut', gym: 'tone',
  level: 'mid', place: 'gym', plate: 1.25, only: 'all', lim: [], eq: [],
  plan: [{ k: 'теннис', d: [3, 6], min: 90, i: 'mod' }] };

const полоса = page => page.evaluate(() => {
  const nav = document.querySelector('.l1-in');
  const bs = Array.from(nav.children).filter(b => b.tagName === 'BUTTON' && getComputedStyle(b).display !== 'none');
  const r = nav.getBoundingClientRect();
  const пер = bs[0].getBoundingClientRect(), посл = bs[bs.length - 1].getBoundingClientRect();
  return { n: bs.length,
    колонок: getComputedStyle(nav).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
    слева: Math.round(пер.left - r.left), справа: Math.round(r.right - посл.right),
    boss: document.body.classList.contains('boss') };
});

(async () => {
  const br = await chromium.launch();

  /* ══ 1. нижняя полоса ══ */
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, me: ЧЕЛОВЕК, admin: true, hist: M.журнал() });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  const п = await полоса(page);
  дано(п.n === 3, 'в полосе три вкладки: ' + п.n);
  дано(п.колонок === 3, 'и сетка на три колонки, а не на четыре: ' + п.колонок);
  дано(!п.boss, 'класса boss на теле нет даже у владельца');
  дано(Math.abs(п.слева - п.справа) <= 2,
    'кнопки занимают всю полосу, а не жмутся налево: отступ слева ' + п.слева + ', справа ' + п.справа);

  /* ══ 2. профиль: чего в нём больше нет ══ */
  await page.click('#profbtn'); await page.waitForTimeout(800);
  const проф = await page.$eval('#profm', e => e.textContent.replace(/\s+/g, ' '));
  дано(!/сам меняет/.test(проф) && !/спрашивает/.test(проф),
    'выбора «сам меняет / спрашивает» в профиле нет');
  дано(await page.$('#pf-auto') === null && await page.$('#me-auto') === null,
    'и поля под него в разметке не осталось');
  дано(!/Спорт вне зала/i.test(проф), 'раздела «Спорт вне зала» в профиле нет');
  дано(await page.$('#profm #me-plan') === null, 'и редактора плана в профиле нет');
  дано(/Админ панель/.test(проф) && !/Приборн/i.test(проф),
    'строка владельца называется «Админ панель»');
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => { const m = document.getElementById('profm'); if (m) m.classList.remove('show'); });

  /* ══ 3. про спорт вне зала — одна кнопка, а не две ══ */
  await page.click('.l1-in button[data-page="gym"]');
  await page.waitForTimeout(1100);
  const кнопок = await page.evaluate(() => Array.from(document.querySelectorAll('button'))
    .filter(b => b.offsetParent && /занятие вне зала/i.test(b.textContent)).length);
  дано(кнопок === 1, 'на странице тренировки ровно одна кнопка про занятие вне зала: ' + кнопок);
  дано(await page.$('#me-plan') === null && await page.$('#planwrap') === null,
    'отдельного редактора расписания больше нет нигде');

  await page.click('#addsport'); await page.waitForTimeout(900);
  const лист = await page.evaluate(() => ({
    открыт: !!document.querySelector('#sportm.show'),
    повторы: Array.from(document.querySelectorAll('#sp-plan .splr')).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    дни: Array.from(document.querySelectorAll('#sp-days button')).map(b => b.textContent),
    горят: Array.from(document.querySelectorAll('#sp-days button[aria-pressed="true"]')).map(b => b.textContent),
    вид: (document.querySelector('#sp-kind button[aria-pressed="true"]') || {}).textContent,
    кнопка: (document.getElementById('sp-save') || {}).textContent,
    втораяСкрыта: (document.getElementById('sp-only') || {}).hidden
  }));
  дано(лист.открыт, 'лист занятия открылся');
  дано(лист.дни.join('') === 'пнвтсрчтптсбвс', 'в листе появилась строка дней: ' + лист.дни.join(' '));
  дано(лист.повторы.length === 1 && /теннис/.test(лист.повторы[0]) && /ср, сб/.test(лист.повторы[0]),
    'заведённое повторение видно сверху: ' + (лист.повторы[0] || ''));
  дано(лист.вид === 'теннис' && лист.горят.join(',') === 'ср,сб',
    'и его дни уже горят у выбранного вида: ' + лист.горят.join(', '));
  дано(лист.кнопка === 'Записать и повторять', 'кнопка говорит про оба дела: ' + лист.кнопка);
  дано(лист.втораяСкрыта === true, 'пока ничего не поменяли — второй кнопки нет');

  /* снимаем субботу: расписание меняется, появляется вторая дорога */
  await page.click('#sp-days button[data-spd="6"]');
  await page.waitForTimeout(400);
  const после = await page.evaluate(() => ({
    вторая: (document.getElementById('sp-only') || {}).hidden === false,
    текст: (document.getElementById('sp-only') || {}).textContent,
    вПамяти: (JSON.parse(localStorage.getItem('shp_v1_me') || '{}').plan || [])[0]
  }));
  дано(после.вторая && после.текст === 'Только в расписание',
    'появилась вторая дорога: ' + после.текст);
  дано((после.вПамяти.d || []).join(',') === '3,6', 'но пока ничего не сохранилось — нажатия не было');

  await page.click('#sp-only'); await page.waitForTimeout(700);
  const сохр = await page.evaluate(() => ({
    закрыт: !document.querySelector('#sportm.show'),
    план: JSON.parse(localStorage.getItem('shp_v1_me') || '{}').plan || []
  }));
  дано(сохр.закрыт, '«только в расписание» закрывает лист');
  дано(сохр.план.length === 1 && (сохр.план[0].d || []).join(',') === '3',
    'и сохраняет одно повторение с новыми днями: ' + JSON.stringify(сохр.план[0].d));

  /* крестик убирает повторение целиком */
  await page.click('#addsport'); await page.waitForTimeout(800);
  await page.click('#sp-plan [data-splx]'); await page.waitForTimeout(600);
  const пусто = await page.evaluate(() => ({
    план: JSON.parse(localStorage.getItem('shp_v1_me') || '{}').plan || [],
    списокСкрыт: (document.getElementById('sp-planrow') || {}).hidden,
    горят: document.querySelectorAll('#sp-days button[aria-pressed="true"]').length
  }));
  дано(пусто.план.length === 0, 'крестик убрал повторение');
  дано(пусто.списокСкрыт === true, 'список повторений пропал вместе с последним');
  дано(пусто.горят === 0, 'и дни у вида погасли');

  /* запись занятия заводит повторение вместе с записью */
  await page.click('#sp-days button[data-spd="1"]');
  await page.waitForTimeout(300);
  дано(await page.$eval('#sp-save', e => e.textContent) === 'Записать и повторять',
    'кнопка снова про оба дела');
  await page.click('#sp-save'); await page.waitForTimeout(1400);
  const итог = await page.evaluate(() => ({
    закрыт: !document.querySelector('#sportm.show'),
    план: JSON.parse(localStorage.getItem('shp_v1_me') || '{}').plan || []
  }));
  дано(итог.закрыт, 'запись закрыла лист');
  дано(итог.план.length === 1 && (итог.план[0].d || []).join(',') === '1',
    'и повторение завелось тем же нажатием: ' + JSON.stringify(итог.план[0]));
  await page.close();

  /* ══ 4. «только еда»: кнопки занятия на «Еде» нет (24.09) ══ */
  const еда = await br.newPage({ viewport: { width: 390, height: 900 } });
  await еда.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош2 = await M.поднять(еда, { theme: 'dark', page: 'food', wait: 2800,
    me: Object.assign({}, ЧЕЛОВЕК, { only: 'food' }) });
  дано(ош2.length === 0, 'у «только еды» страница поднялась без ошибок ' + (ош2[0] || ''));
  await еда.waitForTimeout(800);
  const п2 = await полоса(еда);
  дано(п2.n === 2 && Math.abs(п2.слева - п2.справа) <= 2,
    'у него в полосе две вкладки и они не смещены: ' + п2.слева + ' / ' + п2.справа);
  const кн2 = await еда.evaluate(() => {
    const b = document.getElementById('addsport2');
    return { есть: !!b, виден: !!(b && b.offsetParent), зал: !!(document.getElementById('addsport') || {}).offsetParent };
  });
  /* 24.09, его решение «для всех»: кнопки занятия на «Еде» больше нет и у
     тех, кто без зала, — занятие записывается в чате с тренером */
  дано(!кн2.есть, 'кнопки «+ Занятие вне зала» на «Еде» нет');
  дано(!кн2.зал, 'и кнопки со страницы зала у него не видно');
  дано(await еда.isVisible('#coachfab'), 'чат с тренером на месте — занятие записывается там');
  await еда.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
