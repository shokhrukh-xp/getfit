'use strict';
/* Главная «Сегодня» — полукруг дня. Его правка 11.09: ночь не рисуем, окно
   06→22 раздвигается под поздние записи. Проверяем геометрию на обжитых днях:
   пузыри в кадре, число внутри дуги, края окна подписаны. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ЕДА = [
  { id:1, t:'08:40', kind:'завтрак', kcal:420, prot:26, img:'/p/a.jpg' },
  { id:2, t:'13:20', kind:'обед',    kcal:610, prot:41, img:'/p/b.jpg' }
];

async function часы(page){
  return page.evaluate(() => {
    const svg = document.querySelector('.hclk-svg'), r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal, k = r.width / vb.width;
    return { cx: r.left + 175 * k, cy: r.top + 214 * k, R: 126 * k, box: r.toJSON(),
      часы: Array.from(svg.querySelectorAll('.hch')).map(e => e.textContent),
      слова: Array.from(svg.querySelectorAll('.hcw')).map(e => ({ t: e.textContent, x: e.getBoundingClientRect().left })),
      пузыри: Array.from(svg.querySelectorAll('.hb')).map(e => ({ cls: e.getAttribute('class'), b: e.getBoundingClientRect().toJSON() })),
      строки: Array.from(document.querySelectorAll('.hctr > *')).map(e => {
        /* меряем сам текст, а не блок: у блока поля шире слов */
        const rg = document.createRange(); rg.selectNodeContents(e);
        const b = rg.getBoundingClientRect(); return { t: e.textContent.slice(0, 24), b: b.toJSON() };
      }),
      сон: !!svg.querySelector('.hcsleep'), дуга: !!svg.querySelector('.hcring') };
  });
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 844 } });
  const ош = await M.поднять(page, { theme: 'dark', time: '19:40', day: { meals: ЕДА } });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  const ч = await часы(page);
  дано(ч.дуга, 'дуга дня нарисована');
  дано(!ч.сон, 'ночного сектора больше нет');
  дано(ч.слова.length === 2 && ч.слова[0].t === 'утро' && ч.слова[1].t === 'вечер', 'два слова: утро и вечер');
  дано(ч.слова[0].x < ч.cx && ч.слова[1].x > ч.cx, 'утро слева, вечер справа');
  дано(ч.часы[0] === '06' && ч.часы[ч.часы.length - 1] === '22', 'края окна подписаны: 06 и 22, а не середина');

  /* всё, что нарисовано, должно быть в кадре */
  const вылез = ч.пузыри.filter(p => p.b.left < ч.box.left - 1 || p.b.right > ч.box.right + 1 || p.b.top < ч.box.top - 1);
  дано(вылез.length === 0, 'пузыри не вылезают за кадр ' + JSON.stringify(вылез.map(v => v.cls)));

  /* число живёт ВНУТРИ полукруга — это и есть весь смысл геометрии */
  const вне = ч.строки.filter(с => [[с.b.left, с.b.top], [с.b.right, с.b.top],
      [с.b.left, с.b.bottom], [с.b.right, с.b.bottom]]
    .some(([x, y]) => Math.hypot(x - ч.cx, y - ч.cy) > ч.R - 2));
  дано(вне.length === 0, 'число и подписи не выходят за дугу ' + JSON.stringify(вне.map(v => v.t)));

  дано((await page.$$('.hweek .hwd')).length === 7, 'неделя семью точками');
  дано((await page.$$('.hrows .hrow')).length >= 3, 'дорожки под часами на месте');

  /* пузырь еды — это вход в «Еду», пустое место следующего приёма — камера */
  дано(await page.$('.hb-meal[data-hgo="food"]') !== null, 'по фото еды можно уйти в «Еду»');
  дано(await page.$('.hb-next[data-hact="photo"], .hb-todo[data-hact="photo"]') !== null, 'пустое место приёма ведёт к камере');
  дано(await page.$('.hb-w') !== null, 'взвешивание стоит на дуге');
  await page.click('.hb-meal[data-hgo="food"]');
  await page.waitForTimeout(400);
  дано(await page.isVisible('#p-food, [data-page="food"]').catch(() => false) || await page.$eval('body', b => /Еда/.test(b.textContent)), 'тап по еде открыл «Еду»');
  await page.close();

  /* поздняя запись раздвигает окно до полуночи */
  const p2 = await br.newPage({ viewport: { width: 390, height: 844 } });
  await M.поднять(p2, { theme: 'dark', time: '23:20', day: { meals: ЕДА.concat([
    { id:3, t:'20:30', kind:'ужин', kcal:700, prot:44, img:'/p/c.jpg' },
    { id:4, t:'23:10', kind:'ужин', kcal:530, prot:12, img:'/p/d.jpg' } ]) } });
  const ч2 = await часы(p2);
  дано(ч2.часы[ч2.часы.length - 1] === '00', 'после записи в 23:10 окно дотянулось до 00, а не обрезало её');
  дано(ч2.пузыри.filter(p => /hb-meal/.test(p.cls)).length === 4, 'все четыре приёма на дуге');
  const вылез2 = ч2.пузыри.filter(p => p.b.right > ч2.box.right + 1 || p.b.left < ч2.box.left - 1);
  дано(вылез2.length === 0, 'поздний приём тоже в кадре');
  await p2.close();

  /* пустое утро: день ещё не начался, но места приёмов уже видны */
  const p3 = await br.newPage({ viewport: { width: 390, height: 844 } });
  await M.поднять(p3, { theme: 'dark', time: '08:15', day: { meals: [], kcal:0, prot:0, fat:0, fib:0, sug:0 }, score: null });
  const ч3 = await часы(p3);
  дано(ч3.пузыри.filter(p => /hb-todo|hb-next/.test(p.cls)).length >= 2, 'на пустом дне видны места будущих приёмов');
  дано(/оценка — с первой записью/.test(await p3.textContent('.hctr')), 'без записей оценка не выдумывается');
  await p3.close();

  /* ── перебор в пределах коридора — не промах ──
     Его вопрос 11.09 вечером: «я же уложился в норму, почему +78 красным?».
     Коридор ±10 % — тот же, по которому считается оценка дня и красится
     неделя. Три места об одном факте обязаны красить одинаково. */
  const цвет = async (page) => page.$eval('.hctr b', e => ({
    cls: e.className, col: getComputedStyle(e).color, t: e.textContent }));
  const НОРМА = { kcal: 1700, prot: 160, fat: { min: 45, max: 66 }, fib: 30, sug: 45,
    parts: { base: 1700, gym: 0, acts: 0, plan: 0, delta: 0, k: 1 } };

  const p4 = await br.newPage({ viewport: { width: 390, height: 844 } });
  await M.поднять(p4, { theme: 'dark', time: '21:11',
    day: { meals: ЕДА, kcal: 1778, prot: 162, targets: НОРМА } });
  const c4 = await цвет(p4);
  дано(/okover/.test(c4.cls), '+78 при норме 1700 (+4,6 %) — не красный: ' + c4.t + ' · ' + c4.cls);
  дано(!/\bover\b/.test(c4.cls.replace('okover','')), 'класса промаха на нём нет');
  const зелёный = c4.col;
  await p4.close();

  const p5 = await br.newPage({ viewport: { width: 390, height: 844 } });
  await M.поднять(p5, { theme: 'dark', time: '21:11',
    day: { meals: ЕДА, kcal: 2100, prot: 162, targets: НОРМА } });
  const c5 = await цвет(p5);
  дано(/\bover\b/.test(c5.cls) && !/okover/.test(c5.cls),
    '+400 при норме 1700 (+23,5 %) — уже промах: ' + c5.t + ' · ' + c5.cls);
  дано(c5.col !== зелёный, 'и цвет другой, чем у перебора в коридоре');
  await p5.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
