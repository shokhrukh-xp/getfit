'use strict';
/* Таймер отдыха — по желанию (24.09). Его слова: «я отмечаю по ходу, обычно
   просто игнорирую таймер для отдыха». Выбор: таймер появляется после
   первого подхода тренировки с кнопкой «включить на всю тренировку»; не
   включил — больше не всплывает; включил — после каждого подхода, и там же
   выключается. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const виден = p => p.evaluate(() => document.getElementById('timer').classList.contains('show'));
const режим = p => p.evaluate(() => { const b = document.getElementById('tmode'); return b.hidden ? null : b.textContent; });
async function вЗал(br){
  const page = await br.newPage({ viewport: { width: 390, height: 1000 } });
  await M.поднять(page, { theme: 'dark', time: '18:20', page: 'home', wait: 2400 });
  await page.click('.l1 button[data-page="gym"]'); await page.waitForTimeout(800);
  const стр = await page.$('#list .exrow'); if (стр) { await стр.click(); await page.waitForTimeout(500); }
  return page;
}
const подход = async p => { const b = await p.$('.settbl .setrow:not(.done) .ok'); await b.click(); await p.waitForTimeout(700); };

(async () => {
  const br = await chromium.launch();
  /* 1. не включил — после первого подхода показался и больше не мешает */
  let page = await вЗал(br);
  await подход(page);
  дано(await виден(page), 'после первого подхода тренировки таймер появился');
  дано(await режим(page) === 'Включить таймер на всю тренировку', 'и предлагает включить его на всю тренировку');
  await page.click('#tskip'); await page.waitForTimeout(300);
  await подход(page);
  дано(!(await виден(page)), 'не включил — после второго подхода таймера нет');
  await подход(page);
  дано(!(await виден(page)), 'и после третьего тоже');
  await page.close();

  /* 2. включил — после каждого подхода; выключил — больше нет */
  page = await вЗал(br);
  await подход(page);
  await page.click('#tmode'); await page.waitForTimeout(200);
  дано(await режим(page) === 'Не показывать таймер до конца тренировки', 'включил — кнопка теперь выключает');
  await page.click('#tskip'); await page.waitForTimeout(300);
  await подход(page);
  дано(await виден(page), 'включён — таймер после второго подхода');
  await page.click('#tmode'); await page.waitForTimeout(300);
  дано(!(await виден(page)), '«не показывать» — таймер сразу убрался');
  await подход(page);
  дано(!(await виден(page)), 'и больше не всплывает');
  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
