'use strict';
/* 01.11.2026, режим дня, шаг 1. Его запрос: друг Фаррух работает в логистике США из Ташкента —
   ночью. Выборы: «Ночь + сменный», «Анкета + тренер», «Готовые кнопки» (ввод смены), «Шаг 1 сразу».
   Заперто: (1) на первом шаге анкеты строка «сон»: ночью / работаю ночью / смены;
   (2) «работаю ночью» открывает лист «Режим дня»: смена кнопками (18–03, 22–07, Другое — кнопку
   «США» он убрал 02.11: «как-то неправильно сравнивать с США»), сон по умолчанию — через час
   после смены, полоса суток; (3) «Сохранить» пишет me.rezhim (без сна, если сон не трогали);
   (4) смена, которую тренер записал по часам Нью-Йорка, в профиле — местными часами «ночью 19–04»,
   в листе — «Другое» 19:00–04:00; (5) «Другое» и свой сон сохраняются;
   (6) «Сплю ночью» убирает режим; (7) закрыл лист без сохранения — в анкете прежний выбор;
   (8) обе темы, 320 px — ничего не вылезает, без ошибок JS. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ОН = { sex: 'm', age: 30, ht: 178, bw: 85, wt: 'down', goal: 'fat', voice: 'fun' };
const ЦЕЛЬ = { text: '78 кг к весне', wt: 'down', rate: -0.5, from: M.Д(20), w0: 88, by: '2027-03-01', kg: 10 };
const meИз = p => p.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));
const вид = (p, s) => p.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && !e.closest('[hidden]') && e.getBoundingClientRect().height > 0; }, s);
const вбок = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('#rezm .modalbox *')].some(e => e.getBoundingClientRect().right > innerWidth + 1));

(async () => {
  const br = await chromium.launch();
  try {
    /* 1–3, 7: анкета новичка */
    for (const [тема, ширина] of [['dark', 390], ['light', 320]]) {
      const где = тема + ' ' + ширина + ': ';
      const ctx = await br.newContext({ viewport: { width: ширина, height: 844 }, timezoneId: 'Asia/Tashkent' });
      const p = await ctx.newPage();
      const ош = await M.поднять(p, { theme: тема, newbie: true, wait: 2500 });
      дано(await вид(p, '#wz-rez'), где + 'на первом шаге — строка «сон»');
      const кн = await p.$$eval('#wz-rez button', bs => bs.map(b => b.dataset.v + ':' + b.getAttribute('aria-pressed')).join());
      дано(кн === 'den:true,noch:false,smeny:false', где + 'по умолчанию «ночью»: ' + кн);
      await p.click('#wz-rez [data-v="smeny"]'); await p.waitForTimeout(300);
      дано(await вид(p, '#rezm'), где + '«смены» открывают лист');
      await p.click('#rezm [data-rz="close"]'); await p.waitForTimeout(300);
      дано(await p.$eval('#wz-rez [data-v="den"]', b => b.getAttribute('aria-pressed')) === 'true', где + 'закрыл без сохранения — в анкете прежний выбор');
      await p.click('#wz-rez [data-v="noch"]'); await p.waitForTimeout(300);
      дано(await p.$eval('#rezm [data-rzvid="noch"]', b => b.getAttribute('aria-pressed')) === 'true', где + 'в листе выбран «Работаю ночью»');
      const смены = await p.$$eval('#rezm [data-rzsm]', bs => bs.map(b => b.textContent).join(','));
      дано(смены === '18–03,22–07,Другое', где + 'смены кнопками, без «США»: ' + смены);
      await p.click('#rezm [data-rzsm="18-03"]'); await p.waitForTimeout(200);
      const т = await p.locator('#rezm .rzleg').innerText();
      дано(/смена\s*18:00–03:00/.test(т) && /сон\s*04:00–11:00/.test(т), где + 'смена 18:00–03:00, сон по умолчанию 04:00–11:00: ' + т.replace(/\s+/g, ' '));
      дано(await p.locator('#rezm .rzbar i').count() === 3, где + 'полоса суток: смена через полночь — двумя кусками, сон — одним');
      дано(!(await вбок(p)), где + 'ничего не вылезает вбок');
      await p.screenshot({ path: '/tmp/gf-rezhim-list-' + тема + '-' + ширина + '.png' });
      await p.click('#rezm [data-rz="save"]'); await p.waitForTimeout(300);
      const me = await meИз(p);
      дано(me.rezhim && me.rezhim.vid === 'noch' && me.rezhim.smena.s === '18:00' && me.rezhim.smena.d === '03:00' && !me.rezhim.smena.tz && !me.rezhim.son,
        где + 'сохранено: ' + JSON.stringify(me.rezhim));
      дано(!(await вид(p, '#rezm')) && await p.$eval('#wz-rez [data-v="noch"]', b => b.getAttribute('aria-pressed')) === 'true', где + 'лист закрыт, в анкете «работаю ночью»');
      await p.screenshot({ path: '/tmp/gf-rezhim-anketa-' + тема + '-' + ширина + '.png' });
      дано(ош.length === 0, где + 'без ошибок JS ' + ош.slice(0, 2).join(' | '));
      await ctx.close();
    }
    /* 4–6: профиль */
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tashkent' });
    const p = await ctx.newPage();
    await p.addInitScript(() => { try { localStorage.setItem('shp_v1_trcard_off', '1'); } catch (e) {} });
    const ош = await M.поднять(p, { page: 'home', time: '15:00', goal: ЦЕЛЬ, me: Object.assign({}, ОН, { rezhim: { vid: 'noch', smena: { s: '09:00', d: '18:00', tz: 'America/New_York' } } }) });
    await p.waitForTimeout(600);
    await p.click('#profbtn'); await p.waitForTimeout(400);
    дано(await вид(p, '#pq-rez'), 'в профиле строка «Режим дня»');
    дано((await p.locator('#pv-rez').innerText()).trim() === 'ночью 19–04', 'строка — «ночью 19–04»: ' + await p.locator('#pv-rez').innerText());
    await p.click('#pq-rez'); await p.waitForTimeout(300);
    дано(await вид(p, '#rezm [data-rzsm="own"][aria-pressed="true"]') && await p.inputValue('#rz-s') === '19:00' && await p.inputValue('#rz-d') === '04:00',
      'смена по часам Нью-Йорка в листе — «Другое» 19:00–04:00');
    await p.fill('#rz-s', '22:00'); await p.dispatchEvent('#rz-s', 'change');
    await p.fill('#rz-d', '06:00'); await p.dispatchEvent('#rz-d', 'change'); await p.waitForTimeout(200);
    дано(/сон\s*07:00–14:00/.test(await p.locator('#rezm .rzleg').innerText()), 'сон по умолчанию пересчитался от новой смены');
    await p.fill('#rz-ss', '08:00'); await p.dispatchEvent('#rz-ss', 'change'); await p.waitForTimeout(200);
    await p.click('#rezm [data-rz="save"]'); await p.waitForTimeout(300);
    let me = await meИз(p);
    дано(me.rezhim.smena.s === '22:00' && me.rezhim.smena.d === '06:00' && !me.rezhim.smena.tz && me.rezhim.son && me.rezhim.son.s === '08:00' && me.rezhim.son.d === '14:00',
      '«Другое» и свой сон сохранены: ' + JSON.stringify(me.rezhim));
    дано((await p.locator('#pv-rez').innerText()).trim() === 'ночью 22–06', 'строка — «ночью 22–06»');
    await p.click('#pq-rez'); await p.waitForTimeout(300);
    await p.click('#rezm [data-rzsm="own"]'); await p.fill('#rz-s', ''); await p.dispatchEvent('#rz-s', 'change'); await p.waitForTimeout(150);
    await p.click('#rezm [data-rz="save"]'); await p.waitForTimeout(200);
    дано(/Укажите начало и конец смены/.test(await p.locator('#rezm').innerText()) && await вид(p, '#rezm'), 'без смены не сохраняет — просит указать');
    await p.click('#rezm [data-rzvid="den"]'); await p.waitForTimeout(150);
    await p.screenshot({ path: '/tmp/gf-rezhim-den.png' });
    await p.click('#rezm [data-rz="save"]'); await p.waitForTimeout(300);
    me = await meИз(p);
    дано(!me.rezhim && (await p.locator('#pv-rez').innerText()).trim() === 'обычный', '«Сплю ночью» убирает режим, строка — «обычный»');
    дано(ош.length === 0, 'профиль: без ошибок JS ' + ош.slice(0, 2).join(' | '));
    await ctx.close();
    /* 9. шаг 2 (02.11): свои сутки, дуга от его подъёма, тихое окно */
    const НОЧ = Object.assign({}, ОН, { rezhim: { vid: 'noch', smena: { s: '19:00', d: '04:00' } } });
    for (const [тема, кто, me] of [['dark', 'ночник', НОЧ], ['light', 'обычный', ОН]]) {
      const c2 = await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tashkent' });
      const p2 = await c2.newPage();
      await p2.addInitScript(() => { try { localStorage.setItem('shp_v1_trcard_off', '1'); } catch (e) {} });
      const даты = []; p2.on('request', r => { const m = r.url().match(/\/day\?[^#]*date=(\d{4}-\d\d-\d\d)/); if (m) даты.push(m[1]); });
      const ош2 = await M.поднять(p2, { page: 'home', theme: тема, time: '02:00', goal: ЦЕЛЬ, me, day: { meals: [{ id: 1, t: '13:10', kind: 'завтрак', kcal: 500, prot: 30 }, { id: 2, t: '20:30', kind: 'обед', kcal: 700, prot: 40 }] } });
      await p2.waitForTimeout(500);
      const v = await p2.evaluate(() => ({ next: (document.querySelector('.hb-next') || {}).textContent || '', тихо: !!document.querySelector('.hcquiet'),
        часы: [...document.querySelectorAll('.hch')].map(e => e.textContent), w0: +document.querySelector('.hclk-svg').dataset.w0, w1: +document.querySelector('.hclk-svg').dataset.w1 })); v.today = даты[даты.length - 1];
      if (кто === 'ночник') {
        дано(v.today === M.Д(1), кто + ': в 02:00 на смене — ещё вчерашний день (' + v.today + ')');
        дано(!v.next, кто + ': в 02:00 (тихое окно) следующий приём не советуем: «' + v.next + '»');
        дано(v.тихо, кто + ': на дуге тихое окно 01–06');
        дано(v.часы[0] === '11' && v.часы.includes('02') && v.w1 > 24, кто + ': дуга с 11:00 через полночь: ' + v.часы.join(' '));
      } else {
        дано(v.today === M.Д(0), кто + ': в 02:00 — новый день, как было');
        дано(!v.тихо && v.w1 <= 24, кто + ': без тихого окна, дуга как была: ' + v.часы.join(' '));
      }
      await p2.screenshot({ path: '/tmp/gf-rezhim-duga-' + кто + '.png' });
      дано(ош2.length === 0, кто + ': без ошибок JS ' + ош2.slice(0, 2).join(' | '));
      await c2.close();
    }
    /* «Новый день» в листе: свой час сохраняется */
    {
      const c3 = await br.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tashkent' });
      const p3 = await c3.newPage();
      await p3.addInitScript(() => { try { localStorage.setItem('shp_v1_trcard_off', '1'); } catch (e) {} });
      await M.поднять(p3, { page: 'home', time: '15:00', goal: ЦЕЛЬ, me: НОЧ });
      await p3.click('#profbtn'); await p3.waitForTimeout(400); await p3.click('#pq-rez'); await p3.waitForTimeout(300);
      дано(/08:00 — середина сна/.test(await p3.locator('#rz-den').innerText()), 'новый день по умолчанию — 08:00, середина сна');
      await p3.selectOption('#rz-den', '06:00'); await p3.dispatchEvent('#rz-den', 'change');
      await p3.click('#rezm [data-rz="save"]'); await p3.waitForTimeout(200);
      дано((await meИз(p3)).rezhim.den === '06:00', 'свой час начала дня сохранён');
      await c3.close();
    }
  } finally { await br.close(); }
  console.log(плохо ? 'ПРОВАЛОВ: ' + плохо : 'ВСЁ ОК');
  process.exit(плохо ? 1 : 0);
})();
