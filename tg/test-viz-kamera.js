'use strict';
/* Камера с контуром (25.10). Его вопрос: «при открытии камеры показать силуэт в который тело
   пользователя должно попасть для правильной фотки». Его выбор: автоснимок, фронтальная камера
   с переключателем, галерея второй кнопкой. Камера на стенде — подставное видео Chromium
   (один кадр JPEG; человек вымышленный, нарисован Gemini). Заперто:
   1) на шаге фото две кнопки — «Снять с контуром» и «Из галереи»;
   2) камера открылась: видео, контур, переключатель камеры, подсказки вместо кнопок фото;
   3) человек целиком в контуре — «Отлично, замрите», зелёный контур, отсчёт 3-2-1, снимок сам:
      ушёл JPEG 3:4, камера выключена, открылся главный вид;
   3б) его выбор «хватит до колен»: кадр от головы до колен, ступней нет — тоже снимок сам;
   4) колени не в кадре — «Отойдите на шаг назад…», отсчёта и снимка нет;
      «Снять сейчас» — снимок без ожидания (дальше обычная проверка фото);
   5) «Отмена» выключает камеру и возвращает кнопки. */
const { chromium } = require('playwright');
const path = require('path');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ФИКС = n => path.join(__dirname, 'fixtures', n);
const МЕ = { sex: 'm', age: 34, ht: 178, bw: 86.1, wt: 'down', goal: 'fat', voice: 'hard', coach_at: 'x' };
const ЦЕЛЬ = { text: '75 кг к 07.03 · 0,6 кг в неделю', wt: 'down', rate: -0.6, from: '2026-10-01', w0: 86.1, by: '2027-03-07', kg: 11.1 };
const РАСЧЁТ = { ok: true, sex: 'm', w0: 86.1, w1: 75, dl: 0, dlMin: -2, dlMax: 2.5, пол: 64, fat0: 24, fat1: 12.8, жирОценка: true, fatKg: 11.1,
  талия0: 100, талияИзмерена: false, талияД: 12.8, талияОт: 9, талияДо: 16.6, талия1: 87.2, отношение: 0.872, срез: [] };
async function открыть(видео){
  const br = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + ФИКС(видео)] });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('shp_v1_trcard_off', '1'); } catch (e) {} });
  const o = { page: 'home', time: '10:00', goal: ЦЕЛЬ, me: МЕ,
    viz: { ok: true, allowed: true, adult: true, consent: true, photo: null, left: 8, steps: [{ k: 'g', t: 'цель 75', w: 75 }], calc: РАСЧЁТ },
    onVizCalc: () => РАСЧЁТ, vizImg: k => k === 'orig' ? ФИКС('viz-0-ishod.jpg') : null };
  const ош = await M.поднять(page, o);
  await page.waitForTimeout(700);
  await page.click('#profbtn'); await page.waitForTimeout(900);
  await page.click('#vizopen'); await page.waitForTimeout(500);
  return { br, page, o, ош };
}
(async () => {
  /* 1–3: человек в контуре */
  { const { br, page, o, ош } = await открыть('viz-kamera-good.mjpeg');
    try {
      дано(ош.length === 0, 'страница без ошибок ' + (ош[0] || ''));
      дано(await page.isVisible('#vizcamgo') && await page.isVisible('#vizpick'), 'две кнопки: «Снять с контуром» и «Из галереи»');
      await page.click('#vizcamgo');
      await page.waitForFunction(() => { const v = document.getElementById('vizvideo'); return v && v.readyState >= 2; }, null, { timeout: 8000 }).catch(() => {});
      дано(await page.isVisible('#vizvideo') && await page.isVisible('.vizghost') && await page.isVisible('#vizflip'), 'камера: видео, контур, переключатель');
      дано(!(await page.isVisible('#vizphotobtns')) && !(await page.isVisible('#vizptips')), 'кнопки и советы на время камеры спрятаны');
      дано(await page.evaluate(() => document.getElementById('vizvideo').classList.contains('mirror')), 'фронтальная — зеркально, как в зеркале');
      await page.waitForSelector('#vizcount:not([hidden])', { timeout: 15000 }).catch(() => {});
      дано(/Отлично, замрите/.test(await page.textContent('#vizcamhint')) && await page.evaluate(() => document.getElementById('vizcam').classList.contains('good')), 'в контуре — «Отлично, замрите», контур зелёный');
      дано(['3', '2'].includes(await page.textContent('#vizcount')), 'идёт отсчёт');
      await page.screenshot({ path: '/tmp/viz-kamera-otschet.png' });
      await page.waitForSelector('#viz-main:not([hidden])', { timeout: 15000 }).catch(() => {});
      const ф = (o.vizAsked || { photo: [] }).photo;
      дано(ф.length === 1 && ф[0].mime === 'image/jpeg' && ф[0].len > 10000, 'снимок сделан сам и ушёл JPEG');
      дано(await page.evaluate(() => !document.getElementById('vizcam').hidden) === false, 'камера закрыта');
      дано(await page.evaluate(() => { const v = document.getElementById('vizvideo'); return !v.srcObject; }), 'поток камеры остановлен');
    } finally { await br.close(); }
  }
  /* 3б: до колен — достаточно */
  { const { br, page, o, ош } = await открыть('viz-kamera-koleni.mjpeg');
    try {
      дано(ош.length === 0, 'страница без ошибок ' + (ош[0] || ''));
      await page.click('#vizcamgo');
      await page.waitForSelector('#vizcount:not([hidden])', { timeout: 15000 }).catch(() => {});
      await page.screenshot({ path: '/tmp/viz-kamera-koleni.png' });
      await page.waitForSelector('#viz-main:not([hidden])', { timeout: 15000 }).catch(() => {});
      дано((o.vizAsked || { photo: [] }).photo.length === 1, 'от головы до колен, без ступней — снимок сделан сам');
    } finally { await br.close(); }
  }
  /* 4–5: колени не в кадре */
  { const { br, page, o, ош } = await открыть('viz-kamera-close.mjpeg');
    try {
      дано(ош.length === 0, 'страница без ошибок ' + (ош[0] || ''));
      await page.click('#vizcamgo'); await page.waitForTimeout(5000);
      дано(/Отойдите на шаг назад — в кадре нужны голова и колени/.test(await page.textContent('#vizcamhint')), 'колени не в кадре — «Отойдите на шаг назад»: ' + await page.textContent('#vizcamhint'));
      дано(await page.isHidden('#vizcount') && !(o.vizAsked && o.vizAsked.photo.length), 'отсчёта и снимка нет');
      await page.screenshot({ path: '/tmp/viz-kamera-otoydite.png' });
      await page.click('#vizflip'); await page.waitForTimeout(1500);
      дано(await page.evaluate(() => !document.getElementById('vizvideo').classList.contains('mirror')), 'переключатель — задняя камера, без зеркала');
      await page.click('#vizcamx'); await page.waitForTimeout(300);
      дано(await page.isHidden('#vizcam') && await page.isVisible('#vizcamgo'), '«Отмена» — камера закрыта, кнопки на месте');
      await page.click('#vizcamgo'); await page.waitForTimeout(2500);
      await page.click('#vizshot');
      await page.waitForFunction(() => /плеч|рост/.test(document.getElementById('vizpmsg').textContent) || !document.getElementById('viz-main').hidden, null, { timeout: 15000 }).catch(() => {});
      дано(await page.isHidden('#vizcam'), '«Снять сейчас» — снимок без ожидания, камера закрыта');
    } finally { await br.close(); }
  }
  console.log(плохо ? 'ПРОВАЛОВ: ' + плохо : 'ВСЁ OK');
  process.exit(плохо ? 1 : 0);
})();
