'use strict';
/* 05.11, единицы по стране (выключатель edinicy). Его решения кнопками: «Тренер + вес и рост»,
   «По стране телефона + в профиле». Хранение — кг и см, пересчёт только при показе и вводе,
   один помощник ЕД. Заперто: (1) без выключателя units='imperial' в анкете ничего не меняет — экран
   байт в байт как с метрикой, строки «Единицы» в профиле нет; (2) с выключателем и imperial — «Тело»,
   карточка замера, профиль и экран цели в lb и ft′in″, ни одного «кг» рядом с весом тела;
   (3) ввод замера в lb уходит на сервер в кг; (4) анкета шлёт region телефона с записью me;
   (5) выбор «кг, см» в профиле пишет me.units/unitsSrc и возвращает метрику;
   (6) дневник еды — в граммах и при imperial. */
const { chromium } = require('playwright'), M = require('./mock');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
const меБаза = { sex: 'm', age: 34, ht: 178, bw: 88.1, med: { at: 1 }, coach_at: 1 };
const текст = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, sel);

(async () => { const b = await chromium.launch(); try {
  const стр = async (o) => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
    const сервер = { me: [] };
    o.handleRoute = async r => {
      const п = new URL(r.request().url()).pathname;
      if (п === '/s' && r.request().method() === 'POST') { const b2 = JSON.parse(r.request().postData() || '{}'); if (b2.key === 'me') сервер.me.push(b2); }
      return false;
    };
    o = Object.assign({ theme: 'dark', page: 'home', time: '08:05', meas: M.замеры() }, o);
    const err = await M.поднять(p, o);
    await p.waitForTimeout(900); return { p, err, сервер, o };
  };
  /* 1. без выключателя — байт в байт как с метрикой, строки «Единицы» нет */
  let эталон;
  { const { p } = await стр({ me: меБаза });
    await p.waitForSelector('#homebody .vz', { timeout: 6000 }).catch(() => {});
    эталон = { тело: await текст(p, '#homebody .vz'), карточка: await текст(p, '#homebody .zm-card') };
    await p.click('#profbtn'); await p.waitForSelector('#profilecontent:not([hidden])', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(300); эталон.профиль = await текст(p, '#mesumt'); эталон.цель = await текст(p, '#goalcard');
    await p.close(); }
  { const { p, err } = await стр({ me: Object.assign({}, меБаза, { units: 'imperial', unitsSrc: 'auto' }) });
    await p.waitForSelector('#homebody .vz', { timeout: 6000 }).catch(() => {});
    ok((await текст(p, '#homebody .vz')) === эталон.тело && (await текст(p, '#homebody .zm-card')) === эталон.карточка, 'без выключателя: «Тело» и карточка замера те же, что с метрикой');
    await p.click('#profbtn'); await p.waitForTimeout(400);
    ok((await текст(p, '#mesumt')) === эталон.профиль && (await текст(p, '#goalcard')) === эталон.цель, 'без выключателя: профиль и карточка цели те же');
    ok(!(await p.locator('#pq-units').isVisible()), 'без выключателя строки «Единицы» в профиле нет');
    ok(/кг/.test(эталон.профиль) && /178 см/.test(эталон.профиль), 'метрика: «… см · … кг» в профиле');
    ok(err.length === 0, 'без ошибок ' + err.slice(0, 1).join(''));
    await p.close(); }
  /* 2–5. с выключателем и imperial */
  { const { p, err, сервер, o } = await стр({ me: Object.assign({}, меБаза, { units: 'imperial', unitsSrc: 'auto' }), features: ['edinicy', 'zamer2'] });
    await p.waitForSelector('#homebody .vz', { timeout: 6000 }).catch(() => {});
    const тело = await текст(p, '#homebody .vz');
    ok(/195,3\s*lb/.test(тело) && /сегодня 194,2/.test(тело) && !/кг/.test(тело), '«Тело»: средний 195,3 lb, сегодня 194,2, «кг» нет: ' + тело.slice(0, 80));
    const карт = await текст(p, '#homebody .zm-card');
    ok(/194,2 lb — записано/.test(карт) && /lb с /.test(карт) && !/кг/.test(карт), 'карточка замера: «194,2 lb — записано», разница в lb: ' + карт);
    /* профиль: сводка, поля, строка «Единицы» */
    await p.click('#profbtn'); await p.waitForTimeout(400);
    const св = await текст(p, '#mesumt');
    ok(/5′10″/.test(св) && /194,2 lb/.test(св) && !/кг|см/.test(св), 'профиль: «5′10″ · 194,2 lb»: ' + св);
    ok(await p.locator('#pq-units').isVisible() && (await p.getAttribute('#pq-units [data-units="imperial"]', 'aria-pressed')) === 'true', 'строка «Единицы», отмечено «lb, ft»');
    await p.click('#meedit'); await p.waitForTimeout(200);
    ok((await p.getAttribute('#me-ht', 'type')) === 'text' && (await p.inputValue('#me-ht')) === '5′10″', 'поле роста — текст «5′10″»');
    ok(/вес, lb/.test(await текст(p, '#me-bwl')) || (await p.evaluate(() => document.getElementById('me-bwl').hidden)), 'подпись веса — «вес, lb» (или поле спрятано: вес из замеров)');
    const цк = await текст(p, '#goalcard');
    ok(!/кг/.test(цк), 'карточка цели без «кг»: ' + цк.slice(0, 100));
    /* рост «6 ft» руками → в анкете 183 см */
    await p.fill('#me-ht', "6'0"); await p.dispatchEvent('#me-ht', 'change'); await p.waitForTimeout(600);
    const me1 = await p.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));
    ok(me1.ht === 183, 'рост «6\'0» → me.ht = 183 см (' + me1.ht + ')');
    ok(сервер.me.some(x => x.region === 'US'), 'запись анкеты несёт region телефона (US)');
    /* экран цели: «Сейчас … lb», степпер веса в lb */
    await p.locator('#goalcard [data-bodygoal]').click();
    await M.цельШаги(p, { до: 'goal' });
    const ц = await текст(p, '#goalconversation');
    ok(/Сейчас: [\d,]+ lb/.test(ц) && /lb\/нед/.test(ц) && !/кг/.test(ц), 'экран цели: «Сейчас … lb», темп в lb/нед, без «кг»: ' + ц.slice(0, 120));
    const w0 = await текст(p, '#gs-w'); await p.click('#goalconversation [data-gs="w"][data-v="-1"]'); await p.waitForTimeout(1500);
    const w1 = await текст(p, '#gs-w');
    /* стенд считает цель серверным кодом без выключателя — округляет к полукилограмму, поэтому 183 → 181,9 (на бою с edinicy — 182) */
    ok(/lb/.test(w0) && /lb/.test(w1) && parseFloat(w0.replace(',', '.')) - parseFloat(w1.replace(',', '.')) > 0.9, 'степпер веса — минус около 1 lb: ' + w0 + ' → ' + w1);
    ok(err.length === 0, 'imperial, профиль и цель: без ошибок ' + err.slice(0, 2).join(' | '));
    await p.close(); }
  /* 3, 5, 6. ввод замера в lb → на сервер в кг; дневник в граммах; «кг, см» в профиле */
  { const { p, err, o } = await стр({ me: Object.assign({}, меБаза, { units: 'imperial', unitsSrc: 'auto' }), features: ['edinicy', 'zamer2'] });
    await p.waitForSelector('#homebody .zm-card', { timeout: 6000 }).catch(() => {});
    await p.evaluate(() => { scrollTo(0, 0); }); await p.click('#homebody .zm-card'); await p.waitForTimeout(400);
    await M.замерВручную(p); await p.waitForTimeout(200);
    ok(/Вес, lb/.test(await текст(p, '#hmeas .fmeasq label:first-of-type')), 'подпись поля замера — «Вес, lb»');
    await p.fill('#fw', '190'); await p.click('#fmsave'); await p.waitForTimeout(800);
    ok(o.замер && Math.abs(o.замер.w - 86.18) < 0.05, 'замер 190 lb ушёл на сервер в кг: ' + JSON.stringify(o.замер));
    await p.waitForTimeout(400);
    ok(/сегодня 190,0/.test(await текст(p, '#homebody .vz')), 'после записи «Тело» показывает сегодня 190,0 (lb): ' + (await текст(p, '#homebody .vz')).slice(0, 120));
    /* дневник еды — граммы */
    await p.evaluate(() => { document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show')); });
    await p.click('#l1 [data-page="food"]').catch(() => {}); await p.waitForTimeout(500);
    const еда = await текст(p, '#p-food');
    ok(/\d+\s*г(?![а-яё])/.test(еда) && !/(^|[^a-z])oz(?![a-z])/.test(еда), 'дневник еды — в граммах, oz нет: ' + еда.slice(0, 80));
    /* «кг, см» в профиле — выбор человека, метрика обратно */
    await p.click('#profbtn'); await p.waitForTimeout(400);
    await p.click('#pq-units [data-units="metric"]'); await p.waitForTimeout(500);
    const me2 = await p.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));
    ok(me2.units === 'metric' && me2.unitsSrc === 'user', 'выбор «кг, см» → me.units=metric, unitsSrc=user');
    ok(/кг/.test(await текст(p, '#mesumt')) && (await p.getAttribute('#pq-units [data-units="metric"]', 'aria-pressed')) === 'true', 'сводка снова в кг, отмечено «кг, см»');
    ok(err.length === 0, 'imperial, замер и единицы: без ошибок ' + err.slice(0, 2).join(' | '));
    await p.close(); }
  /* 7. знакомство: умолчание по региону телефона до ответа сервера — только с выключателем и пустой анкетой */
  for (const [locale, ждём] of [['en-US', 'imperial'], ['ru-UZ', 'metric']]) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale });
    const o = { theme: 'dark', newbie: true, wait: 2500, features: ['edinicy'] };
    const err = await M.поднять(p, o);
    const me0 = await p.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));
    ok(me0.units === ждём && me0.unitsSrc === 'auto', locale + ': новичку единицы по региону телефона — ' + ждём + ' (' + JSON.stringify(me0) + ')');
    await p.click('#wz-only button[data-only="all"]'); await p.click('#wz-only-go'); await M.цельШаги(p, { до: 'me' });
    const имп = ждём === 'imperial', т = await текст(p, '#goalconversation');
    ok(имп ? /Рост, ft′in″/.test(т) && /Вес, lb/.test(т) : /Рост, см/.test(т) && /Вес, кг/.test(т), locale + ': поля знакомства — ' + (имп ? 'ft′in″ и lb' : 'см и кг'));
    if (имп) {
      await p.click('#goalconversation [data-gs="sex"][data-v="m"]');
      await p.fill('#gs-p-age', '34'); await p.fill('#gs-p-ht', "5'10"); await p.fill('#gs-p-bw', '190');
      await p.click('#goalconversation [data-gs="calc"]'); await M.цельШаги(p, { до: 'goal' });
      const ц = await текст(p, '#goalconversation');
      ok(/Сейчас: 190(,0)? lb/.test(ц) && !/кг/.test(ц), 'рост «5\'10» и 190 lb → в анкету 178 см и 86,2 кг, экран цели в lb: ' + ц.slice(0, 60));
      await M.цельШаги(p, {});
      const me1 = await p.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));
      ok(me1.ht === 178 && Math.abs(me1.bw - 86.18) < 0.05 && me1.units === 'imperial', 'после сохранения в анкете — см и кг, единицы остались: ' + JSON.stringify({ ht: me1.ht, bw: me1.bw, units: me1.units }));
    }
    ok(err.length === 0, locale + ': без ошибок ' + err.slice(0, 2).join(' | '));
    await p.close();
  }
  /* без выключателя новичку ничего не ставится */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
    await M.поднять(p, { theme: 'dark', newbie: true, wait: 1500 });
    const me0 = await p.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));
    ok(me0.units === undefined, 'без выключателя units не ставится: ' + JSON.stringify(me0)); await p.close(); }
} finally { await b.close(); }
  console.log(bad ? 'ПРОВАЛОВ: ' + bad : 'PASS edinicy'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
