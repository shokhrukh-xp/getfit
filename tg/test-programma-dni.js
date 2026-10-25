'use strict';
/* Собранная программа по дням с фото (25.10). Его слова: «мне совсем непонятно какие
   упражнения в какой день. Нужно показать их удобнее уже по дням и с фото»; из двух макетов
   выбран A — вкладки по дням. И его скриншот: «пишет вчера тренировка была а следующая в
   субботу. Но вчера была суббота» — выбор «новая — с Дня 1».
   Заперто: 1) вкладки «День N» с днём недели из дней анкеты, выбранная — первая; под ней
   заголовок дня, число упражнений и строки с кадром, мышцей и подходами; нажатие на вкладку
   меняет список; вкладки не мельче 44 px, в экране, в тёмной теме читаются (контраст ≥ 4,5);
   2) после смены программы занятия по прошлой не ставят ✓ на дни новой и не ведут очередь:
   следующий — День 1, «вчера» на чипе не появляется. */
const { chromium } = require('playwright'); const M = require('./mock'); const fs = require('fs'), path = require('path');
const { opts } = require('./shot-clean');
let плохо = 0; const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const PROG = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'prog-3dnya.json'), 'utf8'));
const онб = b => ({ ok: true, prog: PROG, wt: 'down', gym: 'muscle', goal: 'lose_muscle', goalObj: null, ask: null, options: [], left: 0, hint: b.after ? 'Составила программу.' : '', likes: [], dislikes: [], sports: null });
const яркость = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const контраст = (a, b) => { const x = яркость(a), y = яркость(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

(async () => {
  const br = await chromium.launch();
  for (const theme of ['light', 'dark']) for (const width of [320, 390]) {
    const т = theme + ' ' + width + ': ';
    const p = await br.newPage({ viewport: { width, height: 844 } });
    const ош = await M.поднять(p, { theme, newbie: true, wait: 2500, onOnboard: онб });
    await M.шаги(p, {}); await p.click('#wz-go'); await p.waitForSelector('.aitabs button', { timeout: 8000 }).catch(() => {});
    const вкл = await p.$$eval('.aitabs button', bs => bs.map(b => { const r = b.getBoundingClientRect(); const s = getComputedStyle(b);
      return { t: b.innerText.replace(/\s+/g, ' ').trim(), sel: b.getAttribute('aria-selected'), h: r.height, right: r.right, fg: s.color, bg: s.backgroundColor }; }));
    дано(вкл.length === 3 && /^День 1 пн$/.test(вкл[0].t) && /^День 2 ср$/.test(вкл[1].t) && /^День 3 пт$/.test(вкл[2].t), т + 'три вкладки с днями анкеты: ' + вкл.map(x => x.t).join(' | '));
    дано(вкл[0].sel === 'true' && вкл[1].sel === 'false', т + 'выбрана первая');
    дано(вкл.every(x => x.h >= 44 && x.right <= width), т + 'вкладки не мельче 44 px и в экране');
    дано(контраст(вкл[0].fg, вкл[0].bg) >= 4.5, т + 'выбранная читается: контраст ' + контраст(вкл[0].fg, вкл[0].bg).toFixed(2));
    const список = () => p.$$eval('.aiprev .aiex', rs => rs.map(r => ({ t: r.innerText.replace(/\s+/g, ' ').trim(), img: (r.querySelector('img') || {}).getAttribute ? r.querySelector('img').getAttribute('src') : '' })));
    let с = await список();
    дано(с.length === 7 && /^Жим ногами \(тренажёр, обычный\) квадрицепс · 3 × 10–12$/.test(с[0].t), т + 'день 1: 7 строк, мышца и подходы: ' + (с[0] || {}).t);
    дано(с.every(x => /img\/t\//.test(x.img || '')), т + 'у каждой строки кадр из своих миниатюр');
    дано(/Ноги, грудь, спина, руки/.test(await p.textContent('.aiprev .aidh b')) && /7 упражнений/.test(await p.textContent('.aiprev .aidh i')), т + 'заголовок дня и число упражнений');
    await p.click('.aitabs button[data-aitab="1"]'); await p.waitForTimeout(250);
    с = await список();
    дано(/^Присед \(гиря, кубковый\)/.test((с[0] || {}).t) && await p.getAttribute('.aitabs button[data-aitab="1"]', 'aria-selected') === 'true', т + 'нажал «День 2» — его упражнения');
    дано(!!(await p.$('#wzapply')) && !!(await p.$('#wzagain')), т + 'кнопки «Начать по ней» и «Переделать» на месте');
    if (width === 390) await p.screenshot({ path: '/tmp/programma-dni-' + theme + '.png' });
    дано(!ош.length, т + 'без ошибок ' + (ош[0] || ''));
    await p.close();
  }

  /* 2: смена программы — очередь с Дня 1 */
  const зап = (сдвиг, day) => ({ id: M.Д(сдвиг) + '_' + day, date: M.Д(сдвиг), day, name: 'День ' + day.slice(1), week: 1, dur: 45,
    t0: new Date(M.Д(сдвиг) + 'T18:00:00').toISOString(), updated: new Date(M.Д(сдвиг) + 'T19:10:00').toISOString(), ex: [{ n: 'Жим лёжа', id: 'Barbell_Bench_Press_-_Medium_Grip', unit: 'reps', sets: [{ w: 55, r: 8 }] }] });
  const пн = (new Date(M.TODAY + 'T12:00:00').getDay() + 6) % 7;
  if (пн < 1) console.log('  (понедельник: вчера — прошлая неделя, проверка пропущена)');
  else {
    const o = opts('dark'); o.page = 'gym'; o.hist = [зап(1, 'D2')]; o.preserveReload = true;
    const p = await br.newPage({ viewport: { width: 390, height: 844 } });
    await M.поднять(p, o); await p.waitForTimeout(500);
    const чипы = () => p.evaluate(() => [...document.querySelectorAll('#dayseg button')].map(b => ({ k: b.dataset.day, i: (b.querySelector('i') || {}).textContent, fin: b.dataset.fin === '1' })));
    let ч = await чипы();
    дано((ч.find(x => x.k === 'D2') || {}).fin === true, 'до смены: вчерашний День 2 — с ✓');
    await p.addInitScript(() => { try { localStorage.setItem('tgcs_app_profile', JSON.stringify({ p: 'shp', at: new Date(Date.now() - 864e5 * 30).toISOString(), ch: new Date().toISOString() })); } catch (e) {} });
    {
      await p.reload(); await p.waitForTimeout(2600);
      ч = await чипы();
      дано(ч.length >= 3 && ч.every(x => !x.fin), 'после смены: ни одного ✓ от прошлой программы: ' + JSON.stringify(ч));
      дано(ч.every(x => x.i !== 'вчера'), 'после смены: «вчера» на чипах нет');
      дано(/день 1/i.test((await p.locator('#nexthint').innerText()).replace(/\s+/g, ' ')), 'следующий по очереди — День 1');
    }
    await p.close();
  }
  /* 3: у него вт/чт/сб — анкета новой программы показывает их, а не пн/ср/пт по умолчанию */
  {
    const o = opts('light'); o.page = 'gym';
    const p = await br.newPage({ viewport: { width: 390, height: 844 } });
    await p.addInitScript(() => { try { const d = JSON.stringify({ 2: 1, 4: 1, 6: 1 }); localStorage.setItem('shp_v1_shp_sched', d); localStorage.setItem('shp_v1_sched_any', d); } catch (e) {} });
    await M.поднять(p, o); await p.waitForTimeout(500);
    await p.evaluate(() => document.getElementById('profswitch').click()); await p.waitForTimeout(800);   /* «сменить программу» */
    const сводка = (await p.$$eval('#wz-wd button[data-wd]', bs => bs.filter(b => b.getAttribute('aria-pressed') === 'true' || b.classList.contains('on')).map(b => b.textContent.trim()))).join(' ');
    дано(/вт чт сб/.test(сводка || ''), 'анкета новой программы — его дни вт чт сб: «' + сводка + '»');
    await p.close();
  }
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  if (плохо) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
