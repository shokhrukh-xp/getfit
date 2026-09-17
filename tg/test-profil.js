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

  /* ══ 3. план спорта живёт на «Тренировке» ══ */
  await page.click('.l1-in button[data-page="gym"]');
  await page.waitForTimeout(1100);
  const дом = await page.evaluate(() => {
    const w = document.getElementById('planwrap');
    return { где: w && w.parentNode ? w.parentNode.id : null,
      виден: !!(w && w.getBoundingClientRect().height > 10),
      свёрнут: (document.getElementById('plbody') || {}).hidden,
      сводка: ((document.getElementById('plsum') || {}).textContent || '').trim(),
      послеКнопки: !!(document.getElementById('addsport') && w &&
        (document.getElementById('addsport').compareDocumentPosition(w) & Node.DOCUMENT_POSITION_FOLLOWING)) };
  });
  дано(дом.где === 'planslot-gym', 'блок стоит на странице тренировки: ' + дом.где);
  дано(дом.виден, 'и он на экране виден');
  дано(дом.свёрнут === true, 'свёрнут — это настройка, а не действие дня');
  дано(дом.послеКнопки, 'и стоит ниже кнопки «Занятие вне зала», рядом с ней');
  дано(/теннис/.test(дом.сводка) && /ср/.test(дом.сводка) && /сб/.test(дом.сводка),
    'свёрнутая строка говорит то же, что список внутри: ' + дом.сводка);

  await page.click('#pltoggle'); await page.waitForTimeout(500);
  const внутри = await page.evaluate(() => ({
    открыт: !(document.getElementById('plbody') || {}).hidden,
    строк: document.querySelectorAll('#me-plan .plrow').length,
    вид: (document.querySelector('#me-plan .plk') || {}).value,
    дни: Array.from(document.querySelectorAll('#me-plan .pldays button[aria-pressed="true"]')).map(b => b.textContent),
    добавить: !!document.getElementById('pladd'),
    подпись: ((document.querySelector('#plbody .seghint2') || {}).textContent || '').replace(/\s+/g, ' ')
  }));
  дано(внутри.открыт, 'раскрывается по нажатию');
  дано(внутри.строк === 1 && внутри.вид === 'теннис', 'внутри — план человека: ' + внутри.вид);
  дано(внутри.дни.join(',') === 'ср,сб', 'с его днями: ' + внутри.дни.join(', '));
  дано(внутри.добавить, 'и кнопка «+ занятие» на месте');
  дано(/норму еды/.test(внутри.подпись) && /Занятие вне зала/.test(внутри.подпись),
    'подпись говорит, куда план идёт и чем записать разовое: ' + внутри.подпись.slice(0, 90));

  /* день недели снимается и сразу сохраняется — слушатели перенос пережили */
  await page.click('#me-plan .pldays button[data-pd="6"]');
  await page.waitForTimeout(700);
  const после = await page.evaluate(() => ({
    вПамяти: (JSON.parse(localStorage.getItem('shp_v1_me') || '{}').plan || [])[0],
    сводка: ((document.getElementById('plsum') || {}).textContent || '').trim()
  }));
  дано(!!после.вПамяти && (после.вПамяти.d || []).join(',') === '3',
    'снятый день сохранился: ' + JSON.stringify(после.вПамяти && после.вПамяти.d));
  дано(/ср/.test(после.сводка) && !/сб/.test(после.сводка), 'и сводка пересчиталась: ' + после.сводка);
  await page.close();

  /* ══ 4. «только еда»: блок переезжает к еде ══ */
  const еда = await br.newPage({ viewport: { width: 390, height: 900 } });
  await еда.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош2 = await M.поднять(еда, { theme: 'dark', page: 'food', wait: 2800,
    me: Object.assign({}, ЧЕЛОВЕК, { only: 'food' }) });
  дано(ош2.length === 0, 'у «только еды» страница поднялась без ошибок ' + (ош2[0] || ''));
  await еда.waitForTimeout(700);
  const п2 = await полоса(еда);
  дано(п2.n === 2 && Math.abs(п2.слева - п2.справа) <= 2,
    'у него в полосе две вкладки и они тоже не смещены: ' + п2.слева + ' / ' + п2.справа);
  const дом2 = await еда.evaluate(() => {
    const w = document.getElementById('planwrap');
    return { где: w && w.parentNode ? w.parentNode.id : null,
      виден: !!(w && w.getBoundingClientRect().height > 10),
      сводка: ((document.getElementById('plsum') || {}).textContent || '').trim() };
  });
  дано(дом2.где === 'planslot-food', 'блок переехал на «Еду»: ' + дом2.где);
  дано(дом2.виден, 'и виден — у этих людей другого учёта движения нет');
  дано(/теннис/.test(дом2.сводка), 'с тем же планом: ' + дом2.сводка);
  await еда.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
