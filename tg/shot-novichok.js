'use strict';
/* 06.11, ревью «глазами новичка»: снимки первого запуска шаг за шагом — анкета, цель, расписание,
   программа, первый «Сегодня», «Еда», «Тренировка». Подсказки по месту включены (o.cm), как у живого новичка.
   Запуск: node tg/shot-novichok.js [папка] — снимки 390×844. Не проверка, а материал для разбора. */
const { chromium } = require('playwright'), M = require('./mock'), path = require('path'), fs = require('fs');
const out = process.argv[2] || path.join(__dirname, '..', '..', 'shots-nov');
fs.mkdirSync(out, { recursive: true });
(async () => { const b = await chromium.launch(); try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  let n = 0; const снять = async (имя) => { await p.waitForTimeout(700); await p.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '-' + имя + '.png') }); };
  const ош = await M.поднять(p, { theme: 'dark', newbie: true, wait: 2500, cm: true, features: ['panel2', 'zamer2', 'svob2', 'menu2', 'ui3'] });
  if (ош.length) console.log('ошибки:', ош.join(' | ').slice(0, 300));
  await снять('start');
  await p.click('#wz-only-go'); await снять('posle-rezhima');
  try { await M.цельШаги(p, {}); } catch (e) { console.log('цельШаги:', e.message.slice(0, 200)); }
  await снять('raspisanie');
  try { await p.click('#wz-go'); await p.waitForTimeout(2500); } catch (e) { console.log('wz-go:', e.message.slice(0, 120)); }
  await снять('programma');
  try { await p.click('#wzapply'); await p.waitForTimeout(2000); } catch (e) { console.log('wzapply:', e.message.slice(0, 120)); }
  await снять('posle-programmy');
  for (const [кнопка, имя] of [['[data-page="home"],[data-tab="home"]', 'segodnya'], ['[data-page="food"],[data-tab="food"]', 'eda'], ['[data-page="gym"],[data-tab="gym"]', 'trenirovka']]) {
    try { await p.click(кнопка, { timeout: 3000 }); } catch (e) { console.log(имя + ':', e.message.slice(0, 120)); }
    await снять(имя);
  }
  console.log('снимки:', out);
} finally { await b.close(); } })();
