'use strict';
/* Одно меню на дату, готовое блюдо и вес покупок (15.10, GF-07/08/09 из
   проверки Codex 13.10). Его выбор для GF-09 — «Одно меню»: «Завтра» при
   неделе — её день, «Другое меню» заменяет его в неделе. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ЗАВТРА = M.Д(-1), ПОСЛЕ = M.Д(-2);
const И = (name, g, kcal, prot) => ({ name, g, kcal, prot, fat: 5, carb: 10 });
const день = (date, приёмы) => ({ date, зал: false, спорт: [], норма: { kcal: 1800, prot: 140 }, kcal: 1700, prot: 130, белокМало: 0, приёмы });
const П1 = { id: 'b1', kind: 'обед', text: 'Плов из столовой', мин: null, готовое: 1, гот: ['Плов с говядиной'], kcal: 520, prot: 20, items: [И('Плов с говядиной', 300, 520, 20)] };
const П2 = { id: 'b2', kind: 'ужин', text: 'Курица с гречкой', мин: 30, kcal: 500, prot: 55, items: [И('Куриная грудка запечённая', 200, 330, 55)] };
const ПОК = { семья: 1, дней: 7, дома: [], пояснение: 'Веса — в магазинном виде: крупы и бобовые сухими.', отделы: [{ отдел: 'Мясо и птица', список: [{ имя: 'Куриная грудка', сколько: '300 г', g: 300 }] }] };
const НЕДЕЛЯ = { ok: true, span: 'week', from: ЗАВТРА, at: Date.now(), note: '', дни: [день(ЗАВТРА, [П1, П2]), день(ПОСЛЕ, [П2])], покупки: ПОК };
const ВИД = { ok: true, span: 'day', from: ЗАВТРА, at: Date.now(), note: '', изНедели: 1, дни: [день(ЗАВТРА, [П1, П2])], покупки: ПОК };
const НОВЫЙ = { id: 'z1016_b1', kind: 'обед', text: 'Рыба с рисом', мин: 25, kcal: 500, prot: 45, items: [И('Треска запечённая', 200, 180, 40)] };
(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const о = { theme: 'dark', wait: 2400, page: 'eat', menu: { завтра: ЗАВТРА, day: ВИД, week: НЕДЕЛЯ },
    onMenu: route => { const б = JSON.parse(route.request().postData() || '{}');
      if (б.span === 'today') return { ok: false, нет: 'нет' };
      о.просили = б;
      const нед = JSON.parse(JSON.stringify(НЕДЕЛЯ)); нед.дни[0].приёмы = [НОВЫЙ, П2];
      return Object.assign({}, ВИД, { дни: [нед.дни[0]], неделя: нед }); } };
  const ош = await M.поднять(page, о);
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.click('#eatbody [data-eseg="day"]'); await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/gf-menu-odno-zavtra.png', fullPage: true });
  дано(await page.isVisible('#mizned'), '«Завтра» при неделе — подписано, что это день из недели');
  const т = (await page.textContent('#eatbody')).replace(/\s+/g, ' ');
  дано(/Готовить не нужно: плов с говядиной — готовое, без рецепта/.test(т), 'готовое блюдо — объяснено, что его покупают: ' + (т.match(/Готовить[^.]*/) || [''])[0]);
  await page.click('#eatbody [data-mgen="day"]'); await page.waitForTimeout(900);
  дано(о.просили && о.просили.span === 'day', '«Другое меню» на завтра попросило сервер');
  await page.click('#eatbody [data-eseg="week"]'); await page.waitForTimeout(400);
  const нт = (await page.textContent('#eatbody')).replace(/\s+/g, ' ');
  дано(/Рыба с рисом/.test(нт) && !/Плов из столовой/.test(нт), 'в неделе на завтра — новый день, а не прежний');
  await page.click('#eatbody [data-eseg="buy"]'); await page.waitForTimeout(400);
  дано(await page.isVisible('#bpoyas'), 'в покупках — «Как посчитан вес»');
  await page.click('#bpoyas summary'); await page.waitForTimeout(150);
  дано(/магазинном виде/.test(await page.textContent('#bpoyas')), 'и само пояснение');
  await page.screenshot({ path: '/tmp/gf-menu-odno-buy.png', fullPage: true });
  const вбок = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  дано(!вбок, 'страница не ездит вбок');
  /* ревью Codex: неделя, собранная вчера, действует, пока в ней есть завтра; отметка покупки — с количеством */
  {
    const p2 = await br.newPage({ viewport: { width: 390, height: 900 } });
    await p2.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    const нед = JSON.parse(JSON.stringify(НЕДЕЛЯ)); нед.from = M.Д(0); нед.дни = [день(M.Д(0), [П2]), день(ЗАВТРА, [П1, П2])];
    const ПОК2 = JSON.parse(JSON.stringify(ПОК)); нед.покупки = ПОК2;
    await p2.addInitScript(k => { try { localStorage.setItem(k, JSON.stringify({ 'Куриная грудка': '100 г' })); } catch (e) {} }, 'shp_v1_buy_week_' + M.Д(0));
    await M.поднять(p2, { theme: 'dark', wait: 2400, page: 'eat', menu: { завтра: ЗАВТРА, day: ВИД, week: нед }, onMenu: () => ({ ok: false, нет: 'нет' }) });
    await p2.click('#eatbody [data-eseg="week"]'); await p2.waitForTimeout(400);
    дано(await p2.$('#eatbody [data-menu-day]') !== null, 'неделя со вчерашнего дня ещё видна, пока в ней есть завтра');
    await p2.click('#eatbody [data-eseg="buy"]'); await p2.waitForTimeout(400);
    дано(/Покупки на неделю/.test(await p2.textContent('#eatbody')), 'покупки — по этой неделе, а не по одному дню');
    const отм = await p2.$eval('#eatbody [data-buy="Куриная грудка"]', b => b.getAttribute('aria-pressed'));
    дано(отм === 'false', 'отметка на «100 г» после пересчёта до «300 г» снята');
    await p2.click('#eatbody [data-buy="Куриная грудка"]'); await p2.waitForTimeout(150);
    дано(await p2.$eval('#eatbody [data-buy="Куриная грудка"]', b => b.getAttribute('aria-pressed')) === 'true', 'новая отметка ставится');
    await p2.close();
  }
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
