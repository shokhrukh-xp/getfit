'use strict';
/* «Почему вдруг 1600, я же ещё не тренировался?» (16.10, его выбор «давай»).
   Норма по факту, а под ней — на сколько вырастет после зала и спорта по
   плану: «+~150 за зал · +~600 за теннис». Строка внутри дуги и не налезает
   на соседние. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ЦЕЛЬ = { kcal: 1600, prot: 145, fat: { min: 50, max: 70 }, fib: 25, sug: 45,
  parts: { base: 2280, gym: 0, acts: 0, plan: 0, delta: -680, k: 1, gymMin: 0, gymSets: 0 } };
async function центр(page){
  return page.evaluate(() => {
    const svg = document.querySelector('.hclk-svg'), r = svg.getBoundingClientRect(), k = r.width / svg.viewBox.baseVal.width;
    const cx = r.left + 175 * k, cy = r.top + 214 * k, R = 126 * k;
    const строки = Array.from(document.querySelectorAll('.hctr > *')).map(e => { const rg = document.createRange(); rg.selectNodeContents(e);
      return { t: e.textContent, cls: e.className, b: rg.getBoundingClientRect().toJSON() }; });
    return { cx, cy, R, строки };
  });
}
(async () => {
  const br = await chromium.launch();
  for (const [ширина, тема] of [[390, 'dark'], [360, 'light']]) {
    const page = await br.newPage({ viewport: { width: ширина, height: 844 } });
    await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    const ош = await M.поднять(page, { theme: тема, time: '07:10', meas: M.замеры(),
      day: { meals: [], kcal: 0, prot: 0, gymPlan: true, targets: ЦЕЛЬ, впереди: [{ what: 'зал', kcal: 150 }, { what: 'теннис', kcal: 600 }] } });
    дано(ош.length === 0, ширина + ': страница без ошибок ' + (ош[0] || ''));
    const ц = await центр(page);
    const вп = ц.строки.find(с => /hcup/.test(с.cls));
    дано(вп && вп.t === '+~150 за зал · +~600 за теннис', ширина + ': под нормой — «' + (вп && вп.t) + '»');
    дано(ц.строки.some(с => /1\s?600/.test(с.t)), ширина + ': сама норма по факту — 1600');
    const вне = ц.строки.filter(с => [[с.b.left, с.b.top], [с.b.right, с.b.top], [с.b.left, с.b.bottom], [с.b.right, с.b.bottom]]
      .some(([x, y]) => Math.hypot(x - ц.cx, y - ц.cy) > ц.R - 2));
    дано(!вне.length, ширина + ': строки внутри дуги ' + JSON.stringify(вне.map(v => v.t)));
    /* у крупного числа рамка текста выше букв — меряем только новую строку */
    const нал = вп && ц.строки.filter(с => с !== вп && с.b.bottom > вп.b.top + 1 && вп.b.bottom > с.b.top + 1);
    дано(нал && !нал.length, ширина + ': новая строка не налезает на соседние ' + JSON.stringify((нал || []).map(с => [с.t, с.b.top, с.b.bottom, вп.b.top])));
    const стат = await page.$eval('.day-status.hnext', e => e.getBoundingClientRect().top);
    дано(вп && вп.b.bottom <= стат, ширина + ': и не наезжают на строку под дугой');
    await page.screenshot({ path: '/tmp/gf-vperedi-' + ширина + '.png', clip: { x: 0, y: 0, width: ширина, height: 560 } });
    await page.close();
  }
  /* женский род — «за ходьбу»; день отдыха — строки нет */
  let page = await br.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', time: '07:10', day: { meals: [], kcal: 0, prot: 0, targets: ЦЕЛЬ, впереди: [{ what: 'скандинавская ходьба', kcal: 200 }] } });
  дано((await page.textContent('.hcup')) === '+~200 за скандинавскую ходьбу', 'женский род: «за скандинавскую ходьбу»');
  await page.close();
  page = await br.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', time: '07:10', day: { meals: [], kcal: 0, prot: 0, targets: ЦЕЛЬ } });
  дано(!(await page.$('.hcup')), 'день отдыха — строки нет');
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
