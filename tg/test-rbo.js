'use strict';
/* ── ПРЕДЛОЖЕНИЕ ПЕРЕСОБРАТЬ ПРОГРАММУ ПОД ЦЕЛЬ ───────────────────────
   18.09, его слова: «нажимаю "Собрать и показать", но ничего не происходит».
   Кнопка не была мёртвой: сборка запускалась, и строка «Собираю программу…»
   появлялась НИЖЕ карточки, за краем экрана. Сама карточка не менялась ничем
   ни до, ни во время, ни после, а второе нажатие гасилось первой же строкой
   aiBuild (`if(AIBUSY) return`) молча. Кнопка, которая на нажатие не
   отвечает, — сломанная кнопка, даже если под ней всё работает.
   Проверяется поведение, а не атрибут: нажали — кнопка сказала, что собирает;
   собралось — предложение ушло, а программа появилась. Ровно так же пять
   дней жил плюсик на дуге, у которого тест сторожил атрибут. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const у = (id, n, m, p) => ({ id, n, en: n, m, q: 'barbell', p, sets: 3, reps: '8–12', rest: 90, ss: null, why: 'по каталогу' });
const ПРОГ = { name: 'Мышцы · 3 дня', note: 'Три дня.', focus: ['quadriceps'], days: [
  { s: 'Низ', sub: 'ноги', ex: [у('Barbell_Full_Squat', 'Присед', 'quadriceps', 'Приседания'), у('Leg_Press', 'Жим ногами', 'quadriceps', 'Жим'), у('Seated_Leg_Curl', 'Сгибание ног', 'hamstrings', 'Сгибание')] },
  { s: 'Верх', sub: 'грудь', ex: [у('Barbell_Bench_Press_Medium_Grip', 'Жим лёжа', 'chest', 'Жим'), у('Wide-Grip_Lat_Pulldown', 'Тяга сверху', 'lats', 'Тяга')] },
  { s: 'Плечи', sub: 'плечи', ex: [у('Standing_Military_Press', 'Жим стоя', 'shoulders', 'Жим'), у('Side_Lateral_Raise', 'Махи', 'shoulders', 'Махи')] } ] };
const НОВАЯ = JSON.parse(JSON.stringify(ПРОГ));
НОВАЯ.name = 'Сушка · 3 дня';
НОВАЯ.days[0].ex[0] = у('Hack_Squat', 'Гакк-присед', 'quadriceps', 'Приседания');

const КНОПКА = p => p.$$eval('#recobox .rbc .rb button',
  ns => ns.map(n => ({ т: n.textContent.trim(), выкл: n.disabled })));

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, prog: ПРОГ, profile: 'ai', aiDelay: 2500,
    rbo: { stamp: 'g2', why: 'Программа собрана до того, как цель была согласована целиком.', phase: 'дефицит, жир выше 20%' },
    onAi: () => ({ ok: true, prog: НОВАЯ }),
    me: { sex: 'm', age: 38, ht: 178, bw: 88.5, goal: 'fat', wt: 'down', gym: 'muscle', level: 'mid', place: 'gym', only: 'all', lim: [], eq: [] } });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  await page.click('#profbtn');
  await page.waitForTimeout(1200);
  дано(await page.$eval('#profm', e => e.classList.contains('show')).catch(() => false), 'профиль открыт');

  /* ── карточка на месте и зовёт собрать ── */
  let к = await КНОПКА(page);
  дано(к.length === 2, 'в предложении две кнопки: ' + к.map(x => x.т).join(' · '));
  дано(к[0].т === 'Собрать и показать' && !к[0].выкл, 'главная кнопка зовёт собрать и нажимаема');

  /* ── НАЖИМАЕМ. Кнопка обязана ответить сразу, а не молчать ── */
  await page.click('#recobox .rbc [data-rb="go"]');
  await page.waitForTimeout(400);
  к = await КНОПКА(page);
  дано(к.length === 2 && /Собираю/.test(к[0].т), 'нажатие видно на самой кнопке: «' + (к[0] || {}).т + '»');
  дано(к[0].выкл, 'и повторно нажать её нельзя — не молчит, а объясняет');
  const стр = await page.$eval('#aistate', e => ({ видно: !e.hidden, т: e.textContent.trim() })).catch(() => ({}));
  дано(стр.видно && /Собираю программу/.test(стр.т), 'строка состояния тоже говорит: ' + (стр.т || '').slice(0, 40));

  /* ── собралось: предложение уходит, программа появляется ── */
  await page.waitForTimeout(3200);
  дано((await КНОПКА(page)).length === 0, 'после сборки предложение с экрана ушло — решать теперь по программе');
  const прев = await page.$eval('#aibox', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  дано(прев.length > 20, 'а сама программа показана: ' + прев.slice(0, 56));
  дано(/Сушка|Гакк/.test(прев), 'и это именно новая программа, а не прежняя: ' + (прев.match(/Сушка[^·]*/) || ['—'])[0].slice(0, 30));
  дано(await page.$eval('#aistate', e => e.hidden || !e.textContent.trim()).catch(() => false),
    'строка «собираю» погасла — сборка закончилась, и это видно');

  /* ── «Не сейчас» прячет предложение и не ломает экран ── */
  await br.close();
  const br2 = await chromium.launch();
  const p2 = await br2.newPage({ viewport: { width: 390, height: 900 } });
  await p2.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош2 = await M.поднять(p2, { theme: 'dark', wait: 2800, prog: ПРОГ, profile: 'ai',
    rbo: { stamp: 'g2', why: 'Цель поменялась.', phase: 'дефицит' },
    me: { sex: 'm', age: 38, ht: 178, bw: 88.5, goal: 'fat', wt: 'down', gym: 'muscle', level: 'mid', place: 'gym', only: 'all', lim: [], eq: [] } });
  await p2.click('#profbtn'); await p2.waitForTimeout(1200);
  дано((await КНОПКА(p2)).length === 2, 'предложение показано и во втором заходе');
  await p2.click('#recobox .rbc [data-rb="no"]');
  await p2.waitForTimeout(600);
  дано((await КНОПКА(p2)).length === 0, '«Не сейчас» убирает предложение');
  дано(ош2.length === 0, 'и ни одной ошибки JS за весь заход ' + (ош2[0] || ''));

  await br2.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
