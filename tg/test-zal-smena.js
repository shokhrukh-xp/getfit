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

/* 5. присед и жим ногами растят приводящие и ягодицы, а не бицепс бедра
   (МРТ: Kubo 2019, Plotkin 2023) — разметка каталога это учитывает */
{ const CAT = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'catalog.json'), 'utf8'));
  const пр = CAT.ex.filter(e => e.m === 'quadriceps' && e.c === 'strength' && /squat|leg press/i.test(e.e));
  дано(пр.every(e => !(e.sm || []).includes('hamstrings')), 'у приседов и жимов ногами бицепс бедра не вспомогательная: ' + пр.filter(e => (e.sm || []).includes('hamstrings')).map(e => e.i).slice(0, 3).join(', '));
  const fs = пр.find(e => e.i === 'Barbell_Full_Squat');
  дано(!!fs && fs.sm.includes('adductors') && fs.sm.includes('glutes'), 'глубокий присед — приводящие и ягодицы: ' + (fs && fs.sm.join(','))); }

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  /* программу сменили сегодня — так её помечает явный выбор (ch в указателе) */
  await page.addInitScript(() => { try {
    const ук = JSON.stringify({ p: 'ai', at: new Date().toISOString(), start: null, ch: new Date().toISOString() });
    ['tgcs_app_profile', 'tgcs_@308687648_app_profile'].forEach(k => { if (!localStorage.getItem(k)) localStorage.setItem(k, ук); });
    localStorage.removeItem('shp_v1_startdate');
  } catch (e) {} });
  let перестроено = false;
  const ош = await M.поднять(page, { theme: 'dark', time: '07:10', page: 'gym', wait: 2800, prog: ПРОГ, profile: 'ai', me: ME,
    hist: ЖУРНАЛ, layer: { extra: ЛИШНЕЕ },
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

  /* 2. очередь — с Дня 1, вчерашний день прошлой программы её не ведёт */
  const открыт = await page.$eval('#dayseg button[aria-pressed="true"]', b => b.dataset.day).catch(() => '');
  дано(открыт === 'A1', 'открыт День 1, а не следующий за вчерашним «днём 2» прошлой программы: ' + открыт);

  /* 4. добавленное руками в прошлой программе пока на месте (программа пришла не выбором) */
  const день1 = () => page.$eval('#list', e => e.textContent.replace(/\s+/g, ' ')).catch(() => '');
  дано(/одной рукой/.test(await день1()), 'до пересборки в Дне 1 видно добавленное руками');

  /* 3. кикбэк — с кадрами и подходами программы */
  await page.click('#dayseg button[data-day="A2"]'); await page.waitForTimeout(700);
  const ряд = await page.evaluate(() => { const r = [...document.querySelectorAll('#list .exrow')].find(x => /Отведение ноги назад/.test(x.textContent));
    return r ? { img: (r.querySelector('img') || {}).src || '', txt: r.textContent.replace(/\s+/g, ' ') } : null; });
  дано(!!ряд && /img\/kickback-0\.jpg/.test(ряд.img), 'у «Отведения ноги назад» есть кадр: ' + (ряд && ряд.img.split('/').pop()));
  дано(!!ряд && /4 × 10–12/.test(ряд.txt), 'и полные 4 подхода программы: ' + (ряд && ряд.txt.slice(0, 70)));

  /* 4. пересборка всей программы снимает прежние правки дней */
  await page.click('#coachnav'); await page.waitForTimeout(600);
  await page.fill('#ctext', 'Пересобери программу'); await page.click('#csend'); await page.waitForTimeout(1800);
  дано(перестроено, 'просьба ушла тренеру');
  await page.evaluate(() => { const m = document.getElementById('coachm'); if (m) m.classList.remove('show'); });
  await page.click('#dayseg button[data-day="A1"]').catch(() => {}); await page.waitForTimeout(700);
  дано(!/одной рукой/.test(await день1()), 'после новой программы второго трицепса из прошлой в Дне 1 нет');
  const extra = await page.evaluate(() => localStorage.getItem('shp_v1_ai_extra'));
  дано(!extra || extra === '{}', 'и в сохранённых правках его нет: ' + extra);

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
function M_Д45(){ return M.Д(45); }
