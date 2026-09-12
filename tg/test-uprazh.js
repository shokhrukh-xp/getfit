'use strict';
/* «Упражнения» в Журнале — одна таблица вместо «Прогресса» и «Итога блока».
   12.09 он написал: «в секции с упражнениями нет фото как должно быть по
   идее». Фото там берётся по id каталога; записи, сделанные до 12.09, id не
   хранят — и строка оставалась с серым квадратом. Проверяем: кадр есть,
   порядок по весу, рядом видно прошлый раз, и десять сверху. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

async function журнал(page) {
  const g = await page.$('.l1 button[data-page="gym"]');
  if (g) { await g.click(); await page.waitForTimeout(500); }
  for (const b of await page.$$('.zseg button'))
    if ((await b.textContent()).trim() === 'Журнал' && await b.isVisible()) { await b.click(); break; }
  await page.waitForTimeout(1200);
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 844 } });
  const ош = await M.поднять(page, { theme: 'dark', hist: M.журнал() });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await журнал(page);

  const строки = await page.$$eval('#logprog .uprow', rs => rs.map(r => ({
    имя: (r.querySelector('.upn') || {}).textContent || '',
    вес: (r.querySelector('.upw') || {}).textContent || '',
    кадр: !!r.querySelector('.exph img, .exph svg')
  })));
  дано(строки.length === 4, 'по одной строке на упражнение: ' + строки.length);
  дано(строки.every(с => с.кадр), 'в каждой строке есть кадр движения');
  дано(/Приседания/.test(строки[0].имя), 'сверху то, что тяжелее всего: ' + строки[0].имя.slice(0, 30));
  дано(/Планка/.test(строки[строки.length - 1].имя), 'без веса — внизу списка');
  дано(/было/.test(строки[0].вес), 'рядом с текущим весом видно прошлый раз: ' + строки[0].вес.replace(/\s+/g, ' '));
  дано(!/был[оа] 75/.test(строки[0].вес) && /72,5/.test(строки[0].вес),
    'сравнение — с прошлой тренировкой, а не с первой: ' + строки[0].вес.replace(/\s+/g, ' '));

  /* второй блок «Итог» тех же упражнений больше не рисует — одна правда на экран */
  const итог = await page.textContent('#logblk');
  дано(!/Приседания/.test(итог || ''), 'подвал не повторяет список упражнений');

  /* строк меньше десяти — кнопки «ещё» быть не должно */
  дано(await page.$('#upmore') === null, 'при четырёх упражнениях кнопки «ещё» нет');

  /* запись без id каталога: кадр ищется по имени в программе */
  await br.close();
  const br2 = await chromium.launch();
  const p2 = await br2.newPage({ viewport: { width: 390, height: 844 } });
  const стар = M.журнал().map(w => Object.assign({}, w, {
    ex: w.ex.map(x => { const y = Object.assign({}, x); delete y.id; return y; }) }));
  await M.поднять(p2, { theme: 'dark', hist: стар });
  await журнал(p2);
  const без = await p2.$$eval('#logprog .uprow', rs => rs.map(r => ({
    имя: ((r.querySelector('.upn') || {}).textContent || '').slice(0, 26),
    кадр: !!r.querySelector('.exph img, .exph svg'),
    пусто: !!r.querySelector('.exph') && !r.querySelector('.exph img, .exph svg')
  })));
  дано(без.length > 0, 'старые записи без id всё равно попадают в список: ' + без.length);
  дано(без.every(с => !с.пусто), 'ни одной строки с пустым серым квадратом вместо кадра');
  const сКадром = без.filter(с => с.кадр).map(с => с.имя);
  дано(сКадром.length >= 3, 'кадр нашёлся по имени в программе: ' + сКадром.join(', '));
  await br2.close();

  /* СВОИ УПРАЖНЕНИЯ. 12.09 он показал «Сумо-тягу (гантель)» без кадра: её нет
     в free-exercise-db, кадры лежат у нас в img/, а знает об этом только наш
     каталог — он же грузился лишь на экране каталога. Открыл «Тренировку»
     сразу — ушёл адрес CDN, оттуда 404, и вместо кадра пустой квадрат. */
  const br5 = await chromium.launch();
  const p5 = await br5.newPage({ viewport: { width: 390, height: 844 } });
  const картинки = [];
  p5.on('request', r => { if (/\.(jpg|png)(\?|$)/.test(r.url())) картинки.push(r.url()); });
  await M.поднять(p5, { theme: 'dark', subs: { 'D1:1': {
    n: 'Сумо-тяга (гантель)', e: 'Dumbbell Sumo Deadlift', i: 'Dumbbell_Sumo_Deadlift' } } });
  await p5.click('.l1 button[data-page="gym"]');
  await p5.waitForTimeout(2000);
  const сумо = картинки.filter(u => /rdl-[01]\.jpg/.test(u));
  const чужие = картинки.filter(u => /Dumbbell_Sumo_Deadlift/.test(u));
  дано(сумо.length >= 1, 'своему упражнению ушли наши кадры: ' +
    (сумо[0] || '—').replace(/^https?:\/\/[^/]+/, ''));
  дано(чужие.length === 0, 'на CDN за ним не ходим — там его нет (' + чужие.length + ' запросов)');
  const естьВСписке = await p5.$$eval('#list .exrow, #list .card.exact',
    rs => rs.map(r => (r.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)));
  дано(естьВСписке.some(t => /Сумо/.test(t)), 'замена стоит в дне: ' + естьВСписке.join(' / ').slice(0, 90));
  await br5.close();

  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
