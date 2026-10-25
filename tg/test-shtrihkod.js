'use strict';
/* Штрихкод (25.10, его выбор «своя база + OFF»). Заперто:
   1) кнопка «Штрихкод» в чате открывает сканер; на фото штрихкода код читается (и встроенным
      распознаванием, и своей копией zxing из vendor/, когда встроенного нет — как на iPhone);
   2) нашёлся продукт — название, числа на 100 г, граммы по умолчанию — порция, сумма
      пересчитывается; «Записать» шлёт штрихкод, граммы и приём; ответ — в чате, шторка закрыта;
   3) не нашёлся — просьба сфотографировать этикетку; фото уходит тренеру со штрихкодом;
   4) снимок без штрихкода — понятная подсказка, ничего не уходит. */
const { chromium } = require('playwright');
const path = require('path');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const КОД = '4780001234562', ФОТО = path.join(__dirname, 'fixtures', 'ean-' + КОД + '.png'), ЕДА = path.join(__dirname, 'fixtures', 'a.jpg');
const ПРОД = { ean: КОД, name: 'Йогурт греческий 2%', brand: 'Nestlé', per: { kcal: 66, prot: 8.5, fat: 2, carb: 3.6 }, serving: 140, src: 'off' };

async function прогон(br, theme, безРодного) {
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  if (безРодного) await page.addInitScript(() => { try { delete window.BarcodeDetector; window.BarcodeDetector = undefined; } catch (e) {} });
  const wasm = []; page.on('request', r => { if (/zxing-reader-3\.1\.3\.wasm$/.test(r.url())) wasm.push(r.url()); });
  let найти = true;
  const o = { theme, wait: 2400, chat: [],
    onBarcode: ean => найти ? { ok: true, found: true, product: ПРОД } : { ok: true, found: false, product: null },
    onBarcodeAdd: b => ({ ok: true, user: 'Штрихкод: Йогурт греческий 2%, ' + b.g + ' г', reply: '**Записал перекус · 99 ккал, белок 12,8 г**\nЙогурт греческий 2% ' + b.g + ' г', ts: Date.now() }),
    onCoach: () => ({ ok: true, reply: 'Записал творожок с этикетки.' }) };
  const ош = await M.поднять(page, o);
  const т = theme + (безРодного ? ', своя копия zxing' : '');
  дано(ош.length === 0, т + ': страница без ошибок ' + (ош[0] || ''));
  await page.click('#coachnav'); await page.waitForTimeout(700);
  дано(await page.isVisible('#cscan'), т + ': в чате есть кнопка «Штрихкод»');
  const кн = await page.$eval('#cscan', b => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  дано(кн.w >= 32 && кн.h >= 32, т + ': кнопка не мельче 32 px');

  /* 4: фото без штрихкода */
  await page.click('#cscan'); await page.waitForTimeout(300);
  дано(await page.isVisible('#scanm'), т + ': открылся сканер');
  await page.setInputFiles('#scanfile', ЕДА); await page.waitForTimeout(3500);
  дано(/Не вижу штрихкод/.test(await page.textContent('#scanhint')), т + ': фото без штрихкода — подсказка снять ближе');
  дано(!(o.barcodeAsked || []).length, т + ': без кода ничего не ушло');

  /* 1–2: нашёлся */
  await page.setInputFiles('#scanfile', ФОТО);
  await page.waitForSelector('#scan-prod:not([hidden])', { timeout: 15000 }).catch(() => {});
  дано((o.barcodeAsked || [])[0] === КОД, т + ': код прочитан с фото: ' + ((o.barcodeAsked || [])[0] || '—'));
  if (безРодного) дано(wasm.length > 0 && wasm.every(u => /\/vendor\//.test(u)), т + ': распознавание — своя копия из vendor/, не с чужого сайта');
  дано(/Йогурт греческий 2%/.test(await page.textContent('#scanname')), т + ': название продукта');
  дано(/На 100 г: 66 ккал · белок 8,5 г · жир 2 г · углеводы 3,6 г/.test(await page.textContent('#scanper')), т + ': числа на 100 г');
  дано(await page.inputValue('#scang') === '140', т + ': граммы по умолчанию — порция с упаковки');
  await page.fill('#scang', '150');
  дано(/150 г — 99 ккал, белок 12,8 г/.test(await page.textContent('#scansum')), т + ': сумма пересчитана: ' + await page.textContent('#scansum'));
  await page.click('#scankind button[data-v="перекус"]');
  await page.screenshot({ path: '/tmp/shtrihkod-' + theme + (безРодного ? '-zx' : '') + '.png' });
  await page.click('#scanadd'); await page.waitForTimeout(600);
  const доб = (o.barcodeAdded || [])[0] || {};
  дано(доб.ean === КОД && доб.g === 150 && доб.kind === 'перекус', т + ': записано: штрихкод, 150 г, перекус');
  дано(!(await page.isVisible('#scanm')), т + ': шторка закрылась');
  дано(/Записал перекус · 99 ккал/.test(await page.textContent('#chatlog')), т + ': ответ в чате');

  /* 3: не нашёлся → фото этикетки тренеру со штрихкодом */
  найти = false;
  await page.click('#cscan'); await page.waitForTimeout(300);
  await page.setInputFiles('#scanfile', ФОТО);
  await page.waitForSelector('#scan-none:not([hidden])', { timeout: 15000 }).catch(() => {});
  дано(/сфотографируйте этикетку/i.test(await page.textContent('#scannonetext')), т + ': не нашёлся — просьба сфотографировать этикетку');
  const [выбор] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null), page.click('#scanlabel')]);
  if (выбор) await выбор.setFiles(ЕДА);
  await page.waitForTimeout(1800);
  await page.click('#csend').catch(() => {}); await page.waitForTimeout(1500);
  const тело = (o.coachBodies || []).slice(-1)[0] || {};
  дано(тело.ean === КОД && !!тело.image, т + ': фото этикетки ушло тренеру со штрихкодом');
  await page.close();
}

(async () => {
  const br = await chromium.launch();
  await прогон(br, 'light', false);
  await прогон(br, 'dark', true);
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  if (плохо) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
