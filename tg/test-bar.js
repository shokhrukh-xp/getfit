'use strict';
/* Панель записи еды на главной. 11.09 он прикрепил фото и не понял,
   прикрепилось ли: миниатюра и кнопка отправки жили выше по странице, а он
   смотрел вниз — на кнопку, которую нажал. Проверяем, что всё состояние
   записи видно В САМОЙ панели и что панель не уезжает за экран. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 844 } });
  const ош = await M.поднять(page, { theme: 'dark' });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* 1. покой — один-единственный вид панели */
  дано(await page.isVisible('#hphoto'), 'кнопка съёмки на месте');
  дано(await page.isVisible('#htext'), 'поле ввода видно сразу, без переключения');
  дано(await page.isVisible('#hsend'), 'кнопка отправки на месте');
  дано(await page.$('#htog') === null, 'переключателя «текстом» больше нет — вид один');
  дано(/ужин/.test(await page.getAttribute('#htext', 'placeholder') || ''), 'приём назван в подсказке поля');
  дано(await page.$('#homebody .attbox') === null, 'миниатюры в потоке страницы больше нет');
  дано(await page.$('#homebody > .freply') === null, 'ответа в потоке страницы больше нет');

  /* 2. фото прикреплено — это видно в панели */
  await page.setInputFiles('#hfile', 'tg/fixtures/c.jpg');
  await page.waitForSelector('.hbar.hcard .hcth', { timeout: 5000 });
  дано(await page.isVisible('.hbar.hcard .hcth'), 'миниатюра прикреплённого фото — в панели');
  дано(/прикреплено/.test(await page.textContent('#hbar')), 'панель говорит, что фото прикреплено');
  дано(await page.isVisible('#htext'), 'поле подписи открыто');
  дано(/Записать/.test(await page.textContent('#hsend')), 'кнопка отправки называет действие');

  const п = await page.$eval('#hbar', e => e.getBoundingClientRect().toJSON());
  const в = await page.$eval('.tabs, #tabs, nav', e => e.getBoundingClientRect().toJSON()).catch(() => null);
  дано(п.top >= 0 && п.bottom <= 844, 'панель целиком в кадре');
  if (в) дано(п.bottom <= в.top + 1, 'панель над вкладками');

  /* 3. крестик убирает фото */
  await page.click('#hbar [data-att]');
  await page.waitForTimeout(200);
  дано(await page.$('.hbar.hcard') === null, 'после ✕ панель вернулась к обычному виду');
  дано(await page.isVisible('#hphoto') && await page.isVisible('#htext'), 'камера и поле на месте');

  /* 4. отправка: ожидание с миниатюрой, потом ответ */
  await page.setInputFiles('#hfile', 'tg/fixtures/c.jpg');
  await page.waitForSelector('.hbar.hcard .hcth');
  await page.route('**/food', async route => {
    await new Promise(r => setTimeout(r, 1200));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ok: true, reply: 'Записал: плов, 650 ккал.', day: M.день({}) }) });
  });
  await page.click('#hsend');
  await page.waitForTimeout(400);
  const ждём = await page.textContent('#hbar');
  дано(/считаю/i.test(ждём), 'пока считает — это написано в панели');
  дано(await page.isVisible('.hbar.hcard .hcth'), 'миниатюра ушедшего фото видна в ожидании');
  дано(await page.$('#hbar .hcx') === null, 'в ожидании крестика нет — отменять уже нечего');

  await page.waitForSelector('#hclose', { timeout: 6000 });
  дано(/Записал/.test(await page.textContent('#hbar')), 'ответ тренера пришёл в панель');
  await page.click('#hclose');
  await page.waitForTimeout(200);
  дано(await page.isVisible('#hphoto') && await page.isVisible('#htext'),
    'после ✕ панель снова готова к следующему приёму');

  /* 5. запись словами без фото */
  await page.fill('#htext', 'плов');
  await page.click('#hsend');
  await page.waitForTimeout(500);
  дано(/считаю|Записал/i.test(await page.textContent('#hbar')), 'текст уходит той же кнопкой «→»');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
