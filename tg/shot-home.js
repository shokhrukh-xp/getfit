'use strict';
/* Снимки главной в разных днях: обычный вечер, поздняя запись (окно дуги
   раздвигается), пустое утро. Смотрим на обжитой день, а не на макет. */
const { chromium } = require('playwright');
const M = require('./mock');
const тема = process.argv[2] || 'dark';
const сцены = {
  a: { time: '19:40', day: { meals: [
        { id:1, t:'08:40', kind:'завтрак', kcal:420, prot:26, img:'/p/a.jpg' },
        { id:2, t:'13:20', kind:'обед',    kcal:610, prot:41, img:'/p/b.jpg' } ] } },
  b: { time: '23:20', day: { meals: [
        { id:1, t:'08:40', kind:'завтрак', kcal:420, prot:26, img:'/p/a.jpg' },
        { id:2, t:'13:20', kind:'обед',    kcal:610, prot:41, img:'/p/b.jpg' },
        { id:3, t:'20:30', kind:'ужин',    kcal:700, prot:44, img:'/p/c.jpg' },
        { id:4, t:'23:10', kind:'ужин',    kcal:530, prot:12, img:'/p/d.jpg' } ] } },
  e: { time: '08:15', day: { meals: [], kcal:0, prot:0, fat:0, fib:0, sug:0 }, score: null }
};
(async () => {
  const br = await chromium.launch();
  for (const имя of Object.keys(сцены)) {
    const page = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const ош = await M.поднять(page, Object.assign({ theme: тема }, сцены[имя]));
    if (ош.length) console.log('ОШИБКИ', имя, ош.slice(0, 2));
    await page.waitForTimeout(700);
    await page.screenshot({ path: `tg/home-${тема}-${имя}.png` });
    console.log('снято', имя);
    await page.close();
  }
  await br.close();
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
