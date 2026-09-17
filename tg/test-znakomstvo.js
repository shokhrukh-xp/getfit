'use strict';
/* ── ЗНАКОМСТВО ОДНОЙ СТРАНИЦЕЙ ────────────────────────────────────────
   16.09, по данным базы: из семи первых людей до программы дошли трое.
   Обрыв был размазан по всем четырём шагам мастера — двое не закончили
   первый, один встал между вторым и третьим, один между третьим и
   четвёртым. Поэтому цепочку укоротили целиком: профиль, цель и
   расписание стоят на одной странице, программа собирается БЕЗ единого
   вопроса, а вопросы тренера приходят уже поверх готовой программы —
   их не больше трёх, и каждый ответ правит то, что человек видит. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const текст = async (page, sel) => (await page.textContent(sel).catch(() => '') || '').replace(/\s+/g, ' ').trim();

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  const онб = [];
  page.on('request', r => { if (/\/onboard/.test(r.url())) { try { онб.push(JSON.parse(r.postData() || '{}')); } catch (e) {} } });

  const ош = await M.поднять(page, { theme: 'dark', newbie: true, wait: 2500 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* ── 1. всё на одной странице ── */
  дано(await page.isVisible('#wzme'), 'о себе — на странице');
  дано(await page.isVisible('#wzgoal'), 'цель — на той же странице');
  дано(await page.isVisible('#wzform'), 'где и когда — на той же странице');
  дано(!(await page.isVisible('#wzstep').catch(() => false)), 'счётчика «шаг 1 из 4» больше нет');
  дано(!(await page.isVisible('#wz-me-go').catch(() => false)) && !(await page.isVisible('#g-go').catch(() => false)),
    'кнопок отдельных шагов нет');
  дано(/Собрать программу/.test(await текст(page, '#wz-one')), 'внизу одна кнопка: ' + await текст(page, '#wz-one'));

  /* ── 2. пока веса нет, темп не считаем ── */
  дано(/Заполни возраст, рост и вес/.test(await текст(page, '#g-body')),
    'цель ждёт вес, а не показывает ошибку: ' + await текст(page, '#g-body'));

  await page.fill('#wz-age', '34'); await page.fill('#wz-ht', '176'); await page.fill('#wz-bw', '88');
  await page.waitForSelector('#g-rng', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  дано(await page.isVisible('#g-rng'), 'ввели вес — шкала цели посчиталась тут же, без перехода');

  /* ── 3. одна кнопка доводит до программы ── */
  await page.click('#wz-one');
  await page.waitForTimeout(2200);
  дано(await page.isVisible('.aiprev'), 'программа на экране');
  дано(/Присед со штангой/.test(await текст(page, '.aiprev')), 'и в ней есть упражнения: ' + (await текст(page, '.aiprev')).slice(0, 70));
  дано(онб.length >= 1 && онб[0].after === false, 'первый запрос шёл БЕЗ вопросов (after=false)');
  дано(онб.length >= 1 && (онб[0].qa || []).length === 0, 'и без единого заданного вопроса');

  /* ── 4. вопрос пришёл ПОСЛЕ программы, программа с экрана не ушла ── */
  дано(онб.length >= 2 && онб[1].after === true, 'второй запрос — уточнение поверх готового (after=true)');
  дано(await page.isVisible('.wzq'), 'под программой стоит вопрос тренера');
  дано(/Колени или спина/.test(await текст(page, '.wzq')), 'вопрос про то, что меняет программу: ' + await текст(page, '.wzq'));
  дано(await page.isVisible('.aiprev'), 'программа при этом никуда не делась');
  дано(await page.isVisible('#wzapply'), 'и начать по ней можно, не отвечая ни на один вопрос');

  /* ── 5. ответ меняет программу на глазах ── */
  await page.click('.wzq [data-opt="колени"]');
  await page.waitForTimeout(2000);
  дано(!/Присед со штангой/.test(await текст(page, '.aiprev')), 'после «колени» присед со штангой из программы ушёл');
  дано(/Убрал присед/.test(await текст(page, '.wzdone')), 'и сказано, что именно поменялось: ' + await текст(page, '.wzdone'));
  дано(/Что делать не любишь/.test(await текст(page, '.wzq')), 'следом идёт второй вопрос: ' + await текст(page, '.wzq'));
  дано(онб.length >= 3 && (онб[2].qa || []).length === 1 && онб[2].prog, 'ответ ушёл вместе с той программой, что человек видит');

  /* ── 6. три вопроса — и всё ── */
  await page.click('.wzq [data-opt="кардио"]');
  await page.waitForTimeout(1800);
  дано(/Раньше занимался/.test(await текст(page, '.wzq')), 'третий вопрос: ' + await текст(page, '.wzq'));
  await page.click('.wzq [data-opt="нет"]');
  await page.waitForTimeout(1800);
  дано(!(await page.isVisible('.wzq').catch(() => false)), 'после третьего ответа вопросов больше нет');
  дано(/Всё учёл/.test(await текст(page, '.wzdone')), 'тренер закрывает разговор: ' + await текст(page, '.wzdone'));
  дано(await page.isVisible('#wzapply'), 'осталась одна кнопка — начать по программе');

  /* ── 7. ушёл на середине и вернулся ── */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  const пол = await текст(page, '#onbbar');
  дано(!(await page.$eval('#onbbar', e => e.hidden)) && /Программа собрана/.test(пол),
    'вернулся — на главной полоска с тем местом, где он ушёл: ' + пол);
  дано(!/Заполни профиль/.test(пол), 'и это не общее «заполни профиль», а именно его шаг');
  await page.click('#onbbar');
  await page.waitForTimeout(1600);
  дано(await page.isVisible('.aiprev'), 'нажал — знакомство открылось на собранной программе, а не с нуля');
  дано(/Жим ногами/.test(await текст(page, '.aiprev')), 'и это та самая, исправленная: ' + (await текст(page, '.aiprev')).slice(0, 60));

  /* ── 8. начал по ней — черновика больше нет ── */
  await page.click('#wzapply');
  await page.waitForTimeout(1800);
  const черн = await page.evaluate(() => { try { return localStorage.getItem('shp_v1_onbdraft'); } catch (e) { return 'нет доступа'; } });
  дано(черн === null || черн === 'null', 'программа применена — черновик стёрт: ' + черн);
  дано(!(await page.$eval('#picker', e => e.classList.contains('show')).catch(() => false)), 'окно знакомства закрылось');
  дано(await page.$eval('#onbbar', e => e.hidden), 'и полоска «осталось ответить» с главной ушла');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
