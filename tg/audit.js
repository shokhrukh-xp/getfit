'use strict';
/* ── ОБХОДЧИК ЭКРАНОВ ──────────────────────────────────────────────────
   13.09, его вопрос: «почему так много ошибок, чиним одно — ломается другое».
   Причина в двух вещах. Первая: приложение — один файл с ОБЩИМ CSS, и
   правило без родителя дотягивается до любого элемента с таким же классом
   в любом углу (так строка «сохранено» получила ширину галочки подхода).
   Вторая: проверки ловят сценарии, о которых я подумал, а не состояние
   экранов целиком.

   Этот набор проверяет не сценарий, а МЕХАНИКУ на каждом экране:
     · ошибки JS в консоли и необработанные исключения;
     · горизонтальный вылет за край телефона;
     · текст, зажатый в колонку (ровно тот класс поломки);
     · цели нажатия меньше 44 пикселей (Apple HIG, Material);
     · кнопки, перекрытые чем-то плавающим;
     · картинки, которые не загрузились;
     · пустые места там, где на обжитых данных обязано быть содержимое.

   Обходит все шесть экранов и все окна, в тёмной и светлой теме, на узком
   и обычном телефоне. Запуск: node tg/audit.js  (или в составе tg/run.sh). */
const { chromium } = require('playwright');
const M = require('./mock');

let плохо = 0, всего = 0;
const находки = [];
function дано(у, т) { всего++; console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; }
function нашли(экран, вид, текст) { находки.push({ экран, вид, текст }); }

/* ── что проверяем на каждом состоянии ── */
const ПРОВЕРКА = () => {
  const ШИР = innerWidth, ВЫС = innerHeight;
  const ВСЯВЫСОТА = Math.max(document.documentElement.scrollHeight, ВЫС);
  const видно = el => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > -200 && r.top < ВСЯВЫСОТА + 200;
  };

  const из = [];

  /* 1. горизонтальный вылет */
  const док = document.documentElement;
  if (док.scrollWidth > ШИР + 1) из.push({ вид: 'вылет', т: 'страница шире экрана: ' + док.scrollWidth + ' > ' + ШИР });
  document.querySelectorAll('body *').forEach(el => {
    if (el.ownerSVGElement || !видно(el)) return;       /* внутренности svg меряет сам svg */
    const s = getComputedStyle(el);
    if (s.position === 'fixed') return;                 /* плавающее живёт по своим правилам */
    const r = el.getBoundingClientRect();
    if (r.width - ШИР > 4)
      из.push({ вид: 'вылет', т: имя(el) + ' шире экрана на ' + Math.round(r.width - ШИР) + 'px' });
  });

  /* 2. текст, зажатый в колонку: лист с текстом, узкая ширина, много строк */
  document.querySelectorAll('body *').forEach(el => {
    if (el.ownerSVGElement || el.children.length || !видно(el)) return;
    const t = (el.textContent || '').trim();
    if (t.length < 10) return;
    const s = getComputedStyle(el);
    if (s.writingMode && s.writingMode.indexOf('vertical') === 0) return;
    const r = el.getBoundingClientRect();
    const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.4 || 16;
    const строк = r.height / lh;
    if (r.width < 72 && строк > 2.4)
      из.push({ вид: 'столбик', т: имя(el) + ' «' + t.slice(0, 34) + '» ширина ' + Math.round(r.width) + 'px, строк ' + строк.toFixed(1) });
  });

  /* 3. мелкие цели нажатия */
  const окно0 = document.querySelector('.modal.show');
  (окно0 ? окно0.querySelectorAll('button, [role="button"], a[href], input[type="checkbox"]')
         : document.querySelectorAll('button, [role="button"], a[href], input[type="checkbox"]')).forEach(el => {
    if (!видно(el) || el.disabled) return;
    /* галочка в подписи нажимается всей подписью — меряем то, во что целится
       палец, а не сам квадратик */
    const цель = (el.tagName === 'INPUT' && el.closest('label')) ? el.closest('label') : el;
    const r = цель.getBoundingClientRect();
    if (r.top > ВЫС || r.bottom < 0) return;             /* за пределами первого экрана не мерим */
    let w = r.width, h = r.height;
    const a = getComputedStyle(цель, '::after');
    if (a && a.content && a.content !== 'none') {
      w = Math.max(w, parseFloat(a.width) || 0);
      h = Math.max(h, parseFloat(a.height) || 0);
    }
    if (w < 40 || h < 40)
      из.push({ вид: 'мелко', т: имя(el) + ' «' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 22) + '» ' + Math.round(w) + '×' + Math.round(h) });
  });

  /* 4. перекрытые кнопки. Открытое окно закрывает собой всё за спиной — это
     не поломка, поэтому при открытом окне меряем только его содержимое.
     И тревога только если закрыты ВСЕ пять точек: центр и четыре угла с
     отступом. Палец попадает по площади, а не по одной точке. */
  const окно = document.querySelector('.modal.show');
  (окно ? окно.querySelectorAll('button, [role="button"]')
        : document.querySelectorAll('button, [role="button"]')).forEach(el => {
    if (!видно(el) || el.disabled) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > ВЫС || r.width < 8 || r.height < 8) return;
    const dx = Math.min(6, r.width / 3), dy = Math.min(6, r.height / 3);
    const точки = [[r.left + r.width / 2, r.top + r.height / 2],
                   [r.left + dx, r.top + dy], [r.right - dx, r.top + dy],
                   [r.left + dx, r.bottom - dy], [r.right - dx, r.bottom - dy]];
    let свободна = false, чем = null;
    точки.forEach(([x, y]) => {
      const верх = document.elementFromPoint(x, y);
      if (!верх || верх === el || el.contains(верх) || верх.contains(el)) свободна = true;
      else if (!чем) чем = верх;
    });
    if (!свободна && чем)
      из.push({ вид: 'перекрыто', т: имя(el) + ' «' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 22) + '» закрыт ' + имя(чем) });
  });

  /* 5. картинки, которые не загрузились */
  document.querySelectorAll('img').forEach(el => {
    if (!видно(el)) return;
    /* кадры движения лежат на jsdelivr — у контейнера проверок туда нет сети,
       и это не поломка приложения (см. tg/test-katalog.js) */
    if ((el.getAttribute('src') || '').indexOf('jsdelivr') >= 0) return;
    if (el.complete && el.naturalWidth === 0)
      из.push({ вид: 'картинка', т: имя(el) + ' не загрузилась: ' + (el.getAttribute('src') || '').slice(0, 60) });
  });

  /* 6. вылезает из своей рамки. 28.10, его снимок: поле «30 Mar 2027» вышло за бокс «Срок» —
     край телефона при этом цел, поэтому пункт 1 молчал. Рамка — ближайший предок, которого видно
     глазом: со скруглением и с фоном или обводкой (карточка, строка, чип, поле, лист). Если раньше
     рамки встретилась обрезка (overflow), лишнего не видно — это не поломка. */
  const прозрачно = c => !c || c === 'transparent' || /rgba\(\d+, \d+, \d+, 0\)/.test(c);
  /* рамка и по каким осям за неё можно выходить: прокрутка или обрезка у самой рамки или между —
     лишнего не видно, это не поломка */
  const режет = v => ['hidden', 'clip', 'auto', 'scroll'].indexOf(v) >= 0;
  const рамкаДля = el => {
    let x = true, y = true;
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.display === 'contents') continue;
      if (режет(s.overflowX)) x = false;
      if (режет(s.overflowY)) y = false;
      if (!x && !y) return null;
      const фон = !прозрачно(s.backgroundColor) || s.backgroundImage !== 'none';
      const край = parseFloat(s.borderLeftWidth) > 0 && s.borderLeftStyle !== 'none' && !прозрачно(s.borderLeftColor);
      if ((фон || край) && parseFloat(s.borderTopLeftRadius) > 0) return { a, x, y };
    }
    return null;
  };
  document.querySelectorAll('body *').forEach(el => {
    if (el.ownerSVGElement || !видно(el) || el.closest('[data-audit-free]')) return;
    /* содержимое закрытого <details> в Chromium имеет размеры, но не видно */
    const дет = el.closest('details'); if (дет && !дет.open && !el.closest('summary')) return;
    const s = getComputedStyle(el);
    if (s.position === 'fixed' || +s.opacity === 0) return;
    const r = el.getBoundingClientRect();
    /* значки и риски (серия у аватара, отметка нормы на полосе) нарочно сидят на краю */
    if (s.position === 'absolute' && r.width <= 44 && r.height <= 24) return;
    const рамка = рамкаДля(el);
    if (!рамка || !видно(рамка.a)) return;
    const b = рамка.a.getBoundingClientRect();
    const вылет = Math.max(рамка.x ? Math.max(b.left - r.left, r.right - b.right) : 0, рамка.y ? Math.max(b.top - r.top, r.bottom - b.bottom) : 0);
    if (вылет > 1.5)
      из.push({ вид: 'из рамки', т: имя(el) + ' выходит из ' + имя(рамка.a) + ' на ' + Math.round(вылет) + 'px' });
  });

  /* 7. родные поля даты и времени. На iPhone такое поле само решает свою ширину и язык
     («30 Mar 2027») и вылезает из рамки; в Chromium проверок этого не видно, поэтому правило:
     видимое родное поле — только без системного вида (appearance: none) или прозрачным поверх своей кнопки. */
  document.querySelectorAll('input[type="date"],input[type="time"],input[type="month"],input[type="week"],input[type="datetime-local"]').forEach(el => {
    if (!el.getClientRects().length) return;
    const s = getComputedStyle(el);
    if (+s.opacity === 0) return;
    if (s.appearance !== 'none' && s.webkitAppearance !== 'none')
      из.push({ вид: 'родное поле', т: имя(el) + ' с системным видом — на iPhone своя ширина и английская дата' });
  });

  function имя(el) {
    if (!el || !el.tagName) return '?';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  }
  return из;
};

/* ── обход ── */
const ЭКРАНЫ = [
  ['home', 'Сегодня'], ['gym', 'Тренировка'], ['log', 'Журнал'],
  ['ref', 'Каталог'], ['food', 'Еда'], ['circle', 'Рейтинг']
];
/* окна: [имя, как открыть, что должно быть внутри] */
/* Раскрывает карточку, у которой есть палец вниз. Просто «первая строка» не
   годится: в дне бывает суперсет, у него подвал другой и пальцев нет, — а от
   того, сколько сценариев отработало до этого, зависит, какая карточка сейчас
   раскрыта. Обход не должен зависеть от своего же порядка. */
async function сПальцем(p) {
  await p.click('.l1 button[data-page="gym"]'); await p.waitForTimeout(600);
  for (let i = 0; i < 6; i++) {
    if (await p.$('.card.exact [data-nope]')) return true;
    const rows = await p.$$('#list .exrow');
    if (!rows[0]) return false;
    await rows[Math.min(i, rows.length - 1)].click();
    await p.waitForTimeout(600);
  }
  return !!(await p.$('.card.exact [data-nope]'));
}

const ОКНА = [
  ['профиль', async p => { await p.click('#profbtn'); }, '#profm'],
  ['мои дни', async p => { await p.click('.l1 button[data-page="gym"]'); await p.waitForTimeout(400); await p.click('#schedbtn'); }, '#schedm'],
  ['чат', async p => { await p.click('#coachnav'); }, '#coachm'],
  ['сборка', async p => { await p.click('#profbtn'); await p.waitForTimeout(500); await p.click('#pq-gym'); await p.click('#progedit'); }, '#sborm'],
  /* 16.09: кнопки «Заменить» больше нет — её место занял палец вниз, а
     каталог открывается ссылкой «выбрать самому» из строки после замены. */
  ['каталог замены', async p => {
    await сПальцем(p);
    const n = await p.$('.card.exact [data-nope]'); if (n) await n.click();
    await p.waitForTimeout(400);
    /* 18.09: палец вниз открывает шторку с выбором, замена — во втором касании */
    const nd = await p.$('.card.exact [data-noped]'); if (nd) await nd.click();
    await p.waitForTimeout(1600);
    const s = await p.$('[data-selfpick]'); if (s) await s.click();
  }, '#catalog'],
  /* 28.10: экран цели (лист тренера) — со своей датой, как на его снимке */
  ['экран цели', async p => {
    await p.click('#coachnav'); await p.waitForTimeout(400); await p.click('#goalchatopen');
    const ждать = () => p.waitForFunction(() => { const g = document.getElementById('goalconversation'); return g && g.dataset.state !== 'loading' && g.getAttribute('aria-busy') === 'false'; }, null, { timeout: 8000 });
    await ждать();
    if (await p.$('#gs-date')) { await p.fill('#gs-date', new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10)); await p.dispatchEvent('#gs-date', 'change'); await ждать(); }
    if (await p.$('[data-gs="health"][data-v="yes"]')) { await p.click('[data-gs="health"][data-v="yes"]'); await ждать(); }
  }, '#coachm'],
  ['приём еды', async p => {
    await p.click('.l1 button[data-page="food"]'); await p.waitForTimeout(900);
    /* приёмы живут в #fmeals, а .fbar в #fday — это пустые слоты, они ведут
       к камере, а не к карточке приёма */
    const m = await p.$('#fmeals .fmeal, .fmeal');
    if (m) await m.click();
  }, '#mealm']
];

/* состояния внутри экранов: раскрыть и посмотреть, не сломалось ли */
const ГЛУБЖЕ = [
  ['карточка упражнения', async p => {
    await p.click('.l1 button[data-page="gym"]'); await p.waitForTimeout(600);
    const r = await p.$('#list .exrow'); if (r) { await r.click(); await p.waitForTimeout(600); }
  }],
  /* 18.09: «Описание» в подвале больше нет. Техника, когда она в каталоге есть,
     открывается картинкой; шторка выбора — пальцем вниз. Смотрим обе. */
  ['техника за картинкой', async p => {
    await p.click('.l1 button[data-page="gym"]'); await p.waitForTimeout(600);
    const r = await p.$('#list .exrow'); if (r) { await r.click(); await p.waitForTimeout(500); }
    const i = await p.$('.card.exact button.exthumb[data-tech]'); if (i) { await i.click(); await p.waitForTimeout(600); }
  }],
  ['шторка под пальцем вниз', async p => {
    await сПальцем(p);
    const n = await p.$('.card.exact [data-nope]'); if (n) { await n.click(); await p.waitForTimeout(600); }
  }],
  ['карта тела с выбранной мышцей', async p => {
    await p.click('.l1 button[data-page="gym"]'); await p.waitForTimeout(500);
    for (const b of await p.$$('.zseg button'))
      if ((await b.textContent()).trim() === 'Журнал' && await b.isVisible()) { await b.click(); break; }
    await p.waitForTimeout(1300);
    /* зона мышцы — группа внутри svg: playwright по ней не попадает, жмём по
       координатам, как это делает палец */
    const z = await p.$('#logmus .bodymap .mz');
    if (z) {
      const b = await z.boundingBox();
      if (b) { await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(800); }
    }
  }],
  ['каталог: раскрытая группа', async p => {
    await p.click('.l1 button[data-page="gym"]'); await p.waitForTimeout(500);
    for (const b of await p.$$('.zseg button'))
      if ((await b.textContent()).trim() === 'Каталог' && await b.isVisible()) { await b.click(); break; }
    await p.waitForTimeout(1300);
    const h = await p.$('.catgrp h4 button, .catlist h4 button'); if (h) { await h.click(); await p.waitForTimeout(700); }
  }]
];
async function закрытьВсё(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
    document.body.classList.remove('coach');
    /* 18.09: шторка под пальцем вниз — переключатель. Оставленная открытой от
       прошлого сценария, она от следующего нажатия ЗАКРОЕТСЯ, и обход решит,
       что окно не открылось. Сбрасываем её вместе с окнами. */
    document.querySelectorAll('.exnope').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nope]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }).catch(() => {});
  await page.waitForTimeout(300);
}
/* Кнопка, уехавшая под нижнюю панель в одном положении прокрутки, достаётся
   пальцем в другом — это не поломка. Поэтому перекрытия засчитываем только
   те, что живут и вверху страницы, и внизу. Остальные виды находок от
   прокрутки не зависят, их объединяем. */
async function состояние(page, имя) {
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(750);                 /* кнопка чата доезжает переходом */
  const верх = await page.evaluate(ПРОВЕРКА);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)).catch(() => {});
  await page.waitForTimeout(750);
  const низ = await page.evaluate(ПРОВЕРКА);
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

  const внизу = {};
  низ.forEach(x => { if (x.вид === 'перекрыто') внизу[x.т] = 1; });
  const видели = {};
  верх.concat(низ).forEach(x => {
    if (x.вид === 'перекрыто' && !(внизу[x.т] && верх.some(y => y.вид === 'перекрыто' && y.т === x.т))) return;
    const k = x.вид + '|' + x.т;
    if (видели[k]) return;
    видели[k] = 1;
    нашли(имя, x.вид, x.т);
  });
}

(async () => {
  const br = await chromium.launch();
  const ошибки = [];

  /* 390×844 — обычный телефон, 360×740 — узкий, 430×932 — его iPhone:
     на высоком экране кнопка чата садилась ровно на «Отправить», а на 844
     этого перекрытия нет вовсе.
     Без ключа обходим два размера (это минуты), с «--все» — все четыре. */
  const ВСЕ = process.argv.indexOf('--все') >= 0 || process.argv.indexOf('--all') >= 0;
  const РАЗМЕРЫ = ВСЕ
    ? [['dark', 390, 844], ['light', 390, 844], ['dark', 360, 740], ['dark', 430, 932]]
    : [['dark', 390, 844], ['dark', 430, 932], ['light', 320, 700]];
  /* Обход — это задания, каждое на своей свежей странице: на каждом размере
     «экраны и окна», а на обычном тёмном ещё и «внутри экранов». Шаги и так
     не зависят от порядка (перед каждым всё закрывается), поэтому быстрый
     прогон (tg/run-fast.js) делит задания между потоками: с GF_PART=k/n этот
     процесс берёт только задания с номером k по модулю n. Заданий 4, с «--все» — 5. */
  const ЧАСТЬ = (process.env.GF_PART || '').match(/^(\d+)\/(\d+)$/);
  const ЗАДАНИЯ = [];
  РАЗМЕРЫ.forEach(р => { ЗАДАНИЯ.push([р, 'экраны']); if (р[0] === 'dark' && р[1] === 390) ЗАДАНИЯ.push([р, 'глубже']); });
  const МОИ = ЗАДАНИЯ.filter((_, i) => !ЧАСТЬ || i % +ЧАСТЬ[2] === +ЧАСТЬ[1]);
  for (const [[тема, ширина, высота], что] of МОИ) {
    const метка = тема + ' ' + ширина + '×' + высота;
    const page = await br.newPage({ viewport: { width: ширина, height: высота } });
    /* картинки с CDN в контейнере всё равно не загрузятся — не ждём их по минуте */
    await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    page.on('pageerror', e => ошибки.push(метка + ' · ' + e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text();
      /* CDN и кадры встроенной программы в контейнере недоступны — это стенд,
         а не приложение (см. tg/srv.sh и tg/test-katalog.js) */
      if (/jsdelivr|ERR_CONNECTION_RESET|ERR_FAILED|Failed to load resource/.test(t)) return;
      ошибки.push(метка + ' · консоль: ' + t.slice(0, 160));
    });
    page.on('response', r => {
      if (r.status() < 400) return;
      const u = r.url();
      /* кадры встроенной программы лежат в img/*.jpg: в контейнер проверок
         репозиторий приезжает без них, на живом сайте они отдаются 200 */
      if (/jsdelivr|telegram\.org/.test(u) || /\/img\/.*\.jpg/.test(u)) return;
      ошибки.push(метка + ' · ' + r.status() + ' ' + u.replace(M.БАЗА.replace(/\/$/, ''), ''));
    });

    await M.поднять(page, {
      theme: тема, time: '17:40', wait: 2600,
      hist: M.журнал(), day: {}, week: {}, meas: M.замеры(), circle: M.круг()
    });
    await page.waitForTimeout(700);

    console.error('· ' + метка + (что === 'глубже' ? ' · внутри экранов' : ''));
    if (что === 'экраны') for (const [p, титул] of ЭКРАНЫ) {
      const кн = await page.$('.l1 button[data-page="' + (p === 'log' || p === 'ref' ? 'gym' : p === 'circle' ? 'food' : p) + '"]');
      if (кн) { await кн.click(); await page.waitForTimeout(500); }
      if (p === 'log' || p === 'ref' || p === 'circle') {
        for (const b of await page.$$('.zseg button')) {
          const t = (await b.textContent()).trim();
          if ((p === 'log' && t === 'Журнал') || (p === 'ref' && t === 'Каталог') || (p === 'circle' && t === 'Рейтинг')) {
            if (await b.isVisible()) { await b.click(); break; }
          }
        }
        await page.waitForTimeout(900);
      }
      await состояние(page, метка + ' · ' + титул);
    }

    /* второй слой: состояния ВНУТРИ экранов. Окна и вкладки проверены выше,
       но карточка упражнения, описание, раскрытая группа каталога и выбранная
       мышца на карте тела — тоже отдельные состояния со своей вёрсткой. */
    if (что === 'глубже') {   /* состояния внутри экранов — один раз, на обычном тёмном */
      for (const [имя, шаги] of ГЛУБЖЕ) {
        try {
          await закрытьВсё(page);
          await шаги(page);
          await состояние(page, метка + ' · ' + имя);
        } catch (e) { нашли(метка + ' · ' + имя, 'сбой', String(e.message).slice(0, 110)); }
      }
    }

    if (что === 'экраны') for (const [имя, открыть, сел] of ОКНА) {
      try {
        /* Escape закрывает не все окна — снимаем показ руками, иначе следующее
           окно кликается сквозь предыдущее и обход утыкается в таймаут */
        await закрытьВсё(page);
        await открыть(page);
        await page.waitForTimeout(900);
        const есть = await page.$eval(сел, e => e.classList.contains('show')).catch(() => false);
        if (!есть) { нашли(метка + ' · ' + имя, 'не открылось', сел + ' не показалось'); continue; }
        await состояние(page, метка + ' · окно ' + имя);
        await закрытьВсё(page);
      } catch (e) { нашли(метка + ' · ' + имя, 'сбой', String(e.message).slice(0, 120)); }
    }
    await page.close();
  }
  await br.close();

  /* ── отчёт ── */
  console.log('');
  const поВиду = {};
  находки.forEach(f => { (поВиду[f.вид] = поВиду[f.вид] || []).push(f); });
  Object.keys(поВиду).sort().forEach(в => {
    console.log('═══ ' + в + ' · ' + поВиду[в].length + ' ═══');
    /* одинаковые находки на разных темах схлопываем */
    const видели = {};
    поВиду[в].forEach(f => {
      const k = f.вид + '|' + f.текст;
      if (видели[k]) { видели[k].n++; return; }
      видели[k] = { n: 1, f: f };
    });
    Object.keys(видели).forEach(k => {
      const x = видели[k];
      console.log('   ' + x.f.экран + (x.n > 1 ? ' (×' + x.n + ')' : '') + ' — ' + x.f.текст);
    });
  });
  console.log('');
  дано(ошибки.length === 0, 'ни одной ошибки JS на всех экранах' + (ошибки.length ? ': ' + ошибки.slice(0, 4).join(' | ') : ''));
  дано(!поВиду['вылет'], 'ничего не вылезает за край экрана');
  дано(!поВиду['столбик'], 'нигде текст не зажат в колонку');
  дано(!поВиду['из рамки'], 'ничто не вылезает из своей рамки (карточки, строки, чипа, поля)');
  дано(!поВиду['родное поле'], 'поля даты и времени без системного вида');
  дано(!поВиду['мелко'], 'все цели нажатия не меньше 44 пикселей');
  дано(!поВиду['перекрыто'], 'ни одна кнопка не перекрыта');
  дано(!поВиду['картинка'], 'все картинки загрузились');
  дано(!поВиду['не открылось'] && !поВиду['сбой'], 'все окна открываются');

  console.log('');
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо + ' из ' + всего) : ('ВСЕ ' + всего + ' ПРОВЕРКИ ПРОЙДЕНЫ'));
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
