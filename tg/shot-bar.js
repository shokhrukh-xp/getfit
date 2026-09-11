'use strict';
/* Снимки четырёх состояний панели записи еды: покой → фото прикреплено →
   ждём разбор → ответ. Проверяем ГЛАЗАМИ на обжитом дне, а не на пустом. */
const { chromium } = require('playwright');
const M = require('./mock');
const тема = process.argv[2] || 'dark';

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const err = await M.поднять(page, { theme: тема });
  if (err.length) { console.log('ОШИБКИ НА СТРАНИЦЕ:', err.slice(0, 3)); }

  const снять = async n => { await page.waitForTimeout(500); await page.screenshot({ path: `tg/bar-${тема}-${n}.png` }); console.log('снято', n); };
  await снять('1-pokoy');

  await page.setInputFiles('#hfile', 'tg/fixtures/c.jpg');
  await page.waitForSelector('.hbar.hcard .hcth', { timeout: 5000 });
  await снять('2-prikreplено');

  /* ответ задерживаем, чтобы поймать состояние ожидания */
  await page.route('**/food', async route => {
    await new Promise(r => setTimeout(r, 3500));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ok: true, reply: 'Записал: плов с говядиной, 650 ккал, белка 32 г. До нормы осталось 430 ккал.',
      day: M.день({ meals: [
        { id: 1, t: '08:40', kind: 'завтрак', kcal: 420, prot: 26, img: '/p/a.jpg' },
        { id: 2, t: '13:20', kind: 'обед', kcal: 610, prot: 41, img: '/p/b.jpg' },
        { id: 9, t: '14:03', kind: 'обед', kcal: 650, prot: 32, img: '/p/c.jpg' } ] })
    }) });
  });
  await page.fill('#htext', 'плов с говядиной');
  await page.click('#hsend');
  await page.waitForTimeout(900);
  await снять('3-zhdyom');
  await page.waitForTimeout(3500);
  await снять('4-otvet');

  await br.close();
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
