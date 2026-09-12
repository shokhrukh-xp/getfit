'use strict';
/* «Тренировка»: один подход крупно (его выбор 11.09 из четырёх эскизов,
   с условием «обязательно чтобы было фото упражнения»). Раскрыто ровно одно
   упражнение, внутри — ровно один подход; остальные свёрнуты строками с фото.
   12.09: при входе не раскрыто НИЧЕГО — «можно не раскрывать карточку, пока я
   не нажму на неё». Нажал — дальше как прежде: закрыл упражнение, следующее
   открылось само (в зале лишний тап дороже). */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const снимок = page => page.evaluate(() => ({
  шапка: (document.querySelector('.dayhd') || {}).textContent || '',
  доля: (document.querySelector('.dayhd .dhtr s') || {}).style?.width || '',
  раскрыто: document.querySelectorAll('.card.exact').length,
  фотоБольшое: !!document.querySelector('.card.exact .exthumb img, .card.exact .exthumb svg'),
  свёрнуто: Array.from(document.querySelectorAll('.exrow')).map(e => ({
    имя: (e.querySelector('.exrn b') || {}).textContent || '',
    фото: !!e.querySelector('.exph img, .exph svg'),
    справа: (e.querySelector('.exrv') || {}).textContent || '',
    done: e.classList.contains('done') })),
  подход: (document.querySelector('.exboxh u') || {}).textContent || '',
  чипы: Array.from(document.querySelectorAll('.exchip')).map(e => e.className + '|' + e.textContent),
  кнопка: (document.querySelector('.exgo') || {}).textContent || ''
}));

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  const ош = await M.поднять(page, { theme: 'dark', time: '17:40', page: 'gym', wait: 2200 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(500);

  let с = await снимок(page);
  дано(/подходов/.test(с.шапка), 'в шапке дня есть дорожка подходов: ' + с.шапка.replace(/\s+/g, ' ').slice(0, 70));
  дано(с.раскрыто === 0, 'при входе не раскрыто ничего: ' + с.раскрыто);
  дано(с.свёрнуто.length >= 4, 'весь день виден списком: ' + с.свёрнуто.length + ' строк');
  дано(с.свёрнуто.every(r => r.фото), 'у каждой строки есть кадр движения');

  /* нажал на первое упражнение — оно раскрылось */
  await page.click('.exrow');
  await page.waitForTimeout(400);
  с = await снимок(page);
  дано(с.раскрыто === 1, 'после нажатия раскрыто ровно одно упражнение: ' + с.раскрыто);

  /* 12.09: нажал по шапке раскрытой карточки — она свернулась обратно */
  await page.click('.card.exact .exttl');
  await page.waitForTimeout(350);
  дано((await снимок(page)).раскрыто === 0, 'повторное нажатие свернуло карточку');
  await page.click('.exrow');
  await page.waitForTimeout(350);
  с = await снимок(page);
  дано(с.раскрыто === 1, 'и снова раскрывается нажатием: ' + с.раскрыто);
  дано(с.фотоБольшое, 'у активного упражнения есть фото');
  дано(с.свёрнуто.length >= 1, 'остальные упражнения свёрнуты: ' + с.свёрнуто.length);
  дано(с.свёрнуто.every(r => r.фото), 'у каждого свёрнутого тоже есть фото');
  дано(/из/.test(с.свёрнуто[0].справа), 'в свёрнутой строке видно, сколько подходов закрыто: ' + с.свёрнуто[0].справа);
  дано(/подход 1 из/.test(с.подход), 'первым идёт первый подход: ' + с.подход);
  дано(/Подход сделан/.test(с.кнопка), 'кнопка одна и называет действие');
  дано(с.чипы.filter(x => /\bn\b/.test(x.split('|')[0])).length === 1, 'ровно один чип помечен как текущий');

  /* закрываем подход — активным становится следующий */
  const всего = с.чипы.length;
  await page.click('.exgo');
  await page.waitForTimeout(400);
  let д = await снимок(page);
  дано(/подход 2 из/.test(д.подход), 'после «Подход сделан» активен следующий подход: ' + д.подход);
  дано(д.чипы.filter(x => /\bd\b/.test(x.split('|')[0])).length === 1, 'закрытый подход помечен чипом');
  дано(д.доля !== с.доля, 'дорожка дня сдвинулась: ' + с.доля + ' → ' + д.доля);

  /* закрываем упражнение целиком — фокус уходит на следующее */
  for (let i = 1; i < всего; i++) { await page.click('.exgo'); await page.waitForTimeout(260); }
  д = await снимок(page);
  дано(д.раскрыто === 1, 'по-прежнему раскрыто одно упражнение');
  дано(д.свёрнуто.some(r => r.done), 'закрытое упражнение свернулось с отметкой: ' +
    JSON.stringify(д.свёрнуто.filter(r => r.done).map(r => r.справа)));

  /* тап по свёрнутому возвращает фокус на него */
  const имя = д.свёрнуто.find(r => !r.done) ? д.свёрнуто.find(r => !r.done).имя : д.свёрнуто[0].имя;
  await page.click('.exrow:not(.done)').catch(() => page.click('.exrow'));
  await page.waitForTimeout(400);
  д = await снимок(page);
  дано(д.раскрыто === 1 && !new RegExp(имя.slice(0, 10)).test(д.свёрнуто.map(r => r.имя).join('|')),
    'тап по свёрнутой строке раскрыл именно её');

  /* тап по чипу переключает подход внутри упражнения */
  const чипов = д.чипы.length;
  if (чипов > 1) {
    await page.click('.exchip:last-child');
    await page.waitForTimeout(300);
    д = await снимок(page);
    дано(new RegExp('подход ' + чипов + ' из').test(д.подход), 'тап по чипу открыл этот подход: ' + д.подход);
  }

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
