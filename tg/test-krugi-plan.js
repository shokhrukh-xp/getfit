'use strict';
/* ── ПЛАН НА ДУГЕ: ОБЕД И УЖИН ОДИНАКОВЫЕ, ВРЕМЯ РЯДОМ, «СЕЙЧАС» ─────────────
   29.10, его слова: «непонятно, почему один жёлтый с +, а другой белый с
   „ужин“», «может сделать их одного цвета и приписать рекомендованное время
   для обеда, для ужина?» → вариант E с отметкой «сейчас». Оба плановых
   кружка — одного вида, внутри название приёма, под ним «≈ЧЧ:ММ»; нажатие
   на любой ведёт записывать еду; на дуге отмечено текущее время. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const meals = [{ id: 1, t: '08:50', kind: 'завтрак', kcal: 422, prot: 38, img: '/p/a.jpg', text: 'Омлет, творог, кофе' }];
(async () => {
  const br = await chromium.launch();
  for (const тема of ['dark', 'light']) for (const w of [390, 320]) {
    const page = await br.newPage({ viewport: { width: w, height: 900 } });
    const ош = await M.поднять(page, { theme: тема, page: 'home', time: '10:50', day: { meals }, wait: 2400 });
    const где = тема + ' ' + w + ': ';
    дано(ош.length === 0, где + 'без ошибок ' + (ош[0] || ''));
    const r = await page.evaluate(() => {
      const вид = sel => { const g = document.querySelector('.hclk-svg ' + sel); if (!g) return null; const c = g.querySelector('.hbbg'), cs = getComputedStyle(c);
        return { fill: cs.fill, stroke: cs.stroke, dash: cs.strokeDasharray, имя: (g.querySelector('text') || {}).textContent || '', плюс: g.querySelectorAll('path').length, жми: g.hasAttribute('data-hact') }; };
      const плашки = [...document.querySelectorAll('.hclk-svg .hbtime.hbplan text')].map(t => t.textContent);
      const now = document.querySelector('.hclk-svg .hcnow'), nt = document.querySelector('.hclk-svg .hcnowt');
      const svg = document.querySelector('.hclk-svg').getBoundingClientRect();
      const ntr = nt && nt.getBoundingClientRect();
      return { след: вид('.hb-next'), потом: вид('.hb-todo'), плашки, now: !!now, nt: nt ? nt.textContent : '',
        ntВнутри: !ntr || (ntr.left >= svg.left - 1 && ntr.right <= svg.right + 1) };
    });
    дано(r.след && r.след.имя === 'обед' && r.след.плюс === 0, где + 'следующий — кружок «обед», без «+»: ' + JSON.stringify(r.след));
    дано(r.потом && r.потом.имя === 'ужин', где + 'дальше — «ужин»');
    дано(r.след && r.потом && r.след.fill === r.потом.fill && r.след.stroke === r.потом.stroke && r.след.dash === r.потом.dash,
      где + 'оба плановых кружка одного вида');
    дано(r.след && r.след.жми && r.потом.жми, где + 'на любой можно нажать — запись еды');
    дано(r.плашки.length >= 2 && r.плашки.every(t => /^≈\d\d:\d\d/.test(t)), где + 'под ними рекомендованное время: ' + r.плашки.join(' | '));
    дано(r.now, где + 'на дуге отметка «сейчас»');
    дано(r.ntВнутри, где + 'подпись «сейчас» не выходит за дугу');
    await page.close();
  }
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
