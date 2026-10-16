'use strict';
/* Снимок карточки упражнения с «Заменить» и раскрытой шторкой (16.10). */
const { chromium } = require('playwright');
const M = require('./mock');
(async () => {
  const br = await chromium.launch();
  for (const тема of ['dark', 'light']) {
    const page = await br.newPage({ viewport: { width: 375, height: 860 } });
    await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    await M.поднять(page, { theme: тема, page: 'gym', wait: 2800 });
    if (!(await page.$('.card.exact .exfoot'))) { const r = await page.$('#list .exrow'); if (r) { await r.click(); await page.waitForTimeout(700); } }
    await page.click('.card.exact [data-nope]'); await page.waitForTimeout(400);
    const box = await page.$eval('.card.exact', c => { const b = c.getBoundingClientRect(); return { y: b.top + window.scrollY, h: b.height }; });
    await page.screenshot({ path: '/tmp/gf-zamenit-' + тема + '.png', fullPage: true, clip: { x: 0, y: Math.max(0, box.y + box.h - 330), width: 375, height: 340 } });
    await page.close();
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
