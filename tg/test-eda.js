'use strict';
/* Вкладка «Еда» должна говорить то же самое, что главная: два места об одном
   факте не расходятся. 11.09 разошлись сразу три вещи — порядок кнопок записи,
   «мышцы» в графике весов и слово «пока» у оценки. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const НОРМА = { kcal: 1700, prot: 160, fat: { min: 45, max: 66 }, fib: 30, sug: 45,
  parts: { base: 1700, gym: 0, acts: 0, plan: 0, delta: 0, k: 1 } };
const ЕДА = [
  { id: 1, t: '09:26', kind: 'завтрак', kcal: 520, prot: 48, fat: 22, fib: 6, sug: 9, img: '/p/a.jpg', text: 'омлет с индейкой' },
  { id: 2, t: '15:35', kind: 'обед',    kcal: 634, prot: 80, fat: 19, fib: 7, sug: 8, img: '/p/b.jpg', text: 'курица с рисом' }
];

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  const ош = await M.поднять(page, { theme: 'dark', time: '17:40', page: 'food',
    day: { meals: ЕДА, targets: НОРМА }, wait: 2200 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(600);

  /* 1. запись еды выглядит так же, как в панели на «Сегодня» */
  const ряд = await page.evaluate(() => Array.from(document.querySelector('.fask').children)
    .filter(e => e.id).map(e => e.id));
  дано(ряд.slice(0, 3).join(',') === 'fphoto,ftext,fsend',
    'порядок тот же, что в разговоре с тренером: камера, поле, отправка — ' + ряд.join(','));
  const фон = await page.$eval('#fphoto', e => getComputedStyle(e).backgroundColor);
  const фонПоля = await page.$eval('#ftext', e => getComputedStyle(e).backgroundColor);
  дано(фон !== фонПоля, 'кнопка съёмки выделена фоном, а не сливается с полем');

  /* 2. третья полоса графика — белковая масса, а не «мышцы» */
  const текст = await page.textContent('#p-food');
  дано(/Белок/.test(текст), 'в графике весов есть полоса «Белок»');
  дано(!/Мышцы/.test(текст), '«Мышц» в графике больше нет — на главной их тоже нет');

  /* 3. язык оценки тот же, что на главной */
  дано(!/пока — день идёт/.test(текст), 'слова «пока» у оценки больше нет: формула теперь полная');
  дано(/день идёт|итог дня/.test(текст), 'состояние дня подписано');

  /* 4. приёмы узнаются по фото, как на часах */
  const фото = await page.$$('.fmeal .fmth');
  дано(фото.length >= 2, 'у приёмов есть миниатюры: ' + фото.length);
  дано(await page.$eval('.fmeal .ft i', e => e.textContent) === 'завтрак',
    'имя приёма — подписью над текстом');

  /* 5. недельная строка не теряет белок */
  const нед = await page.textContent('#fweekt');
  дано(/\d+\s*г белка/.test(нед) && !/ 0 г белка/.test(нед), 'в недельной сводке есть белок: ' + нед);

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
