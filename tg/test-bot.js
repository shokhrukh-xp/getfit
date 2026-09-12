'use strict';
/* Полоска «бот не подключён». Кто вошёл по коду внутри приложения, а не через
   бота, остаётся без вечернего напоминания, утренней таблицы круга и разбора
   недели: Telegram не даёт боту написать первым. Раньше об этом молчали и
   экран, и бот — человек просто не получал половину приложения. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

(async () => {
  const br = await chromium.launch();

  /* ── бота нет: говорим об этом и даём его открыть ── */
  let page = await br.newPage({ viewport: { width: 390, height: 900 } });
  let ссылка = null;
  await page.exposeFunction('поймал', u => { ссылка = u; });
  await page.addInitScript(() => {
    const ждём = setInterval(() => {
      if (window.Telegram && window.Telegram.WebApp) {
        clearInterval(ждём);
        window.Telegram.WebApp.openTelegramLink = u => window.поймал(u);
      }
    }, 10);
  });
  const ош = await M.поднять(page, { theme: 'dark', time: '19:40', bot: false, wait: 2500 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(800);
  дано(await page.isVisible('#hbot'), 'полоска показана');
  const т = await page.textContent('#hbot');
  дано(/не подключён/.test(т), 'сказано, что бота нет: ' + т.trim().slice(0, 80));
  дано(/напоминания|таблица/.test(т), 'и что из-за этого не приходит');
  await page.click('#hbot');
  await page.waitForTimeout(400);
  дано(/t\.me\/GetFit_MyBot/.test(ссылка || ''), 'нажатие открывает бота: ' + ссылка);
  await page.close();

  /* ── бот есть: полоска про него не лезет ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await M.поднять(page, { theme: 'dark', time: '19:40', bot: true, wait: 2500 });
  await page.waitForTimeout(800);
  const видна = await page.isVisible('#hbot').catch(() => false);
  const т2 = видна ? await page.textContent('#hbot') : '';
  дано(!/не подключён/.test(т2), 'у того, у кого бот есть, полоски про бота нет');
  await page.close();

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
