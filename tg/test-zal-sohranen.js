'use strict';
/* 07.11, его снимки: в Telegram «Зал 26 из 26», в приложении для iOS «23 из 26» — тренировка сохранена целиком,
   а главная считала черновик сессии на этом устройстве (оставшийся с середины тренировки). Сохранённая сегодня
   запись — правда для всех устройств. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ex = n => ({ n, sets: [{ w: 50, r: 10 }, { w: 50, r: 10 }, { w: 50, r: 8 }] });
const ЗАП = { id: M.TODAY + '_D1', date: M.TODAY, day: 'D1', name: 'День 1', week: 1, updated: new Date().toISOString(),
  ex: [ex('Приседания со штангой'), ex('Жим лёжа'), ex('Тяга блока')] };
(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 390, height: 1000 } });
  await p.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  /* черновик на этом устройстве: отмечено 6 из 9 */
  await p.addInitScript(([k]) => { try {
    const s = { ex: [0, 1, 2].map(i => ({ sets: [{ done: true }, { done: true }, { done: i === 0 }] })) };
    s.ex[2].sets[1].done = false; localStorage.setItem('shp_v1_' + k, JSON.stringify(s)); } catch (e) {} }, ['sess_' + M.TODAY + '_D1']);
  const ош = await M.поднять(p, { theme: 'light', page: 'home', features: ['panel2', 'ui3'], hist: [ЗАП], wait: 2000 });
  дано(ош.length === 0, 'без ошибок ' + (ош[0] || ''));
  const зал = await p.evaluate(() => { const r = [...document.querySelectorAll('.hrow')].find(x => /Зал/.test(x.textContent)); return r ? r.textContent.replace(/\s+/g, ' ') : ''; });
  дано(/9 из 9 подходов/.test(зал), 'сохранено 9 из 9 — главная так и показывает, хотя черновик тут 4 из 9: ' + зал);
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
