'use strict';
/* 07.11, его слова: «он мне собирал программу на 2 дня, но там нет ни одного суперсета». Пары были, но в превью стояли
   одной цифрой перед названием. Теперь — рамка «Суперсет N · без отдыха между ними» вокруг двух строк (А и Б) и строка
   над днём «N суперсета — пары без отдыха между упражнениями»; в листе сборки — «Суперсеты: когда нужно / побольше / без них». */
const { chromium } = require('playwright'); const M = require('./mock'); const fs = require('fs'), path = require('path');
let плохо = 0; const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const PROG = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'prog-3dnya.json'), 'utf8'));
const д0 = PROG.days[0].ex; д0[3].ss = 1; д0[4].ss = 1; д0[5].ss = 2; д0[6].ss = 2;
const онб = b => ({ ok: true, prog: PROG, wt: 'down', gym: 'muscle', goal: 'lose_muscle', goalObj: null, ask: null, options: [], left: 0, hint: '', likes: [], dislikes: [], sports: null });
(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 390, height: 900 } });
  const ош = await M.поднять(p, { theme: 'light', newbie: true, wait: 2500, onOnboard: онб });
  await M.шаги(p, {}); await p.click('#wz-go'); await p.waitForSelector('.aitabs button', { timeout: 8000 }).catch(() => {});
  дано(ош.length === 0, 'без ошибок ' + (ош[0] || ''));
  const рамки = await p.$$eval('.aiprev .aissg', gs => gs.map(g => ({ h: g.querySelector('.aissh').textContent.replace(/\s+/g, ' '), n: g.querySelectorAll('.aiex').length,
    tags: [...g.querySelectorAll('.sstag')].map(t => t.textContent).join('') })));
  дано(рамки.length === 2 && рамки.every(r => r.n === 2), 'две рамки по две строки: ' + JSON.stringify(рамки));
  дано(/Суперсет 1/.test((рамки[0] || {}).h) && /без отдыха между ними/i.test((рамки[0] || {}).h) && (рамки[0] || {}).tags === 'АБ', 'заголовок рамки и метки А/Б: ' + JSON.stringify(рамки[0]));
  дано(/2 суперсета — пары без отдыха между упражнениями/.test(await p.textContent('.aiprev .aissn')), 'строка над днём');
  дано((await p.$$eval('.aiprev .aiex', rs => rs.length)) === 7, 'все 7 упражнений на месте');
  if (process.env.SHOT) { await p.evaluate(() => document.querySelector('.aiprev .aissg').scrollIntoView({ block: 'center' })); await p.screenshot({ path: process.env.SHOT }); }
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
