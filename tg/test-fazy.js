'use strict';
/* 29.10, фазы программы. Его вопрос: «Если у человека фокус на всё тело, а время может уделять
   только 30 минут, может стоит его программу делить на фазы?» → макет «Фазы программы» →
   «Да, делай»; фаза 6 недель, смена кнопкой.
   Заперто:
     1) выбор «По фазам / Всё понемногу» в листе сборки — только при «всё тело» и нехватке
        подходов (30 мин × 3 = 42 < 80); упор на грудь или 90 минут — выбора нет;
     2) выбор уходит в сборку (phases), превью показывает фазу;
     3) в тренировке — полоса фаз «Фаза 1 из 3 · неделя 2 из 6», растущие группы отмечены;
     4) фаза кончилась — итог по весам растущих мышц, «Ещё 2 недели этой» продлевает,
        «Начать фазу 2» уходит в сборку с cycNext;
     5) обе темы, 320 и 390, ничего не выходит за край. */
const { chromium } = require('playwright'), M = require('./mock'), viewport = require('./viewport-check'), fs = require('fs'), path = require('path');
let плохо = 0; const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const БАЗА = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'prog-3dnya.json'), 'utf8'));
const ВСЕ = [{ k: 'torso', t: 'Спина, грудь' }, { k: 'legs', t: 'Ноги' }, { k: 'arms', t: 'Плечи, руки' }];
const сФазой = (from, i) => Object.assign(JSON.parse(JSON.stringify(БАЗА)), { cyc: { i: i || 0, n: 3, k: ВСЕ[i || 0].k, t: ВСЕ[i || 0].t,
  grow: [['lats', 'chest'], ['quadriceps', 'hamstrings'], ['shoulders', 'biceps', 'triceps']][i || 0], from, weeks: 6, ext: 0, all: ВСЕ } });
const тяга = (дн, w) => ({ id: M.Д(дн) + '_A1', date: M.Д(дн), day: 'A1', name: 'День 1', week: 1, dur: 30, t0: new Date(M.Д(дн) + 'T07:00:00').toISOString(),
  updated: new Date(M.Д(дн) + 'T07:40:00').toISOString(), fin: new Date(M.Д(дн) + 'T07:35:00').toISOString(),
  ex: [{ n: 'Тяга верхнего блока (блок, широкий хват)', id: 'Wide-Grip_Lat_Pulldown', unit: 'reps', sets: [{ w, r: 10 }, { w, r: 10 }] }] });
const лист = async p => { await p.click('#profbtn'); await p.waitForTimeout(400); await p.click('#pq-gym'); await p.click('#progedit'); await p.waitForSelector('#sborm.show'); await p.waitForTimeout(250); };
const жми = async (p, sel) => { await p.locator(sel).click(); await p.waitForTimeout(150); };
const видно = (p, sel) => p.locator(sel).evaluate(e => !e.hidden && e.getBoundingClientRect().height > 0).catch(() => false);
(async () => {
  const b = await chromium.launch(); try {
  for (const theme of ['light', 'dark']) for (const width of [320, 390]) {
    const т = theme + '/' + width + ': ';
    /* 1–3 */
    const o = { theme, page: 'gym', me: { sex: 'm', age: 30, ht: 180, bw: 80, wt: 'keep', gym: 'muscle', place: 'gym', min: 45, focus: [], level: 'mid', only: 'all', med: { at: Date.now(), none: 1 } },
      hist: [тяга(2, 50)], onAi: () => ({ ok: true, prog: сФазой(M.Д(10), 0) }) };
    const p = await b.newPage({ viewport: { width, height: 844 } });
    const ош = await M.поднять(p, o);
    await лист(p);
    await жми(p, '#sb-min button[data-v="30"]');
    дано(await видно(p, '#sb-cycrow'), т + '1) 30 мин, всё тело — выбор фаз виден');
    const мат = (await p.locator('#sb-cycmath').innerText()).replace(/\s+/g, ' ');
    дано(/~\d+/.test(мат) && /~80/.test(мат), т + '1) влезает против нужного: ' + мат);
    дано(await p.locator('#sb-cyc button[data-cyc="on"]').getAttribute('aria-checked') === 'true', т + '1) по умолчанию «По фазам»');
    await жми(p, '#sb-focus button[data-v="chest"]');
    дано(!(await видно(p, '#sb-cycrow')), т + '1) упор на грудь — выбора нет');
    await жми(p, '#sb-focus button[data-v="even"]');
    await жми(p, '#sb-min button[data-v="90"]');
    дано(!(await видно(p, '#sb-cycrow')), т + '1) 90 минут — времени хватает, выбора нет');
    await жми(p, '#sb-min button[data-v="30"]');
    await жми(p, '#sb-cyc button[data-cyc="off"]'); await жми(p, '#sb-cyc button[data-cyc="on"]');
    дано(await p.locator('#sb-cyc button[aria-checked="true"]').getAttribute('data-cyc') === 'on', т + '1) выбор переключается');
    if (process.env.FAZY_SHOT) await p.locator('#sb-cycrow').screenshot({ path: '/tmp/fazy-' + theme + width + '-list.png' });
    let плохие = await viewport(p); дано(!плохие.length, т + '1) лист сборки в рамках ' + JSON.stringify(плохие));
    await p.click('#sb-go'); await p.waitForSelector('#aiapply', { timeout: 8000 }).catch(() => {});
    const тело = (o.aiBodies || []).slice(-1)[0] || {};
    дано(тело.phases === 'on' && !тело.cycNext, т + '2) в сборку ушло phases=on: ' + JSON.stringify({ phases: тело.phases, cycNext: тело.cycNext }));
    дано(/Фаза 1 из 3/i.test(await p.locator('#aibox').innerText()), т + '2) превью показывает фазу');
    await p.click('#aiapply'); await p.waitForTimeout(400);
    await p.click('.l1 [data-page="gym"]'); await p.waitForTimeout(400);
    дано(await видно(p, '#cycbox'), т + '3) карточка фазы в тренировке');
    const кар = (await p.locator('#cycbox').innerText()).replace(/\s+/g, ' ');
    дано(/Фаза 1 из 3 · неделя 2 из 6/i.test(кар), т + '3) «Фаза 1 из 3 · неделя 2 из 6»: ' + кар.slice(0, 80));
    дано(await p.locator('#cycbox .cycseg').count() === 3 && /Ноги/.test(кар) && /Плечи, руки/.test(кар), т + '3) три фазы на полосе');
    const раст = await p.locator('#cycbox .cycrow.g span').allInnerTexts();
    дано(раст.length >= 1 && раст.every(x => x === 'Спина' || x === 'Грудь'), т + '3) растут спина и грудь: ' + раст.join(', '));
    if (process.env.FAZY_SHOT) await p.locator('#cycbox').screenshot({ path: '/tmp/fazy-' + theme + width + '-idet.png' });   /* снимки для глаза: FAZY_SHOT=1 */
    плохие = await viewport(p); дано(!плохие.length, т + '3) карточка в рамках ' + JSON.stringify(плохие));
    дано(!ош.length, т + 'без ошибок страницы ' + ош.join('; '));
    await p.close();
    /* 4) фаза кончилась */
    const o2 = Object.assign({}, o, { hist: [тяга(40, 55), тяга(3, 62.5)], onAi: () => ({ ok: true, prog: сФазой(M.Д(45), 0) }) });
    const q = await b.newPage({ viewport: { width, height: 844 } });
    const ош2 = await M.поднять(q, o2);
    await лист(q); await жми(q, '#sb-min button[data-v="30"]');
    await q.click('#sb-go'); await q.waitForSelector('#aiapply', { timeout: 8000 }).catch(() => {});
    await q.click('#aiapply'); await q.waitForTimeout(400);
    await q.click('.l1 [data-page="gym"]'); await q.waitForTimeout(400);
    const итог = (await q.locator('#cycbox').innerText()).replace(/\s+/g, ' ');
    дано(/Фаза 1 готова/i.test(итог) && /55 → 62,5 кг/.test(итог), т + '4) итог фазы с весами: ' + итог.slice(0, 120));
    дано(/Начать фазу 2/.test(итог) && /Ещё 2 недели этой/.test(итог) && /Ноги/.test(итог), т + '4) кнопки и следующая фаза');
    if (process.env.FAZY_SHOT) await q.locator('#cycbox').screenshot({ path: '/tmp/fazy-' + theme + width + '-itog.png' });
    плохие = await viewport(q); дано(!плохие.length, т + '4) итог в рамках ' + JSON.stringify(плохие));
    await q.click('#cycbox [data-cycgo="ext"]'); await q.waitForTimeout(300);
    дано(/неделя 7 из 8/i.test((await q.locator('#cycbox').innerText()).replace(/\s+/g, ' ')), т + '4) «Ещё 2 недели» — фаза продлена до 8 недель');
    дано(await q.evaluate(() => Object.keys(localStorage).some(k => /ai_prog$/.test(k) && ((JSON.parse(localStorage.getItem(k)) || {}).cyc || {}).ext === 14)), т + '4) продление сохранено');
    дано(!ош2.length, т + 'без ошибок страницы (итог) ' + ош2.join('; '));
    await q.close();
    /* «Начать фазу 2» */
    const o3 = Object.assign({}, o2, { aiBodies: [] });
    const r = await b.newPage({ viewport: { width, height: 844 } });
    await M.поднять(r, o3);
    await лист(r); await жми(r, '#sb-min button[data-v="30"]');
    await r.click('#sb-go'); await r.waitForSelector('#aiapply', { timeout: 8000 }).catch(() => {});
    await r.click('#aiapply'); await r.waitForTimeout(400);
    await r.click('.l1 [data-page="gym"]'); await r.waitForTimeout(400);
    await r.click('#cycbox [data-cycgo="next"]'); await r.waitForTimeout(1500);
    const тело2 = (o3.aiBodies || []).slice(-1)[0] || {};
    дано(тело2.cycNext === 1, т + '4) «Начать фазу 2» — сборка с cycNext');
    await r.close();
  }
  } finally { await b.close(); }
  console.log(плохо ? 'ПРОВАЛОВ: ' + плохо : 'фазы программы: всё ✓'); process.exit(плохо ? 1 : 0);
})();
