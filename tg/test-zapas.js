'use strict';
/* Запас недели (17.10, его выбор «сам копится», «тратить не обязательно»).
   Под нормой — «запас недели +N»; перебор в пределах запаса — спокойным
   цветом и «из запаса недели · осталось N»; сверх — красным и «исчерпан».
   Строки внутри дуги и не налезают друг на друга — и вместе с «+~ за зал». */
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
async function открыть(br, ширина, тема, day){
  const page = await br.newPage({ viewport: { width: ширина, height: 844 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: тема, time: '13:10', meas: M.замеры(), day });
  return { page, ош };
}
(async () => {
  const br = await chromium.launch();
  for (const [ширина, тема] of [[390, 'dark'], [360, 'light']]) {
    const { page, ош } = await открыть(br, ширина, тема, { meals: [], kcal: 900, prot: 60, gymPlan: true, targets: ЦЕЛЬ,
      впереди: [{ what: 'зал', kcal: 150 }], запас: { z: 597, накоплено: 1103, взято: 506 } });
    дано(ош.length === 0, ширина + ': страница без ошибок ' + (ош[0] || ''));
    const ц = await центр(page);
    const з = ц.строки.find(с => /hzap/.test(с.cls));
    дано(з && з.t === 'запас недели +597', ширина + ': под нормой — «' + (з && з.t) + '»');
    const вне = ц.строки.filter(с => [[с.b.left, с.b.top], [с.b.right, с.b.top], [с.b.left, с.b.bottom], [с.b.right, с.b.bottom]]
      .some(([x, y]) => Math.hypot(x - ц.cx, y - ц.cy) > ц.R - 2));
    дано(!вне.length, ширина + ': строки внутри дуги ' + JSON.stringify(вне.map(v => v.t)));
    const нал = з && ц.строки.filter(с => с !== з && с.b.bottom > з.b.top + 1 && з.b.bottom > с.b.top + 1);
    дано(нал && !нал.length, ширина + ': строка запаса не налезает на соседние ' + JSON.stringify((нал || []).map(с => с.t)));
    const стат = await page.$eval('.day-status.hnext', e => e.getBoundingClientRect().top);
    дано(з && з.b.bottom <= стат, ширина + ': и не наезжает на строку под дугой');
    await page.screenshot({ path: '/tmp/gf-zapas-' + ширина + '.png', clip: { x: 0, y: 0, width: ширина, height: 560 } });
    await page.close();
  }
  /* перебор 300 при запасе 597 — спокойный цвет, остаток запаса */
  let { page } = await открыть(br, 390, 'dark', { meals: [], kcal: 1900, prot: 120, targets: ЦЕЛЬ, запас: { z: 597, накоплено: 597, взято: 0 } });
  дано((await page.textContent('.hzap')) === 'из запаса недели · осталось 297', 'перебор в пределах запаса — «' + (await page.textContent('.hzap')) + '»');
  дано(!!(await page.$('.hctr b.okover')) && !(await page.$('.hctr b.over')), 'перебор в пределах запаса — не красный');
  await page.screenshot({ path: '/tmp/gf-zapas-pokryt.png', clip: { x: 0, y: 0, width: 390, height: 560 } });
  await page.close();
  /* перебор 800 при запасе 300 — красный, исчерпан */
  ({ page } = await открыть(br, 390, 'dark', { meals: [], kcal: 2400, prot: 120, targets: ЦЕЛЬ, запас: { z: 300, накоплено: 300, взято: 0 } }));
  дано((await page.textContent('.hzap')) === 'запас недели исчерпан', 'сверх запаса — «запас недели исчерпан»');
  дано(!!(await page.$('.hctr b.over')), 'сверх запаса — красный');
  await page.close();
  /* без запаса — строки нет */
  ({ page } = await открыть(br, 390, 'dark', { meals: [], kcal: 900, prot: 60, targets: ЦЕЛЬ }));
  дано(!(await page.$('.hzap')), 'без запаса — строки нет');
  await page.close();
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
