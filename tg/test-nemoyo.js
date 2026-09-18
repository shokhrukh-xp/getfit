'use strict';
/* ── ОТМЕЧЕННЫЕ «НЕ МОЁ» ───────────────────────────────────────────────
   16.09, его правка: не заводить отдельный список отвергнутых упражнений,
   а добавить фильтр в самом каталоге — там, где человек и так выбирает
   упражнение, и замену видно сразу.

   До этого 👎 копились и не показывались нигде: передумал — вернуть некуда,
   а подбор замен молча обходил упражнение навсегда. */
const fs = require('fs');
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const кадр = fs.readFileSync(__dirname + '/fixtures/a.jpg');

const вКаталог = async page => {
  await page.locator('.l1-in button', { hasText: 'Тренировка' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: 'каталог' }).first().click();
  await page.waitForTimeout(1400);
};
const открытьФильтры = async page => {
  if (!(await page.isVisible('#pcatfilters').catch(() => false))) {
    await page.click('#pcatfbtn');
    await page.waitForTimeout(400);
  }
};

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**/cdn.jsdelivr.net/**', r =>
    r.fulfill({ status: 200, contentType: 'image/jpeg', body: кадр }));
  const ош = await M.поднять(page, { theme: 'dark', page: 'gym', wait: 2800 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* ── пока ничего не отмечено, фильтра нет: мёртвых кнопок не держим ── */
  await вКаталог(page);
  await открытьФильтры(page);
  дано(!(await page.$('#pcatfilters .mchips[data-f="nope"]')), 'без отметок фильтра «моё» нет вовсе');

  /* ── отмечаем одно упражнение большим пальцем вниз ── */
  await page.locator('.l1-in button', { hasText: 'Тренировка' }).first().click();
  await page.waitForTimeout(500);
  for (const b2 of await page.$$('.zseg button'))
    if ((await b2.textContent()).trim() === 'Упражнения' && await b2.isVisible()) { await b2.click(); break; }
  await page.waitForTimeout(900);
  if (!(await page.$('.card.exact [data-nope]'))) {
    const rows = await page.$$('#list .exrow');
    if (rows[0]) { await rows[0].click(); await page.waitForTimeout(700); }
  }
  const было = await page.$eval('.card.exact .exname', e => e.textContent.trim());
  /* 18.09: палец вниз сначала спрашивает — «не нравится» или «мешает суставу» */
  await page.click('.card.exact [data-nope]');
  await page.waitForTimeout(400);
  await page.click('.card.exact [data-noped]');
  await page.waitForTimeout(1800);
  const стало = await page.$$eval('#list .exrow .exrn b, #list .card.exact .exname', ns => ns.map(n => n.textContent.trim()))
    .then(a2 => a2[0] || '');
  дано(было && стало && было !== стало, 'упражнение заменилось: ' + было + ' → ' + стало);

  /* ── фильтр появился и показывает ровно отмеченное ── */
  await вКаталог(page);
  await открытьФильтры(page);
  const чип = await page.$('#pcatfilters .mchips[data-f="nope"] .mchip[data-v="no"]');
  дано(!!чип, 'фильтр появился, как только появилась первая отметка');
  const подпись = чип ? (await чип.textContent()).replace(/\s+/g, ' ').trim() : '';
  дано(/👎/.test(подпись) && /1/.test(подпись), 'на чипе палец и счёт: ' + подпись);

  await чип.click();
  await page.waitForTimeout(900);
  const строки = await page.$$eval('#pcatbody .catitem', els => els.map(e => ({
    имя: (e.querySelector('.cattx b') || {}).textContent || '',
    отмечено: e.classList.contains('nope'),
    кнопка: ((e.querySelector('.catpick') || {}).textContent || '').trim()
  })));
  дано(строки.length === 1, 'в списке ровно отмеченное: ' + строки.length);
  дано(строки[0] && строки[0].отмечено, 'строка помечена как отвергнутая');
  /* В программе у упражнения своя подпись («Приседания со штангой»), в
     каталоге — каноническая («Присед (штанга, классический)»). Сверяем по
     id, а не по имени: это одно и то же упражнение под двумя ярлыками. */
  const ключ = await page.evaluate(() => {
    try { const k = Object.keys(localStorage).filter(x => /_nope$/.test(x))[0];
      return k ? Object.keys(JSON.parse(localStorage.getItem(k) || '{}'))[0] : ''; } catch (e) { return ''; }
  });
  const вСтроке = await page.$eval('#pcatbody [data-unnope]', e => e.dataset.unnope).catch(() => '');
  дано(!!ключ && ключ === вСтроке, 'в списке ровно то упражнение, что отмечено: ' + вСтроке);
  дано(строки[0] && строки[0].кнопка === 'вернуть', 'вместо «видео» — «вернуть»: ' + (строки[0] || {}).кнопка);
  дано(/отмеченные/.test(await page.textContent('#pcatfbtn')), 'кнопка фильтров признаётся, что фильтрует: ' + (await page.textContent('#pcatfbtn')).replace(/\s+/g, ' ').trim());

  /* ── вернули: отметка снята, список опустел, фильтр сам выключился ── */
  await page.click('#pcatbody [data-unnope]');
  await page.waitForTimeout(900);
  const после = await page.$$eval('#pcatbody .catitem.nope', els => els.length);
  дано(после === 0, 'отмеченных больше нет: ' + после);
  await открытьФильтры(page);
  дано(!(await page.$('#pcatfilters .mchips[data-f="nope"]')), 'и фильтр снова исчез — отмечать нечего');

  /* ── и упражнение снова годится в замены ── */
  const вернулось = await page.evaluate(() => {
    try { const k = Object.keys(localStorage).filter(x => /_nope$/.test(x))[0];
      return k ? localStorage.getItem(k) : 'нет ключа'; } catch (e) { return 'нет доступа'; }
  });
  дано(вернулось === '{}' || вернулось === null || вернулось === 'нет ключа',
    'память отметок пуста: ' + вернулось);

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
