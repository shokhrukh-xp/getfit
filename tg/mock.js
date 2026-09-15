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
    /* Раскладка нормы — ровно теми полями, что отдаёт сервер. Зал считается
       по плотности: 60 минут на 24 подхода — 2,5 минуты на подход, это
       строка компендиума 5,0, и (5 − 1) × 88,1 × 1 ч = 350 ккал. */
    targets: o.targets || { kcal: 2110, prot: 165, fat: { min: 52, max: 78 }, fib: 30, sug: 50,
      parts: { base: 1760, gym: 350, acts: 0, plan: 0, delta: 0, k: 1,
               gymMin: 60, gymSets: 24, gymMet: 5 } }
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
/* Круг отдаём ровно тем же набором полей, что и сервер (/circle): без
   списка circles приложение честно решает, что человек ни в каком кругу не
   состоит, и рисует «Круг ещё не собран» вместо таблицы — на этом 14.09
   и споткнулась первая проверка страницы человека. */
function круг() {
  return {
    ok: true, today: TODAY, circle: 'family',
    circles: [{ id: 'family', name: 'семья', n: 2, code: 'семья7', link: 'https://t.me/GetFit_MyBot?start=semya7', owner: true },
              { id: 'c_zal', name: 'зал', n: 4, code: 'fit7788', link: 'https://t.me/GetFit_MyBot?start=fit7788', owner: false }],
    board: [
      { uid: '308687648', name: 'Ты', me: true, days: ['ok', 'ok', 'low', 'ok', 'today', '', ''],
        avg: 7.9, ravg: 7.9, pts: 41, closed: false, today: { r: 8.4, closed: false, why: [{ t: 'недобрал белок', v: 1.6 }], n: 3, counts: true, going: true }, streak: 6, level: 2 },
      { uid: '850965787', name: 'жена', me: false, days: ['ok', 'ok', 'ok', 'ok', 'today', '', ''],
        avg: 8.3, ravg: 8.3, pts: 45, closed: false, today: { r: 9.1, closed: false, why: [], n: 2, counts: true, going: true }, streak: 9, level: 3 }
    ],
    last: { monday: Д(7), best: null, grow: null },
    me: { streak: 6, week: ['ok', 'ok', 'low', 'ok', 'today', '', ''], pts: 41, avg: 7.9, ravg: 7.9,
          elapsed: 5, level: 2, closed: false, score: null, today: { r: 8.4, closed: false, why: [{ t: 'недобрал белок', v: 1.6 }], n: 3, counts: true, going: true } }
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

  /* НАСТОЯЩИЙ telegram-web-app.js НА СТЕНД НЕ ПУСКАЕМ.
     15.09: test-bot то проходил, то падал, и оба раза приложение было ни при
     чём. Страница тянет скрипт мини-аппа с telegram.org, и он ПЕРЕЗАПИСЫВАЕТ
     window.Telegram — вместе с подставным CloudStorage. Загрузился скрипт —
     хранилище отвечает «метод не поддерживается» (вне Telegram он объявляет
     версию 6.0), загрузка дня обрывается, и половина проверок смотрит на
     пустой экран. Не загрузился (сеть моргнула) — стенд работает.
     Проверка, которая зависит от того, доехал ли чужой сервер, не проверка;
     блокируем его всегда, а подставка и так полнее. */
  await page.route('**://telegram.org/**', r => r.abort().catch(() => {}));

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
    /* спорт вне зала. Прибавку СЧИТАЕТ СЕРВЕР, а не приложение: стенд нарочно
       отвечает числом, которого не даст никакая формула (777), и проверка
       убеждается, что на экране стоит именно ответ сервера. Посчитай
       приложение само — и число разошлось бы с тем, что уедет в день. */
    /* страница человека в круге: его еда за день. Один приём С фото и один
       БЕЗ — чтобы видеть оба случая сразу (14.09: «почему фото еды других не
       отображаются» — фото не было в самих записях, но проверки этого не
       знали). */
    if (p === '/feed') {
      const who = u.searchParams.get('who') || '';
      if (!who) return дать({ ok: true, circle: 'family', today: TODAY, feed: o.feed || [] });
      return дать({ ok: true, circle: 'family', today: TODAY, who, name: 'жена',
        date: u.searchParams.get('date') || TODAY, streak: 4,
        day: { r: 7.2, closed: false, why: [], n: 2, counts: true, going: true },
        meals: o.meals === null ? [] : (o.meals || [
          { ref: who + ':m1', uid: who, name: 'жена', me: false, date: TODAY, t: '09:05',
            kind: 'завтрак', text: 'Яичница с томатами', kcal: 420, prot: 26, fat: 24, carb: 18,
            fib: 5, sug: 4, items: [{ name: 'яйца', g: 120 }], img: '/p/a.jpg', note: '',
            stars: { n: 4, why: 'белок и овощи' }, likes: 0, liked: false, likers: [] },
          { ref: who + ':m2', uid: who, name: 'жена', me: false, date: TODAY, t: '14:33',
            kind: 'обед', text: 'Творог и кофе', kcal: 254, prot: 34, fat: 9, carb: 12,
            fib: 0, sug: 3, items: [{ name: 'творог', g: 200 }], img: null, note: '',
            stars: { n: 3, why: 'мало клетчатки' }, likes: 1, liked: false, likers: ['Ты'] }
        ]) });
    }
    /* подписка. o.sub — что отдаёт сервер про доступ; по умолчанию доступ
       есть (так живут все, кто был в приложении до появления цены), а
       o.sub:'нет' поднимает стену. */
    if (p === '/sub') {
      if (o.sub === 'нет') return дать({ ok: true, stars: 500, link: 'https://t.me/$invoice_mock',
        title: 'GetFit — тренер', about: 'Разбор еды по фото и словам, разговор с тренером, сборка программы и недельный разбор.',
        sub: { ok: false, kind: 'none', until: 0, stars: 500 } });
      if (o.sub === 'платит') return дать({ ok: true, stars: 500, link: null,
        sub: { ok: true, kind: 'sub', until: Date.now() + 18 * 864e5, canceled: false, stars: 500 } });
      return дать({ ok: true, stars: 500, link: null, boss: !!o.admin, sub: { ok: true, kind: 'grand', until: 0 } });
    }
    if (p === '/sub/cancel') return дать({ ok: true });
    /* приглашения и баллы. o.ref — что отдаёт сервер; по умолчанию ссылка
       есть, приглашённых нет, баллов нет. */
    /* Приборная владельца. По умолчанию стенд — ОБЫЧНЫЙ человек: владелец
       в приложении один, и если бы стенд был им всегда, четвёртая вкладка
       молча уехала бы во все проверки, которые считают кнопки внизу.
       Владельцем стенд становится только когда попросили: o.admin. */
    if (p === '/admin') {
      if (!o.admin) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'нет' }) });
      const мес = Date.parse('2026-09-01T00:00:00Z');
      return дать(Object.assign({
        ok: true, build: '15.09', now: Date.now(), month: мес,
        люди: { всего: 42, занеделю: 6, активных: 19, кругов: 11 },
        доступ: { вечных: 8, платных: 6, ушедших: 2 },
        деньги: { завсё: 7500, платежей: 15, ставка: 500, замесяц: 3000, платежейМес: 6, новыхМес: 4,
                  понеделям: [500, 1000, 500, 1500, 1000, 2000, 3000], заморожено: 3000, курс: 0.013,
                  долларов: 39, ии: 24, вызовов: 2353, токенов: 30_589_000, изкеша: 24_920_000, вышло: 282_000,
                  кеш_доля: 81, виды: [{ kind: 'еда', n: 1800, стоило: 14 }, { kind: 'еда с фото', n: 400, стоило: 8 }],
                  роздано: 1000, розданоДолларов: 13, итог: 2 },
        внимание: { молчат: [{ uid: '1', name: 'Пётр' }, { uid: '2', name: 'Олег' }, { uid: '3', name: 'Инна' }, { uid: '4', name: 'Марат' }] },
        неделя: { откуда: [{ by: 'ref', n: 4 }, { by: 'code', n: 2 }], новыхПлатящих: 2 },
        рефералы: { всего: 5, оплатили: 2, зовуны: [{ uid: '9', name: 'Фируз', привёл: 3, оплатили: 2 }] },
        баллы: { на_руках: 1000, выдано: 2000, потрачено: 1000 },
        промо: [{ code: 'zalfriends', uses: 20, used: 7, note: 'для зала', created: Date.now() }],
        свои: { kind: 'grand' },
        список: [
          { uid: '11', name: 'Пётр Смирнов', by: 'ref', created: Date.now() - 864e5, kind: 'sub', until: Date.now() + 20 * 864e5, приёмов: 4, последний: '2026-09-15', привёл: 0 },
          { uid: '12', name: 'Нигора', by: 'code', created: Date.now() - 3 * 864e5, kind: 'grand', until: 0, приёмов: 22, последний: '2026-09-15', привёл: 0 },
          { uid: '13', name: 'Andrew Nee', by: 'bot', created: Date.now() - 2 * 864e5, kind: null, until: 0, приёмов: 0, последний: null, привёл: 0 }
        ]
      }, o.admin === true ? {} : o.admin));
    }
    if (p === '/admin/promo') return дать({ ok: true, code: 'новый', uses: 10 });
    if (p === '/ref') {
      const r = o.ref || {};
      return дать({ ok: true, link: 'https://t.me/GetFit_MyBot?start=r_308687648',
        points: r.points || 0, earned: r.earned || 0, spent: r.spent || 0,
        perRef: 500, month: 500,
        people: r.people || [] });
    }
    if (p === '/ref/spend') {
      const r = o.ref || {};
      if ((r.points || 0) < 500) return route.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({ error: 'Нужно 500 баллов, у тебя ' + (r.points || 0) + '.' }) });
      r.points -= 500; o.ref = r;
      return дать({ ok: true, until: Date.now() + 30 * 864e5, points: r.points, autoOff: true });
    }
    if (p === '/promo') {
      const b4 = JSON.parse(route.request().postData() || '{}');
      if (String(b4.code || '').toLowerCase() === 'getfit') return дать({ ok: true, code: 'getfit' });
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Такого кода нет.' }) });
    }
    if (p === '/circle/new') {
      const b5 = JSON.parse(route.request().postData() || '{}');
      return дать({ ok: true, circle: { id: 'c_new', name: b5.name, code: 'fit4242',
        link: 'https://t.me/GetFit_MyBot?start=fit4242', n: 1, owner: true } });
    }
    if (p === '/circle/leave' || p === '/circle/drop' || p === '/circle/rename') return дать({ ok: true });
    if (p === '/circle/members') return дать({ ok: true, id: u.searchParams.get('id') || '', mine: true,
      members: [{ uid: '308687648', name: 'Ты', owner: true, me: true },
                { uid: '850965787', name: 'жена', owner: false, me: false }] });
    if (p === '/acts') {
      const виды = o.kinds || ['теннис', 'бег', 'ходьба', 'плавание', 'велосипед', 'футбол',
        'бадминтон', 'сквош', 'йога', 'танцы', 'гребля', 'лыжи', 'коньки', 'бокс'];
      const kind = u.searchParams.get('kind') || '', min = +u.searchParams.get('min') || 0;
      if (kind && min > 0) {
        const знаком = виды.indexOf(kind) >= 0;
        return дать({ ok: true, kinds: виды, preview: { kind, min, kcal: 777,
          intensity: u.searchParams.get('intensity') || 'mod', met: 7.3, kg: 88.1, known: знаком } });
      }
      return дать({ ok: true, kinds: виды, acts: o.acts || [] });
    }
    if (p === '/act/add') {
      const b2 = JSON.parse(route.request().postData() || '{}');
      const акт = { id: 'a1', date: b2.date, t: '18:20', kind: b2.kind, min: b2.min,
                    kcal: 777, intensity: b2.intensity, hr: null, dev: null, src: 'hand', note: null };
      o.acts = (o.acts || []).concat([акт]);
      return дать({ ok: true, act: акт, day: день({ acts: o.acts }) });
    }
    if (p === '/act/del') {
      const b3 = JSON.parse(route.request().postData() || '{}');
      o.acts = (o.acts || []).filter(a => a.id !== b3.id);
      return дать({ ok: true, day: день({ acts: o.acts }) });
    }
    if ((p === '/food' || p === '/coach' || p === '/ai' || p === '/onboard') && o.sub === 'нет')
      return route.fulfill({ status: 402, contentType: 'application/json',
        body: JSON.stringify({ error: 'Тренер работает по подписке.', code: 'sub', stars: 500,
          sub: { ok: false, kind: 'none', until: 0 } }) });
    if (p === '/food')       return дать(o.onFood ? o.onFood(route) : {
      ok: true, reply: 'Записал: плов с говядиной, 650 ккал, белка 32 г. До нормы осталось 430 ккал.',
      day: день({ meals: (день_ ? день_.meals : []).concat([{ id: 9, t: '14:03', kind: 'обед', kcal: 650, prot: 32, img: '/p/c.jpg', text: 'плов' }]) })
    });
    return дать({ ok: true });
  });

  const ошибки = [];
  page.on('pageerror', e => ошибки.push(String(e)));
  /* Нужный экран открываем адресом, а не памятью вкладки: с 15.09 приложение
     всегда начинает с главной («сейчас как попало открывается» — его слова),
     и последняя вкладка между заходами больше ничего не решает. */
  let адрес = o.base || БАЗА;
  if (o.page && o.page !== 'home' && !/[?&]p=/.test(адрес))
    адрес += (адрес.indexOf('?') >= 0 ? '&' : '?') + 'p=' + o.page;
  await page.goto(адрес, { waitUntil: 'domcontentloaded' });   /* o.base — эскиз на другом порту */
  await page.waitForTimeout(o.wait || 1400);
  return ошибки;
}

module.exports = { Д, TODAY, БАЗА, поднять, день, неделя, замеры, стартовый, круг, журнал };
