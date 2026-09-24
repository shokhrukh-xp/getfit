'use strict';
/* ── КАРТА «В ПРОШЛЫЙ РАЗ» НЕ УПИРАЕТСЯ В ПОТОЛОК ─────────────────────
   16.09, его снимок: красное «Сбой — cloud/last: CloudStorage timeout»
   под зелёным «Сохранено ✓ 15 подходов». Тренировка была в облаке; не
   доехала служебная карта подсказок, потому что доросла до потолка
   значения Telegram (4 КБ). У потолка стояла тихая мясорубка: сначала
   выбрасывалась история подходов, потом удалялись упражнения с начала —
   и подсказки пропадали молча.
   Проверяем то, что ломается тихо: карта режется у источника, режется
   по свежести (а не «с начала»), и остаётся заведомо меньше потолка. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const КЛЮЧ = 'shp_v1_shp_last';

/* сто движений: чем больше номер, тем древнее, у всех история подходов */
const БОЛЬШАЯ = () => {
  const m = {}, д = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  for (let i = 0; i < 100; i++) m['Движение номер ' + i] = { w: 50 + i, r: 10, d: д(i * 3), s: [[50, 10], [55, 10], [60, 10]] };
  return m;
};

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await page.addInitScript(([ключ, карта]) => {
    try { localStorage.setItem(ключ, JSON.stringify(карта)); } catch (e) {}
  }, [КЛЮЧ, БОЛЬШАЯ()]);
  const ош = await M.поднять(page, { theme: 'dark', page: 'gym', wait: 2800 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  const до = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), КЛЮЧ);
  дано(Object.keys(до).length === 100, 'на входе карта из ста движений: ' + Object.keys(до).length);

  /* закрываем упражнение и сохраняем — карта уходит в облако этим же путём */
  const карточки = await page.$$('#list .exrow');
  await карточки[0].click(); await page.waitForTimeout(500);
  const все = await page.$('.card.exact .allb');
  if (все) { await все.click(); await page.waitForTimeout(700); }
  await page.click('#finish');
  await M.ответитьДлительность(page, 45);   /* занятие на стенде — секунды */
  await page.waitForTimeout(2400);

  const после = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), КЛЮЧ);
  const имена = Object.keys(после);
  дано(имена.length <= 80, 'карта подрезана до предела: ' + имена.length + ' из 100');
  const байт = JSON.stringify({ m: после }).length;
  дано(байт < 4000, 'и влезает в значение Telegram с запасом: ' + байт + ' байт из 4096');

  /* режем по свежести, а не «с начала»: древнее уходит, свежее остаётся */
  дано(!!после['Движение номер 0'], 'самое свежее движение осталось');
  дано(!после['Движение номер 99'], 'самое древнее (297 дней назад) выброшено');
  const старее = имена.filter(n => {
    const д = после[n].d; return д && д < new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  });
  дано(старее.length === 0, 'старше четырёх месяцев не осталось ничего: ' + старее.length);

  /* история подходов — только у свежих: она втрое тяжелее самой подсказки */
  const сИсторией = имена.filter(n => после[n].s);
  дано(сИсторией.length > 0 && сИсторией.length < имена.length,
    'история подходов осталась только у недавних: ' + сИсторией.length + ' из ' + имена.length);
  дано(сИсторией.every(n => после[n].d >= new Date(Date.now() - 46 * 864e5).toISOString().slice(0, 10)),
    'и ни у чего старше полутора месяцев её нет');

  /* и главное: под зелёной кнопкой нет красного «Сбой» */
  const кнопка = await page.$eval('#finish', e => e.textContent.trim());
  const нота = await page.$eval('#dbnote', e => ({ т: e.textContent.trim(), к: e.className }));
  дано(/Сохранено/.test(кнопка), 'тренировка сохранена: ' + кнопка);
  дано(!/Сбой/.test(нота.т) && !/bad/.test(нота.к), 'и под ней нет красного «Сбой»: ' + нота.т.slice(0, 60));

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
