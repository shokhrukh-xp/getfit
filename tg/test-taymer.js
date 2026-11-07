'use strict';
/* Таймер отдыха. 07.11, его слова: «почему здесь пишет „Включить таймер“? Он и так включен, мне нужно наоборот
   выключить». Теперь: после каждого подхода по умолчанию; кнопка «Выключить таймер до конца тренировки»; вернуть —
   «включить таймер» у упражнения. (Было 24.09: показ один раз и «включить на всю тренировку».) */
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
  /* 1. по умолчанию — после каждого подхода, кнопка выключает */
  let page = await вЗал(br);
  await подход(page);
  дано(await виден(page), 'после подхода таймер появился');
  дано(await режим(page) === 'Выключить таймер до конца тренировки', 'кнопка — «Выключить таймер до конца тренировки»');
  await page.click('#tskip'); await page.waitForTimeout(300);
  await подход(page);
  дано(await виден(page), 'и после второго подхода — по умолчанию включён');
  /* 2. выключил — сразу убрался и не всплывает; у упражнения «включить таймер» */
  await page.click('#tmode'); await page.waitForTimeout(300);
  дано(!(await виден(page)), '«Выключить» — таймер сразу убрался');
  await подход(page);
  дано(!(await виден(page)), 'и больше не всплывает');
  дано(await page.locator('[data-tmron]').first().isVisible(), 'у упражнения — «включить таймер»');
  /* 3. включил обратно — снова после подхода */
  await page.locator('[data-tmron]').first().click(); await page.waitForTimeout(300);
  const ещё = await page.$('.settbl .setrow:not(.done) .ok');
  if (ещё) { await ещё.click(); await page.waitForTimeout(700); дано(await виден(page), 'включил у упражнения — таймер снова после подхода'); }
  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
