'use strict';
/* «Тренировка»: таблица подходов (его выбор 13.09 из трёх эскизов).
   До этого в карточке жил ровно ОДИН подход крупными числами, остальные —
   чипами внизу: «очень неудобно и непонятно записывать подходы». Теперь
   строка на подход, все видны сразу, и вплотную к полям — колонка «было»:
   что поднял в прошлый раз именно на этом подходе.
   Раскрыто по-прежнему ровно одно упражнение, остальные — строки с фото;
   при входе не раскрыто ничего, пока не нажал. */
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
  колонки: Array.from(document.querySelectorAll('.card.exact .settbl th')).map(t => t.textContent.trim()),
  строки: Array.from(document.querySelectorAll('.card.exact .settbl .setrow')).map(r => ({
    n: (r.querySelector('.cn') || {}).textContent || '',
    было: ((r.querySelector('.cb') || {}).textContent || '').trim(),
    кг: (r.querySelector('input[data-f="w"]') || {}).value,
    подсказкаКг: (r.querySelector('input[data-f="w"]') || {}).placeholder,
    повт: (r.querySelector('input[data-f="r"]') || {}).value,
    done: r.classList.contains('done'),
    now: r.classList.contains('now') }))
}));

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  const ош = await M.поднять(page, { theme: 'dark', time: '17:40', page: 'gym', wait: 2200, hist: M.журнал() });
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
  дано(с.свёрнуто.every(r => r.фото), 'у каждого свёрнутого тоже есть фото');
  дано(/из/.test(с.свёрнуто[0].справа), 'в свёрнутой строке видно, сколько подходов закрыто: ' + с.свёрнуто[0].справа);

  /* ── ТАБЛИЦА ПОДХОДОВ (13.09) ── */
  дано(с.строки.length >= 2, 'все подходы видны строками сразу: ' + с.строки.length);
  дано(/^#/.test(с.колонки[0]) && с.колонки[1] === 'было',
    'колонки названы: ' + с.колонки.join(' | '));
  дано(/повторы|секунды/.test(с.колонки.join(' ')), 'колонка повторов подписана: ' + с.колонки.join(' | '));
  дано(с.строки.filter(r => r.now).length === 1, 'ровно одна строка помечена текущей');
  дано(с.строки[0].было !== '' && с.строки[0].было !== '·',
    'в колонке «было» стоит прошлый раз: ' + с.строки[0].было);
  дано(с.строки.every(r => r.n !== ''), 'у каждой строки виден номер подхода');

  /* ── РЕКОМЕНДАЦИЯ — ПОДСКАЗКА, А НЕ ЗАПИСЬ (13.09) ──
     Раньше в ячейку заранее вписывался рекомендованный вес готовым значением.
     Нажал галочку не глядя — и в журнал уехало число, которого не поднимал:
     47,5 кг там, где сделал 40. Теперь ячейка пустая, рекомендация стоит
     серой подсказкой, а галочка переносит её в саму ячейку. */
  дано(с.строки.every(r => r.кг === ''),
    'ячейки пустые, а не заполнены рекомендацией: ' + JSON.stringify(с.строки.map(r => r.кг)));
  дано(с.строки[0].подсказкаКг !== '' && с.строки[0].подсказкаКг !== '—',
    'но подсказка в ячейке стоит: ' + с.строки[0].подсказкаКг);
  const подск = с.строки[0].подсказкаКг;
  await page.click('.card.exact .settbl .setrow:first-child .ok');
  await page.waitForTimeout(400);
  дано((await снимок(page)).строки[0].кг === подск,
    'галочка переносит подсказку в ячейку — записанное равно видимому: ' + подск);
  await page.click('.card.exact .settbl .setrow:first-child .ok');   /* отменяем: дальше вводим руками */
  await page.waitForTimeout(350);

  /* ── ЗАПИСАННОЕ ЧИСЛО = ВИДИМОЕ ЧИСЛО (13.09) ──
     «Жим ногами на икры я сделал по 40 кг, почему на карточке пишется 47,5?»
     В строке стоял рекомендованный вес. Вводим 40×15 и проверяем, что
     свёрнутая строка показывает ровно это. */
  await page.fill('.card.exact .settbl .setrow:first-child input[data-f="w"]', '40');
  await page.fill('.card.exact .settbl .setrow:first-child input[data-f="r"]', '15');
  await page.waitForTimeout(150);
  await page.click('.card.exact .settbl .setrow:first-child .ok');
  await page.waitForTimeout(500);
  let д = await снимок(page);
  дано(д.строки[0].done, 'подход закрылся галочкой');
  дано(д.строки[0].кг === '40' && д.строки[0].повт === '15',
    'введённое осталось в ячейках: ' + д.строки[0].кг + '×' + д.строки[0].повт);
  дано(д.строки[1] && д.строки[1].now, 'текущей стала следующая строка');
  дано(д.строки[1] && д.строки[1].подсказкаКг === '40',
    'следующий подход подсказан твоим же весом, а не рекомендацией: ' + (д.строки[1] || {}).подсказкаКг);
  дано(д.доля !== с.доля, 'дорожка дня сдвинулась: ' + с.доля + ' → ' + д.доля);

  await page.click('.card.exact .exttl');
  await page.waitForTimeout(350);
  д = await снимок(page);
  дано(/40×15/.test(д.свёрнуто[0].справа.replace(/\s/g, '')),
    'в свёрнутой строке стоит сделанное, а не рекомендованное: ' + д.свёрнуто[0].справа.replace(/\s+/g, ' '));

  /* закрываем упражнение целиком — фокус уходит на следующее */
  await page.click('.exrow');
  await page.waitForTimeout(350);
  for (let i = 0; i < 6; i++) {
    const кн = await page.$('.card.exact .settbl .setrow:not(.done) .ok');
    if (!кн) break;
    await кн.click(); await page.waitForTimeout(280);
  }
  д = await снимок(page);
  дано(д.раскрыто === 1, 'по-прежнему раскрыто одно упражнение');
  дано(д.свёрнуто.some(r => r.done), 'закрытое упражнение свернулось с отметкой: ' +
    JSON.stringify(д.свёрнуто.filter(r => r.done).map(r => r.справа.replace(/\s+/g, ' '))));

  /* тап по свёрнутому возвращает фокус на него */
  const имя = д.свёрнуто.find(r => !r.done) ? д.свёрнуто.find(r => !r.done).имя : д.свёрнуто[0].имя;
  await page.click('.exrow:not(.done)').catch(() => page.click('.exrow'));
  await page.waitForTimeout(400);
  д = await снимок(page);
  дано(д.раскрыто === 1 && !new RegExp(имя.slice(0, 10)).test(д.свёрнуто.map(r => r.имя).join('|')),
    'тап по свёрнутой строке раскрыл именно её');

  /* ── ЗАКРЫТОЕ УПРАЖНЕНИЕ ТОЖЕ ОТКРЫВАЕТСЯ (13.09) ──
     «Я сделал 2 подхода первого упражнения, после чего его карточка больше не
     открывается, а я хочу добавить ещё один». */
  const зак = await page.$('.exrow.done');
  дано(!!зак, 'закрытое упражнение свернулось в строку');
  if (зак) {
    await зак.click();
    await page.waitForTimeout(400);
    const открыт = await page.$eval('.card.exact .exname', e => e.textContent).catch(() => '');
    дано(открыт.length > 0, 'нажатие по закрытому открыло именно его: ' + открыт);
    const до = (await снимок(page)).строки.length;
    await page.click('.card.exact .setadd .addset');
    await page.waitForTimeout(400);
    const п = await снимок(page);
    дано(п.строки.length === до + 1, 'к закрытому упражнению добавляется подход: ' + до + ' → ' + п.строки.length);
    дано(п.строки[п.строки.length - 1].now, 'и новый подход сразу становится текущим');
    /* закрытые подходы остаются доступными для правки — это его условие */
    дано(п.строки.filter(r => r.done).every(r => r.кг !== undefined),
      'сделанные подходы остались редактируемыми');
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

  /* ── «ВСЁ» ТОЖЕ ПИШЕТ ЧИСЛА ──
     Кнопка отмечала все подходы разом, не трогая ячейки: упражнение уходило
     в журнал прочерком вместо веса. */
  await page.click('.exrow:not(.done)').catch(() => {});
  await page.waitForTimeout(400);
  const всёКн = await page.$('.card.exact .allb');
  if (всёКн) {
    await всёКн.click();
    await page.waitForTimeout(500);
    const в = await снимок(page);
    const этаСтрока = в.свёрнуто.find(r => r.done) || {};
    дано(в.строки.length === 0 || в.строки.every(r => r.повт !== ''),
      'после «всё» в каждой строке стоит число: ' + JSON.stringify(в.строки.map(r => r.кг + '×' + r.повт)));
    дано(!/^\s*—/.test(этаСтрока.справа || ''),
      'и свёрнутая строка не показывает прочерк: ' + (этаСтрока.справа || '—').replace(/\s+/g, ' '));
  }

  /* ── СТРОКА СОСТОЯНИЯ ИДЁТ СТРОКОЙ ──
     Класс ok на #dbnote значит «сохранено», а не «кнопка 44×44». Правило
     галочки подхода однажды поймало его без .setrow, и «11 подходов отмечено ·
     сохранено в Telegram» встало столбиком в сорок четыре пикселя поверх
     кнопки «Завершить». */
  const заметка = await page.evaluate(() => {
    const e = document.getElementById('dbnote'); if (!e) return null;
    e.className = 'dbnote ok';
    e.textContent = '13 подходов отмечено · сохранено в Telegram ✓';
    const b = e.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height) };
  });
  дано(заметка && заметка.w > 200 && заметка.h < 60,
    'строка «сохранено» идёт строкой, а не столбиком: ' + JSON.stringify(заметка));

  await br.close();

  /* ── ЧТО ДЕРЖАТ, СЧИТАЕТСЯ В СЕКУНДАХ (13.09) ──
     «Планка считается в секундах же, где таймер здесь?» Признак — каталог:
     у упражнений, которые держат, стоит tm. */
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
      колонки: Array.from(document.querySelectorAll('.card.exact .settbl th')).map(t => t.textContent.trim()).join('|'),
      кг: !!document.querySelector('.card.exact input[data-f="w"]'),
      часы: document.querySelectorAll('.card.exact [data-watch]').length
    }));
    дано(/ с/.test(к.спец), 'в карточке тоже секунды: ' + к.спец);
    дано(/секунды/.test(к.колонки), 'колонка подписана «секунды», а не «повторы»: ' + к.колонки);
    дано(!к.кг, 'веса у планки нет — колонки килограммов тоже');
    дано(к.часы >= 1, 'секундомер стоит в каждой строке подхода: ' + к.часы);
  }
  await br2.close();

  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
