'use strict';
/* ── КАК ЗАПИСЫВАЕТСЯ УПРАЖНЕНИЕ (07.10) ──────────────────────────────
   Его слова: «в упражнениях на лестнице или дорожке нужно, чтобы был таймер,
   а не подходы с повторениями. Проанализируйте все упражнения и определите,
   у кого что должно быть». Каталог размечен полем lg, выборы кнопками:
   кардио — минуты и «как шло», свой вес — «+кг» по желанию. Заперто:
   1) у каждого способа свои колонки: лестница — секундомер и минуты без «кг»,
      отжимания — «+кг» с подсказкой «свой», резинка — только повторы,
      планка — секундомер и секунды, прогулка фермера — кг и метры, жим — кг и повторы;
   2) в карточке лестницы — «как шло» (средне по умолчанию), один заход «15–20 мин»;
   3) в журнал лестница едет минутами (unit 'min') и с «как шло», жим — reps;
   4) отжимания без веса пишутся без веса;
   5) каталог: все 899 размечены, лестница и дорожки — минуты. */
const { chromium } = require('playwright');
const M = require('./mock');
const fs = require('fs'), path = require('path');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const у = (id, n, en, m, q, p, reps, sets) => ({ id, n, en, m, q, p, sets: sets || 3, reps: reps || '10–12', rest: 60, ss: null, why: '' });
const ПРОГ = { name: 'Проверка записи', note: '', focus: [], days: [
  { s: 'День 1', sub: 'всё подряд', ex: [
    у('Barbell_Bench_Press_-_Medium_Grip', 'Жим лёжа (штанга, средний хват)', 'Barbell Bench Press - Medium Grip', 'chest', 'barbell', 'Грудь', '8–12'),
    у('Pushups', 'Отжимания (классические)', 'Pushups', 'chest', 'body only', 'Грудь', '10–15'),
    у('Band_Pull_Apart', 'Тяга (резинки, резина)', 'Band Pull Apart', 'shoulders', 'bands', 'Плечи', '15–20'),
    у('Plank', 'Планка', 'Plank', 'abdominals', 'body only', 'Пресс', '12–15'),
    у('Farmers_Walk', 'Прогулка фермера (с рукоятками)', "Farmer's Walk", 'forearms', 'other', 'Хват', '8–10'),
    у('Step_Mill', 'Лестница (тренажёр)', 'Step Mill', 'quadriceps', 'machine', 'Кардио', '10–12', 3)] }] };
const МЕ = { sex: 'm', age: 34, ht: 178, bw: 88, goal: 'fat', wt: 'down', gym: 'muscle', level: 'mid', place: 'gym', only: 'all', lim: [], eq: [] };

async function карточка(page, имя) {
  const i = await page.$$eval('#list [data-pickex]', (ns, имя) => { const n = ns.find(x => x.textContent.indexOf(имя) >= 0); return n ? n.dataset.pickex : null; }, имя);
  if (i == null) return null;
  await page.click('#list [data-pickex="' + i + '"]'); await page.waitForTimeout(450);
  return page.evaluate(() => {
    const c = document.querySelector('#list .settbl'); if (!c) return null;
    const box = c.closest('.exbox');
    return { шапка: Array.from(c.querySelectorAll('thead th')).map(x => x.textContent.trim()),
      кг: !!c.querySelector('input[data-f="w"]'), секундомер: !!c.querySelector('.swb'), мм: !!c.querySelector('.swb.mm'),
      подсказкаВеса: (c.querySelector('input[data-f="w"]') || {}).placeholder || '',
      как: Array.from(box.querySelectorAll('.cint button')).map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
      строк: c.querySelectorAll('tbody tr').length };
  });
}
async function свернуть(page){ const sh = await page.$('#list [data-shut]'); if (sh) { await sh.click(); await page.waitForTimeout(250); } }

(async () => {
  /* 5. каталог */
  const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog.json'), 'utf8'));
  const by = {}; cat.ex.forEach(e => by[e.i] = e);
  const cnt = {}; cat.ex.forEach(e => { cnt[e.lg || 'кг×повт'] = (cnt[e.lg || 'кг×повт'] || 0) + 1; });
  дано(cat.ex.length === 899 && Object.keys(cnt).every(k => ['кг×повт', 'r+', 'r', 's', 'ks', 'min', 'km'].includes(k)), 'каталог: 899, способы только известные ' + JSON.stringify(cnt));
  дано(['Step_Mill', 'Stairmaster', 'Walking_Treadmill', 'Jogging_Treadmill', 'Running_Treadmill', 'Elliptical_Trainer', 'Rowing_Stationary', 'Bicycling_Stationary', 'Recumbent_Bike']
    .every(i => by[i] && by[i].lg === 'min'), 'лестница, степпер, дорожки, эллипс, гребля, вело — минуты');
  дано(cat.ex.filter(e => e.tm).every(e => e.lg === 's'), 'все удержания (tm) — секунды');
  дано(cat.ex.filter(e => e.c === 'stretching').every(e => e.lg === 's' || e.lg === 'r'), 'растяжка — секунды или повторы (движением)');
  дано(by.Skating.n === 'Катание на роликах' && /висе/.test(by.Wind_Sprints.n), 'названия исправлены: ролики, подъём коленей в висе');

  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1000 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', page: 'gym', time: '18:20', wait: 2800, prog: ПРОГ, profile: 'ai', hist: [], me: МЕ });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* 1–2. колонки */
  const лест = await карточка(page, 'Лестница');
  дано(лест && !лест.кг && лест.мм && лест.шапка.includes('минуты'), 'лестница: секундомер и минуты, без «кг» ' + JSON.stringify(лест && лест.шапка));
  дано(лест && лест.строк === 1, 'лестница — один заход, а не три подхода (' + (лест && лест.строк) + ')');
  дано(лест && JSON.stringify(лест.как) === JSON.stringify(['легко', 'средне*', 'тяжело']), '«как шло» есть, по умолчанию средне ' + JSON.stringify(лест && лест.как));
  const строкаЛест = await page.$$eval('#list .exrow, #list .exname, #list .card', ns => ns.map(n => n.textContent).join(' | '));
  дано(/15–20 мин/.test(строкаЛест), 'в программе «15–20 мин», а не «10–12»');
  /* тяжело → минуты руками → галочка */
  await page.click('.cint button[data-cint="hard"]'); await page.waitForTimeout(300);
  дано(await page.$eval('.cint button[data-cint="hard"]', b => b.getAttribute('aria-pressed')) === 'true', '«тяжело» выбрано');
  await page.fill('#list .settbl input[data-f="r"]', '25');
  await page.click('#list .settbl .ok'); await page.waitForTimeout(400);
  дано(!(await page.evaluate(() => document.getElementById('timer').classList.contains('show'))), 'после кардио таймер отдыха не всплывает');
  await свернуть(page);

  const отж = await карточка(page, 'Отжимания');
  дано(отж && отж.кг && отж.шапка.includes('+кг') && отж.подсказкаВеса === 'свой' && !отж.секундомер, 'отжимания: «+кг» по желанию, подсказка «свой» ' + JSON.stringify(отж));
  await page.fill('#list .settbl input[data-f="r"]', '15');
  await page.click('#list .settbl .ok'); await page.waitForTimeout(300);
  await свернуть(page);
  const рез = await карточка(page, 'резинки');
  дано(рез && !рез.кг && !рез.секундомер && рез.шапка.includes('повторы'), 'резинка: только повторы ' + JSON.stringify(рез && рез.шапка));
  await свернуть(page);
  const пл = await карточка(page, 'Планка');
  дано(пл && !пл.кг && пл.секундомер && !пл.мм && пл.шапка.includes('секунды'), 'планка: секундомер и секунды ' + JSON.stringify(пл && пл.шапка));
  await свернуть(page);
  const ф = await карточка(page, 'фермера');
  дано(ф && ф.кг && ф.шапка.includes('кг') && ф.шапка.includes('метры') && !ф.секундомер, 'прогулка фермера: кг и метры ' + JSON.stringify(ф && ф.шапка));
  await свернуть(page);
  const жим = await карточка(page, 'Жим лёжа');
  дано(жим && жим.кг && жим.шапка.includes('кг') && жим.шапка.includes('повторы') && !жим.шапка.includes('+кг'), 'жим: кг и повторы ' + JSON.stringify(жим && жим.шапка));
  await page.fill('#list .settbl input[data-f="w"]', '60');
  await page.fill('#list .settbl input[data-f="r"]', '10');
  await page.click('#list .settbl .ok'); await page.waitForTimeout(2200);

  /* 3–4. что уехало в журнал */
  const зап = await page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^tgcs_workouts_/.test(k)) return JSON.parse(localStorage.getItem(k)); } return null; });
  const ex = {}; ((зап && зап.ex) || []).forEach(x => ex[x.id] = x);
  дано(ex.Step_Mill && ex.Step_Mill.unit === 'min' && ex.Step_Mill.int === 'hard' && ex.Step_Mill.sets[0].r === 25 && ex.Step_Mill.sets[0].w == null,
    'лестница в журнале: 25 мин, тяжело ' + JSON.stringify(ex.Step_Mill));
  дано(ex.Pushups && ex.Pushups.unit === 'reps' && ex.Pushups.sets[0].r === 15 && ex.Pushups.sets[0].w == null, 'отжимания без веса — без веса ' + JSON.stringify(ex.Pushups));
  дано(ex['Barbell_Bench_Press_-_Medium_Grip'] && ex['Barbell_Bench_Press_-_Medium_Grip'].unit === 'reps' && ex['Barbell_Bench_Press_-_Medium_Grip'].sets[0].w === 60, 'жим — кг × повторы');
  /* было в свёрнутой строке */
  const лСтрока = await page.$$eval('#list .exrow', ns => (ns.find(n => /Лестница/.test(n.textContent)) || {}).textContent || '');
  дано(/25 мин/.test(лСтрока), 'в строке лестницы «25 мин»: ' + лСтрока.replace(/\s+/g, ' '));
  await br.close();
  if (плохо) { console.log('ПРОВАЛОВ: ' + плохо); process.exitCode = 1; } else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e => { console.error(e); process.exitCode = 1; });
