'use strict';
/* Новая версия — сама (24.09). После каждой выкладки его приходилось
   просить «закрой и открой приложение». Теперь при запуске и при возврате из
   фона приложение само перезагружается на новую версию — но не посреди дела
   (открыт лист, идёт ввод), не по кругу, если Pages ещё отдаёт старую
   страницу, и на тот же экран, где человек был. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ЕДА = [{ id: 11, t: '09:10', kind: 'завтрак', kcal: 602, prot: 37, fat: 38, fib: 4, sug: 5, text: 'Яичница' }];

(async () => {
  const br = await chromium.launch();

  /* 1. на сервере новее: при запуске — одна перезагрузка, дальше не крутится */
  let page = await br.newPage({ viewport: { width: 390, height: 900 } });
  let переходы = 0;
  page.on('framenavigated', f => { if (f === page.mainFrame()) переходы++; });
  await M.поднять(page, { theme: 'dark', page: 'home', srvBuild: '99.99 99:99', wait: 3000 });
  await page.waitForTimeout(2500);
  дано(/[?&]v=99\.99/.test(page.url()), 'при запуске сама перезагрузилась на новую версию: ' + page.url().replace(/^.*\//, '/'));
  дано(переходы === 2, 'ровно одна перезагрузка, а не по кругу (Pages ещё отдаёт старую): переходов ' + переходы);
  дано(await page.evaluate(() => { const b = document.getElementById('newver'); return !!b && !b.hidden; }), 'старая версия осталась — видна полоска «Вышла новая версия»');
  await page.close();

  /* 2. возврат из фона посреди дела — не трогаем; дело закончено — обновляем, на тот же экран */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  const опц = { theme: 'dark', page: 'food', day: { meals: ЕДА }, wait: 2600 };
  await M.поднять(page, опц);
  await page.waitForTimeout(600);
  дано(!/[?&]v=/.test(page.url()), 'версия та же — никаких перезагрузок');
  await page.click('.fmeal[data-mid="11"] .ft'); await page.waitForTimeout(400);
  опц.srvBuild = '99.99 99:99';                                  /* тем временем выложили новую */
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(1500);
  дано(!/[?&]v=/.test(page.url()) && await page.evaluate(() => document.getElementById('mealm').classList.contains('show')),
    'открыт лист приёма — не перезагружает, лист на месте');
  await page.click('#mealclose'); await page.waitForTimeout(300);
  await Promise.all([page.waitForNavigation({ timeout: 5000 }).catch(() => null),
    page.evaluate(() => window.dispatchEvent(new Event('focus')))]);
  await page.waitForTimeout(1500);
  дано(/[?&]v=99\.99/.test(page.url()), 'лист закрыт, вернулся из фона — обновилась сама');
  дано(/[?&]p=food/.test(page.url()) && await page.evaluate(() => !document.getElementById('p-food').classList.contains('hide')),
    'и открылась там же, на «Еде», а не на главной');
  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
