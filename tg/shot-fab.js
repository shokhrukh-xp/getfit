'use strict';
/* Снимки нового входа в разговор: кнопка на главной, открытый разговор,
   кнопка во время отдыха (над полоской таймера) и список упражнений с кадрами. */
const { chromium } = require('playwright');
const M = require('./mock');
const тема = process.argv[2] || 'dark';
const снять = (page, имя) => page.screenshot({ path: `tg/fab-${тема}-${имя}.png` })
  .then(() => console.log('снято', имя));

(async () => {
  const br = await chromium.launch();
  const нов = () => br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  let page = await нов();
  await M.поднять(page, { theme: тема, time: '19:40', hist: M.журнал() });
  await page.waitForTimeout(700);
  await снять(page, '1-glavnaya');
  await page.click('#coachfab'); await page.waitForTimeout(600);
  await снять(page, '2-razgovor');
  await page.close();

  page = await нов();
  await M.поднять(page, { theme: тема, hist: M.журнал() });
  await page.click('.l1 button[data-page="gym"]'); await page.waitForTimeout(600);
  const стр = await page.$('#list .exrow');
  if (стр) { await стр.click(); await page.waitForTimeout(400); }
  const set = await page.$('.exgo');
  if (set) { await set.click(); await page.waitForTimeout(1000); }
  await снять(page, '3-otdyh');
  for (const b of await page.$$('.zseg button'))
    if ((await b.textContent()).trim() === 'Журнал' && await b.isVisible()) { await b.click(); break; }
  await page.waitForTimeout(1400);
  await снять(page, '4-uprazhneniya');
  await page.close();

  await br.close();
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
