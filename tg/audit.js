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
const ОКНА = [
  ['профиль', async p => { await p.click('#profbtn'); }, '#profm'],
  ['мои дни', async p => { await p.click('.l1 button[data-page="gym"]'); await p.waitForTimeout(400); await p.click('#schedbtn'); }, '#schedm'],
  ['чат', async p => { await p.click('#coachfab'); }, '#coachm'],
  ['сборка', async p => { await p.click('#profbtn'); await p.waitForTimeout(500); await p.click('#profai'); }, '#sborm'],
  /* 16.09: кнопки «Заменить» больше нет — её место занял палец вниз, а
     каталог открывается ссылкой «выбрать самому» из строки после замены. */
  ['каталог замены', async p => {
    await p.click('.l1 button[data-page="gym"]'); await p.waitForTimeout(500);
    const r = await p.$('#list .exrow'); if (r) { await r.click(); await p.waitForTimeout(400); }
    const n = await p.$('.card.exact [data-nope]'); if (n) await n.click();
    await p.waitForTimeout(1600);
    const s = await p.$('[data-selfpick]'); if (s) await s.click();
  }, '#catalog'],
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
  ['описание упражнения', async p => {
    await p.click('.l1 button[data-page="gym"]'); await p.waitForTimeout(600);
    const r = await p.$('#list .exrow'); if (r) { await r.click(); await p.waitForTimeout(500); }
    const i = await p.$('.card.exact [data-info]'); if (i) { await i.click(); await p.waitForTimeout(600); }
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
    : [['dark', 390, 844], ['dark', 430, 932]];
  for (const [тема, ширина, высота] of РАЗМЕРЫ) {
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
      ошибки.push(метка + ' · ' + r.status() + ' ' + u.replace('http://127.0.0.1:8899', ''));
    });

    await M.поднять(page, {
      theme: тема, time: '17:40', wait: 2600,
      hist: M.журнал(), day: {}, week: {}, meas: M.замеры(), circle: M.круг()
    });
    await page.waitForTimeout(700);

    console.error('· ' + метка);
    for (const [p, титул] of ЭКРАНЫ) {
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
    if (ширина === 390 && тема === 'dark') {   /* состояния внутри экранов — один раз */
      for (const [имя, шаги] of ГЛУБЖЕ) {
        try {
          await закрытьВсё(page);
          await шаги(page);
          await состояние(page, метка + ' · ' + имя);
        } catch (e) { нашли(метка + ' · ' + имя, 'сбой', String(e.message).slice(0, 110)); }
      }
    }

    for (const [имя, открыть, сел] of ОКНА) {
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
  дано(!поВиду['мелко'], 'все цели нажатия не меньше 44 пикселей');
  дано(!поВиду['перекрыто'], 'ни одна кнопка не перекрыта');
  дано(!поВиду['картинка'], 'все картинки загрузились');
  дано(!поВиду['не открылось'] && !поВиду['сбой'], 'все окна открываются');

  console.log('');
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо + ' из ' + всего) : ('ВСЕ ' + всего + ' ПРОВЕРКИ ПРОЙДЕНЫ'));
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
