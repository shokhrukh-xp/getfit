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
  await page.click('.card.exact [data-nope]');
  await page.waitForTimeout(1800);
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
  await page.click('.card.exact [data-nope]');
  await page.waitForTimeout(1800);
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
  const группы = await page.$$eval('.ordrow .ordn', ns => ns.map(n => n.firstChild.textContent.trim()));
  дано(группы.length >= 2, 'список для перестановки собран: ' + группы.length);
  дано(группы.some(t => / \+ /.test(t)), 'суперсет стоит одной строкой, парой: ' + (группы.filter(t => / \+ /.test(t))[0] || '—'));

  const вниз = await page.$$('[data-orddn]');
  await вниз[0].click(); await page.waitForTimeout(500);
  const после = await page.$$eval('.ordrow .ordn', ns => ns.map(n => n.firstChild.textContent.trim()));
  дано(после[0] === группы[1] && после[1] === группы[0], 'стрелка поменяла местами: ' + после[0]);

  await page.click('#orddone'); await page.waitForTimeout(700);
  дано(!(await page.evaluate(() => document.body.classList.contains('ordmode'))), 'режим выключается «Готово»');
  const всписке = await ИМЕНА(page);
  дано(всписке[0] === после[0].split(' + ')[0], 'и порядок применился к дню: ' + всписке[0]);

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
