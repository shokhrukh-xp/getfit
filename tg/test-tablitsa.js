'use strict';
/* ── СТРОКА ТОГО, КТО ТОЛЬКО ПРИШЁЛ ───────────────────────────────────
   19.09. Человек, которого позвали час назад, вставал в таблицу пустой
   строкой с номером места — и это читалось как проигрыш, хотя он ещё не
   играл. Место даётся за записи: пока их нет, вместо номера прочерк, а
   вместо пустоты сказано, что записей пока нет.
   21.09 взгляд «Неделя» убран по его просьбе («ниже не нужно делить на
   Сегодня и Неделя»): таблица всегда за сегодня, балл недели стоит под
   именем. Проверяем одну таблицу и то, что переключателя больше нет. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

async function рейтинг(page) {
  const f = await page.$('.l1 button[data-page="food"]');
  if (f) { await f.click(); await page.waitForTimeout(600); }
  for (const кн of await page.$$('.zseg button'))
    if ((await кн.textContent()).trim() === 'Рейтинг' && await кн.isVisible()) { await кн.click(); break; }
  await page.waitForTimeout(1400);
}
const строки = page => page.$$eval('.lbrow', rs => rs.map(r => ({
  кто: (r.querySelector('.who b') || {}).textContent || '',
  место: (r.querySelector('.pos') || {}).textContent || '',
  под: (r.querySelector('.who i') || {}).textContent || '',
  балл: (r.querySelector('.sc') || {}).textContent || ''
})));

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));

  const к = M.круг();
  к.circles[0].n = 3;
  к.board.push({ uid: '777000222', name: 'Новенький', me: false, days: ['', '', '', '', '', '', ''],
    avg: null, ravg: null, pts: 0, closed: 0, today: null, streak: 0, level: 3 });
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, circle: к });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await рейтинг(page);

  let сп = await строки(page);
  дано(сп.length === 3, 'в таблице все трое, новичка не прячем: ' + сп.length);
  let нов = сп.filter(r => /Новенький/.test(r.кто))[0];
  дано(!!нов, 'новичок в таблице есть');
  if (нов) {
    дано(нов.место === '—', 'место ему не даётся, пока нет записей: «' + нов.место + '»');
    дано(/пока без записей/i.test(нов.под), 'и строка объясняет пустоту: ' + нов.под);
    дано(сп[сп.length - 1].кто === нов.кто, 'стоит последним, а не вклинивается в середину');
  }
  дано(сп.filter(r => /Ты|жена/.test(r.кто)).every(r => /^[0-9]+$/.test(r.место)),
    'у тех, кто пишет, места обычные: ' + сп.map(r => r.место).join(' '));

  /* с 21.09 таблица одна — за сегодня; переключателя «Сегодня / Неделя» нет */
  дано(!(await page.$('[data-lbmode]')), 'переключателя «Сегодня / Неделя» нет — таблица одна');

  await page.close();
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
