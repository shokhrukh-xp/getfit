'use strict';
/* Общая обвязка проверок: поднимает приложение в браузере без Telegram и без
   сервера. Всё, что приложение спрашивает у воркера, отвечает этот файл.
   Даты СЧИТАЮТСЯ ОТ СЕГОДНЯ (тест с захардкоженной датой разваливается в
   полночь — так и вышло 11.09 с test-circle). */
const Д = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const TODAY = Д(0);
const БАЗА = 'http://127.0.0.1:8899/';

/* ── данные «обжитого» дня: он смотрит на реальные экраны, а не на пустые ── */
function день(o) {
  o = o || {};
  const приёмы = o.meals !== undefined ? o.meals : [
    { id: 1, t: '08:40', kind: 'завтрак', kcal: 420, prot: 26, img: '/p/a.jpg', text: 'омлет с индейкой' },
    { id: 2, t: '13:20', kind: 'обед',    kcal: 610, prot: 41, img: '/p/b.jpg', text: 'курица с рисом' }
  ];
  const сумма = k => приёмы.reduce((s, m) => s + (+m[k] || 0), 0);
  return {
    date: o.date || TODAY, meals: приёмы, acts: o.acts || [],
    kcal: o.kcal !== undefined ? o.kcal : сумма('kcal'),
    prot: o.prot !== undefined ? o.prot : сумма('prot'),
    fat: o.fat || 48, fib: o.fib || 17, sug: o.sug || 32,
    line: o.line || 'За день: 1030 ккал, белка 67 г. До нормы ещё 1080 ккал.',
    targets: o.targets || { kcal: 2110, prot: 165, fat: { min: 52, max: 78 }, fib: 30, sug: 50,
      parts: { base: 1780, gym: 330, acts: 0, plan: 0, delta: 0, k: 1 } }
  };
}
function неделя(o) {
  o = o || {};
  const дни = [];
  for (let i = 6; i >= 0; i--) дни.push({ date: Д(i), kcal: [2050, 1880, 2210, 2000, 2450, 1960, 1030][6 - i], n: i === 0 ? 2 : 3 });
  return { targets: { kcal: 2110, prot: 165 }, days: o.days || дни };
}
function замеры() {
  const m = [];
  for (let i = 0; i < 8; i++) m.push({
    date: Д(i), w: 88.1 + i * 0.16, fat: 26.4 + i * 0.08, muscle: 60.6 - i * 0.05,
    lean: 64.8, visc: 13, bmr: 1820, created: new Date(Д(i) + 'T07:28:00').getTime()
  });
  return m;
}
function круг() {
  return {
    ok: true, circle: 'family', name: 'семья',
    board: [
      { uid: '308687648', name: 'Ты', me: true, today: { r: 8.4 }, ravg: 7.9, streak: 6 },
      { uid: '850965787', name: 'жена', today: { r: 9.1 }, ravg: 8.3, streak: 9 }
    ],
    me: { streak: 6, level: 2, week: 41 }
  };
}

/* ── подстановки ── */
async function поднять(page, o) {
  o = o || {};
  const час = o.time || '14:03';
  const день_ = o.day === null ? null : день(o.day || {});
  const оценка = o.score === null ? null
    : Object.assign({ ok: true, r: 8.4, closed: false, why: [{ t: 'недобрал белок', v: 1.6 }] }, o.score || {});

  await page.addInitScript(([час, тема, сеанс]) => {
    /* время фиксируем: иначе «сейчас» ездит по циферблату между прогонами */
    const R = Date, ч = +час.split(':')[0], м = +час.split(':')[1];
    const F = new R(); F.setHours(ч, м, 0, 0); const f = F.getTime();
    window.Date = new Proxy(R, {
      construct: (t, a) => a.length ? new t(...a) : new t(f),
      apply: () => new R(f).toString(),
      get: (t, p) => p === 'now' ? (() => f) : t[p]
    });
    /* Telegram: приложение живёт внутри мини-аппа */
    window.Telegram = { WebApp: {
      initData: 'mock', initDataUnsafe: { user: { id: 308687648, first_name: 'Ш' } },
      colorScheme: тема, themeParams: {}, version: '7.0', platform: 'macos',
      expand(){}, ready(){}, close(){}, disableVerticalSwipes(){}, enableVerticalSwipes(){},
      enableClosingConfirmation(){}, disableClosingConfirmation(){}, requestFullscreen(){},
      setHeaderColor(){}, setBackgroundColor(){}, onEvent(){}, offEvent(){},
      HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
      MainButton: { show(){}, hide(){}, setText(){}, onClick(){}, offClick(){} },
      BackButton: { show(){}, hide(){}, onClick(){}, offClick(){} },
      CloudStorage: {
        getItem(k, cb){ cb(null, localStorage.getItem('cs_' + k) || ''); },
        setItem(k, v, cb){ localStorage.setItem('cs_' + k, v); cb && cb(null, true); },
        getKeys(cb){ cb(null, []); }, removeItem(k, cb){ cb && cb(null, true); }
      }
    } };
    try {
      localStorage.setItem('shp_v1_profile', '"shp"');
      localStorage.setItem('shp_v1_page', JSON.stringify(сеанс));
    } catch (e) {}
  }, [час, o.theme || 'dark', o.page || 'home']);

  await page.route('**/getfit-sync.sh-pulatov.workers.dev/**', async route => {
    const u = new URL(route.request().url()), p = u.pathname;
    const дать = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (p === '/all')        return дать({ state: [], workouts: [], meals: [], measures: [] });
    if (p === '/s')          return дать({ ok: true });
    if (p === '/day')        return дать(день_ ? { ok: true, day: день_ } : { ok: true, day: день({ meals: [], kcal: 0, prot: 0, fat: 0, fib: 0, sug: 0 }) });
    if (p === '/day/score')  return дать(оценка || { ok: true, r: null });
    if (p === '/week')       return дать({ ok: true, week: неделя(o.week || {}) });
    if (p === '/measures')   return дать({ ok: true, measures: o.meas === null ? [] : замеры() });
    if (p === '/circle')     return дать(o.circle === null ? { ok: false } : круг());
    if (p === '/goal')       return дать({ ok: true, goal: { w: 73, fat: 12 } });
    if (p === '/food')       return дать(o.onFood ? o.onFood(route) : {
      ok: true, reply: 'Записал: плов с говядиной, 650 ккал, белка 32 г. До нормы осталось 430 ккал.',
      day: день({ meals: (день_ ? день_.meals : []).concat([{ id: 9, t: '14:03', kind: 'обед', kcal: 650, prot: 32, img: '/p/c.jpg', text: 'плов' }]) })
    });
    return дать({ ok: true });
  });

  const ошибки = [];
  page.on('pageerror', e => ошибки.push(String(e)));
  await page.goto(БАЗА, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(o.wait || 1400);
  return ошибки;
}

module.exports = { Д, TODAY, БАЗА, поднять, день, неделя, замеры, круг };
