'use strict';
/* 21.10: снимки карточки «Тело» с целями (вес, жир, мышцы, талия), «Зал»
   без лишнего текста и 🔥 серии у профиля. Папка — аргумент или /tmp/tsel. */
const { chromium } = require('playwright');
const M = require('./mock');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || '/tmp/tsel'; fs.mkdirSync(OUT, { recursive: true });
const цель = { text: '75 кг к концу января', wt: 'down', rate: -0.67, from: M.Д(50), w0: 92.3, by: '2027-02-10', kg: 17.3 };
const progress = { anchor: M.Д(19), anchorW: 88.3, rate: -0.67, w0: 92.3, kg: 17.3, gap: 0.7,
  verdict: { state: 'медленнее', d0: -0.3 }, eta: { pace: -0.5, weeks: 22, date: '2027-03-20' },
  sila: { verdict: 'растёт', up: 2, flat: 1, down: 0, rows: [], text: '', index: { base: M.Д(28), now: 103.4, ch: 3.4, enough: true, weeks: [] } } };
const meas = Array.from({ length: 56 }, (_, i) => { const w = 86.6 + i * 0.1, fat = 26.4 + i * 0.03; return { date: M.Д(i), w: +w.toFixed(1), fat: +fat.toFixed(1), fatkg: +(w * fat / 100).toFixed(1), muscle: +(60.2 + (i > 40 ? 0.6 : 0)).toFixed(1), prot: 16, waist: i % 7 === 0 ? +(92 + i * 0.1).toFixed(1) : undefined }; });
(async () => {
  const br = await chromium.launch();
  for (const тема of ['dark', 'light']) {
    const page = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    const ош = await M.поднять(page, { theme: тема, page: 'home', time: '19:40', goal: цель, progress, meas, me: { sex: 'm', age: 34, ht: 178, bw: 86.2 } });
    if (ош.length) console.log('ошибки:', ош);
    await page.screenshot({ path: path.join(OUT, тема + '-top.png') });
    for (const v of ['w', 'fat', 'mus', 'waist']) {
      const b = page.locator('[data-vzv="' + v + '"]'); if (!(await b.count())) { console.log('нет вкладки', v); continue; }
      await b.click(); await page.waitForTimeout(250);
      await page.locator('#homebody .vz').screenshot({ path: path.join(OUT, тема + '-' + v + '.png') });
    }
    await page.locator('[data-vzv="fat"]').click(); await page.waitForTimeout(200);
    const зал = page.locator('#homebody .zk'); if (await зал.count()) await зал.screenshot({ path: path.join(OUT, тема + '-zal.png') });
    
    await page.close();
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
