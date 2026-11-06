'use strict';
/* 06.11, его пункт 5: «Про Шаги и Сон нужно сначала сделать интеграцию с телефоном и другими приложениями чтобы их
   можно было автоматически брать, потом уже показать в нашем приложении». Выключатель zdorovye (сначала ему и svc_*).
   Проверяется: блок «Шаги и сон» есть только в приложении с «Здоровьем»; «Подключить» просит только чтение шагов и сна;
   шаги — суммой по дням, сон — склеенные отрезки «сплю» без «в кровати», к дню пробуждения; числа уходят в /wear
   и сразу видны; без выключателя и в Telegram блока нет (ui3). */
const { chromium } = require('playwright'), M = require('./mock'), { opts } = require('./shot-clean');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
async function поднять(b, вид, ф, доп){
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }), сервер = { wear: [], day: 0 };
  if (вид === 'ios') await p.addInitScript(() => {
    window.__зд = [];
    const пусто = new Proxy({}, { get: (t, м) => м === 'then' ? undefined : () => Promise.resolve({ remove(){} }) });
    const сег = new Date(); сег.setHours(0, 0, 0, 0);
    const ч = (дн, h, m) => new Date(сег.getTime() + дн * 864e5 + (h * 60 + (m || 0)) * 6e4).toISOString();
    const Health = {
      isAvailable: () => Promise.resolve({ available: true, platform: 'ios' }),
      requestAuthorization: a => { window.__зд.push(['auth', a]); return Promise.resolve({ readAuthorized: a.read, readDenied: [], writeAuthorized: [], writeDenied: [] }); },
      queryAggregated: a => { window.__зд.push(['agg', a]); return Promise.resolve({ samples: [
        { startDate: ч(-1, 0), endDate: ч(0, 0), value: 8412, values: { sum: 8412 }, unit: 'count' },
        { startDate: ч(0, 0), endDate: ч(1, 0), value: 3100.4, values: { sum: 3100.4 }, unit: 'count' }] }); },
      readSamples: a => { window.__зд.push(['read', a]); return Promise.resolve({ samples: [
        { dataType: 'sleep', sleepState: 'inBed', startDate: ч(-1, 22, 30), endDate: ч(0, 7, 10), value: 640, unit: 'minute' },
        { dataType: 'sleep', sleepState: 'asleep', startDate: ч(-1, 23, 0), endDate: ч(0, 3, 0), value: 240, unit: 'minute', sourceName: 'iPhone' },
        { dataType: 'sleep', sleepState: 'deep', startDate: ч(-1, 23, 30), endDate: ч(0, 2, 0), value: 150, unit: 'minute', sourceName: 'Watch' },
        { dataType: 'sleep', sleepState: 'awake', startDate: ч(0, 3, 0), endDate: ч(0, 3, 20), value: 20, unit: 'minute' },
        { dataType: 'sleep', sleepState: 'rem', startDate: ч(0, 3, 20), endDate: ч(0, 7, 0), value: 220, unit: 'minute' }] }); }
    };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { Haptics: пусто, App: пусто, Browser: пусто, StatusBar: пусто, Health } };
    let исх; Object.defineProperty(window, 'Telegram', { configurable: true, get(){ return исх; },
      set(v){ if (v && v.WebApp) { v.WebApp.initData = ''; v.WebApp.initDataUnsafe = {}; } исх = v; } });
    try { localStorage.setItem('wb_session', JSON.stringify({ token: 'sess-test-1', user: { id: '308687648', first_name: 'Ш' } })); } catch (e) {}
  });
  const o = opts('light'); o.bot = false; o.page = доп && доп.page || 'home'; o.features = ф; if (доп && доп.parts) o.day = Object.assign({}, o.day, { targets: Object.assign({}, o.day.targets, { kcal: 2050, parts: доп.parts }) });
  o.handleRoute = async r => {
    const u = new URL(r.request().url());
    if (u.pathname === '/day') сервер.day++;
    if (u.pathname === '/wear') {
      const т = JSON.parse(r.request().postData() || '{}'); сервер.wear.push(т);
      const дни = o.week.days || M.неделя().days;
      o.week = Object.assign({}, o.week, { шагиСон: { дни: дни.map(d => { const x = т.rows.find(y => y.date === d.date); return { date: d.date, steps: x ? x.steps : null, sleep: x ? x.sleep_min : null }; }), шагов: 5756, днейШаги: 2, сна: 480, ночей: 1, авто: true } });
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, saved: т.rows.length }) }); return true;
    }
    return false;
  };
  const err = await M.поднять(p, o); await p.waitForTimeout(900);
  return { p, err, сервер };
}
const виден = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!(e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0); }, sel);
(async () => { const b = await chromium.launch(); try {
  { const { p, err, сервер } = await поднять(b, 'ios', ['panel2', 'ui3', 'zdorovye']);
    ok(await виден(p, '#homebody .wear-surface') && await виден(p, '[data-zdon]'), 'приложение с «Здоровьем»: блок «Шаги и сон» на «Сегодня» с кнопкой «Подключить»');
    ok(await p.evaluate(() => { const w = document.querySelector('#homebody .wear-surface'); return !!w && w.previousElementSibling && w.previousElementSibling.classList.contains('hdaycard'); }), 'блок — сразу под карточкой дня');
    ok(/сверх 5\s000/.test(await p.$eval('.wear-surface', e => e.textContent)), 'сказано, что шаги сверх 5 000 прибавятся к норме');
    ok(!(await виден(p, '#wrh [data-wrcoach]')), 'кнопки «Прислать» (скриншот) нет');
    if (process.env.SHOT) { await p.$eval('.wear-surface', e => e.scrollIntoView({ block: 'center' })); await p.screenshot({ path: '/tmp/wbf/zd-1.png' }); }
    ok(сервер.wear.length === 0 && !(await p.evaluate(() => window.__зд.length)), 'до «Подключить» — ни запроса к «Здоровью», ни к серверу');
    const днейДо = сервер.day;
    await p.click('[data-zdon]'); await p.waitForTimeout(900);
    ok(сервер.day > днейДо, 'после новых шагов норма дня запрошена заново');
    const вызовы = await p.evaluate(() => window.__зд);
    const auth = вызовы.find(x => x[0] === 'auth');
    ok(auth && auth[1].read.join() === 'steps,sleep' && !(auth[1].write || []).length, 'просим только чтение шагов и сна: ' + JSON.stringify(auth && auth[1]));
    const agg = вызовы.find(x => x[0] === 'agg');
    ok(agg && agg[1].bucket === 'day' && agg[1].dataType === 'steps', 'шаги — суммой по дням');
    const т = сервер.wear[0] || { rows: [] }, сег = await p.evaluate(() => { const d = new Date(); return [d, new Date(d.getTime() - 864e5)].map(x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')); });
    ok(т.src === 'apple' && JSON.stringify(т.rows) === JSON.stringify([{ date: сег[1], steps: 8412, sleep_min: null }, { date: сег[0], steps: 3100, sleep_min: 460 }]),
      'в /wear: вчера 8 412 шагов; сегодня 3 100 и сон 7 ч 40 мин (наложения iPhone и часов склеены, «в кровати» и «проснулся» не в счёт): ' + JSON.stringify(т));
    const блок = await p.$eval('.wear-surface', e => e.textContent);
    if (process.env.SHOT) { await p.$eval('.wear-surface', e => e.scrollIntoView({ block: 'center' })); await p.screenshot({ path: '/tmp/wbf/zd-2.png' }); }
    ok(/сегодня\s3\s100 · в среднем\s5\s756/.test(блок) && !/скриншот|ориентир/i.test(блок), 'после подключения — таблица и одна строка «сегодня · в среднем», без абзаца: ' + блок.slice(0, 160));
    ok(await p.evaluate(() => !document.querySelector('#p-food .wear-surface')), 'на «Еде» блока больше нет');
    ok(!err.length, 'без ошибок ' + err.join(' | ').slice(0, 200));
    await p.close(); }
  /* норма дня: слагаемое «шаги» в раскладке на «Еде» */
  { const { p, err } = await поднять(b, 'ios', ['zdorovye'], { page: 'food', parts: { base: 2280, gym: 0, acts: 0, plan: 0, steps: 270, delta: -500, k: 1 } });
    const т = await p.$$eval('.fparts', ns => ns.map(n => n.textContent).join(' | '));
    ok(/норма 2050 = база 2280 \+ шаги 270 − 500 по цели/.test(т), 'раскладка нормы: «база 2280 + шаги 270 − 500 по цели»: ' + т);
    ok(!err.length, 'раскладка: без ошибок ' + err.join(' | ').slice(0, 200));
    await p.close(); }
  { const { p } = await поднять(b, 'ios', ['panel2', 'ui3']);
    ok(!(await виден(p, '.wear-surface')), 'без выключателя zdorovye (ui3) — блока нет');
    ok(!(await p.evaluate(() => window.__зд.length)), 'без выключателя к «Здоровью» не обращаемся');
    await p.close(); }
  { const { p } = await поднять(b, 'telegram', ['panel2', 'ui3', 'zdorovye']);
    ok(!(await виден(p, '.wear-surface')), 'в Telegram (нет «Здоровья») — блока нет');
    await p.close(); }
} finally { await b.close(); }
console.log(bad ? '\nПРОВАЛОВ: ' + bad : '\nВсё прошло'); process.exit(bad ? 1 : 0); })();
