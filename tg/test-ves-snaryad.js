'use strict';
/* ── ВЕС ПРОШЛОГО РАЗА — ТОЛЬКО С ТОГО ЖЕ СНАРЯДА ──────────────────────
   01.10, его слова: «на некоторые упражнения рекомендует нереальные веса.
   Это упражнение я еле делаю с 15 кг. Откуда он взял 30?» Сгибание на
   бицепс с гантелями на наклонной скамье показывало «прошлый раз · 27.09»,
   «было 30×10, 30×12» и «Оставь 30 кг» — это было сгибание СО ШТАНГОЙ: оба
   попадали в шаблон движения 'curl'. Заперто: гантели не берут вес штанги,
   сгибание запястий — не бицепс; та же штанга по-прежнему видит свой вес. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const у = (id, n, en, m, q, p) => ({ id, n, en, m, q, p, sets: 3, reps: '10–12', rest: 60, ss: null, why: '' });
const ПРОГ = { name: 'Мышцы · 2 дня', note: 'Два дня.', focus: ['biceps'], days: [
  { s: 'Руки Б', sub: 'бицепс гантели', ex: [
    у('Incline_Dumbbell_Curl', 'Сгибание на бицепс (наклон вверх, гантели, обычное)', 'Incline Dumbbell Curl', 'biceps', 'dumbbell', 'Бицепс')] },
  { s: 'Руки А', sub: 'бицепс штанга', ex: [
    у('Barbell_Curl', 'Сгибание на бицепс (штанга, классическое)', 'Barbell Curl', 'biceps', 'barbell', 'Бицепс'),
    у('Seated_Palm-Up_Barbell_Wrist_Curl', 'Сгибание запястий (сидя, штанга)', 'Seated Palm-Up Barbell Wrist Curl', 'forearms', 'barbell', 'Предплечья')] } ] };
/* его 27.09: сгибание со штангой 30 кг; запястья — ни разу */
const ЖУРНАЛ = [{ id: M.Д(4) + '_A2', date: M.Д(4), day: 'A2', name: 'День 2', week: 1, updated: new Date(M.Д(4) + 'T19:10:00').toISOString(),
  ex: [{ n: 'Сгибание на бицепс (штанга, классическое)', id: 'Barbell_Curl', p: 'Бицепс', m: 'biceps', unit: 'reps',
    sets: [{ w: 30, r: 10 }, { w: 30, r: 12 }, { w: 30, r: 12 }] }] }];
const МЕ = { sex: 'm', age: 34, ht: 178, bw: 87.6, goal: 'fat', wt: 'down', gym: 'muscle', level: 'mid', place: 'gym', only: 'all', lim: [], eq: [] };

async function день(page, s) {
  for (const b of await page.$$('.dayseg button')) {
    const t = (await b.textContent()).replace(/\s+/g, ' ');
    if (t.indexOf(s) >= 0 && await b.isVisible()) { await b.click(); await page.waitForTimeout(700); return true; }
  }
  return false;
}
async function карточка(page, имя) {
  const i = await page.$$eval('#list [data-pickex]', (ns, имя) => { const n = ns.find(x => x.textContent.indexOf(имя) >= 0); return n ? n.dataset.pickex : null; }, имя);
  if (i != null) { await page.click('#list [data-pickex="' + i + '"]'); await page.waitForTimeout(500); }
  return page.evaluate(() => {
    const c = document.querySelector('#list .card.exact');
    if (!c) return null;
    return { имя: (c.querySelector('.exname') || {}).textContent || '', было: Array.from(c.querySelectorAll('td.cb')).map(x => x.textContent),
      прошлый: (c.querySelector('.lastline') || {}).textContent || '', текст: c.textContent.replace(/\s+/g, ' '),
      вес: Array.from(c.querySelectorAll('input.cell[data-f="w"]')).map(x => x.value || x.placeholder) };
  });
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1000 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', page: 'gym', wait: 2800, prog: ПРОГ, profile: 'ai', hist: ЖУРНАЛ, me: МЕ });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* 1. гантели на наклонной — веса штанги нет */
  дано(await день(page, 'День 1'), 'открыт день с гантелями');
  let к = await карточка(page, 'наклон вверх, гантели');
  дано(!!к && /гантели/.test(к.имя), 'карточка сгибания с гантелями открыта: ' + (к && к.имя));
  дано(к && к.было.every(x => !/30/.test(x)), '«было» не берёт 30 кг штанги: ' + (к && к.было.join(' | ')));
  дано(к && !/27\.09|прошлый раз/.test(к.прошлый), '«прошлый раз» штанги не показан: «' + (к && к.прошлый) + '»');
  дано(к && !/Оставь 30/.test(к.текст) && к.вес.every(x => !/^30/.test(x)), 'и «оставь 30 кг» нет: ' + (к && к.вес.join(',')));

  /* 2. та же штанга — свой вес на месте */
  дано(await день(page, 'День 2'), 'открыт день со штангой');
  к = await карточка(page, 'штанга, классическое');
  дано(к && к.было[0] === '30×10' && к.было.every(x => /^30×1[02]$/.test(x)), 'у сгибания со штангой «было» — его 30 кг: ' + (к && к.было.join(',')));

  /* 3. запястья — не бицепс */
  к = await карточка(page, 'Сгибание запястий');
  дано(к && к.было.every(x => !/30/.test(x)) && !/Оставь 30/.test(к.текст), 'сгибание запястий не берёт вес бицепса: ' + (к && к.было.join(' | ')));

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
