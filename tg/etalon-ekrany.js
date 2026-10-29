'use strict';
/* ЭТАЛОН ЭКРАНОВ (29.10, его условие перед ролями: «нужно убедиться, что
   ничего не сломаем из того, что уже работает»).

   Снимает одни и те же экраны у двух сборок — «было» (по умолчанию main из
   git) и «стало» (рабочая копия) — в одном прогоне, на одном стенде, с одними
   данными, и сравнивает попиксельно. Оба снимка делаются в один день и в одну
   минуту стенда, поэтому даты на экранах совпадают и не дают ложных отличий.

     node tg/etalon-ekrany.js                 main против рабочей копии
     node tg/etalon-ekrany.js <ref>           <ref> (ветка, коммит, тег) против рабочей копии
     node tg/etalon-ekrany.js <ref> <файл>    <ref> против указанного index.html
     GF_ETALON_OUT=папка                      куда писать отчёт (по умолчанию
                                              docs/reviews/<дата>-etalon-ekrany)
   Код выхода 1 — хоть один экран изменился сильнее порога. Отчёт — otchet.md,
   рядом снимки «было», «стало» и карта отличий (красное) для изменившихся.

   Самопроверка инструмента: main против main должен дать 0 изменённых экранов.
   Где роли и другие новые функции ещё спрятаны выключателем, любое отличие
   здесь — повод остановить выпуск и разобраться. */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const M = require('./mock');

const КОРЕНЬ = path.join(__dirname, '..');
const [ссылка = 'main', файл = path.join(КОРЕНЬ, 'index.html')] = process.argv.slice(2);
const ДАТА = M.TODAY;
const ВЫХОД = process.env.GF_ETALON_OUT || path.join(КОРЕНЬ, 'docs/reviews', ДАТА + '-etalon-ekrany');
const ПОРОГ = 40;   /* пикселей. Долей мерить нельзя: подпись в панели на странице высотой 5000 px — 0,03 %. main против main даёт 0. */

/* ── данные стенда: те же, что в shot-all (обжитой день, цель, прогресс) ── */
const цель = { text: '75 кг к концу января · старт 1 сентября · мышцы и силу сохраняем', wt: 'down', rate: -0.67, from: M.Д(33), w0: 92.3, by: '2027-02-10', kg: 17.3 };
const progress = { anchor: M.Д(19), anchorW: 88.3, rate: -0.67, gap: 0.7, fact: -4.7, plan: -5.4, onTrack: false, sinceFact: -0.7, sincePlan: -1.4,
  verdict: { state: 'стоит', text: 'Неделя без снижения: −0,0 кг по средним (3 замера).' }, eta: { pace: -0.43, weeks: 29, date: '2027-04-26' },
  sila: { verdict: 'растёт', up: 2, flat: 1, down: 1, rows: [
    { name: 'Жим лёжа', now: { w: 62.5, r: 8, date: M.Д(2) }, was: { w: 60, r: 8, date: M.Д(12) }, pct: 4.2 },
    { name: 'Присед', now: { w: 77.5, r: 6, date: M.Д(1) }, was: { w: 80, r: 6, date: M.Д(10) }, pct: -3.1 } ] } };
const день = { meals: [
  { id: 1, t: '08:40', kind: 'завтрак', text: 'Творог обезжиренный 200 г, 2 яйца, банан', kcal: 430, prot: 49, fat: 12, carb: 44, img: '/p/a.jpg' },
  { id: 2, t: '13:55', kind: 'обед', text: 'Паровые котлеты, грудка с рисом и овощами', kcal: 544, prot: 59, fat: 14, carb: 52, img: '/p/b.jpg' },
  { id: 3, t: '16:20', kind: 'перекус', text: 'Груша и хурма 230 г', kcal: 141, prot: 1, fat: 0, carb: 34, img: '/p/c.jpg' } ] };
const обжито = () => ({ time: '19:40', day: день, goal: цель, progress, meas: M.замеры(), hist: M.журнал() });
const клик = sel => async p => { const b = p.locator(sel).first(); if (await b.count()) { await b.click(); await p.waitForTimeout(400); } };
const СЦЕНЫ = [
  ['glavnaya', Object.assign(обжито(), { page: 'home' })],
  ['glavnaya-utro', { page: 'home', time: '08:10', day: { meals: [], kcal: 0, prot: 0 }, score: null, goal: цель, progress, meas: M.замеры() }],
  ['glavnaya-novichok', { page: 'home', time: '12:00', newbie: true, day: null, score: null }],
  ['glavnaya-bez-zala', Object.assign(обжито(), { page: 'home', me: { only: 'food', sex: 'm', age: 38, ht: 178, bw: 88.1 } })],
  ['zal', Object.assign(обжито(), { page: 'gym', time: '18:05' })],
  ['zal-zhurnal', Object.assign(обжито(), { page: 'log' })],
  ['zal-katalog', Object.assign(обжито(), { page: 'ref' })],
  ['eda', Object.assign(обжито(), { page: 'food' })],
  ['eda-priem', Object.assign(обжито(), { page: 'food' }), клик('#p-food [data-mid], #p-food .meal, #p-food .frow')],
  ['chto-sest', Object.assign(обжито(), { page: 'eat', time: '12:30' })],
  ['chto-sest-nedelya', Object.assign(обжито(), { page: 'eat', time: '12:30' }), клик('#eatbody [data-eseg="week"]')],
  ['chto-sest-kupit', Object.assign(обжито(), { page: 'eat', time: '12:30' }), клик('#eatbody [data-eseg="buy"]')],
  ['reiting', Object.assign(обжито(), { page: 'circle' })],
  ['profil', Object.assign(обжито(), { page: 'home' }), клик('#profbtn')],
  ['trener', Object.assign(обжито(), { page: 'home' }), клик('#coachnav')],
  ['telo-zhir', Object.assign(обжито(), { page: 'home' }), клик('[data-vzv="fat"]')]
];
const УЗКИЕ = ['glavnaya', 'zal', 'eda'];   /* их же — на 320 px */

/* ── две сборки: каждая со своим сервером ── */
function исходник(ref) {
  try { return execSync('git show ' + ref + ':index.html', { cwd: КОРЕНЬ, maxBuffer: 64 << 20 }).toString(); }
  catch (e) { console.error('Не нашёл index.html в «' + ref + '»: ' + e.message.split('\n')[0]); process.exit(2); }
}
const ТИПЫ = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webp': 'image/webp' };
function сервер(html) {
  return new Promise(ok => {
    const s = http.createServer((q, r) => {
      let u = decodeURIComponent(q.url.split('?')[0]);
      if (u === '/' || u === '/index.html') { r.writeHead(200, { 'content-type': ТИПЫ['.html'] }); return r.end(html); }
      const f = path.join(КОРЕНЬ, path.normalize(u).replace(/^(\.\.[/\\])+/, ''));
      if (!f.startsWith(КОРЕНЬ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': ТИПЫ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    });
    s.listen(0, '127.0.0.1', () => ok({ s, base: 'http://127.0.0.1:' + s.address().port + '/' }));
  });
}

async function снять(br, base, сцена, тема, ширина) {
  const [, o, после] = сцена;
  const page = await br.newPage({ viewport: { width: ширина, height: 844 }, deviceScaleFactor: 1 });
  const опции = JSON.parse(JSON.stringify(o)); опции.theme = тема; опции.base = base;
  const ошибки = await M.поднять(page, опции);
  /* Анимации и переходы — в конечное положение: иначе снимок ловит пульс
     метки или выезд листа в случайный момент, и main против main «меняется». */
  const стоп = () => page.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition:none!important;caret-color:transparent!important}' });
  await стоп();
  await page.waitForTimeout(500);
  if (после) { await после(page); await стоп(); await page.waitForTimeout(300); }
  const png = await page.screenshot({ fullPage: true });
  await page.close();
  return { png, ошибки };
}

async function сравнить(page, a, b) {
  return page.evaluate(async ([a, b]) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const A = await load(a), B = await load(b);
    const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, w, h).data;
    x.fillRect(0, 0, w, h); x.drawImage(B, 0, 0); const im = x.getImageData(0, 0, w, h), d = im.data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const raz = Math.abs(da[i] - d[i]) + Math.abs(da[i + 1] - d[i + 1]) + Math.abs(da[i + 2] - d[i + 2]);
      if (raz > 48) { n++; d[i] = 230; d[i + 1] = 30; d[i + 2] = 30; d[i + 3] = 255; } else d[i + 3] = 50;
    }
    x.clearRect(0, 0, w, h); x.putImageData(im, 0, 0);
    return { n, всего: w * h, размерА: [A.width, A.height], размерБ: [B.width, B.height], карта: c.toDataURL('image/png').split(',')[1] };
  }, [a.toString('base64'), b.toString('base64')]);
}

(async () => {
  const было = await сервер(исходник(ссылка));
  const стало = await сервер(fs.readFileSync(файл, 'utf8'));
  fs.mkdirSync(ВЫХОД, { recursive: true });
  const br = await chromium.launch();
  const холст = await br.newPage();
  const строки = [], изменились = [];
  const задачи = [];
  for (const тема of ['light', 'dark']) for (const с of СЦЕНЫ) {
    задачи.push([с, тема, 390]);
    if (УЗКИЕ.includes(с[0])) задачи.push([с, тема, 320]);
  }
  for (const [с, тема, ш] of задачи) {
    const имя = с[0] + '-' + тема + (ш === 390 ? '' : '-' + ш);
    const A = await снять(br, было.base, с, тема, ш), B = await снять(br, стало.base, с, тема, ш);
    const r = await сравнить(холст, A.png, B.png);
    const доля = r.n / r.всего, размер = r.размерА.join('×') !== r.размерБ.join('×');
    const плохо = r.n > ПОРОГ || размер;
    const новыеОшибки = B.ошибки.filter(e => !A.ошибки.includes(e));
    if (плохо || новыеОшибки.length) {
      изменились.push(имя);
      fs.writeFileSync(path.join(ВЫХОД, имя + '-bylo.png'), A.png);
      fs.writeFileSync(path.join(ВЫХОД, имя + '-stalo.png'), B.png);
      fs.writeFileSync(path.join(ВЫХОД, имя + '-raznica.png'), Buffer.from(r.карта, 'base64'));
    }
    строки.push('| ' + имя + ' | ' + (плохо ? '**изменился**' : 'как было') + ' | ' + (доля * 100).toFixed(3) + ' % | ' +
      (размер ? r.размерА.join('×') + ' → ' + r.размерБ.join('×') : r.размерБ.join('×')) + ' | ' + (новыеОшибки.length ? новыеОшибки[0].slice(0, 80) : '') + ' |');
    console.log((плохо ? '✗ ' : '✓ ') + имя + '  ' + (доля * 100).toFixed(3) + ' %' + (размер ? '  размер ' + r.размерА.join('×') + '→' + r.размерБ.join('×') : '') + (новыеОшибки.length ? '  ОШИБКА: ' + новыеОшибки[0].slice(0, 80) : ''));
  }
  await br.close(); было.s.close(); стало.s.close();
  const отчёт = '# Эталон экранов ' + ДАТА + '\n\nБыло: `' + ссылка + '` · стало: `' + path.relative(КОРЕНЬ, файл) + '`\n\n' +
    'Изменилось экранов: **' + изменились.length + ' из ' + задачи.length + '** (порог — больше ' + ПОРОГ + ' отличающихся пикселей).\n\n' +
    '| Экран | Итог | Отличие | Размер | Новая ошибка |\n|---|---|---|---|---|\n' + строки.join('\n') + '\n';
  fs.writeFileSync(path.join(ВЫХОД, 'otchet.md'), отчёт);
  console.log('\n' + (изменились.length ? '✗ изменилось ' + изменились.length + ' из ' + задачи.length : '✓ все ' + задачи.length + ' экранов как было') + ' · отчёт: ' + path.relative(КОРЕНЬ, ВЫХОД) + '/otchet.md');
  process.exit(изменились.length ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(2); });
