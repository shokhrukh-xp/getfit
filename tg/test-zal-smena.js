'use strict';
/* ── СМЕНА ПРОГРАММЫ НА ЗАЛЕ (21.10) ──────────────────────────────────────
   Его просьба: «проверь полностью часть с тренировками, я обновил программу
   с 4 дней на 3; в одном упражнении нет фото». Нашлось и починено:
   1) фаза: без 'startdate' своя программа при каждом запуске считала старт
      сегодняшним днём — вечная 1-я неделя, «на подход меньше», запас 4;
      теперь старт — первая запись зала;
   2) очередь: вчерашнее занятие по прошлой программе вело очередь новой
      («следующий» прыгал между днями 1 и 3); теперь после смены — День 1;
   3) «Отведение ноги назад (тренажёр)» — своя строка каталога без кадров;
      теперь кадры кикбэка и «Как делать»;
   4) новая программа целиком снимает добавленные руками упражнения прежней
      (в новом Дне 1 оставался второй трицепс). */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const у = (id, n, en, m, q, p, sets) => ({ id, n, en, m, q, p, sets, reps: '10–12', rest: 90, ss: null, why: 'по каталогу' });
const ПРОГ = { name: 'Мышцы · вес вниз · 3 дня', note: 'Три дня.', focus: ['shoulders', 'lats', 'chest'], days: [
  { s: 'День 1', sub: 'верх А', ex: [
    у('Pullups', 'Подтягивания (обычные)', 'Pullups', 'lats', 'body only', 'Широчайшие', 4),
    у('Side_Lateral_Raise', 'Подъём через сторону (гантели, сбоку)', 'Side Lateral Raise', 'shoulders', 'dumbbell', 'Средняя дельта', 4),
    у('Triceps_Pushdown_-_Rope_Attachment', 'Разгибание на трицепс (блок, канат)', 'Triceps Pushdown - Rope Attachment', 'triceps', 'cable', 'Трицепс', 3)] },
  { s: 'День 2', sub: 'низ', ex: [
    у('Barbell_Full_Squat', 'Присед (штанга, глубокий)', 'Barbell Full Squat', 'quadriceps', 'barbell', 'Квадрицепс', 4),
    у('Glute_Kickback_Machine', 'Отведение ноги назад (тренажёр)', 'Glute Kickback Machine', 'glutes', 'machine', 'Ягодицы', 4),
    у('Leg_Extensions', 'Разгибание ног (тренажёр)', 'Leg Extensions', 'quadriceps', 'machine', 'Квадрицепс', 3)] },
  { s: 'День 3', sub: 'верх Б', ex: [
    у('Close-Grip_Front_Lat_Pulldown', 'Тяга верхнего блока (блок, узкий хват, спереди)', 'Close-Grip Front Lat Pulldown', 'lats', 'cable', 'Широчайшие', 4),
    у('Incline_Dumbbell_Press', 'Жим (наклон вверх, гантели)', 'Incline Dumbbell Press', 'chest', 'dumbbell', 'Верх груди', 4),
    у('Incline_Dumbbell_Curl', 'Сгибание на бицепс (наклон вверх, гантели, обычное)', 'Incline Dumbbell Curl', 'biceps', 'dumbbell', 'Бицепс', 3)] }] };
const ME = { sex: 'm', age: 34, ht: 178, bw: 86.2, goal: 'fat', wt: 'down', gym: 'muscle', level: 'mid', place: 'gym', only: 'all', lim: [], eq: [], min: 45 };
const з = (n, day) => ({ id: M.Д(n) + '_' + day, date: M.Д(n), day, name: 'День', week: 1,
  updated: new Date(M.Д(n) + 'T08:00:00').toISOString(),
  ex: [{ n: 'Подтягивания (обычные)', id: 'Pullups', unit: 'reps', sets: [{ w: 0, r: 8 }, { w: 0, r: 8 }] }] });
/* первая запись — 45 дней назад; вчера — «день 2» ПРОШЛОЙ программы */
const ЖУРНАЛ = [з(1, 'A2'), з(45, 'A1')];
const ЛИШНЕЕ = { A1: [{ n: 'Разгибание (одной рукой, гантели, обычное)', e: 'Dumbbell One-Arm Triceps Extension',
  i: 'Dumbbell_One-Arm_Triceps_Extension', m: 'triceps', p: '', sets: 3, reps: '8–12', rest: 90, cues: [], id: 't1' }] };

/* 5. Разметка каталога — ЭВРИСТИКА, а не доказанный вклад в рост. По МРТ
   обычный двусторонний присед растит приводящие и ягодицы, а бицепс бедра —
   нет (Kubo 2019, Plotkin 2023); жим ногами — тот же механизм. Одноногие,
   сплит-, прыжковые, сисси и толчок не изучены — их разметку не трогали
   (ревью Codex 21.10). Проверяем только опорные двусторонние строки. */
{ const CAT = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'catalog.json'), 'utf8'));
  const по = id => CAT.ex.find(e => e.i === id) || {};
  ['Barbell_Full_Squat', 'Barbell_Squat', 'Front_Barbell_Squat', 'Leg_Press', 'Hack_Squat'].forEach(id => {
    const sm = по(id).sm || [];
    дано(!sm.includes('hamstrings') && sm.includes('adductors'), id + ': приводящие, не бицепс бедра — ' + sm.join(','));
  });
  дано((по('Bulgarian_Split_Squat').sm || []).includes('hamstrings'), 'болгарский сплит-присед не трогали: ' + (по('Bulgarian_Split_Squat').sm || []).join(',')); }

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  /* 21.10, ревью Codex R1: программу меняли давно (ch 60 дней назад) — очередь
     идёт от вчерашнего A2 к A3; после явной пересборки сегодня — сразу A1 */
  await page.addInitScript(() => { try {
    const ук = JSON.stringify({ p: 'ai', at: new Date(Date.now() - 60 * 864e5).toISOString(), start: null, ch: new Date(Date.now() - 60 * 864e5).toISOString() });
    ['tgcs_app_profile', 'tgcs_@308687648_app_profile'].forEach(k => { if (!localStorage.getItem(k)) localStorage.setItem(k, ук); });
    localStorage.removeItem('shp_v1_startdate');
  } catch (e) {} });
  let перестроено = false;
  const ош = await M.поднять(page, { theme: 'dark', time: '07:10', page: 'gym', wait: 2800, preserveReload: true, prog: ПРОГ, profile: 'ai', me: ME,
    hist: ЖУРНАЛ, layer: { extra: ЛИШНЕЕ, adj: { 'A1:0': 2 } },
    onCoach: () => { перестроено = true;
      return { ok: true, reply: 'Пересобрал программу целиком.',
        rebuild: { prog: JSON.parse(JSON.stringify(ПРОГ)), at: Date.now(), why: 'новый блок' } }; } });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(800);

  /* 1. фаза — по первой записи, не «вечная первая неделя» */
  const фаза = await page.$eval('#phaseline', e => e.textContent).catch(() => '');
  дано(!/на подход меньше/.test(фаза), 'с первой записи 45 дней — не «Вход»: «' + фаза.slice(0, 60) + '»');
  const sd = await page.evaluate(() => localStorage.getItem('shp_v1_startdate'));
  дано(sd === JSON.stringify(M_Д45()), 'дата старта взята из журнала: ' + sd);

  /* 2. без смены программы очередь идёт как шла: вчера A2 — сегодня A3 */
  const открыт = await page.$eval('#dayseg button[aria-pressed="true"]', b => b.dataset.day).catch(() => '');
  дано(открыт === 'A3', 'программа не менялась — после вчерашнего A2 открыт A3: ' + открыт);
  await page.click('#dayseg button[data-day="A1"]'); await page.waitForTimeout(500);

  /* 4. добавленное руками в прошлой программе пока на месте (программа пришла не выбором) */
  const день1 = () => page.$eval('#list', e => e.textContent.replace(/\s+/g, ' ')).catch(() => '');
  дано(/одной рукой/.test(await день1()), 'до пересборки в Дне 1 видно добавленное руками');

  /* 3. кикбэк — с кадрами и подходами программы */
  await page.click('#dayseg button[data-day="A2"]'); await page.waitForTimeout(700);
  const ряд = await page.evaluate(() => { const r = [...document.querySelectorAll('#list .exrow')].find(x => /Отведение ноги назад/.test(x.textContent));
    return r ? { img: (r.querySelector('img') || {}).src || '', txt: r.textContent.replace(/\s+/g, ' ') } : null; });
  /* 22.10: в списке — миниатюра img/t/o/kickback-0.jpg, полный кадр — в data-full */
  дано(!!ряд && /img\/(t\/o\/)?kickback-0\.jpg/.test(ряд.img), 'у «Отведения ноги назад» есть кадр: ' + (ряд && ряд.img.split('/').pop()));
  дано(!!ряд && /4 × 10–12/.test(ряд.txt), 'и полные 4 подхода программы: ' + (ряд && ряд.txt.slice(0, 70)));

  /* 4. пересборка всей программы снимает прежние правки дней */
  await page.click('#coachnav'); await page.waitForTimeout(600);
  await page.fill('#ctext', 'Пересобери программу'); await page.click('#csend'); await page.waitForTimeout(1800);
  дано(перестроено, 'просьба ушла тренеру');
  await page.evaluate(() => { const m = document.getElementById('coachm'); if (m) m.classList.remove('show'); });
  /* выбран был A2 (кикбэк) — после явной смены программы открыт A1, без перезагрузки */
  const после = await page.$eval('#dayseg button[aria-pressed="true"]', b => b.dataset.day).catch(() => '');
  дано(после === 'A1', 'после пересборки сразу открыт День 1, а не выбранный до неё A2: ' + после);
  const ук = await page.evaluate(() => { for (const k of ['tgcs_app_profile', 'tgcs_@308687648_app_profile']) { const v = localStorage.getItem(k); if (v) return JSON.parse(v); } return null; });
  /* 23.10: сверка с днём стенда (M.TODAY), а не с датой UTC машины — с 00:00 до 05:00 по Ташкенту они расходились */
  дано(!!ук && ук.ch && ук.ch.slice(0, 10) === new Date(M.TODAY + 'T12:00:00Z').toISOString().slice(0, 10), 'в указателе — сегодняшняя смена: ' + (ук && ук.ch));
  await page.click('#dayseg button[data-day="A1"]').catch(() => {}); await page.waitForTimeout(700);
  дано(!/одной рукой/.test(await день1()), 'после новой программы второго трицепса из прошлой в Дне 1 нет');
  const extra = await page.evaluate(() => localStorage.getItem('shp_v1_ai_extra'));
  дано(!extra || extra === '{}', 'и в сохранённых правках его нет: ' + extra);
  /* 21.10, его выбор «Снимать»: ручные подходы прошлой программы тоже сняты */
  const adj = await page.evaluate(() => localStorage.getItem('shp_v1_ai_adj'));
  дано(!adj || adj === '{}', 'ручное число подходов прошлой программы снято: ' + adj);
  const подт = await page.evaluate(() => { const r = [...document.querySelectorAll('#list .exrow')].find(x => /Подтягивания/.test(x.textContent)); return r ? r.textContent.replace(/\s+/g, ' ') : ''; });
  дано(/4 × 6–8|4 × 10–12/.test(подт), 'подтягивания — подходы новой программы (4), а не прежние 2: ' + подт.slice(0, 70));


  /* после перезагрузки — тот же День 1, а не прежний выбор */
  await page.reload(); await page.waitForTimeout(2800);
  const послеПерезагрузки = await page.$eval('#dayseg button[aria-pressed="true"]', b => b.dataset.day).catch(() => '');
  дано(послеПерезагрузки === 'A1', 'и после перезагрузки — День 1: ' + послеПерезагрузки);

  /* 6. ревью Codex R2: единственная правка — свой порядок. Пересборка его
     снимает, и это сохраняется (раньше saveSubs не звался) */
  const p2 = await br.newPage({ viewport: { width: 390, height: 1400 } });
  await p2.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош2 = await M.поднять(p2, { theme: 'dark', time: '07:10', page: 'gym', wait: 2800, preserveReload: true, prog: ПРОГ, profile: 'ai', me: ME,
    hist: ЖУРНАЛ, layer: { ord: { A1: ['A1:2', 'A1:1', 'A1:0'] } },
    onCoach: () => ({ ok: true, reply: 'Пересобрал программу целиком.',
      rebuild: { prog: JSON.parse(JSON.stringify(ПРОГ)), at: Date.now() + 1, why: 'новый блок' } }) });
  дано(ош2.length === 0, 'вторая страница поднялась без ошибок ' + (ош2[0] || ''));
  await p2.click('#dayseg button[data-day="A1"]').catch(() => {}); await p2.waitForTimeout(500);
  const первое = () => p2.$eval('#list .exrow', e => e.textContent.replace(/\s+/g, ' ')).catch(() => '');
  дано(/канат/.test(await первое()), 'до пересборки свой порядок: первым трицепс — ' + (await первое()).slice(0, 40));
  await p2.click('#coachnav'); await p2.waitForTimeout(600);
  await p2.fill('#ctext', 'Пересобери программу'); await p2.click('#csend'); await p2.waitForTimeout(1800);
  await p2.evaluate(() => { const m = document.getElementById('coachm'); if (m) m.classList.remove('show'); });
  const ord = await p2.evaluate(() => localStorage.getItem('shp_v1_ai_ord'));
  дано(!ord || ord === '{}', 'снятый порядок сохранён: ' + ord);
  await p2.reload(); await p2.waitForTimeout(2800);
  await p2.click('#dayseg button[data-day="A1"]').catch(() => {}); await p2.waitForTimeout(500);
  дано(/Подтягивания/.test(await первое()), 'после перезагрузки — порядок программы: ' + (await первое()).slice(0, 40));

  /* 7. ревью Codex R1, второе устройство: здесь сегодня выбран A2, из облака
     приходит указатель со СВЕЖЕЙ сменой — выбор снят, открыт День 1.
     Тот же ch при повторном синке выбор не трогает. */
  const второе = async (chОблака, подпись, ждём) => {
    global.__allHits = 0;
    const pg = await br.newPage({ viewport: { width: 390, height: 1400 } });
    await pg.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    const давно = new Date(Date.now() - 60 * 864e5).toISOString();
    await pg.addInitScript(([д, сег]) => { try {
      const ук = JSON.stringify({ p: 'ai', at: д, start: null, ch: д });
      ['tgcs_app_profile', 'tgcs_@308687648_app_profile'].forEach(k => localStorage.setItem(k, ук));
      localStorage.setItem('shp_v1_ai_pick_' + сег, JSON.stringify('A2'));
    } catch (e) {} }, [давно, M.TODAY]);
    const облако = { p: 'ai', at: new Date().toISOString(), start: null, ch: chОблака === 'давно' ? давно : new Date().toISOString() };
    const о = await M.поднять(pg, { theme: 'dark', time: '07:10', page: 'gym', wait: 4200, preserveReload: true, prog: ПРОГ, profile: 'ai', me: ME, hist: ЖУРНАЛ,
      handleRoute: async route => { const u = new URL(route.request().url());
        if (u.pathname !== '/all') return false;
        global.__allHits = (global.__allHits || 0) + 1;
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ state: [{ key: 'prof', updated: Date.now(), data: облако }], workouts: [], meals: [], measures: [] }) });
        return true; } });
    дано(о.length === 0, подпись + ': страница поднялась без ошибок ' + (о[0] || ''));
    for (let i = 0; i < 20 && !(global.__allHits > 0); i++) await pg.waitForTimeout(500);
    await pg.waitForTimeout(1200);
    дано(global.__allHits > 0, подпись + ': снимок облака забран');
    const д = await pg.$eval('#dayseg button[aria-pressed="true"]', b => b.dataset.day).catch(() => '');
    дано(д === ждём, подпись + ': открыт ' + д + ', ждали ' + ждём);
    if (д !== ждём) console.log('    отладка: /all ' + (global.__allHits || 0) + ', указатель ' + await pg.evaluate(() => Object.keys(localStorage).filter(k => /app_profile|pick_/.test(k)).map(k => k + '=' + localStorage.getItem(k)).join(' | ')));
    await pg.close();
  };
  /* 8. замена в строке: мышца — у самой замены, а не подпись прежнего
     упражнения (махи на месте жима под углом — не «верх груди») */
  { const pg = await br.newPage({ viewport: { width: 390, height: 1400 } });
    await pg.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    const о = await M.поднять(pg, { theme: 'dark', time: '07:10', page: 'gym', wait: 2800, preserveReload: true, prog: ПРОГ, profile: 'ai', me: ME, hist: ЖУРНАЛ,
      layer: { subs: { 'A3:1': { n: 'Подъём через сторону (гантели, сбоку)', e: 'Side Lateral Raise', i: 'Side_Lateral_Raise' } } } });
    дано(о.length === 0, 'замена: страница поднялась без ошибок ' + (о[0] || ''));
    await pg.click('#dayseg button[data-day="A3"]').catch(() => {}); await pg.waitForTimeout(900);
    const ряд = await pg.evaluate(() => { const r = [...document.querySelectorAll('#list .exrow')].find(x => /Подъём через сторону/.test(x.textContent));
      return r ? r.textContent.replace(/\s+/g, ' ') : ''; });
    дано(!!ряд && !/верх груди/i.test(ряд) && /плечи|дельт/i.test(ряд), 'у замены мышца своя, не «верх груди»: ' + ряд.slice(0, 80));
    await pg.close(); }

  /* 9. ревью Codex R1 (замена): мышцы замены хранятся при ней — без каталога
     (не доехал) её подходы не выпадают из недельного объёма. Сравнение: та же
     замена в старом виде (без m) — так её видел код до правки. */
  const планПлечи = async (замена) => {
    const pg = await br.newPage({ viewport: { width: 390, height: 1800 } });
    await pg.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    await pg.route('**/catalog.json*', r => r.abort().catch(() => {}));
    const о = await M.поднять(pg, { theme: 'dark', time: '07:10', page: 'home', wait: 2800, preserveReload: true, prog: ПРОГ, profile: 'ai', me: ME, hist: ЖУРНАЛ,
      layer: { subs: { 'A3:1': замена } } });
    дано(о.length === 0, 'без каталога: страница поднялась без ошибок ' + (о[0] || ''));
    const строки = await pg.$$eval('.zkrow', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim())).catch(() => []);
    await pg.close();
    const m = (строки.find(t => /^Плечи/.test(t)) || '').match(/из (\d+(?:,\d)?)/);
    return m ? parseFloat(m[1].replace(',', '.')) : 0;
  };
  const махи = { n: 'Подъём через сторону (гантели, сбоку)', e: 'Side Lateral Raise', i: 'Side_Lateral_Raise' };
  const безМ = await планПлечи(махи), сМ = await планПлечи(Object.assign({ m: 'shoulders', sm: [] }, махи));
  дано(сМ > безМ, 'без каталога махи-замена с сохранённой мышцей остаются в плане на плечи: ' + сМ + ' против ' + безМ + ' в старом виде');

  /* 10. правка тренера с днём: махи в Дне 1 и в Дне 3 — по 5 подходов.
     Раньше правка без дня вставала только в первый день с таким именем. */
  { const ДВА = JSON.parse(JSON.stringify(ПРОГ));
    ДВА.days[2].ex.push(у('Side_Lateral_Raise', 'Подъём через сторону (гантели, сбоку)', 'Side Lateral Raise', 'shoulders', 'dumbbell', 'Средняя дельта', 3));
    const pg = await br.newPage({ viewport: { width: 390, height: 1400 } });
    await pg.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    const махи = 'Подъём через сторону (гантели, сбоку)';
    const о = await M.поднять(pg, { theme: 'dark', time: '07:10', page: 'gym', wait: 2800, preserveReload: true, prog: ДВА, profile: 'ai', me: ME, hist: ЖУРНАЛ,
      onCoach: () => ({ ok: true, reply: 'Ставлю по 5 подходов махам в первом и третьем днях.',
        changes: [{ what: 'sets', ex: махи, sets: 5, day: 1, text: махи + ' (день 1): 5 подходов', why: 'по просьбе' },
                  { what: 'sets', ex: махи, sets: 5, day: 3, text: махи + ' (день 3): 5 подходов', why: 'по просьбе' }] }) });
    дано(о.length === 0, 'правка по дням: страница поднялась без ошибок ' + (о[0] || ''));
    await pg.click('#coachnav'); await pg.waitForTimeout(600);
    await pg.fill('#ctext', 'Махи в Дне 1 и в Дне 3 — по 5 подходов'); await pg.click('#csend'); await pg.waitForTimeout(1800);
    await pg.evaluate(() => { const m = document.getElementById('coachm'); if (m) m.classList.remove('show'); });
    const махиВ = async дк => { await pg.click('#dayseg button[data-day="' + дк + '"]').catch(() => {}); await pg.waitForTimeout(600);
      return pg.evaluate(() => { const r = [...document.querySelectorAll('#list .exrow')].find(x => /Подъём через сторону/.test(x.textContent)); return r ? r.textContent.replace(/\s+/g, ' ') : ''; }); };
    const в1 = await махиВ('A1'), в3 = await махиВ('A3');
    дано(/5 × /.test(в1) && /5 × /.test(в3), 'махи стали по 5 подходов и в Дне 1, и в Дне 3: «' + в1.slice(0, 50) + '» / «' + в3.slice(0, 50) + '»');
    await pg.close(); }

  /* 10б. ревью Codex R1: правка с днём, где упражнения нет (день 2) или
     дня нет (7), никуда не встаёт; правка с верным днём — встаёт */
  { const pg = await br.newPage({ viewport: { width: 390, height: 1400 } });
    await pg.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    const махи = 'Подъём через сторону (гантели, сбоку)', жим = 'Жим (наклон вверх, гантели)';
    const о = await M.поднять(pg, { theme: 'dark', time: '07:10', page: 'gym', wait: 2800, preserveReload: true, prog: ПРОГ, profile: 'ai', me: ME, hist: ЖУРНАЛ,
      onCoach: () => ({ ok: true, reply: 'Ставлю.',
        changes: [{ what: 'sets', ex: махи, sets: 6, day: 2, text: махи + ' (день 2): 6', why: 'тест' },
                  { what: 'sets', ex: махи, sets: 7, day: 7, text: махи + ' (день 7): 7', why: 'тест' },
                  { what: 'sets', ex: 'Подтягивания (обычные)', sets: 5, day: 1, text: 'Подтягивания: 5', why: 'тест' }] }) });
    дано(о.length === 0, 'отрицательные дни: страница поднялась без ошибок ' + (о[0] || ''));
    await pg.click('#coachnav'); await pg.waitForTimeout(600);
    await pg.fill('#ctext', 'Махи — 6 подходов в дне 2'); await pg.click('#csend'); await pg.waitForTimeout(1500);
    await pg.evaluate(() => { const m = document.getElementById('coachm'); if (m) m.classList.remove('show'); });
    const adj = JSON.parse(await pg.evaluate(() => localStorage.getItem('shp_v1_ai_adj')) || '{}');
    дано(adj['A1:1'] == null, 'махи из Дня 1 не тронуты правками для дней 2 и 7: ' + JSON.stringify(adj));
    дано(adj['A1:0'] === 5, 'правка с верным днём встала: подтягивания 5 — ' + JSON.stringify(adj));
    await pg.close(); }

  /* 10в. ревью Codex R3: «подходы + замена», каталог ещё не пришёл — встают обе */
  { const pg = await br.newPage({ viewport: { width: 390, height: 1400 } });
    await pg.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    let отдать = null; const каталогЖдёт = new Promise(r => { отдать = r; });
    await pg.route('**/catalog.json*', async r => { await каталогЖдёт; r.continue().catch(() => {}); });
    const махи = 'Подъём через сторону (гантели, сбоку)', жим = 'Жим (наклон вверх, гантели)';
    const о = await M.поднять(pg, { theme: 'dark', time: '07:10', page: 'gym', wait: 2800, preserveReload: true, prog: ПРОГ, profile: 'ai', me: ME, hist: ЖУРНАЛ,
      onCoach: () => ({ ok: true, reply: 'Ставлю.', changes: [
        { what: 'sets', ex: махи, sets: 5, day: 1, text: махи + ' (день 1): 5', why: 'тест' },
        { what: 'swap', ex: жим, to: махи, toId: 'Side_Lateral_Raise', toName: махи, day: 3, text: 'Заменить «' + жим + '» на ' + махи, why: 'тест' }] }) });
    дано(о.length === 0, 'пакет при медленном каталоге: страница поднялась без ошибок ' + (о[0] || ''));
    await pg.click('#coachnav'); await pg.waitForTimeout(600);
    await pg.fill('#ctext', 'Махи 5 подходов, а жим в третьем дне замени на махи'); await pg.click('#csend'); await pg.waitForTimeout(1500);
    отдать(); await pg.waitForTimeout(2500);
    const сл = await pg.evaluate(() => ({ adj: JSON.parse(localStorage.getItem('shp_v1_ai_adj') || '{}'), subs: JSON.parse(localStorage.getItem('shp_v1_ai_subs') || '{}') }));
    дано(сл.adj['A1:1'] === 5, 'подходы встали: ' + JSON.stringify(сл.adj));
    дано(сл.subs['A3:1'] && сл.subs['A3:1'].i === 'Side_Lateral_Raise', 'и замена в Дне 3 встала, хотя каталог пришёл позже: ' + JSON.stringify(сл.subs));
    await pg.close(); }


  /* 11. фазы своей программы — свои описания, без чисел готовой «friend» */
  { const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
    дано(/phases:AI_PHASES/.test(src) && !/phases:PROFILES\.friend\.phases/.test(src), 'своя программа берёт свои фазы');
    const ai = src.slice(src.indexOf('var AI_PHASES='), src.indexOf('function installAiProg('));
    дано(!/\d\s*×\s*\d/.test(ai), 'в описаниях фаз своей программы нет «N × повторы» чужой программы'); }

  await второе('сейчас', 'второе устройство, смена пришла из облака', 'A1');
  await второе('давно', 'второе устройство, повторный синк без смены', 'A2');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
function M_Д45(){ return M.Д(45); }
