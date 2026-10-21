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
/* 56 утр: окно «дни 8–35 от старта цели» для базы мышц должно быть в истории */
const meas = Array.from({ length: 56 }, (_, i) => { const w = 86.6 + i * 0.1, fat = 26.4 + i * 0.03;
  return { date: M.Д(i), w: +w.toFixed(1), fat: +fat.toFixed(1), fatkg: +(w * fat / 100).toFixed(1), muscle: +(60.2 + (i > 40 ? 0.6 : 0)).toFixed(1),
    prot: 16, waist: i % 7 === 0 ? +(92 + i * 0.1).toFixed(1) : undefined }; });
const голова = p => p.evaluate(() => { const h = document.querySelector('#homebody .vzgh'), l = document.querySelector('#homebody .vzgline');
  const т = e => e ? e.innerText.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return { л: т(h && h.querySelector('.vzg-l')), п: т(h && h.querySelector('.vzg-r')), строка: т(l), путь: !!(h && h.querySelector('.vzg-tr u')) }; });
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
    let г = await голова(page);
    дано(/^цель 75 ?кг$/.test(г.л) && /^сейчас \d+,\d ?кг$/.test(г.п), где + 'вес: слева цель, справа сейчас: ' + г.л + ' | ' + г.п);
    дано(г.путь && /^осталось \d+(,\d)? кг( · (выше|ниже) плана на \d|( · по плану)|$)/.test(г.строка), где + 'между ними путь, под ними одна строка: ' + г.строка);
    дано(await page.locator('#homebody .vzsub, #homebody .vztd, #homebody p.vzgapline').count() === 0, где + 'лишних строк под головой нет');
    await page.click('[data-vzv="fat"]'); await page.waitForTimeout(200);
    г = await голова(page);
    дано(/^цель \d+(,\d)? ?кг ≈\d+ %$/.test(г.л), где + 'жир: цель в кг и процент от веса цели: ' + г.л);
    await page.click('[data-vzv="mus"]'); await page.waitForTimeout(200);
    г = await голова(page);
    дано(/^держать 60,[23] ?кг$/.test(г.л) && !г.путь, где + 'мышцы: «держать» — база дней 8–35 от старта цели: ' + г.л);
    const сила = await page.$eval('#homebody .vzsil', b => ({ т: b.textContent.replace(/\u00a0/g, ' '), go: b.dataset.zkgo })).catch(() => null);
    дано(!!сила && /рабочие веса \+3,4 %/.test(сила.т) && сила.go === 'log', где + 'строка рабочих весов ведёт в Журнал: ' + (сила && сила.т));
    дано(await page.locator('#homebody .vzgoalln').count() === 1, где + 'цель мышц — пунктиром на графике');
    await page.click('[data-vzv="waist"]'); await page.waitForTimeout(200);
    г = await голова(page);
    дано(/^цель 89 ?см$/.test(г.л) && /^осталось \d/.test(г.строка), где + 'талия: половина роста 178 — 89 см: ' + г.л + ' · ' + г.строка);
    дано(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), где + 'помещается по ширине');
    await page.close();
  }
  /* без цели и роста — строки цели нет, ничего не ломается */
  const p2 = await br.newPage({ viewport: { width: 390, height: 900 } });
  const ош2 = await M.поднять(p2, { theme: 'dark', page: 'home', time: '19:40', meas, me: { sex: 'm', age: 34, bw: 86.2 } });
  await p2.click('[data-vzv="waist"]').catch(() => {}); await p2.waitForTimeout(200);
  дано(!ош2.length && await p2.locator('#homebody .vzgh').count() === 0 && await p2.locator('#homebody .vznum').count() === 1, 'без цели и роста — прежняя голова с одним числом');
  await p2.close();
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
