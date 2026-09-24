'use strict';
/* Шаги и сон в «Моём дне» (24.09, этап 3; его выбор — только скриншот тренеру,
   шаги только отслеживаем). Заперто: есть числа — неделя строками шагов и
   сна, зелёное и красное по ориентирам (8 000 шагов, после 60 — 6 000; сон
   от 7 часов); средние и оговорка «к норме не прибавляются»; нет чисел —
   объяснено, откуда они берутся, и кнопка ведёт к тренеру. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const дни = []; for (let i = 6; i >= 0; i--) дни.push({ date: M.Д(i), steps: null, sleep: null });
дни[1].steps = 9200; дни[1].sleep = 440; дни[4].steps = 4100; дни[4].sleep = 350; дни[6].steps = 12500;
const СС = { дни, шагов: 8600, днейШаги: 3, сна: 395, ночей: 2 };
(async () => {
  const br = await chromium.launch();
  let page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2400, page: 'food', week: { шагиСон: СС } });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  дано(!(await page.$eval('#wrg', n => n.hidden)), 'блок «Шаги и сон» виден');
  const ш = await page.$$eval('#wrg .wrrow:nth-child(2) .wrc', ns => ns.map(n => n.textContent + (n.classList.contains('ok') ? '+' : n.classList.contains('lo') ? '-' : '')));
  дано(ш.join(' ') === '· 9,2к+ · · 4,1к- · 13к+', 'шаги по дням: ' + ш.join(' '));
  const с = await page.$$eval('#wrg .wrrow:nth-child(3) .wrc', ns => ns.map(n => n.textContent + (n.classList.contains('ok') ? '+' : n.classList.contains('lo') ? '-' : '')));
  дано(с.join(' ') === '· 7:20+ · · 5:50- · ·', 'сон по дням: ' + с.join(' '));
  const итог = await page.$eval('#wrg .wrsum', n => n.textContent);
  дано(/Шаги в среднем 8 600 в день — ориентир 8 000/.test(итог) && /сон 6 ч 35 мин — нужно от 7 часов/.test(итог), 'средние с ориентирами: ' + итог.slice(0, 90));
  дано(/к норме еды шаги не прибавляются/.test(итог), 'и что к норме они не прибавляются');
  await page.close();
  page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2400, page: 'food' });
  дано(/скриншот/.test(await page.$eval('#wrg .wrnone', n => n.textContent)), 'нет чисел — сказано, что их присылают скриншотом тренеру');
  await page.click('#wrg [data-wrcoach]'); await page.waitForTimeout(500);
  дано(await page.$eval('#coachm', n => n.classList.contains('show')), 'кнопка открывает тренера');
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
