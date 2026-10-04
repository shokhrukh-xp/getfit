'use strict';
/* 04.10, его снимок карты тела: «границы мышц сливаются и не разборчивы, и
   текст с числами накладываются друг на друга» («Груды16,5», «19,5Дельты»).
   Стенд прежней проверки (test-ds4) давал только целые 3–12 — дробные «16,5»
   от вспомогательных мышц (×0,5) в нём не возникали, поэтому наложение прошло.
   Здесь — его картина: 14 движений с вспомогательными мышцами, три занятия,
   числа «4,5», «13,5», «18». Заперто:
   1) цифры и названия не пересекаются и не обрезаются краем (320–430, обе темы);
   2) шов между мышцами — цвет фона, 0,2 (≈0,7 px; он дважды просил тоньше);
   3) «норма закрыта» — обводка цветом текста, не бирюзой заливки, и такие
      мышцы рисуются последними (шов соседа не перекрывает обводку). */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

function журнал() {
  const E = [['chest', ['shoulders', 'triceps']], ['lats', ['biceps', 'middle back']], ['quadriceps', ['glutes', 'hamstrings']],
    ['shoulders', ['triceps']], ['abdominals', ['obliques']], ['biceps', ['forearms']], ['triceps', ['forearms']],
    ['lower back', ['glutes']], ['calves', []], ['traps', ['neck']], ['adductors', ['abductors']], ['rear delts', ['middle back']],
    ['hamstrings', ['glutes']], ['tibialis', []]];
  const out = [];
  for (let i = 0; i < 3; i++) {
    const date = M.Д(i);
    out.push({ id: date + '_X', day: 'X', date, name: 'Тест', dur: 60,
      ex: E.map(([m, sm], j) => ({ n: 'Тестовое ' + j, m, sm, sets: [{ w: 20, r: 10 }, { w: 20, r: 10 }, { w: 20, r: 10 + (j % 2) }] })) });
  }
  return out;
}

(async () => {
  const br = await chromium.launch();
  for (const theme of ['dark', 'light']) for (const width of [320, 360, 390, 430]) {
    const tag = theme + '/' + width;
    const p = await br.newPage({ viewport: { width, height: 900 } });
    const ош = await M.поднять(p, { theme, page: 'log', hist: журнал() });
    await p.waitForTimeout(400);
    const r = await p.locator('.bodymap').evaluateAll(svgs => svgs.map(svg => {
      const box = svg.getBoundingClientRect(), texts = [...svg.querySelectorAll('text')], rects = texts.map(x => x.getBoundingClientRect()), bad = [];
      rects.forEach((a, i) => {
        if (a.left < box.left - .5 || a.right > box.right + .5) bad.push('обрезано ' + texts[i].textContent);
        for (let j = i + 1; j < rects.length; j++) { const c = rects[j];
          if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > .5 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > .5) bad.push(texts[i].textContent + ' / ' + texts[j].textContent); }
      });
      const css = getComputedStyle(document.documentElement), zones = [...svg.querySelectorAll('.mz')];
      const rgb = c => { const x = document.createElement('i'); x.style.color = c; document.body.appendChild(x); const v = getComputedStyle(x).color; x.remove(); return v; };
      const фон = rgb(css.getPropertyValue('--map-line').trim() || css.getPropertyValue('--bg').trim()), текст = rgb(css.getPropertyValue('--text').trim());
      const шов = zones.filter(z => !z.classList.contains('hit')).map(z => { const s = getComputedStyle(z); return { w: parseFloat(s.strokeWidth), c: s.stroke, f: s.fill }; });
      const норма = zones.filter(z => z.classList.contains('hit')).map(z => { const s = getComputedStyle(z); return { w: parseFloat(s.strokeWidth), c: s.stroke, f: s.fill }; });
      const порядок = zones.map(z => z.classList.contains('hit') ? 1 : 0);
      return { nums: [...svg.querySelectorAll('.num')].map(t => t.textContent), bad, фон, текст, шов, норма,
        последними: порядок.every((v, i) => !i || v >= порядок[i - 1]) };
    }));
    дано(!ош.length, 'без ошибок JS ' + tag + ' ' + ош.join('|'));
    дано(r.length === 2 && r.some(x => x.nums.some(n => /,\d/.test(n) && n.length >= 4)), 'на стенде есть дробные «13,5» ' + tag + ' ' + JSON.stringify(r.map(x => x.nums)));
    дано(r.every(x => !x.bad.length), 'цифры и названия не накладываются и не обрезаны ' + tag + ' ' + JSON.stringify(r.map(x => x.bad)));
    дано(r.every(x => x.шов.length && x.шов.every(s => s.w >= .18 && s.c === x.фон && s.c !== s.f)), 'шов между мышцами — цвет фона, 0,2 (его «ещё тоньше»), но есть ' + tag + ' ' + JSON.stringify(r.map(x => x.шов[0])));
    дано(r.some(x => x.норма.length) && r.every(x => x.норма.every(s => s.c === x.текст && s.c !== s.f && s.w >= .18)), '«норма закрыта» — обводка цветом текста, не заливки ' + tag + ' ' + JSON.stringify(r.map(x => x.норма[0])));
    дано(r.every(x => x.последними), 'закрывшие норму нарисованы поверх соседей ' + tag);
    дано(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'журнал без переполнения ' + tag);
    await p.close();
  }
  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
