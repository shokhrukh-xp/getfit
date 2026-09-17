'use strict';
/* ── СРЕЗ СОСТАВА ──────────────────────────────────────────────────────
   16.09. На главной видно, НА СКОЛЬКО изменился вес, но не видно главного:
   сколько из этого было жиром. Это и есть доказательство, что подписка
   работает, и оно всё время лежало в базе.

   Ни одного числа экран не считает сам: всё приходит с сервера той же
   формулой, что уходит в сообщение бота. Проверка следит именно за этим —
   на экране должны стоять ответы сервера, а не пересчёт приложения. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const текст = async (page, sel) => ((await page.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ').trim();

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const зап = [];
  page.on('request', r => { if (/\/srez/.test(r.url())) зап.push(r.url()); });

  const ош = await M.поднять(page, { theme: 'dark', wait: 2600, meas: M.замеры(), hist: M.журнал() });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* ── дверь с главной ── */
  дано(await page.isVisible('[data-srez]'), 'под таблицей тела есть дверь в срез');
  дано(/жир/.test(await текст(page, '[data-srez]')), 'и она обещает именно то, чего в таблице нет: ' + await текст(page, '[data-srez]'));

  await page.click('[data-srez]');
  await page.waitForTimeout(1500);
  дано(await page.$eval('#srezm', e => e.classList.contains('show')), 'срез открылся');
  дано(зап.length >= 1 && /days=14/.test(зап[0]), 'срок ушёл на сервер: ' + (зап[0] || '').split('?')[1]);

  /* ── вывод стоит первым ── */
  const вывод = await текст(page, '.srv b');
  дано(/ушло 4,0 кг/.test(вывод) && /Жиром — 2,1/.test(вывод), 'вывод сверху и он про жир: ' + вывод);
  дано(/мышцы не тронуты/.test(await текст(page, '.srv p')), 'и сказано, что с мышцами: ' + await текст(page, '.srv p'));

  /* ── числа те же, что прислал сервер ── */
  const строки = await page.$$eval('.srr', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  дано(строки.length >= 4, 'строк с числами: ' + строки.length);
  дано(строки.some(x => /вес/.test(x) && /−4,0/.test(x)), 'вес: ' + (строки.find(x => /вес/.test(x)) || '—'));
  дано(строки.some(x => /жир/.test(x) && /−2,1/.test(x)), 'жир: ' + (строки.find(x => /жир/.test(x)) || '—'));
  дано(строки.some(x => /белковая/.test(x) && /\+0,1/.test(x)), 'белковая: ' + (строки.find(x => /белковая/.test(x)) || '—'));
  const цвета = await page.$$eval('.srr s', els => els.map(e => e.className));
  дано(цвета[0] === 'dn' && цвета[1] === 'dn', 'падение веса и жира отмечено как хорошее: ' + цвета.join(' '));

  /* ── график ── */
  дано(await page.isVisible('.srch svg'), 'график нарисован');
  const путей = await page.$$eval('.srch svg path', els => els.length);
  дано(путей >= 3, 'в нём две линии и полоса между ними: ' + путей);
  дано(/сколько ушло от/.test(await текст(page, '.srch .hd')), 'подпись говорит, что это изменения, а не килограммы: ' + await текст(page, '.srch .hd'));

  /* ── объяснение и источник ── */
  const знач = await текст(page, '.srtxt');
  дано(/гликоген и вода/.test(знач), 'объяснено, почему опережение в начале — это вода');
  дано(/−0,4 кг в неделю/.test(знач), 'и назван темп последней недели');
  дано(!/План был/.test(знач), 'скорость за неделю не выдаётся за сверку с планом');
  дано(/Vázquez-Bautista/.test(await текст(page, '.srsrc')), 'источник на месте: ' + (await текст(page, '.srsrc')).slice(0, 40));

  /* ── что дальше ведёт к тренеру с готовым вопросом ── */
  /* Сверка с планом считается ОДНИМ кодом на приложение и тренера: 16.09
     экран говорил «идёшь медленнее», а тренер в тот же час — «с опережением
     на 2,2 кг», потому что экран сравнивал план по весу со скоростью по жиру. */
  const план = (строки.find(x => /против плана/.test(x)) || '');
  дано(/с 01\.09 ушло 4,0 кг, по плану 1,8/.test(план), 'сверка с планом — от старта цели и в весе: ' + план);
  дано(/впереди 2,2/.test(план), 'и она называет опережение, а не отставание: ' + план);
  дано(/опережение на 2,2 кг/.test(await текст(page, '.sract')), 'что дальше говорит то же самое: ' + await текст(page, '.sract'));
  дано(!/медленнее/.test(await текст(page, '.sract')), 'и не называет это отставанием');
  await page.click('#sr-ask');
  await page.waitForTimeout(900);
  дано(!(await page.$eval('#srezm', e => e.classList.contains('show'))), 'срез закрылся');
  дано(await page.$eval('body', e => e.classList.contains('coach')), 'разговор с тренером открылся');
  дано(/опережением плана/.test(await page.$eval('#ctext', e => e.value)), 'вопрос уже вписан: ' + await page.$eval('#ctext', e => e.value));
  await page.close();

  /* ── замеров нет: зовём на весы, а не показываем пустоту ── */
  const p2 = await ctx.newPage();
  await p2.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(p2, { theme: 'dark', wait: 2600, meas: M.замеры(), srez: null });
  await p2.click('[data-srez]');
  await p2.waitForTimeout(1200);
  const пусто = await текст(p2, '#sr-body');
  дано(/два замера/.test(пусто) && /весы/.test(пусто), 'без замеров сказано, что сделать: ' + пусто.slice(0, 80));
  дано(!(await p2.isVisible('.srch svg').catch(() => false)), 'и пустого графика нет');
  await p2.close();

  /* ── ссылка из сообщения бота открывает срез сразу ── */
  const p3 = await ctx.newPage();
  await p3.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(p3, { theme: 'dark', wait: 2600, meas: M.замеры(), base: M.БАЗА + '?srez=1' });
  await p3.waitForTimeout(1400);
  дано(await p3.$eval('#srezm', e => e.classList.contains('show')), 'ссылка бота открыла срез, а не «куда-то в приложение»');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
