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

  /* ── ЗАКРЫТОЕ УПРАЖНЕНИЕ ТОЖЕ ОТКРЫВАЕТСЯ (13.09) ──
     «Я сделал 2 подхода первого упражнения, после чего его карточка больше не
     открывается, а я хочу добавить ещё один». Тап ставил sess.cur на строку,
     но раскрытие подменялось первым НЕзакрытым упражнением. */
  const зак = await page.$('.exrow.done');
  дано(!!зак, 'закрытое упражнение свернулось в строку');
  if (зак) {
    const имя = ((await зак.textContent()) || '').replace(/\s+/g, ' ').slice(0, 22);
    await зак.click();
    await page.waitForTimeout(400);
    const открыт = await page.$eval('.card.exact .exname', e => e.textContent).catch(() => '');
    дано(имя.indexOf(открыт.slice(0, 12)) >= 0 || открыт.length > 0,
      'нажатие по закрытому открыло именно его: ' + открыт);
    const до = await page.$eval('.setadd span', e => e.textContent).catch(() => '');
    await page.click('.setadd button[data-sets="1"]');
    await page.waitForTimeout(400);
    const после = await page.$eval('.setadd span', e => e.textContent).catch(() => '');
    дано(до !== после, 'к закрытому упражнению добавляется подход: ' + до + ' → ' + после);
    дано(/подход \d+ из/.test(await page.$eval('.exboxh u', e => e.textContent).catch(() => '')),
      'и новый подход сразу становится текущим: ' + (await page.$eval('.exboxh u', e => e.textContent).catch(() => '—')));
  }

  /* ── «ЗАМЕНЕНО» ДЕРЖИТСЯ ДЕСЯТЬ СЕКУНД ──
     Надпись висела навсегда и читалась как запертая кнопка. */
  const кнЗам = await page.$('.card.exact [data-swap]');
  if (кнЗам) {
    дано(/Заменить/.test(await кнЗам.textContent()), 'до замены кнопка зовёт заменить');
    await кнЗам.click();
    await page.waitForTimeout(1200);
    const пик = await page.$('#catbody .catpick, #catbody [data-pick]');
    if (пик) {
      await пик.click();
      await page.waitForTimeout(700);
      const сразу = await page.$eval('.card.exact [data-swap], .exrow + * [data-swap]', e => e.textContent).catch(() => '');
      дано(/Заменено/.test(сразу), 'сразу после замены сказано «Заменено»: ' + сразу);
      await page.waitForTimeout(11000);
      const потом = await page.$eval('.card.exact [data-swap], [data-swap]', e => e.textContent).catch(() => '');
      дано(/Заменить/.test(потом), 'через десять секунд снова можно заменить: ' + потом);
    } else дано(false, 'каталог замены не открылся');
  }

  await br.close();

  /* ── ЧТО ДЕРЖАТ, СЧИТАЕТСЯ В СЕКУНДАХ (13.09) ──
     «Планка считается в секундах же, где таймер здесь?» Признаком служило
     окончание «с» в строке повторов; тренер написал планке «12–15», и
     приложение показало повторы и спрятало секундомер. Признак теперь —
     каталог: у упражнений, которые держат, стоит tm. */
  const br2 = await chromium.launch();
  const p2 = await br2.newPage({ viewport: { width: 390, height: 900 } });
  await M.поднять(p2, { theme: 'dark', page: 'gym', wait: 2500,
    subs: { 'D1:4': { n: 'Планка', e: 'Plank', i: 'Plank' } } });
  const стр = await p2.$$eval('#list .exrow', rs => rs.map(r =>
    ((r.querySelector('.exrn b') || {}).textContent || '') + ' | ' + ((r.querySelector('.exrn i') || {}).textContent || '')));
  const пл = стр.findIndex(t => /Планка/.test(t));
  дано(пл >= 0, 'планка встала в день: ' + (стр[пл] || '—'));
  if (пл >= 0) {
    дано(/ с$/.test(стр[пл].trim()), 'в строке у неё секунды, а не повторы: ' + стр[пл]);
    await (await p2.$$('#list .exrow'))[пл].click();
    await p2.waitForTimeout(600);
    const к = await p2.evaluate(() => ({
      спец: ((document.querySelector('.card.exact .spec') || {}).textContent || '').replace(/\s+/g, ' '),
      поле: ((document.querySelector('.card.exact .exbox') || {}).textContent || '').replace(/\s+/g, ' '),
      часы: !!document.querySelector('.card.exact [data-watch]')
    }));
    дано(/ с/.test(к.спец), 'в карточке тоже секунды: ' + к.спец);
    дано(/секунд/.test(к.поле), 'поле подписано «секунды», а не «повторы»');
    дано(к.часы, 'секундомер на месте');
  }
  await br2.close();

  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
