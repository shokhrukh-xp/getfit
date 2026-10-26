'use strict';
/* 25.10, его слова: «я ставил цель сбросить вес до января 2027 года, но с учетом
   текущего темпа ты должен показывать когда реально будет достичь цель и
   постоянно ее обновлять» и «здесь остался русский текст» (цель на английском).
   Его выбор: темп — последние 4 недели; цель остаётся, прогноз — строкой.
   Заперто: (1) отстаём — «Сейчас худеете на 0,6 кг в неделю», «До 75 кг — около
   20 марта 2027», сколько нужно к сроку; (2) успеваем — «Успеваете к сроку»;
   (3) за 4 недели вес стоит — «к цели по такому темпу не прийти»; (4) на
   английском цель «… · мышцы и силу сохраняем» переводится целиком, когда
   перевод приходит с сервера (раньше второй проход искал полуанглийскую строку),
   и прогноз — по-английски. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const МЕ = { sex: 'm', age: 34, ht: 178, bw: 86.1, wt: 'down', goal: 'fat', voice: 'hard', coach_at: 'x' };
const ЦЕЛЬ = { text: '75 кг к концу января · старт 1 сентября · мышцы и силу сохраняем', wt: 'down', rate: -0.83, from: '2026-09-01', w0: 92.3, by: '2027-01-31', kg: 17.3 };
const ПР = { w0: 92.3, now: 85.9, fact: -6.4, rate: -0.83, kg: 17.3, left: 10.9, by: '2027-01-31', plan: -6.5, gap: 0.1, onTrack: true,
  trend4: { kgWeek: -0.6, from: '2026-09-28', n: 20 }, eta: { pace: -0.6, weeks: 18.2, date: '2027-03-20', basis: '4w' }, need: -1.1 };
const карточка = p => p.evaluate(() => {const d=document.querySelector('#goalcard details');if(d)d.open=true;return (document.querySelector('#profm .goal-eta') || {}).innerText || '';});
async function открыть(br, o){
  const page = await br.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { try { localStorage.setItem('shp_v1_trcard_off', '1'); } catch (e) {} });
  const ош = await M.поднять(page, Object.assign({ page: 'home', time: '10:00', goal: ЦЕЛЬ, me: МЕ }, o));
  await page.waitForTimeout(700);
  await page.click('#profbtn'); await page.waitForTimeout(900);
  return { page, ош };
}
(async () => {
  const br = await chromium.launch();
  try {
    /* (1) отстаём от срока */
    { const { page, ош } = await открыть(br, { progress: ПР });
      const т = await карточка(page);
      дано(/Прогноз · темп последних 4 недель/i.test(т), 'подпись прогноза: ' + JSON.stringify(т));
      дано(/Сейчас худеете на 0,6 кг в неделю/.test(т), 'темп за 4 недели');
      дано(/До 75 кг — около 20 марта 2027/.test(т), 'дата при нынешнем темпе');
      дано(/Чтобы успеть к 31 января 2027, нужно 1,1 кг в неделю/.test(т), 'сколько нужно к сроку');
      дано(/75 кг к концу января/.test(await page.evaluate(() => document.querySelector('#profm .goalcard .gt').innerText)), 'цель и её срок не тронуты');
      await page.screenshot({ path: '/tmp/gf-cel-prognoz-ru.png' });
      дано(ош.length === 0, 'без ошибок JS ' + ош.slice(0, 2).join(' | '));
      await page.close(); }
    /* (2) успеваем */
    { const { page } = await открыть(br, { progress: Object.assign({}, ПР, { eta: { pace: -0.9, weeks: 12, date: '2027-01-17', basis: '4w' }, need: -0.8 }) });
      const т = await карточка(page);
      дано(/Успеваете к сроку — 31 января 2027/.test(т) && !/Чтобы успеть/.test(т), 'успеваем: ' + JSON.stringify(т));
      await page.close(); }
    /* (3) вес стоит четыре недели */
    { const { page } = await открыть(br, { progress: Object.assign({}, ПР, { eta: null, trend4: { kgWeek: 0.05, from: '2026-09-28', n: 20 } }) });
      const т = await карточка(page);
      дано(/За 4 недели вес не снижается — к цели по такому темпу не прийти/.test(т) && /нужно 1,1 кг в неделю/.test(т), 'стоит: ' + JSON.stringify(т));
      await page.close(); }
    /* (4) английский: цель целиком, прогноз по-английски */
    { const { page, ош } = await открыть(br, { tgLang: 'en', me: Object.assign({ lang: 'en' }, МЕ), progress: ПР,
        i18n: { '{0} кг к концу января · старт {1} · мышцы и силу сохраняем': '{0} kg by the end of January · start {1} · keeping muscle and strength' } });
      await page.waitForTimeout(1500);
      const gt = await page.evaluate(() => document.querySelector('#profm .goalcard .gt').innerText);
      дано(!/[А-Яа-яЁё]/.test(gt) && /keeping muscle and strength/.test(gt) && /75 kg/.test(gt), 'цель целиком по-английски: ' + JSON.stringify(gt));
      const т = await карточка(page);
      дано(!/[А-Яа-яЁё]/.test(т), 'прогноз без кириллицы: ' + JSON.stringify(т));
      дано(/You're losing 0\.6 kg a week/.test(т) && /75 kg around March 20, 2027/.test(т) && /To make it by January 31, 2027, you need 1\.1 kg a week/.test(т), 'прогноз по-английски');
      await page.screenshot({ path: '/tmp/gf-cel-prognoz-en.png' });
      дано(ош.length === 0, 'en: без ошибок JS ' + ош.slice(0, 2).join(' | '));
      await page.close(); }
    /* перевод целиком приходит с сервера позже, чем нарисована карточка: тот же узел
       переводится заново из русского, а не из полуанглийской строки */
    { let отдать; const i18nGate=new Promise(r=>{отдать=r;});
      const { page } = await открыть(br, { tgLang: 'en', me: Object.assign({ lang: 'en' }, МЕ), progress: ПР, i18nGate,
        goal: Object.assign({}, ЦЕЛЬ, { text: '75 кг к концу января · старт 1 сентября · держим силу в зале' }),
        i18n: { '{0} кг к концу января · старт {1} · держим силу в зале': '{0} kg by the end of January · start {1} · keeping gym strength' } });
      const до = await page.evaluate(() => document.querySelector('#profm .goalcard .gt').innerText);
      const узел=await page.$('#profm .goalcard .gt');
      отдать();
      await page.waitForFunction(()=>document.querySelector('#profm .goalcard .gt').innerText==='75 kg by the end of January · start September 1 · keeping gym strength');
      дано(await узел.evaluate(e=>e.isConnected),'перевод обновил существующий узел');
      const после = await page.evaluate(() => document.querySelector('#profm .goalcard .gt').innerText);
      дано(/[А-Яа-яЁё]/.test(до) && после === '75 kg by the end of January · start September 1 · keeping gym strength', 'поздний перевод ложится на тот же узел: ' + JSON.stringify([до, после]));
      await page.close(); }
    /* узбекский — прогноз из словаря */
    { const { page } = await открыть(br, { tgLang: 'uz', me: Object.assign({ lang: 'uz' }, МЕ), progress: ПР });
      await page.waitForTimeout(800);
      const т = await карточка(page);
      дано(!/[А-Яа-яЁё]/.test(т) && /2027-yil 20-mart/.test(т), 'uz: ' + JSON.stringify(т));
      await page.close(); }
  } finally { await br.close(); }
  console.log(плохо ? 'ПРОВАЛОВ: ' + плохо : 'ВСЁ ПРОШЛО');
  process.exit(плохо ? 1 : 0);
})();
