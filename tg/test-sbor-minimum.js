'use strict';
/* 07.11, его просьба: в листе сборки — сколько минимум тренировок в неделю нужно при выбранных минутах:
   «всё тело ровно» — для роста всего; упор (руки и плечи) — рост им, остальное держим. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 390, height: 900 } });
  await p.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(p, { theme: 'light', page: 'gym', me: { sex: 'm', age: 34, ht: 178, bw: 88, wt: 'down', gym: 'muscle', place: 'gym', min: 45 }, wait: 1800 });
  дано(ош.length === 0, 'страница без ошибок ' + (ош[0] || ''));
  await p.evaluate(() => document.getElementById('gymrebuild').click()); await p.waitForTimeout(700);
  const текст = () => p.evaluate(() => { const e = document.getElementById('sb-minn'); return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ') : ''; });
  const клик = async (id, v) => { await p.evaluate(([id, v]) => document.querySelector('#' + id + ' button[data-v="' + v + '"]').click(), [id, v]); await p.waitForTimeout(250); };
  if (process.env.SHOT) { await p.evaluate(() => document.getElementById('sb-minn').scrollIntoView({ block: 'center' })); await p.screenshot({ path: process.env.SHOT }); }
  let т = await текст();
  дано(/Рост всего тела/.test(т) && /~72 подхода в неделю/.test(т) && /Минимум 4 тренировки в неделю по 45 минут/.test(т), 'всё тело, 45 минут — минимум 4: ' + т);
  дано(/30 мин — 6/.test(т) && /60 мин — 3/.test(т) && /90 мин — 3/.test(т), 'и для всех вариантов минут: ' + т);
  await клик('sb-min', '30'); т = await текст();
  дано(/Минимум 6 тренировок в неделю по 30 минут/.test(т), '30 минут — минимум 6: ' + т);
  await клик('sb-focus', 'arms'); await клик('sb-focus', 'shoulders'); т = await текст();
  дано(/Рост выбранного, остальное держим/.test(т) && /~54 подхода/.test(т), 'упор руки и плечи — 30 рост + 24 удержание: ' + т);
  /* 07.11: «Суперсеты: когда нужно / побольше / без них» — по умолчанию «когда нужно», подсказка меняется */
  дано(await p.evaluate(() => (document.querySelector('#sb-ss button[aria-pressed="true"]') || {}).dataset?.v) === 'auto', 'суперсеты по умолчанию — когда нужно');
  await клик('sb-ss', 'none');
  дано(/Отдых после каждого подхода/.test(await p.textContent('#sb-ssh')), 'без них — подсказка про отдых');
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
