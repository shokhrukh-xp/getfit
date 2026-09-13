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
  дни.forEach(function (d, i) { d.prot = [150, 132, 171, 158, 146, 160, 128][i]; });
  const было = дни.filter(d => d.date < TODAY);
  return { targets: { kcal: 2110, prot: 165 }, days: o.days || дни,
    avg: { kcal: Math.round(было.reduce((a, d) => a + d.kcal, 0) / (было.length || 1)),
           prot: Math.round(было.reduce((a, d) => a + d.prot, 0) / (было.length || 1)) } };
}
function замеры() {
  const m = [];
  for (let i = 0; i < 8; i++) {
    const w = 88.1 + i * 0.16, fat = 26.4 + i * 0.08;
    m.push({ date: Д(i), w: +w.toFixed(1), fat: +fat.toFixed(1),
      fatkg: +(w * fat / 100).toFixed(1), lean: +(w - w * fat / 100).toFixed(1),
      muscle: +(60.6 - i * 0.05).toFixed(1), prot: +(17.2 - i * 0.07).toFixed(1),
      water: 42.5, visc: 13, bmr: 1820, created: new Date(Д(i) + 'T07:28:00').getTime() });
  }
  return m;
}
/* самый первый замер — 1 сентября, от него считается колонка «всего» */
function стартовый() {
  return { date: '2026-09-01', w: 92.3, fat: 28.5, fatkg: 26.3, lean: 66, muscle: 62.5,
    water: 45.7, prot: 16.1, visc: 14, bmr: 1796 };
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

/* ── журнал тренировок: три занятия с разметкой каталога ──
   Экраны «Упражнения» и итог блока живут на истории. Без неё они пустые, и
   проверить, что в строке есть фото, а в сравнении — прошлый раз, нельзя.
   id здесь настоящие, из каталога: по ним берутся кадры движения. */
function журнал() {
  const дни = [
    { сдвиг: 6, k: 0 }, { сдвиг: 3, k: 1 }, { сдвиг: 1, k: 2 }
  ];
  /* имена и id — как в готовой программе приложения: только так проверяется
     и путь по id каталога, и путь по имени для записей до 12.09 */
  const движения = [
    { id: 'Barbell_Squat', n: 'Приседания со штангой', w: [70, 72.5, 75], r: 8 },
    { id: 'Barbell_Bench_Press_-_Medium_Grip', n: 'Жим лёжа', w: [55, 55, 57.5], r: 8 },
    { id: 'Stiff-Legged_Dumbbell_Deadlift', n: 'Румынская тяга с гантелями', w: [26, 28, 28], r: 10 },
    { id: 'Plank', n: 'Планка', w: [null, null, null], r: 60, unit: 'sec' }
  ];
  return дни.map(({ сдвиг, k }) => ({
    id: Д(сдвиг) + '_A', date: Д(сдвиг), day: 'A', name: 'День A', week: 1,
    updated: new Date(Д(сдвиг) + 'T19:10:00').toISOString(),
    ex: движения.map(m => ({
      n: m.n, id: m.id, unit: m.unit || 'reps',
      sets: [1, 2, 3].map(() => ({ w: m.w[k], r: m.unit === 'sec' ? m.r + k * 5 : m.r }))
    }))
  }));
}

/* ── подстановки ── */
async function поднять(page, o) {
  o = o || {};
  const час = o.time || '14:03';
  const день_ = o.day === null ? null : день(o.day || {});
  const оценка = o.score === null ? null
    : Object.assign({ ok: true, r: 8.4, closed: false, why: [{ t: 'недобрал белок', v: 1.6 }] }, o.score || {});

  await page.addInitScript(([час, тема, сеанс, новичок, журнал, видел, замены]) => {
    /* время фиксируем: иначе «сейчас» ездит по циферблату между прогонами */
    /* Часы приложения стоят («сейчас» не должно ездить между прогонами), но
       СЧЁТЧИК ВРЕМЕНИ должен идти: иначе стенд не может проверить ничего, что
       живёт секундами, — таймер отдыха, «Заменено» на десять секунд. Поэтому
       new Date() отдаёт замороженный момент, а Date.now() — тот же момент плюс
       реально прошедшее время. */
    const R = Date, ч = +час.split(':')[0], м = +час.split(':')[1];
    const F = new R(); F.setHours(ч, м, 0, 0); const f = F.getTime();
    const t0 = R.now();
    window.Date = new Proxy(R, {
      construct: (t, a) => a.length ? new t(...a) : new t(f),
      apply: () => new R(f).toString(),
      get: (t, p) => p === 'now' ? (() => f + (R.now() - t0)) : t[p]
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
      /* CloudStorage раньше отвечал пустым списком ключей — и любой экран,
         который живёт на истории (Журнал, «Упражнения», итог блока), в
         проверках оставался пустым. Теперь это настоящее хранилище поверх
         localStorage: что записали, то и прочитаем. */
      CloudStorage: {
        getItem(k, cb){ cb(null, localStorage.getItem('cs_' + k) || ''); },
        setItem(k, v, cb){ localStorage.setItem('cs_' + k, v); cb && cb(null, true); },
        getItems(ks, cb){ const o = {}; ks.forEach(k => { o[k] = localStorage.getItem('cs_' + k) || ''; }); cb(null, o); },
        getKeys(cb){ const out = [];
          for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i);
            if (k && k.indexOf('cs_') === 0) out.push(k.slice(3)); }
          cb(null, out); },
        removeItem(k, cb){ localStorage.removeItem('cs_' + k); cb && cb(null, true); }
      }
    } };
    try {
      if (!новичок) localStorage.setItem('shp_v1_profile', '"shp"');
      localStorage.setItem('shp_v1_page', JSON.stringify(сеанс));
      /* журнал тренировок кладём туда же, откуда приложение его читает */
      if (видел != null) localStorage.setItem('shp_v1_chat_seen', String(видел));
      /* замены упражнений на день: {'D1:2': {n, e, i}} — как их пишет приложение */
      if (замены) localStorage.setItem('shp_v1_shp_subs', JSON.stringify(замены));
      (журнал || []).forEach(w => {
        localStorage.setItem('cs_workouts_' + w.id, JSON.stringify(w));
        localStorage.setItem('tgcs_workouts_' + w.id, JSON.stringify(w));
      });
    } catch (e) {}
  }, [час, o.theme || 'dark', o.page || 'home', !!o.newbie, o.hist || null, o.seen == null ? null : o.seen, o.subs || null]);

  await page.route('**/getfit-sync.sh-pulatov.workers.dev/**', async route => {
    const u = new URL(route.request().url()), p = u.pathname;
    const дать = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (p === '/all')        return дать({ state: [], workouts: [], meals: [], measures: [] });
    if (p === '/s')          return дать({ ok: true });
    if (p === '/day')        return дать(день_ ? { ok: true, day: день_ } : { ok: true, day: день({ meals: [], kcal: 0, prot: 0, fat: 0, fib: 0, sug: 0 }) });
    if (p === '/day/score')  return дать(оценка || { ok: true, r: null });
    if (p === '/week')       return дать({ ok: true, week: неделя(o.week || {}) });
    if (p === '/measures')   { const мс = o.meas === null ? [] : замеры();
      return дать({ ok: true, measures: мс, first: o.first !== undefined ? o.first : (мс.length ? стартовый() : null) }); }
    if (p === '/circle')     return дать(o.circle === null ? { ok: false } : круг());
    /* заведён ли бот: o.bot === false — человек вошёл по коду в приложении
       и остался без напоминаний; undefined — неизвестно, полоски нет */
    /* разговор с тренером: o.chat — реплики, которые уже лежат на сервере
       (например, вечерний разбор, написанный без человека) */
    if (p === '/chat')       return дать({ ok: true, chat: o.chat || [], intro: o.intro || '' });
    if (p === '/bot')        return дать({ ok: true, bot: o.bot === undefined ? true : o.bot,
                                           link: 'https://t.me/GetFit_MyBot' });
    if (p === '/goal') {
      /* границы безопасного отдаёт сервер — экран их только рисует.
         Мужчина 88,1 кг, сухая 63,8 → пол 70,9; предел темпа 0,88 кг/нед. */
      if (route.request().method() === 'POST') {
        const b = JSON.parse(route.request().postData() || '{}');
        const w = 88.1, пол = 70.9, темп = b.wt === 'down' ? 0.88 : b.wt === 'up' ? 0.35 : 0;
        let t = b.target != null ? +b.target : w;
        if (b.wt === 'down' && t < пол) t = пол;
        if (b.wt === 'keep') t = w;
        const kg = Math.round(Math.abs(w - t) * 10) / 10;
        const weeks = (kg && темп) ? Math.max(1, Math.round(kg / темп)) : null;
        return дать({ ok: true, target: t, safe: { w, max: 0.88, limit: 'вес', floor: пол, upMax: 0.35 },
          goal: { wt: b.wt, gym: b.gym, kg, weeks, rate: b.wt === 'down' ? -темп : темп,
                  text: b.wt === 'keep' ? 'держим 88,1 кг' : t + ' кг · ' + темп + ' кг в неделю',
                  verdict: 'ok', note: 'проверка' } });
      }
      return дать({ ok: true, goal: o.goal === undefined ? null : o.goal,
        safe: o.safe === undefined ? { w: 88.1, max: 0.88, limit: 'вес', floor: 70.9, upMax: 0.35 } : o.safe });
    }
    if (p === '/food')       return дать(o.onFood ? o.onFood(route) : {
      ok: true, reply: 'Записал: плов с говядиной, 650 ккал, белка 32 г. До нормы осталось 430 ккал.',
      day: день({ meals: (день_ ? день_.meals : []).concat([{ id: 9, t: '14:03', kind: 'обед', kcal: 650, prot: 32, img: '/p/c.jpg', text: 'плов' }]) })
    });
    return дать({ ok: true });
  });

  const ошибки = [];
  page.on('pageerror', e => ошибки.push(String(e)));
  await page.goto(o.base || БАЗА, { waitUntil: 'domcontentloaded' });   /* o.base — эскиз на другом порту */
  await page.waitForTimeout(o.wait || 1400);
  return ошибки;
}

module.exports = { Д, TODAY, БАЗА, поднять, день, неделя, замеры, стартовый, круг, журнал };
