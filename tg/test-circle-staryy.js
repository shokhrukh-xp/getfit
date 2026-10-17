'use strict';
/* 17.10, рейтинг у Андрея: на телефоне запомнен круг, в котором его больше
   нет. Сервер отвечает 200 и отдаёт первый из его кругов — страница обязана
   показать его, а не «Не удалось загрузить рейтинг» навсегда. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await page.addInitScript(() => { try { localStorage.setItem('shp_v1_circle', JSON.stringify('c_staryy')); } catch (e) {} });
  const просили = [];
  const ош = await M.поднять(page, { theme: 'light', page: 'circle', handleRoute: async r => {
    const u = new URL(r.request().url()); if (u.pathname !== '/circle') return false;
    просили.push(u.searchParams.get('id') || '');
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(M.круг()) }); return true; } });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(800);
  дано(просили[0] === 'c_staryy', 'страница попросила запомненный старый круг: ' + просили[0]);
  const текст = await page.locator('#cirbody').innerText();
  дано(!/Не удалось загрузить рейтинг/.test(текст), 'ошибки нет');
  дано((await page.locator('.lbrow').count()) > 0, 'таблица круга, который отдал сервер, на месте');
  дано(await page.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_circle') || '""')) === 'family', 'и запомнен уже он, а не старый id');
  /* гонка при переключении (просимый круг у человека есть, ответ про другой) — по-прежнему ошибка: test-circle-error */
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
