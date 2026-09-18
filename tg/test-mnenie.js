'use strict';
/* ── ПАЛЬЦЫ И ПОРЯДОК ─────────────────────────────────────────────────
   16.09, его просьба: у каждого упражнения палец вверх и вниз; палец вниз
   сразу меняет движение на другое для той же мышцы, и не предлагает то,
   что уже отвергли. Когда на мышцу не осталось ничего — показать всё, что
   есть, и сказать честно. Плюс режим перестановки по долгому удержанию.
   Проверяется то, что ломается тихо: замена берётся на ТУ ЖЕ мышцу, отказ
   помнится между заменами, суперсет переставляется парой, а не половиной. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ИМЕНА = p => p.$$eval('#list .exrow .exrn b, #list .card.exact .exname', ns => ns.map(n => n.textContent.trim()));

/* 18.09: палец вниз больше не меняет упражнение молча — сначала спрашивает,
   «не нравится» или «мешает суставу». Отказ теперь в два касания. */
async function отказ(page) {
  await page.click('.card.exact [data-nope]');
  await page.waitForTimeout(400);
  await page.click('.card.exact [data-noped]');
  await page.waitForTimeout(1800);
}

async function раскрыть(page, i) {
  if (await page.$('.card.exact [data-nope]')) {
    const имя = await page.$eval('.card.exact .exname', e => e.textContent.trim());
    const первое = (await ИМЕНА(page))[0];
    if (имя === первое) return;            /* нужная карточка уже раскрыта */
  }
  const rows = await page.$$('#list .exrow');
  if (rows[i]) { await rows[i].click(); await page.waitForTimeout(600); }
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', page: 'gym', wait: 2800 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  await раскрыть(page, 0);
  const кнопки = await page.$$eval('.card.exact .exfoot button', ns => ns.map(n => n.textContent.trim()));
  дано(кнопки[0] === '👍' && кнопки[1] === '👎', 'в карточке оба пальца: ' + кнопки.join(' · '));
  дано(кнопки.indexOf('Заменить') < 0, 'кнопки «Заменить» больше нет — палец вниз и есть замена');

  /* ── палец вниз меняет упражнение ── */
  const было = await page.$eval('.card.exact .exname', e => e.textContent.trim());
  await отказ(page);
  const стало1 = (await ИМЕНА(page))[0];
  дано(стало1 && стало1 !== было, 'упражнение заменилось: «' + было + '» → «' + стало1 + '»');
  const нота = await page.$eval('#dbnote', e => e.textContent.trim());
  дано(нота.indexOf(было) >= 0 && нота.indexOf(стало1) >= 0, 'сказано, что на что: ' + нота.slice(0, 70));
  дано(/выбрать самому/.test(нота), 'и оставлен выход для того, кто хочет выбрать сам');

  /* ── та же мышца, а не «что нашлось» ──
     Имя из программы в каталоге может не найтись (программа старше
     переименования каталога), поэтому мышцу сверяем у ЗАМЕН между собой:
     обе обязаны прийти из одной мышцы. */
  const мышца1 = await page.evaluate(async n => {
    const j = await (await fetch('catalog.json')).json();
    return ((j.ex || []).filter(x => x.n === n)[0] || {}).m;
  }, стало1);
  дано(!!мышца1, 'замена пришла из каталога, мышца известна: ' + мышца1);

  /* ── второй отказ не возвращает первое ── */
  await раскрыть(page, 0);
  await отказ(page);
  const стало2 = (await ИМЕНА(page))[0];
  дано(стало2 !== стало1 && стало2 !== было,
    'второй отказ дал третье движение, а не вернул отвергнутое: ' + стало2);
  const мышца2 = await page.evaluate(async n => {
    const j = await (await fetch('catalog.json')).json();
    return ((j.ex || []).filter(x => x.n === n)[0] || {}).m;
  }, стало2);
  дано(мышца2 === мышца1, 'и обе замены из одной мышцы: ' + мышца1 + ' и ' + мышца2);

  /* ── отказ помнится между заходами ── */
  const отказы = await page.evaluate(() => {
    const k = Object.keys(localStorage).filter(x => /_nope$/.test(x))[0];
    return k ? Object.values(JSON.parse(localStorage.getItem(k))).map(v => v.n) : [];
  });
  дано(отказы.length === 2 && отказы.indexOf(было) >= 0 && отказы.indexOf(стало1) >= 0,
    'оба отказа записаны навсегда: ' + отказы.join(' · '));

  /* ── палец вверх ── */
  await раскрыть(page, 0);
  await page.click('.card.exact [data-like]');
  await page.waitForTimeout(600);
  await раскрыть(page, 0);
  дано(await page.$eval('.card.exact [data-like]', e => e.getAttribute('aria-pressed') === 'true'),
    'палец вверх остаётся нажатым');

  /* ── режим порядка ── */
  const bb = await (await page.$('#list .exrow')).boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
  await page.waitForTimeout(500);
  дано(await page.evaluate(() => document.body.classList.contains('ordmode')),
    'долгое удержание включило режим порядка');
  /* 16.09, его слова: «режим полностью меняет, как выглядит экран». Теперь не
     меняет: те же строки с фото и весами, только каждая группа в рамке. */
  const ИМГРУПП = p => p.$$eval('#list .ordg', gs => gs.map(g =>
    Array.prototype.map.call(g.querySelectorAll('.exrn b'), b2 => b2.textContent.replace(/^[АБ]/, '').trim()).join(' + ')));
  const группы = await ИМГРУПП(page);
  дано(группы.length >= 2, 'список для перестановки собран: ' + группы.length);
  дано(группы.some(t => / \+ /.test(t)), 'суперсет стоит одной рамкой, парой: ' + (группы.filter(t => / \+ /.test(t))[0] || '—'));
  дано((await page.$$('#list .ordg .exrow .exph img, #list .ordg .exrow .exph svg')).length >= 2,
    'фото упражнений остались на месте — экран не подменён');
  дано(/из/.test(await page.$eval('#list .ordg .exrv', e => e.textContent)),
    'и счёт подходов тоже: ' + (await page.$eval('#list .ordg .exrv', e => e.textContent.replace(/\s+/g, ' ').trim())));

  const вниз = await page.$$('[data-orddn]');
  await вниз[0].click(); await page.waitForTimeout(500);
  const после = await ИМГРУПП(page);
  дано(после[0] === группы[1] && после[1] === группы[0], 'стрелка поменяла местами: ' + после[0]);

  /* ── перенос пальцем: тащим третью строку в начало ──
     16.09, его просьба с самого начала была про палец, а не про стрелки.
     Стрелки меняют местами соседей; палец ПЕРЕНОСИТ через несколько строк,
     и остальные должны сдвинуться, а не перемешаться. */
  let финал = после;
  const доТаски = await ИМГРУПП(page);
  if (доТаски.length >= 3) {
    const ряды = await page.$$('#list .ordg');
    const р3 = await (await ряды[2].$('.ordgrip')).boundingBox();
    const верх = await ряды[0].boundingBox();
    дано(!!р3 && !!верх, 'у каждой строки есть ручка для пальца');
    await page.mouse.move(р3.x + р3.width / 2, р3.y + р3.height / 2);
    await page.mouse.down();
    await page.mouse.move(р3.x + р3.width / 2, р3.y + р3.height / 2 - 12, { steps: 3 });
    дано(await page.evaluate(() => !!document.querySelector('.ordg.drag')), 'карточка поднялась под пальцем');
    /* тащим ВЫШЕ середины первой группы — иначе карточка встанет второй, и
       это правильно: перенос считается по серединам, а группы разной высоты */
    await page.mouse.move(р3.x + р3.width / 2, верх.y + 4, { steps: 12 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(800);
    const послеТаски = await ИМГРУПП(page);
    дано(послеТаски[0] === доТаски[2], 'третья строка встала первой: ' + послеТаски[0]);
    дано(послеТаски[1] === доТаски[0] && послеТаски[2] === доТаски[1],
      'остальные сдвинулись, а не поменялись местами: ' + послеТаски.slice(0, 3).join(' · '));
    дано(!(await page.evaluate(() => !!document.querySelector('.ordg.drag'))), 'после отпускания ничего не зависло');
    финал = послеТаски;
  }

  await page.click('#orddone'); await page.waitForTimeout(700);
  дано(!(await page.evaluate(() => document.body.classList.contains('ordmode'))), 'режим выключается «Готово»');
  const всписке = await ИМЕНА(page);
  дано(всписке[0] === финал[0].split(' + ')[0], 'и порядок применился к дню: ' + всписке[0]);

  /* ── порядок пережил перезагрузку ── */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  const поперезагрузке = await ИМЕНА(page);
  /* после перезагрузки первая пара суперсета рисуется с меткой «А» — сравниваем
     по имени, а не по строке целиком */
  const без = s => String(s).replace(/^[АБ]/, '');
  дано(без(поперезагрузке[0]) === без(всписке[0]), 'порядок запомнен навсегда: ' + поперезагрузке[0]);

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
