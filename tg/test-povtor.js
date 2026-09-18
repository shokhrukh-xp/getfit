'use strict';
/* ── ОДНО УПРАЖНЕНИЕ — ОДНА СТРОКА В ДНЕ ──────────────────────────────
   18.09, его слова: «на день 2 поставил аж 3 одинаковых упражнения».
   Сгибание ног стояло трижды: раз в самой программе и дважды среди
   добавленных руками. Добавленные живут отдельным слоем и переживают смену
   программы — он дописал движение в СТАРЫЙ день 2, программа сменилась, и то
   же движение оказалось в ней самой. Ни сервер, ни экран этого не сверяли:
   сервер чистит повторы внутри своей программы и про добавленные руками
   ничего не знает.
   Здесь проверяется и то, что повтор с экрана ушёл, и то, что честно
   добавленное — то, чего в программе нет, — осталось. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const у = (id, n, m, p) => ({ id, n, en: n, m, q: 'machine', p, sets: 3, reps: '10–12', rest: 90, ss: null, why: 'по каталогу' });
const ПРОГ = { name: 'Мышцы · 2 дня', note: 'Два дня.', focus: ['quadriceps'], days: [
  { s: 'Низ', sub: 'ноги', ex: [
    у('Barbell_Full_Squat', 'Присед (штанга, глубокий)', 'quadriceps', 'Приседания'),
    у('Seated_Leg_Curl', 'Сгибание ног (тренажёр, лёжа)', 'hamstrings', 'Сгибание'),
    у('Standing_Calf_Raises', 'Подъём на носки', 'calves', 'Носки')] },
  { s: 'Верх', sub: 'грудь', ex: [
    у('Barbell_Bench_Press_Medium_Grip', 'Жим лёжа', 'chest', 'Жим'),
    у('Wide-Grip_Lat_Pulldown', 'Тяга сверху', 'lats', 'Тяга')] } ] };

/* его случай: дважды дописанное движение, которое теперь стоит и в программе,
   плюс одно честно добавленное — такого в дне нет, оно обязано остаться */
const СЛОЙ = { extra: { A1: [
  { id: 'x1', n: 'Сгибание ног (тренажёр, лёжа)', e: 'Seated Leg Curl', i: 'Seated_Leg_Curl', m: 'hamstrings', sets: 2, reps: '8–12' },
  { id: 'x2', n: 'Сгибание ног (тренажёр, лёжа)', e: 'Seated Leg Curl', i: 'Seated_Leg_Curl', m: 'hamstrings', sets: 3, reps: '8–12' },
  { id: 'x3', n: 'Подъём ног (в висе)', e: 'Hanging Leg Raise', i: 'Hanging_Leg_Raise', m: 'abdominals', sets: 2, reps: '10–12' } ] } };

const ИМЕНА = p => p.$$eval('#list .exrow .exrn b, #list .card.exact .exname',
  ns => ns.map(n => n.textContent.replace(/^[АБ]/, '').trim()));

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', page: 'gym', wait: 2800, prog: ПРОГ, profile: 'ai', layer: СЛОЙ,
    me: { sex: 'm', age: 38, ht: 178, bw: 88.5, goal: 'muscle', wt: 'keep', gym: 'muscle', level: 'mid', place: 'gym', only: 'all', lim: [], eq: [] } });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  const имена = await ИМЕНА(page);
  console.log('    на экране: ' + имена.join(' · '));

  /* ── ГЛАВНОЕ: ни одного повтора ── */
  const счёт = {}; имена.forEach(n => счёт[n] = (счёт[n] || 0) + 1);
  const повторы = Object.keys(счёт).filter(n => счёт[n] > 1);
  дано(!повторы.length, 'ни одно упражнение не повторяется' + (повторы.length ? ': ' + повторы.map(n => n + ' ×' + счёт[n]).join(', ') : ''));
  дано((счёт['Сгибание ног (тренажёр, лёжа)'] || 0) === 1, 'сгибание ног ровно одно, а не три');

  /* ── но честно добавленное осталось: лечение не должно быть хуже болезни ── */
  дано(имена.some(n => /Подъём ног/.test(n)), 'добавленное руками, чего в программе нет, на месте');
  дано(имена.length === 4, 'в дне четыре строки: три из программы и одна дописанная — ' + имена.length);

  /* ── и лишнее не осталось лежать в памяти телефона ── */
  const вПамяти = await page.evaluate(() => {
    const k = Object.keys(localStorage).filter(x => /_extra$/.test(x))[0];
    const e = k ? JSON.parse(localStorage.getItem(k)) : {};
    return (e.A1 || []).map(x => x.i);
  });
  дано(вПамяти.length === 1 && вПамяти[0] === 'Hanging_Leg_Raise',
    'в памяти остался только честный довесок: ' + вПамяти.join(', '));

  /* ── повтор не возвращается после перезагрузки ── */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  const снова = await ИМЕНА(page);
  дано(снова.filter(n => /Сгибание ног/.test(n)).length === 1, 'после перезапуска повтор не вернулся');

  /* ── день без добавленных не пострадал ── */
  for (const b of await page.$$('.dayseg button')) {
    const t = (await b.textContent()).replace(/\s+/g, ' ');
    if (/День 2/.test(t) && await b.isVisible()) { await b.click(); await page.waitForTimeout(800); break; }
  }
  const д2 = await ИМЕНА(page);
  дано(д2.length === 2 && д2.some(n => /Жим лёжа/.test(n)), 'соседний день цел: ' + д2.join(' · '));

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
