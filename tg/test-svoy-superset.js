'use strict';
/* ── СВОЙ СУПЕРСЕТ ─────────────────────────────────────────────────────
   24.09, его слова: «иногда делаю суперсетом сразу 2 упражнения, но не знаю,
   как это отметить». Пару задавала только программа. Теперь на карточке есть
   «Суперсет с…»: выбираешь партнёра, потом — только сегодня или всегда в
   этом дне (его выбор: спрашивать каждый раз). Две базовые в пару не
   ставятся — как у тренера. Своя пара разбирается кнопкой «Разобрать»;
   «только сегодня» назавтра не действует. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const СЛОЙ = { extra: { D1: [
  { n: 'Сгибания с гантелями', e: 'Dumbbell Bicep Curl', i: 'Dumbbell_Bicep_Curl', m: 'biceps', p: 'Бицепс', sets: 3, reps: '8–12', rest: 90, id: 'x1' },
  { n: 'Жим лёжа', e: 'Barbell Bench Press', i: 'Barbell_Bench_Press_-_Medium_Grip', m: 'chest', p: 'Грудь', sets: 3, reps: '6–10', rest: 120, id: 'x2' }] } };
const ПАРЫ = 'shp_v1_shp_pairs';

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', time: '18:10', page: 'gym', layer: СЛОЙ, wait: 2600 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  /* раскрыто всегда одно упражнение: если оно уже открыто, строки у него нет */
  const открыть = async имя => {
    const уже = await page.$eval('.card.exact .exname', e => e.textContent).catch(() => '');
    if (уже.indexOf(имя) >= 0) return;
    await page.click('#list .exrow:has-text("' + имя + '")'); await page.waitForTimeout(400);
  };
  const пары = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), ПАРЫ);
  const суперсет = () => page.$$eval('.sscard', cs => cs.map(c => c.textContent.replace(/\s+/g, ' ')));

  /* 1. базовое — присед: партнёром можно изоляцию, базовое закрыто */
  await открыть('Приседания со штангой');
  дано(!!(await page.$('.card.exact .ssmk')), 'на карточке есть «Суперсет с…»');
  await page.click('.card.exact .ssmk'); await page.waitForTimeout(800);
  const список = await page.$$eval('.sslist .ebtn', bs => bs.map(b => ({ т: b.textContent.trim(), нельзя: b.disabled })));
  const по = s => список.find(x => x.т.indexOf(s) === 0) || {};
  дано(по('Сгибания').нельзя === false, 'изоляцию в пару к базовому можно: ' + JSON.stringify(по('Сгибания')));
  дано(по('Жим лёжа').нельзя === true && /тоже базовое/.test(по('Жим лёжа').т), 'две базовые — нельзя, и сказано почему');
  дано(/как у тренера/.test(await page.textContent('.ssmake')), 'под списком объяснение правила');
  дано(!список.some(x => /Жим ногами|Румынская/.test(x.т)), 'упражнения, уже стоящие в паре программы, не предлагаются');

  /* 2. только сегодня */
  await page.click('.sslist .ebtn:has-text("Сгибания")'); await page.waitForTimeout(300);
  дано((await page.$$('[data-sswhen]')).length === 2, 'спрошено, на сколько: сегодня или всегда');
  await page.click('[data-sswhen="day"]'); await page.waitForTimeout(500);
  let сс = (await суперсет()).find(t => /Приседания/.test(t) && /Сгибания/.test(t)) || '';
  дано(!!сс, 'присед и сгибания теперь одной карточкой суперсета');
  дано(/только сегодня/.test(сс), 'в шапке сказано: только сегодня');
  дано(/Разобрать/.test(сс), 'у своей пары есть «Разобрать»');
  let п = await пары();
  дано(п.D1 && п.D1.length === 1 && п.D1[0].d === M.TODAY && п.D1[0].a === 'D1:0' && п.D1[0].b === 'D1:xx1',
    'пара записана на сегодня: ' + JSON.stringify(п));

  /* 3. разобрать */
  await page.click('.sscard [data-ssbreak]'); await page.waitForTimeout(500);
  дано(!(await суперсет()).some(t => /Приседания/.test(t) && /Сгибания/.test(t)), 'после «Разобрать» пары нет');
  п = await пары();
  дано(!п.D1, 'и в памяти её нет: ' + JSON.stringify(п));

  /* 4. всегда в этом дне — переживает перезагрузку */
  await открыть('Приседания со штангой');
  await page.click('.card.exact .ssmk'); await page.waitForTimeout(800);
  await page.click('.sslist .ebtn:has-text("Сгибания")'); await page.waitForTimeout(300);
  await page.click('[data-sswhen="always"]'); await page.waitForTimeout(500);
  п = await пары();
  дано(п.D1 && п.D1[0].d === null, 'пара записана навсегда: ' + JSON.stringify(п));
  сс = (await суперсет()).find(t => /Приседания/.test(t)) || '';
  дано(!/только сегодня/.test(сс), 'у постоянной пары пометки «только сегодня» нет');
  дано(/своих суперсетов 1/.test(await page.textContent('#list')), 'внизу дня сказано, что в нём своя пара');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2600);
  const строки = await page.$$eval('#list .exrow', rs => rs.map(r => r.textContent.replace(/\s+/g, ' ')));
  дано(строки.some(t => /^ ?А ?Приседания/.test(t)) || строки.some(t => /А\s*Приседания/.test(t)),
    'после перезагрузки присед по-прежнему в паре (метка А): ' + строки.slice(0, 2).join(' | '));

  /* 5. вчерашняя «только сегодня» не действует */
  /* пара живёт и на телефоне, и в облачной копии слоя правок (state/subs) —
     подменяем в обоих местах, иначе облако вернёт вчерашнюю постоянную */
  await page.evaluate(k => {
    const вчера = { D1: [{ a: 'D1:0', b: 'D1:xx1', d: '2000-01-01' }] };
    localStorage.setItem(k, JSON.stringify(вчера));
    ['cs_state_subs', 'tgcs_state_subs'].forEach(ck => {
      const v = localStorage.getItem(ck); if (!v) return;
      const doc = JSON.parse(v); doc.pr = вчера; localStorage.setItem(ck, JSON.stringify(doc));
    });
  }, ПАРЫ);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2600);
  const строки2 = await page.$$eval('#list .exrow', rs => rs.map(r => r.textContent.replace(/\s+/g, ' ')));
  дано(!строки2.some(t => /А\s*Приседания/.test(t)), 'вчерашняя пара «только сегодня» сегодня не действует');
  дано(!/своих суперсетов/.test(await page.textContent('#list')), 'и в правках дня её нет');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
