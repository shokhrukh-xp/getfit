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
  метки: Array.from(document.querySelectorAll('.hclk-svg .hbl')).map(e => e.textContent),
  плюс: !!document.querySelector('.hb-next'),
  совет: (document.querySelector('.hnext') || {}).textContent || '',
  /* 12.09: поля на главной больше нет — разговор один, за круглой кнопкой.
     Подсказку в нём читаем, открыв разговор. */
  кнопка: (document.querySelector('#ctext') || {}).placeholder || ''
}));
const подсказка = async page => {
  await page.click('#coachfab');
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
  дано(/хватит|на сегодня/.test(ч.совет), 'строка говорит то же самое: ' + ч.совет);
  const край = await page.evaluate(() => Array.from(document.querySelectorAll('.hclk-svg .hch')).map(e => e.textContent).pop());
  дано(край === '22', 'рекомендация не удлиняет день: край окна ' + край);
  await page.close();

  /* 4. блок тела: вес, жир и белок числами, без «мышц» и без графиков */
  page = await br.newPage({ viewport: { width: 390, height: 844 } });
  await M.поднять(page, { time: '16:10', day: { meals: ЕДА, targets: НОРМА } });
  const тело = await page.evaluate(() => ({
    колонки: Array.from(document.querySelectorAll('.hbody .hbh s')).map(e => e.textContent),
    строки: Array.from(document.querySelectorAll('.hbody .hbr:not(.hbh)')).map(e => ({
      имя: e.querySelector('u').childNodes[0].textContent.trim(),
      под: (e.querySelector('u em') || {}).textContent || '',
      знач: e.querySelector('b').textContent,
      дельты: Array.from(e.querySelectorAll(':scope > s')).map(x => x.textContent),
      цвет: e.querySelector('s:last-child').className })),
    графики: document.querySelectorAll('.hbody svg').length
  }));
  дано(тело.колонки.join(',') === 'день,неделя,всего', 'три горизонта в шапке: ' + тело.колонки);
  дано(тело.строки.every(r => r.дельты.length === 3), 'у каждой строки три дельты');
  дано(тело.строки.every(r => r.дельты.every(d => d === '—' || /^[+−]\d+,\d$/.test(d))),
    'дельты с одним знаком после запятой: ' + JSON.stringify(тело.строки[0].дельты));
  дано(тело.строки[0].дельты[2] === '−4,2', 'за всё время вес считается от первого замера, а не от края окна: ' + тело.строки[0].дельты[2]);
  дано(тело.строки.length === 3, 'в блоке тела три строки');
  дано(тело.строки.map(r => r.имя).join(',') === 'вес,жир,белок', 'это вес, жир и белок: ' + тело.строки.map(r => r.имя));
  дано(/%/.test(тело.строки[1].под), 'у жира рядом с килограммами стоит процент: ' + тело.строки[1].под);
  дано(!тело.строки.some(r => /мышц/.test(r.имя)), '«мышц» больше нет — весы считают ими воду');
  дано(тело.графики === 0, 'графиков в блоке тела нет — они дублировали дорожки');
  дано(/кг/.test(тело.строки[1].знач), 'жир показан в килограммах, а не в процентах');
  дано(тело.строки[2].цвет === 'up' || тело.строки[2].цвет === 'dn' || тело.строки[2].цвет === '',
    'у белка своя логика цвета (рост — хорошо)');
  await page.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
