'use strict';
/* 04.10: аудит UI/UX — снимки всех экранов на подставном сервере, светлая и
   тёмная тема, 390×844 @2x. Неделя — прокрутка к графику, не стрелка
   следующего дня (сегодня она выключена). Ошибка сцены делает прогон красным. Папка — docs/reviews/<дата>-audit/. В git не идут. */
const { chromium } = require('playwright');
const M = require('./mock');
const path = require('path'), fs = require('fs');
const OUT = process.argv[2] || path.join(__dirname, '../../../docs/reviews/2026-10-04-audit');
fs.mkdirSync(OUT, { recursive: true });
const цель = { text: '75 кг к концу января · старт 1 сентября · мышцы и силу сохраняем', wt: 'down', rate: -0.67, from: M.Д(33), w0: 92.3, by: '2027-02-10', kg: 17.3 };
const progress = { anchor: M.Д(19), anchorW: 88.3, rate: -0.67, gap: 0.7, fact: -4.7, plan: -5.4, onTrack: false, sinceFact: -0.7, sincePlan: -1.4,
  verdict: { state: 'стоит', text: 'Неделя без снижения: −0,0 кг по средним (3 замера). Одна такая бывает от соли, воды и гликогена; вторая подряд — плато.' },
  eta: { pace: -0.43, weeks: 29, date: '2027-04-26' },
  sila: { verdict: 'растёт', up: 2, flat: 1, down: 1, rows: [
    { name: 'Жим лёжа', now: { w: 62.5, r: 8, date: M.Д(2) }, was: { w: 60, r: 8, date: M.Д(12) }, pct: 4.2 },
    { name: 'Присед', now: { w: 77.5, r: 6, date: M.Д(1) }, was: { w: 80, r: 6, date: M.Д(10) }, pct: -3.1 },
    { name: 'Тяга штанги', now: { w: 70, r: 10, date: M.Д(3) }, was: { w: 70, r: 10, date: M.Д(11) }, pct: 0 } ] } };
const день = { meals: [
  { id: 1, t: '08:40', kind: 'завтрак', text: 'Творог обезжиренный 200 г, 2 яйца, банан', kcal: 430, prot: 49, fat: 12, carb: 44, img: '/p/a.jpg' },
  { id: 2, t: '13:55', kind: 'обед', text: 'Паровые котлеты, грудка с рисом и овощами', kcal: 544, prot: 59, fat: 14, carb: 52, img: '/p/b.jpg' },
  { id: 3, t: '16:20', kind: 'перекус', text: 'Груша и хурма 230 г', kcal: 141, prot: 1, fat: 0, carb: 34, img: '/p/c.jpg' } ] };
const сцены = [
  { имя: 'home', o: { page: 'home', time: '19:40', day: день, goal: цель, progress, meas: M.замеры(), hist: M.журнал() } },
  { имя: 'home-morning-empty', o: { page: 'home', time: '08:10', day: { meals: [], kcal: 0, prot: 0 }, score: null, goal: цель, progress, meas: M.замеры() } },
  { имя: 'home-nogym', o: { page: 'home', time: '19:40', day: день, goal: цель, progress, meas: M.замеры(), me: { only: 'food', sex: 'm', age: 38, ht: 178, bw: 88.1 } } },
  { имя: 'home-few-measures', o: { page: 'home', time: '19:40', day: день, goal: цель, progress, meas: [M.замеры()[0]] } },
  { имя: 'home-newbie', o: { page: 'home', time: '12:00', newbie: true, day: null, score: null } },
  { имя: 'gym', o: { page: 'gym', time: '18:05', hist: M.журнал(), day: день } },
  { имя: 'food', o: { page: 'food', time: '19:40', day: день, goal: цель, progress, meas: M.замеры() } },
  { имя: 'food-week', fullPage: false, o: { page: 'food', time: '19:40', day: день }, после: async p => { await p.locator('#fweek').scrollIntoViewIfNeeded(); } },
  { имя: 'eat-now', o: { page: 'eat', time: '12:30', day: день } },
  { имя: 'eat-week', o: { page: 'eat', time: '12:30', day: день }, после: async p => { const b = p.locator('#eatbody [data-eseg="week"]'); if (await b.count()) await b.click(); } },
  { имя: 'eat-buy', o: { page: 'eat', time: '12:30', day: день }, после: async p => { const b = p.locator('#eatbody [data-eseg="buy"]'); if (await b.count()) await b.click(); } },
  { имя: 'circle', o: { page: 'circle', time: '19:40', day: день } },
  { имя: 'log', o: { page: 'log', time: '19:40', hist: M.журнал(), day: день } },
  { имя: 'ref', o: { page: 'ref', time: '19:40', day: день } },
  { имя: 'srez', o: { page: 'home', time: '19:40', day: день, meas: M.замеры(), goal: цель, progress, base: M.БАЗА + '?srez=1' } },
  { имя: 'profile', o: { page: 'home', time: '19:40', day: день }, после: async p => { await p.click('#profbtn'); } },
  { имя: 'coach', o: { page: 'home', time: '19:40', day: день }, после: async p => { await p.click('#coachnav'); } },
  { имя: 'meal', o: { page: 'food', time: '19:40', day: день }, после: async p => { const r = p.locator('#p-food [data-mid], #p-food .meal, #p-food .frow, #p-food li').first(); if (await r.count()) await r.click(); } },
  { имя: 'telo-fat', o: { page: 'home', time: '19:40', day: день, goal: цель, progress, meas: M.замеры() }, после: async p => { const b = p.locator('[data-vzv="fat"]'); if (await b.count()) await b.click(); } },
];
(async () => {
  const br = await chromium.launch();
  for (const тема of ['dark', 'light']) {
    for (const с of сцены) {
      const page = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
      try {
        const ош = await M.поднять(page, Object.assign({ theme: тема }, с.o));
        await page.waitForTimeout(600);
        if (с.после) { await с.после(page); await page.waitForTimeout(500); }
        await page.screenshot({ path: path.join(OUT, `${с.имя}-${тема}.png`), fullPage: с.fullPage !== false });
        console.log('снято', с.имя, тема, ош.length ? 'ошибки: ' + ош.slice(0, 1).join(' | ').slice(0, 100) : '');
      } catch (e) { console.log('УПАЛО', с.имя, тема, e.message.slice(0, 120)); process.exitCode=1; }
      await page.close();
    }
  }
  await br.close();
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
