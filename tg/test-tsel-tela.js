'use strict';
/* Цели на карточке «Тело» (21.10). Его просьба: «на этих карточках показывать
   целевые показатели, к которым я иду»; выбор кнопками: вес — цель из «Цели»;
   жир — к весу цели при сохранённой массе без жира; талия — половина роста;
   «мышцы» вместо «белка тела» с целью «держать» и строкой рабочих весов. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const цель = { text: '75 кг к концу января', wt: 'down', rate: -0.67, from: M.Д(50), w0: 92.3, by: '2027-02-10', kg: 17.3 };
const progress = { anchor: M.Д(19), anchorW: 88.3, rate: -0.67, w0: 92.3, kg: 17.3, gap: 0.7,
  verdict: { state: 'медленнее', d0: -0.3 }, eta: { pace: -0.5, weeks: 22, date: '2027-03-20' },
  sila: { verdict: 'растёт', up: 2, flat: 1, down: 0, rows: [], text: '', index: { base: M.Д(28), now: 103.4, ch: 3.4, enough: true, weeks: [] } } };
const meas = M.замеры().map((m, i) => i % 3 === 0 ? Object.assign({}, m, { waist: 92 + i * 0.4 }) : m);
const цельТекст = p => p.$eval('#homebody .vzgoal', e => e.textContent.replace(/ /g, ' ')).catch(() => '');
(async () => {
  const br = await chromium.launch();
  for (const [theme, width] of [['dark', 390], ['light', 320]]) {
    const где = theme + ' ' + width + ': ';
    const page = await br.newPage({ viewport: { width, height: 900 } });
    const ош = await M.поднять(page, { theme, page: 'home', time: '19:40', goal: цель, progress, meas, me: { sex: 'm', age: 34, ht: 178, bw: 86.2 } });
    дано(!ош.length, где + 'без ошибок ' + (ош[0] || ''));
    const чипы = await page.$$eval('#homebody [data-vzv]', ns => ns.map(n => n.textContent));
    дано(чипы.join(',') === 'вес,жир,мышцы,талия', где + 'вкладки — вес, жир, мышцы, талия: ' + чипы);
    await page.click('[data-vzv="w"]'); await page.waitForTimeout(200);
    const сред = await page.evaluate(() => parseFloat(document.querySelector('#homebody .vznum b').textContent.replace(',', '.')));
    let т = await цельТекст(page);
    const ост = String(Math.round((сред - 75) * 10) / 10).replace('.', ',').replace(/,0$/, '');
    дано(т === 'цель 75 кг · осталось ' + ост, где + 'вес: «' + т + '»');
    дано(await page.locator('#homebody .vzgbar i').count() === 1, где + 'у веса — шкала пройденного от старта');
    await page.click('[data-vzv="fat"]'); await page.waitForTimeout(200);
    т = await цельТекст(page);
    дано(/^цель \d+(,\d)? кг \(≈\d+ %\) · осталось \d/.test(т), где + 'жир: цель в кг с процентом от веса цели: «' + т + '»');
    await page.click('[data-vzv="mus"]'); await page.waitForTimeout(200);
    т = await цельТекст(page);
    дано(/^цель — держать \d+,\d кг/.test(т), где + 'мышцы: «держать»: «' + т + '»');
    const сила = await page.$eval('#homebody .vzsil', b => ({ т: b.textContent.replace(/\u00a0/g, ' '), go: b.dataset.zkgo })).catch(() => null);
    дано(!!сила && /рабочие веса \+3,4 %/.test(сила.т) && сила.go === 'log', где + 'строка рабочих весов ведёт в Журнал: ' + (сила && сила.т));
    дано(!/с 01\.09/.test(await page.$eval('#homebody .vzsub', e => e.textContent)), где + 'у мышц нет «с 01.09» — первая неделя дефицита была водой');
    дано(await page.locator('#homebody .vzgoalln').count() === 1, где + 'цель мышц — пунктиром на графике');
    await page.click('[data-vzv="waist"]'); await page.waitForTimeout(200);
    т = await цельТекст(page);
    дано(/^цель 89 см · осталось \d/.test(т), где + 'талия: половина роста 178 — 89 см: «' + т + '»');
    дано(await page.locator('#homebody .vzgoalln').count() === 1, где + 'цель талии рядом с замерами — пунктиром');
    дано(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), где + 'помещается по ширине');
    await page.close();
  }
  /* без цели и роста — строки цели нет, ничего не ломается */
  const p2 = await br.newPage({ viewport: { width: 390, height: 900 } });
  const ош2 = await M.поднять(p2, { theme: 'dark', page: 'home', time: '19:40', meas, me: { sex: 'm', age: 34, bw: 86.2 } });
  await p2.click('[data-vzv="waist"]').catch(() => {}); await p2.waitForTimeout(200);
  дано(!ош2.length && await p2.locator('#homebody .vzgoal').count() === 0, 'без цели и роста строки цели нет');
  await p2.close();
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
