'use strict';
/* ── СВОИ ПАРЫ ПЕРЕЖИВАЮТ ТОЛЬКО ТО, ЧТО НЕ ПОМЕНЯЛОСЬ ──────────────────
   24.09. Свой суперсет хранится ключами строк («A2:0» + «A2:1»), как и все
   ручные правки дня. Когда тренер пересобирает программу, в строке может
   оказаться другое упражнение — и пара молча собрала бы то, чего человек не
   выбирал. Поэтому: пересобранный день теряет свои пары целиком; в других
   днях пара остаётся, только если обе её строки не поменялись. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const у = (id, n, м, п) => ({ id, n, en: n, m: м, q: 'machine', p: п, sets: 3, reps: '8–12', rest: 90, ss: null, why: '' });
const дн = (s, sub, ex) => ({ s, sub, ex });
const БЫЛО = { name: 'Мышцы · 3 дня', note: '', focus: [], days: [
  дн('Низ', 'ноги', [у('e1', 'Присед', 'quads', 'ноги'), у('e2', 'Жим ногами', 'quads', 'ноги'), у('e3', 'Мостик', 'glutes', 'ягодицы')]),
  дн('Верх', 'грудь', [у('e4', 'Жим лёжа', 'chest', 'грудь'), у('e5', 'Жим стоя', 'delts', 'плечи'), у('e6', 'Тяга блока', 'lats', 'спина')]),
  дн('Низ 2', 'ноги', [у('e7', 'Выпады', 'quads', 'ноги'), у('e8', 'Сгибание голеней', 'hams', 'бедро'), у('e9', 'Носки', 'calves', 'икры')]) ] };
/* тренер пересобрал день 3, а в дне 2 заменил вторую строку */
const СТАЛО = { name: 'Мышцы · 3 дня', note: '', focus: [], days: [
  БЫЛО.days[0],
  дн('Верх', 'грудь', [у('e4', 'Жим лёжа', 'chest', 'грудь'), у('f5', 'Разводка', 'chest', 'грудь'), у('e6', 'Тяга блока', 'lats', 'спина')]),
  дн('Руки', 'руки', [у('a1', 'Сгибания', 'biceps', 'бицепс'), у('a2', 'Разгибания', 'triceps', 'трицепс'), у('a3', 'Планка', 'abs', 'корпус')]) ] };
const ПАРЫ = { A1: [{ a: 'A1:0', b: 'A1:2', d: null }], A2: [{ a: 'A2:0', b: 'A2:1', d: null }], A3: [{ a: 'A3:0', b: 'A3:1', d: null }] };

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await page.addInitScript(п => { if (!sessionStorage.getItem('__пары')) { localStorage.setItem('shp_v1_ai_pairs', JSON.stringify(п)); sessionStorage.setItem('__пары', '1'); } }, ПАРЫ);
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, prog: БЫЛО, profile: 'ai', page: 'gym',
    me: { sex: 'm', age: 38, ht: 178, bw: 88.1, goal: 'muscle', wt: 'keep', gym: 'muscle', level: 'mid', place: 'gym', only: 'all', lim: [], eq: [] },
    rebuild: { prog: СТАЛО, at: Date.now(), day: 3, vol: [] } });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(1200);
  const прог = await page.evaluate(() => (JSON.parse(localStorage.getItem('shp_v1_ai_prog') || '{}').days || []).map(d => (d.ex || []).map(x => x.n).join(', ')));
  дано(/Сгибания/.test(прог[2] || ''), 'пересборка применилась: день 3 — ' + (прог[2] || ''));
  const п = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_ai_pairs') || '{}'));
  дано(!п.A3, 'пересобранный день потерял свои пары: ' + JSON.stringify(п.A3 || null));
  дано(!п.A2, 'в дне 2 строка пары поменялась — пара разобрана: ' + JSON.stringify(п.A2 || null));
  дано(п.A1 && п.A1.length === 1, 'в дне 1 обе строки прежние — пара на месте: ' + JSON.stringify(п.A1 || null));
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
