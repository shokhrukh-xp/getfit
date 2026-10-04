'use strict';
/* Рекомендация следующего приёма и блок тела.
   11.09 он поел в 15:35, а часы объявили «ужин · сейчас» в 16:10 — окна были
   привязаны к часам на стене, а не к последнему приёму. И спросил, почему
   «мышцы» падают: весы считают мышцами воду. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const НОРМА = { kcal: 1700, prot: 160, fat: { min: 45, max: 66 }, fib: 30, sug: 45,
  parts: { base: 1700, gym: 0, acts: 0, plan: 0, delta: 0, k: 1 } };
const ЕДА = [
  { id: 1, t: '09:26', kind: 'завтрак', kcal: 520, prot: 48, img: '/p/a.jpg' },
  { id: 2, t: '15:35', kind: 'обед',    kcal: 634, prot: 80, img: '/p/b.jpg' }
];
const часы = page => page.evaluate(() => ({
  метки: Array.from(document.querySelectorAll('.hb[aria-label]')).map(e => e.getAttribute('aria-label')),
  плюс: !!document.querySelector('.hb-next'),
  совет: (document.querySelector('.hnext') || {}).textContent || '',
  /* 12.09: поля на главной больше нет — разговор один, за круглой кнопкой.
     Подсказку в нём читаем, открыв разговор. */
  кнопка: (document.querySelector('#ctext') || {}).placeholder || ''
}));
const подсказка = async page => {
  await page.click('#coachnav');
  await page.waitForTimeout(300);
  const t = await page.getAttribute('#ctext', 'placeholder');
  await page.click('#coachclose');
  await page.waitForTimeout(250);
  return t || '';
};

(async () => {
  const br = await chromium.launch();

  /* 1. поел в 15:35 — в 16:10 ужин НЕ «сейчас», а через 3,5 часа */
  let page = await br.newPage({ viewport: { width: 390, height: 844 } });
  let ош = await M.поднять(page, { time: '16:10', day: { meals: ЕДА, targets: НОРМА } });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  let ч = await часы(page);
  дано(!ч.метки.some(t => /сейчас/.test(t)), 'через полчаса после обеда никакого «сейчас» нет');
  дано(ч.метки.some(t => /19:0\d · ужин/.test(t)), 'ужин предложен через 3,5 часа после обеда ' + JSON.stringify(ч.метки));
  дано(/мяса или рыбы/.test(ч.совет), 'под часами сказано, чем закрыть белок: ' + ч.совет);
  const пд = await подсказка(page);
  дано(/ужин/.test(пд), 'поле разговора называет тот же приём, что и часы: ' + пд);
  await page.close();

  /* 2. утром весь дневной белок не валится в один приём */
  page = await br.newPage({ viewport: { width: 390, height: 844 } });
  await M.поднять(page, { time: '08:15', day: { meals: [], kcal: 0, prot: 0, fat: 0, fib: 0, sug: 0, targets: НОРМА }, score: null });
  ч = await часы(page);
  const г = (ч.совет.match(/~\s*(\d+)\s*г/) || [])[1];
  дано(г && +г < 300, 'утром совет по одному приёму, а не на весь день: ' + ч.совет);
  дано(/на приём/.test(ч.совет), 'сказано, что это доза на приём');
  await page.close();

  /* 3. норма закрыта — приёма не советуем ни на часах, ни строкой */
  page = await br.newPage({ viewport: { width: 390, height: 844 } });
  await M.поднять(page, { time: '20:40', day: { meals: ЕДА.concat([
    { id: 3, t: '19:30', kind: 'ужин', kcal: 560, prot: 38, img: '/p/c.jpg' } ]), targets: НОРМА } });
  ч = await часы(page);
  дано(!ч.плюс, 'при закрытой норме «+» с часов убран');
  дано(/только если голоден/.test(ч.совет), 'строка говорит то же самое: ' + ч.совет);
  const край = await page.evaluate(() => Array.from(document.querySelectorAll('.hclk-svg .hch')).map(e => e.textContent).pop());
  дано(край === '22', 'рекомендация не удлиняет день: край окна ' + край);
  await page.close();

  /* 4. блок тела. До 30.09 здесь была таблица «день / неделя / всего» без
     графиков; 30.09 он попросил перенести график весов с «Еды» на главную и
     выбрал карточку с одной величиной (подробно — test-telo.js). Здесь —
     то, что пережило перемену: «мышц» нет, жир в кг с процентом рядом,
     «всего» — от самого первого замера, график один. */
  page = await br.newPage({ viewport: { width: 390, height: 844 } });
  await M.поднять(page, { time: '16:10', day: { meals: ЕДА, targets: НОРМА } });
  const тело = await page.evaluate(() => {
    const v = document.querySelector('#homebody .vz');
    return v ? { чипы: Array.from(v.querySelectorAll('[data-vzv]')).map(b => b.textContent),
      под: v.querySelector('.vzsub').textContent, графики: v.querySelectorAll('.vzsvg svg').length } : null;
    /* 02.10, вариант А: «всего» — от среднего за 7 дней, как крупное число */
  });
  дано(!!тело, 'на главной — карточка «Тело»');
  дано(тело && тело.чипы.join(',') === 'вес,жир,белок', 'величины — вес, жир и белок: ' + (тело && тело.чипы));
  дано(тело && !тело.чипы.some(x => /мышц/.test(x)), '«мышц» больше нет — весы считают ими воду');
  дано(тело && /−3,7/.test(тело.под), 'за всё время — от первого замера до среднего за 7 дней, а не от края окна: ' + (тело && тело.под));
  дано(тело && тело.графики === 1, 'график один — выбранной величины');
  await page.click('[data-vzv="fat"]'); await page.waitForTimeout(300);
  const жир = await page.evaluate(() => ({ ч: document.querySelector('#homebody .vznum b').textContent, п: (document.querySelector('#homebody .vztd') || {}).textContent || '' }));
  дано(/кг$/.test(жир.ч) && /%/.test(жир.п), 'жир показан в килограммах, процент рядом: ' + жир.ч + ' · ' + жир.п);
  await page.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
