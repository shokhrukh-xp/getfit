'use strict';
/* Коридор у каждой шкалы (27.09). Его вопрос: «тебе не кажется, что у
   каждой линии должен быть зелёный коридор? или ты уверен, что у некоторых
   есть чёткая грань?» Чёткой грани нет ни у одной нормы. Заперто:
   • у всех пяти шкал «Моего дня» — зелёная зона;
   • калории, когда норма — нижняя граница плана, зеленеют от неё, а не от −10 %;
   • белок и клетчатка — коридор от нормы до края; правее — серое, не красное;
     при почках белок — узкий коридор, перебор красный;
   • сахар — зелёное до 5 % калорий, жёлтое до 10 %, выше красное;
   • у старого дня без краёв коридоры всё равно есть (запас на экране);
   • на «Сегодня» у калорий и белка — те же коридоры. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ЧАСТИ = { base: 2280, gym: 260, acts: 0, plan: 0, delta: -740, floor: 1, k: 1, gymMin: 45, gymSets: 20, gymMet: 5, gymTempo: 'плотный' };
const НОРМА = { kcal: 1800, prot: 160, protMax: 195, protCap: false, fat: { min: 55, max: 70 }, fib: 25, fibMax: 40, sug: 45, sugIdeal: 22, parts: ЧАСТИ };
const около = (a, b) => Math.abs(a - b) < 0.25;
async function шкалы(page) {
  return page.$$eval('#fday .fbar', ns => ns.map(n => ({
    имя: n.querySelector('u').innerText.replace(/[▼▲]/g, '').trim(),
    зн: n.querySelector('b').innerText.replace(/\s+/g, ' ').trim(),
    кор: [...n.querySelectorAll('.tr .fcor')].map(e => ({ l: parseFloat(e.style.left), w: parseFloat(e.style.width), c: e.className })),
    кл: (n.querySelector('.tr i') || {}).className || '' })));
}
async function день(br, d, o) {
  const page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, Object.assign({ theme: 'dark', wait: 2400, page: 'food', day: d }, o || {}));
  return { page, ош };
}
(async () => {
  const br = await chromium.launch();

  /* ── его день 27.09: 1167 ккал, белок 78, жир 36, клетчатка 10, сахар 48 ── */
  let { page, ош } = await день(br, { targets: НОРМА, kcal: 1167, prot: 78, fat: 36, fib: 10, sug: 48 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  let ш = await шкалы(page);
  дано(ш.length === 5 && ш.every(x => x.кор.length >= 1), 'у всех пяти шкал — зелёная зона: ' + ш.map(x => x.имя + ':' + x.кор.length).join(', '));
  const [к, б, ж, кл, с] = ш;
  дано(около(к.кор[0].l, 1800 / 2520 * 100) && около(к.кор[0].w, 180 / 2520 * 100),
    'калории: норма — нижняя граница плана, коридор 1800–1980, ниже зелёного нет: ' + JSON.stringify(к.кор[0]));
  дано(б.зн === '78 норма 160–195 г', 'белок подписан коридором: ' + б.зн);
  дано(около(б.кор[0].l, 160 / 224 * 100) && около(б.кор[0].w, 35 / 224 * 100), 'белок: коридор 160–195, норма на 71 %: ' + JSON.stringify(б.кор[0]));
  дано(ж.зн === '36 норма 55–70 г' && ж.кор.length === 1, 'жир — как был: ' + ж.зн);
  дано(кл.зн === '10 норма 25–40 г' && около(кл.кор[0].l, 25 / 44 * 100) && около(кл.кор[0].w, 15 / 44 * 100),
    'клетчатка: коридор 25–40, шкала тянется до 1,1 края: ' + кл.зн + ' ' + JSON.stringify(кл.кор[0]));
  дано(с.зн === '48 до 45 г', 'сахар подписан потолком: ' + с.зн);
  дано(с.кор.length === 2 && /fcor0/.test(с.кор[0].c) && /fmid/.test(с.кор[1].c) && около(с.кор[0].w, 22 / 63 * 100) && около(с.кор[1].l, 22 / 63 * 100),
    'сахар: зелёное до 22 г (5 %), жёлтое до 45 г (10 %): ' + JSON.stringify(с.кор));
  дано(с.кл === 'fb-over', '48 из 45 — красное: ' + с.кл);
  await page.click('#fday .fbar[data-fk="sug"]'); await page.waitForTimeout(300);
  const подпись = await page.$eval('#fday .fbar[data-fk="sug"]', e => e.innerText);
  дано(/до 22 г \(5 % калорий, ориентир ВОЗ\), жёлтое — до 45 г/.test(подпись), 'по нажатию сказано, что значат зоны сахара');
  await page.click('#fday .fbar[data-fk="prot"]'); await page.waitForTimeout(300);
  дано(/Коридор — 160–195 г\. Больше — не ошибка/.test(await page.$eval('#fday .fbar[data-fk="prot"]', e => e.innerText)), 'и у белка — что правее серое, не ошибка');
  await page.click('#fday .fbar[data-fk="kcal"]'); await page.waitForTimeout(300);
  дано(/1800 — нижняя граница плана, ниже неё зелёного нет/.test(await page.$eval('#fday .fbar[data-fk="kcal"]', e => e.innerText)), 'и у калорий — почему коридор от 1800');
  await page.close();

  /* ── перебор нужного: серое, жёлтое, зелёное; норма не на границе ── */
  ({ page } = await день(br, { targets: Object.assign({}, НОРМА, { parts: Object.assign({}, ЧАСТИ, { floor: 0 }) }), kcal: 1850, prot: 210, fat: 60, fib: 45, sug: 30 }));
  ш = await шкалы(page);
  дано(около(ш[0].кор[0].l, 0.9 / 1.4 * 100) && ш[0].кл === 'fb-done', 'норма по цели — коридор ±10 %, 1850 в нём: ' + JSON.stringify(ш[0].кор[0]));
  дано(ш[1].кл === 'fb-more', 'белок 210 при коридоре 160–195 — серое, не красное: ' + ш[1].кл);
  дано(ш[3].кл === 'fb-more', 'клетчатка 45 при 25–40 — серое: ' + ш[3].кл);
  дано(ш[4].кл === 'fb-mid', 'сахар 30 — между 22 и 45 — жёлтое: ' + ш[4].кл);
  await page.close();
  ({ page } = await день(br, { targets: НОРМА, kcal: 1850, prot: 170, fat: 60, fib: 30, sug: 15 }));
  ш = await шкалы(page);
  дано(ш[1].кл === 'fb-done' && ш[3].кл === 'fb-done' && ш[4].кл === 'fb-done', 'в коридоре — зелёное: белок 170, клетчатка 30, сахар 15');
  await page.close();

  /* ── почки: коридор узкий, перебор — красным ── */
  ({ page } = await день(br, { targets: Object.assign({}, НОРМА, { prot: 70, protMax: 75, protCap: true }), kcal: 1500, prot: 90, fat: 50, fib: 20, sug: 10 }));
  ш = await шкалы(page);
  дано(ш[1].зн === '90 норма 70–75 г' && ш[1].кл === 'fb-over', 'почки: белок 90 при 70–75 — красным: ' + ш[1].зн + ' ' + ш[1].кл);
  await page.close();

  /* ── старый день без краёв: коридоры всё равно есть ── */
  ({ page } = await день(br, { targets: { kcal: 2110, prot: 165, fat: { min: 52, max: 78 }, fib: 30, sug: 50 }, kcal: 1030, prot: 67 }));
  ш = await шкалы(page);
  дано(ш.length === 5 && ш.every(x => x.кор.length >= 1), 'норма без краёв (старый день) — коридоры из запаса: ' + ш.map(x => x.зн).join(' | '));
  дано(ш[1].зн === '67 норма 165–205 г' && ш[3].зн === '17 норма 30–50 г', 'белок ×1,25, клетчатка ×1,6: ' + ш[1].зн + ', ' + ш[3].зн);
  await page.close();

  /* ── «Сегодня»: те же коридоры у калорий и белка ── */
  ({ page } = await день(br, { targets: НОРМА, kcal: 1167, prot: 78 }, { page: 'home' }));
  const дор = await page.$$eval('.hrows .hrow', ns => ns.map(n => ({ имя: n.querySelector('u').innerText, кор: [...n.querySelectorAll('.hcor')].map(e => parseFloat(e.style.left)) })));
  const hk = дор.find(x => x.имя === 'Калории'), hb = дор.find(x => x.имя === 'Белок');
  дано(hk && hk.кор.length === 1 && около(hk.кор[0], 1800 / 2520 * 100), '«Сегодня», калории: коридор от нижней границы плана: ' + JSON.stringify(hk));
  дано(hb && hb.кор.length === 1 && около(hb.кор[0], 160 / 224 * 100), '«Сегодня», белок: коридор вместо одной черты: ' + JSON.stringify(hb));
  await page.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
