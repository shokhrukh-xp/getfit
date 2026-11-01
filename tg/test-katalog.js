'use strict';
/* Каталог: поиск главный, фильтры за одной кнопкой, без запроса — подборки
   по мышцам. Раньше четыре ряда чипов занимали больше половины экрана, и до
   первого упражнения надо было листать. */
const fs = require('fs');
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const кадр = fs.readFileSync(__dirname + '/fixtures/a.jpg');

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  /* картинки упражнений живут на jsdelivr — у контейнера туда нет сети.
     Подменяем местным кадром, иначе меряем пустые рамки (уже обжигались). */
  await page.route('**/cdn.jsdelivr.net/**', r =>
    r.fulfill({ status: 200, contentType: 'image/jpeg', body: кадр }));
  const ош = await M.поднять(page, { theme: 'dark', time: '19:40' });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.locator('.l1-in button', { hasText: 'Тренировка' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: 'каталог' }).first().click();
  await page.waitForTimeout(1500);

  /* 01.11, его слова «переделай каталог и сделай его более удобным и понятным» (макет,
     выбор 2A + «добавь ещё фильтр по тренажёру»): место сегментом, «Что тренируем»
     сеткой из девяти плиток, «Популярное», чипы «Снаряд / Тренажёр / Уровень». */
  /* 1. стартовый экран: место, плитки, популярное */
  дано(await page.$$eval('#pcatwhere [data-where]', bs => bs.map(b => b.textContent.trim()).join(' · ')) === 'Зал · Дом · Улица',
    'место — три кнопки: Зал · Дом · Улица');
  дано(await page.$eval('#pcatwhere [aria-pressed="true"]', b => b.dataset.where) === 'g', 'по умолчанию — зал (место из профиля)');
  const плитки = await page.$$eval('#pcatbody .catgrid button b', bs => bs.map(b => b.textContent));
  дано(плитки.join(' · ') === 'Ноги · Ягодицы · Спина · Грудь · Плечи · Руки · Пресс · Растяжка · Кардио',
    '«Что тренируем» — девять плиток: ' + плитки.join(' · '));
  const верх = await page.$eval('#pcatbody .catgrid', e => e.getBoundingClientRect().top);
  дано(верх < 420, 'плитки видны без прокрутки: ' + Math.round(верх) + ' px от верха');
  const поп = await page.$$eval('#pcatbody .catlist .catitem', n => n.length);
  дано(поп >= 4 && поп <= 6, 'ниже — популярное: ' + поп);
  дано(await page.$$eval('#pcatchips [data-catchip]', bs => bs.map(b => b.dataset.catchip).join(',')) === 'q,m,l',
    'чипы: снаряд, тренажёр, уровень');
  дано(!(await page.isVisible('#pcatfilters')), 'панель фильтров закрыта');

  /* 2. плитка открывает список группы, чип с крестиком её снимает */
  await page.click('#pcatbody .catgrid [data-grp="chest"]'); await page.waitForTimeout(600);
  дано(!(await page.$('#pcatbody .catgrid')), 'после плитки — список, а не плитки');
  дано(/Грудь ✕/.test(await page.textContent('#pcatchips')), 'выбранная группа — чипом с крестиком');
  дано(/сначала популярные/.test(await page.textContent('#pcatbody .catcount')), 'список: сначала популярные');
  const перваяГр = await page.textContent('#pcatbody .catitem .cattx b');
  дано(/^Жим/.test(перваяГр), 'первым в груди — жим, а не экзотика: ' + перваяГр);
  дано(await page.$$eval('#pcatbody .catitem .catlv', n => n.length) > 3, 'уровень — точками');
  await page.click('#pcatchips [data-catchip="grp"]'); await page.waitForTimeout(500);
  дано(!!(await page.$('#pcatbody .catgrid')), 'крестик вернул плитки');

  /* 3. тренажёр: чип → плитки тренажёров → список; «сбросить» */
  await page.click('#pcatchips [data-catchip="m"]'); await page.waitForTimeout(500);
  дано(await page.isVisible('#pcatfilters [data-gear="m:smith"]'), 'чип «Тренажёр» открыл плитки тренажёров');
  await page.click('#pcatfilters [data-gear="m:smith"]'); await page.waitForTimeout(600);
  дано(!(await page.isVisible('#pcatfilters')) && /Смит/.test(await page.textContent('#pcatchips [data-catchip="m"]')),
    'выбран Смит — панель закрылась, чип подписан');
  const смит = await page.$$eval('#pcatbody .catitem .catsub', n => n.map(e => e.textContent));
  дано(смит.length > 3 && смит.every(t => /Смит/i.test(t)), 'в списке только Смит: ' + смит.length);
  await page.click('#pcatchips [data-catchip="reset"]'); await page.waitForTimeout(500);
  дано(!!(await page.$('#pcatbody .catgrid')), '«сбросить» вернул стартовый экран');

  /* 4. поиск работает поверх всего; нажатие на строку — карточка */
  await page.fill('#pcatsearch', 'присед');
  await page.waitForTimeout(700);
  const первый = await page.textContent('#pcatbody .catitem .cattx b');
  дано(/присед/i.test(первый), 'первое найденное отвечает запросу: ' + первый);
  await page.click('#pcatbody .catitem'); await page.waitForTimeout(900);
  дано(await page.isVisible('#techm.show'), 'нажатие на строку открыло карточку');
  дано(/Работает/.test(await page.textContent('#techbody')) && /Где/.test(await page.textContent('#techbody')), 'в карточке — что работает и где');
  await page.click('#techbody [data-techclose]'); await page.waitForTimeout(400);

  /* 5. снаряд не написан дважды: в имени и в серой подписи */
  await page.fill('#pcatsearch', 'штанга');
  await page.waitForTimeout(800);
  const строки = await page.$$eval('#pcatbody .catitem', ns => ns.slice(0, 12).map(e => ({
    имя: e.querySelector('.cattx b').textContent,
    подпись: e.querySelector('.catsub').textContent })));
  дано(строки.length > 0, 'нашлись строки со штангой: ' + строки.length);
  дано(строки.every(r => !/\(/.test(r.имя)), 'имена короткие, без скобок: ' + (строки[0] || {}).имя);
  дано(строки.filter(r => /штанга/i.test(r.имя) && /штанга/i.test(r.подпись)).length === 0, 'снаряд не повторяется в подписи');
  await page.fill('#pcatsearch', ''); await page.waitForTimeout(400);

  /* 8. одинаковых имён в каталоге не осталось */
  /* весь скрипт приложения в IIFE — CAT изнутри page.evaluate не виден,
     поэтому читаем тот же файл, который грузит приложение */
  const имена = await page.evaluate(async () => {
    const d = await (await fetch('catalog.json')).json();
    const c = {}; let п = 0;
    d.ex.forEach(x => { c[x.n] = (c[x.n] || 0) + 1; });
    Object.values(c).forEach(v => { if (v > 1) п++; });
    return { всего: d.ex.length, повторов: п };
  });
  /* 28.10: 18 своих упражнений без фото (голень, сложные на своём весе) убраны — 881 */
  /* 01.11: +120 для дома и улицы из бесплатного RepDB — 1001 */
  дано(имена.всего === 1001, 'в каталоге все 1001 упражнение: ' + имена.всего);
  дано(имена.повторов === 0, 'одинаковых имён не осталось: ' + имена.повторов);

  /* 9. 01.11: «силы по умолчанию» больше нет — растяжка находится поиском сразу */
  await page.fill('#pcatsearch', 'растяжка');
  await page.waitForTimeout(800);
  const нашлось = await page.$$('#pcatbody .catitem');
  дано(нашлось.length > 10, 'растяжки находятся поиском без фильтров: ' + нашлось.length);

  /* ── ПРОДВИНУТЫЕ ДВИЖЕНИЯ (12.09) ──
     Он спросил, почему их так мало. Часть пришла из починки разметки, часть
     завели своими записями: в открытых наборах с картинками их нет ни у кого,
     поэтому вместо фото — наша схема движения. А тяжёлые ВАРИАНТЫ того же
     движения (Пендлея, с паузой, Андерсона) отдельной строкой не заводим —
     это тот же подход и то же фото, они живут подписью у своей базы. */
  await page.fill('#pcatsearch', 'Пендлея');
  await page.waitForTimeout(800);
  const пенд = await page.$$eval('#pcatbody .catitem', rs => rs.map(r => ({
    имя: (r.querySelector('.cattx b') || {}).textContent || '',
    вариант: [...r.querySelectorAll('.cathard')].map(u => u.textContent).join(' ; ') })));
  дано(пенд.length === 1 && /^Тяга$/.test(пенд[0].имя),
    'тяжёлый вариант ищется по имени и ведёт к своей базе: ' + (пенд[0] || {}).имя);
  дано(/с пола/.test((пенд[0] || {}).вариант || ''),
    'и рядом сказано, чем он отличается: ' + ((пенд[0] || {}).вариант || '—').slice(0, 70));

  await page.fill('#pcatsearch', 'флаг дракона');
  await page.waitForTimeout(800);
  const флаг = await page.$$eval('#pcatbody .catitem', rs => rs.map(r => ({
    имя: (r.querySelector('.cattx b') || {}).textContent || '',
    тег: (r.querySelector('.cattag') || {}).textContent || '',
    схема: !!r.querySelector('svg.fig') })));
  /* 28.10: свои движения без настоящего фото (флаг дракона, планш, висы…)
     убраны по его просьбе — в каталоге остаются только упражнения с фото */
  /* 01.11: флаг дракона вернулся уже с кадрами RepDB — проверяем, что он с картинкой, а не со схемой */
  дано(флаг.some(f => /Флаг дракона/.test(f.имя)) && await page.$('#pcatbody .catitem img[src*="r-dragon-flag-0"]') !== null,
    'флаг дракона есть и с картинкой RepDB: ' + (флаг.map(f => f.имя).join(', ') || 'пусто'));
  дано(!флаг.some(f => f.схема), 'рисованных схем вместо фото в выдаче нет');

  /* 01.11, его слова «я не вижу в каталоге категорий в зале, дома, на улице»:
     сегмент «Зал · Дом · Улица» над поиском (01.11 — без «Все», по умолчанию зал) */
  const имена2 = () => page.$$eval('#pcatbody .catitem .cattx b', bs => bs.map(b => b.textContent));
  await page.click('#pcatwhere [data-where="s"]'); await page.fill('#pcatsearch', 'вис'); await page.waitForTimeout(700);
  дано((await имена2()).includes('Вис на турнике'), '«Улица»: вис на турнике есть');
  await page.fill('#pcatsearch', 'штанг'); await page.waitForTimeout(700);
  дано(!(await имена2()).length, '«Улица»: упражнений со штангой нет');
  await page.click('#pcatwhere [data-where="h"]'); await page.fill('#pcatsearch', 'подтягивания'); await page.waitForTimeout(700);
  дано(!(await имена2()).some(n => /^Подтягивания/.test(n)), '«Дом»: турника нет — подтягиваний нет');
  await page.fill('#pcatsearch', 'отжимания'); await page.waitForTimeout(700);
  дано((await имена2()).some(n => /^Отжимания с колен/.test(n)), '«Дом»: отжимания с колен есть');
  await page.click('#pcatwhere [data-where="g"]'); await page.fill('#pcatsearch', ''); await page.waitForTimeout(500);

  /* ── ЛИСТ СБОРКИ (12.09) ──
     «Почему при нажатии на собрать заново не спрашиваются дни, минуты, упор,
     зал или дома, блины? Это нужно спрашивать здесь, а не показывать в профиле
     постоянно». Условия сборки теперь живут в листе, а профиль показывает
     карточку «под что собрана». */
  await page.click('#profbtn');
  await page.waitForTimeout(700);
  /* 17.09: «часть про зал упрости». Семь строк с ярлыками схлопнулись в одну
     строку условий — факты те же, ярлыков нет. */
  const карт = (await page.textContent('#progcard')).replace(/\s+/g, ' ');
  дано(/дней в неделю/.test(карт) && /мин/.test(карт) && /тело ровно|упор/.test(карт),
    'в профиле карточка «под что собрана»: ' + карт.slice(0, 90));
  дано(карт.split('·').length <= 8, 'и она короткая, а не список из семи строк: ' + карт.slice(0, 90));
  for (const id of ['pf-place', 'pf-plate', 'pf-lim', 'pf-level'])
    дано(!(await page.isVisible('#' + id)), 'россыпь в профиле убрана: #' + id);

  await page.click('#pq-gym'); await page.waitForTimeout(300);   /* 17.10: карточка — в листе «Программа» */
  await page.click('#progedit');
  await page.waitForTimeout(600);
  дано(await page.isVisible('#sborm'), 'кнопка открывает лист сборки, а не собирает молча');
  for (const id of ['sb-wd', 'sb-min', 'sb-level', 'sb-place', 'sb-focus', 'sb-plate', 'sb-lim', 'sb-dis'])
    дано(await page.isVisible('#' + id), 'в листе спрашивается ' + id);
  const дней = await page.$$eval('#sb-wd button', bs => bs.filter(b => b.getAttribute('aria-pressed') === 'true').length);
  дано(дней >= 2, 'дни подставлены из расписания: ' + дней);
  дано(/подход\S* за занятие/.test(await page.textContent('#sb-minh')),
    'сказано, во что превращаются минуты: ' + (await page.textContent('#sb-minh')));

  /* «всё тело ровно» и точечный упор вместе не бывают */
  const кн = await page.$$('#sb-focus button');
  for (const b of кн) if (/плечи/.test(await b.textContent())) { await b.click(); break; }
  await page.waitForTimeout(200);
  let выбр = await page.$$eval('#sb-focus button', bs => bs.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent));
  дано(выбр.length === 1 && выбр[0] === 'плечи', 'выбрал мышцу — «всё тело ровно» снялось: ' + выбр.join(', '));
  for (const b of кн) if (/всё тело/.test(await b.textContent())) { await b.click(); break; }
  await page.waitForTimeout(200);
  выбр = await page.$$eval('#sb-focus button', bs => bs.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent));
  дано(выбр.length === 1 && /всё тело/.test(выбр[0]), 'выбрал «ровно» — точечный упор снялся: ' + выбр.join(', '));

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
