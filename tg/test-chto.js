'use strict';
/* ── ЧТО СЪЕСТЬ ───────────────────────────────────────────────────────
   17.09. Самая частая просьба в приложении — «чем набрать остаток» и
   «влезет ли плов»: 23 сообщения из 167 написанных руками.

   Здесь проверено то, что ломается тихо. Цель ОДНОГО приёма не равна
   остатку дня — утром подбор предложил целого цыплёнка на завтрак, честно
   взяв весь дневной остаток. Дальше выяснилось, что и делить остаток
   поровну нельзя: его вопрос был «если ты рекомендуешь блюдо на 750 ккал
   на обед, то на ужин что останется?» — и ответ должен быть виден до
   выбора, а не после. Поэтому проверяется раскладка по приёмам, подпись,
   откуда взяты доли, плотность белка и метка на блюдах, после которых
   день уже не закрыть. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

async function еда(page) {
  const f = await page.$('.l1 button[data-page="food"]');
  if (f) { await f.click(); await page.waitForTimeout(1000); }
}
/* 17.09: подбор переехал из «Моего дня» в свою вкладку внутри Еды */
async function вкладка(page) {
  await еда(page);
  for (const b of await page.$$('#fseg-food button'))
    if ((await b.textContent()).trim() === 'Что съесть') { await b.click(); break; }
  await page.waitForTimeout(1200);
}

(async () => {
  const br = await chromium.launch();

  /* ── середина дня: завтрак съеден, впереди обед, ужин и перекус ── */
  let page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  /* слушаем, а не перехватываем: мок ставит свои маршруты позже и выигрывает,
     а нам важно только то, что ушло, и с каким id */
  let поймал = null;
  let добавил = null;
  page.on('request', req => {
    try {
      if (/\/meal\/repeat/.test(req.url())) поймал = JSON.parse(req.postData() || '{}');
      if (/\/meal\/add/.test(req.url())) добавил = JSON.parse(req.postData() || '{}');
    } catch (e) {}
  });
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await вкладка(page);

  дано(!!(await page.$('#fpod')), 'на экране еды есть блок «Что съесть»');

  const цель = await page.$eval('#fpod .podc', e => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
  дано(/486/.test(цель) && /61/.test(цель), 'показана цель ОДНОГО приёма, а не остаток дня 849: ' + цель);

  /* ── раскладка: три приёма впереди и что достанется каждому ── */
  const чипы = await page.$$eval('.podraz button', bs => bs.map(b => b.innerText.replace(/\s+/g, ' ').trim()));
  дано(чипы.length === 3, 'приёмы впереди показаны все: ' + чипы.join(' | '));
  дано(/обед\s*486/.test(чипы[0]) && /ужин\s*237/.test(чипы[1]) && /перекус\s*126/.test(чипы[2]),
    'у каждого приёма своя доля остатка, а не поровну: ' + чипы.join(' | '));
  дано(чипы.reduce((с, т) => с + (+(/(\d+)$/.exec(т) || [0, 0])[1]), 0) === 849,
    'сумма приёмов сходится с остатком дня ровно: ' + чипы.join(' | '));

  const под = await page.$eval('#fpod .podsub', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  дано(/57%/.test(под) && /849/.test(под), 'сказано, какая это доля от остатка дня: ' + под);
  дано(/по твоим 15 дням/.test(под), 'и откуда взята доля: ' + под);

  const плот = await page.$eval('#fpod .podplot', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  дано(/12,6 г белка на 100 ккал/.test(плот), 'названа плотность белка — то, что и связывает руки: ' + плот);
  дано(/только постное/.test(плот), 'и что она означает словами: ' + плот);

  /* ── каталог ── */
  const строки = await page.$$eval('.eatrow .en b', bs => bs.map(b => b.innerText));
  дано(строки.length >= 8, 'каталог показывает своё и базу вместе: ' + строки.length);
  дано(строки[0] === 'Творог, яйца, греческий йогурт и банан',
    'сверху то, что лучше ложится в цель приёма: ' + строки[0]);
  const своё = await page.$$eval('.eatrow .en s', ss => ss.map(x => x.innerText));
  дано(своё.indexOf('своё') >= 0, 'своя еда подписана «своё»');
  дано(своё.indexOf('японская') >= 0 || своё.indexOf('итальянская') >= 0, 'у блюд базы подписана кухня');

  /* ── блюда, после которых день не закрыть ── */
  const меток = await page.$$eval('.eatrow', rs => rs.map(r => r.classList.contains('brk') ? 1 : 0));
  дано(меток.reduce((a, b) => a + b, 0) === 5, 'помечено ровно то, что ломает день: ' + меток.join(''));
  дано(меток.slice(0, меток.length - 5).every(x => !x) && меток.slice(-5).every(x => x),
    'и опущено вниз, а не разбросано: ' + меток.join(''));
  const текстМетки = await page.$eval('.eatrow.brk .ebrk', e => e.innerText).catch(() => '');
  дано(/день не закрыть/i.test(текстМетки), 'метка объясняет себя одной фразой: ' + текстМетки);

  /* первая строка раскрыта сразу — с ней и работают */
  const откр1 = await page.$eval('.eatopen', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  дано(/После него на день останется 367 ккал и 51 г белка/.test(откр1),
    'под блюдом сказано, что останется на остальные приёмы: ' + откр1.slice(0, 140));
  дано(/13,9 г на 100 ккал/.test(откр1), 'и какой плотностью это добирается: ' + откр1.slice(0, 160));

  /* у ломающего блюда — та же фраза, но с приговором */
  const ломкий = await page.$$('.eatrow.brk');
  await ломкий[0].click(); await page.waitForTimeout(400);
  const откр2 = await page.$eval('.eatopen .warn', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  дано(/не бывает|не закрыть/.test(откр2), 'у ломающего блюда сказано прямо: ' + откр2);

  /* ── переключение приёма пересчитывает всё ── */
  await page.click('[data-podk="ужин"]'); await page.waitForTimeout(500);
  const цель2 = await page.$eval('#fpod .podc', e => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
  дано(/237/.test(цель2), 'выбор другого приёма меняет цель: ' + цель2);
  const строки2 = await page.$$eval('.eatrow .en b', bs => bs.map(b => b.innerText));
  дано(/Exponenta/.test(строки2[0]), 'и пересобирает список под неё: ' + строки2[0]);
  дано((await page.$$eval('.eatrow', rs => rs.filter(r => r.classList.contains('brk')).length)) === 5,
    'метка «день не закрыть» не зависит от того, на какой приём смотришь');
  await page.click('[data-podk="обед"]'); await page.waitForTimeout(500);

  /* ── «Записать» кладёт то, что показано ── */
  await page.click('.eatopen [data-catadd]');
  await page.waitForTimeout(700);
  дано(!!поймал && поймал.id === 'm1', 'своё уходит повтором записи: id ' + ((поймал || {}).id || 'ничего не ушло'));

  /* ── вкладка и фильтры ── */
  const сег = await page.$$eval('#fseg-food button', bs => bs.map(b => b.textContent.trim()));
  дано(сег.indexOf('Что съесть') >= 0, 'вкладка стоит внутри Еды: ' + сег.join(' | '));

  /* у фишки есть счётчик — сравнивать на точное равенство нельзя */
  for (const b of await page.$$('[data-ckuh]'))
    if ((await b.textContent()).trim().indexOf('японская') === 0) { await b.click(); break; }
  await page.waitForTimeout(400);
  const яп = await page.$$eval('.eatrow .en b', bs => bs.map(b => b.innerText));
  дано(яп.length === 1 && /Роллы/.test(яп[0]), 'фильтр по кухне сужает список: ' + яп.join(' | '));

  const откр = await page.$eval('.eatopen', e => e.innerText).catch(() => '');
  дано(/Порция \d+ г/.test(откр), 'в раскрытии есть порция: ' + откр.split('\n')[0]);
  дано(/технологической карте/.test(откр), 'и сказано, откуда состав: ' + (откр.match(/Состав[^\n]*/) || [''])[0]);

  await page.click('[data-catadd]');
  await page.waitForTimeout(700);
  дано(!!добавил && /Роллы/.test(добавил.text || ''), 'блюдо базы уходит в /meal/add: ' + ((добавил || {}).text || 'ничего не ушло'));
  дано(!!добавил && добавил.kcal === 317 && добавил.prot === 17, 'и уходит с теми числами, что показаны: ' + ((добавил || {}).kcal) + '/' + ((добавил || {}).prot));

  /* ── сортировка ── */
  const числа = () => page.$$eval('.eatrow .em', es => es.map(e => {
    const m = e.innerText.replace(/\s+/g, ' ');
    const n = k => { const r = new RegExp(k + ' ([\\d,]+)').exec(m); return r ? +r[1].replace(',', '.') : null; };
    return { k: n('ккал'), p: n('белок'), f: n('жир'), c: n('клетч\\.') };
  }));
  const жми = async им => {
    for (const b of await page.$$('[data-csort]'))
      if ((await b.textContent()).trim().indexOf(им) === 0) { await b.click(); break; }
    await page.waitForTimeout(400);
  };
  await page.click('#catclear'); await page.waitForTimeout(400);

  const сорта = await page.$$eval('[data-csort]', bs => bs.map(b => b.innerText.trim()));
  дано(/по цели/.test(сорта[0]), 'сортировка по умолчанию названа честно — «по цели»: ' + сорта.join(' | '));

  await жми('белок');
  let ч = await числа();
  дано(ч.length > 3 && ч[0].p >= ч[1].p && ч[1].p >= ч[2].p,
    'по белку сверху больше, а не меньше: ' + ч.slice(0, 3).map(x => x.p).join(' → '));
  /* Порядок здесь просил человек, и подменять его «заботой» нельзя: ломающее
     блюдо остаётся на своём месте по белку, но с меткой. */
  const меткиБ = await page.$$eval('.eatrow', rs => rs.map(r => r.classList.contains('brk') ? 1 : 0));
  дано(меткиБ.reduce((a, b) => a + b, 0) === 5, 'метки видны и при своей сортировке: ' + меткиБ.join(''));
  дано(меткиБ.slice(0, 5).indexOf(1) >= 0, 'но порядок остаётся тот, что просили: ' + меткиБ.join(''));
  await жми('белок');
  ч = await числа();
  дано(ч[0].p <= ч[1].p, 'повторное нажатие переворачивает: ' + ч.slice(0, 3).map(x => x.p).join(' → '));

  await жми('калории');
  ч = await числа();
  дано(ч[0].k <= ч[1].k && ч[1].k <= ч[2].k,
    'по калориям сверху меньше: ' + ч.slice(0, 3).map(x => x.k).join(' → '));

  await жми('жир');
  ч = await числа();
  дано(ч[0].f <= ч[1].f && ч[1].f <= ч[2].f,
    'по жиру сверху меньше: ' + ч.slice(0, 3).map(x => x.f).join(' → '));
  дано(ч.every(x => x.f !== null), 'жир виден в каждой строке — сортировать по невидимому нечестно');

  await жми('клетчатка');
  ч = await числа();
  дано(ч[0].c >= ч[1].c && ч[1].c >= ч[2].c,
    'по клетчатке сверху больше: ' + ч.slice(0, 3).map(x => x.c).join(' → '));

  /* ── счётчики на фильтрах ── */
  await page.click('#catclear'); await page.waitForTimeout(400);
  const фишки = await page.$$eval('[data-ckuh]', bs => bs.map(b => b.innerText.replace(/\s+/g, ' ').trim()));
  дано(фишки.every(t => /\d+$/.test(t)), 'у каждой фишки кухни написано, сколько там блюд: ' + фишки.join(' | '));
  const рыб = async () => page.$$eval('[data-cosn]', bs => {
    const b = bs.filter(x => /^рыба/.test(x.innerText.trim()))[0];
    return b ? +(/(\d+)\s*$/.exec(b.innerText.replace(/\s+/g, ' ')) || [])[1] : null;
  });
  const былоРыб = await рыб();
  for (const b of await page.$$('[data-ckuh]'))
    if ((await b.textContent()).trim().indexOf('японская') === 0) { await b.click(); break; }
  await page.waitForTimeout(400);
  const сталоРыб = await рыб();
  дано(былоРыб !== null && сталоРыб !== null && сталоРыб < былоРыб,
    'счётчик основы считает с учётом выбранной кухни: рыба ' + былоРыб + ' → ' + сталоРыб);

  await page.click('#catclear'); await page.waitForTimeout(400);
  дано((await page.$$eval('.eatrow', r => r.length)) >= 8, 'сброс возвращает каталог');

  await page.fill('#eatq', 'паст'); await page.waitForTimeout(500);
  const пск = await page.$$eval('.eatrow .en b', bs => bs.map(b => b.innerText));
  дано(пск.length === 1 && /карбонара/i.test(пск[0]), 'поиск ищет по названию: ' + пск.join(' | '));
  await page.close();

  /* ── у кого истории ещё нет: доли обычные, и об этом сказано ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2800, eat: {
    'тип': 'завтрак', 'впереди': 4, 'пусто': false, 'всё': false, 'безНормы': false,
    'ост': { kcal: 1850, prot: 140, fib: 25 }, 'цель': { kcal: 463, prot: 35, fib: 6.3 },
    'раскладка': [{ kind: 'завтрак', kcal: 463, prot: 35, fib: 6.3, 'доля': 25 },
                  { kind: 'обед', kcal: 648, prot: 49, fib: 8.8, 'доля': 35 },
                  { kind: 'ужин', kcal: 555, prot: 42, fib: 7.5, 'доля': 30 },
                  { kind: 'перекус', kcal: 185, prot: 14, fib: 2.5, 'доля': 10 }],
    'доли': { 'завтрак': 0.25, 'обед': 0.35, 'ужин': 0.3, 'перекус': 0.1 },
    'дней': 0, 'свои': false, 'откуда': 'пока по среднему: своей истории ещё нет',
    'плотность': { 'надо': 7.6, 'слово': 'подойдёт любая обычная еда', 'потолок': 22,
                   'шкала': [[8, 'подойдёт любая обычная еда'], [9999, 'нет']], 'пусто': 'белок уже закрыт' },
    'норма': { kcal: 1850, prot: 140, fib: 25 }, 'съел': { kcal: 0, prot: 0, fib: 0 },
    'варианты': [], 'примерка': [] } });
  await вкладка(page);
  const нов = await page.$eval('#fpod', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  дано(/пока по среднему/.test(нов), 'новичку сказано, что доли не его: ' + нов.slice(0, 120));
  дано(/463/.test(нов), 'и цель приёма всё равно посчитана: ' + нов.slice(0, 120));
  const чипыН = await page.$$eval('.podraz button', bs => bs.map(b => b.innerText.replace(/\s+/g, ' ').trim()));
  дано(чипыН.length === 4, 'с утра впереди все четыре приёма: ' + чипыН.join(' | '));
  дано(!/12,6|плотность/.test(нов) && !/на 100 ккал/.test(нов),
    'и лишнего про плотность белка не сказано, пока она ничему не мешает');
  дано((await page.$$eval('.eatrow', r => r.length)) >= 5, 'каталог новичку виден весь — ему больше не из чего выбирать');
  await page.close();

  /* ── нормы ещё нет: не говорим «на сегодня всё» ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2800, eat: {
    'тип': 'завтрак', 'впереди': 4, 'пусто': true, 'всё': false, 'безНормы': true,
    'ост': { kcal: 0, prot: 0, fib: 0 }, 'цель': { kcal: 0, prot: 0, fib: 0 },
    'раскладка': [], 'доли': {}, 'дней': 0, 'свои': false,
    'норма': { kcal: null, prot: null, fib: null }, 'съел': { kcal: 0, prot: 0, fib: 0 },
    'нет': 'норма ещё не посчитана', 'варианты': [], 'примерка': [] } });
  await вкладка(page);
  const бн = await page.$eval('#fpod', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  дано(/норма ещё не посчитана/i.test(бн), 'без нормы объяснено, чего не хватает: ' + бн.slice(0, 110));
  дано(!/на сегодня всё/i.test(бн), 'и не сказано «на сегодня всё» — это была бы неправда');
  await page.close();

  /* ── день закрыт: предлагать нечего ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2800, eat: {
    'тип': 'ужин', 'впереди': 1, 'пусто': true, 'всё': true, 'безНормы': false,
    'ост': { kcal: 0, prot: 4, fib: 0 }, 'цель': { kcal: 0, prot: 1, fib: 0 },
    'раскладка': [{ kind: 'ужин', kcal: 0, prot: 1, fib: 0, 'доля': 100 }],
    'норма': { kcal: 1750, prot: 160, fib: 20 }, 'съел': { kcal: 1974, prot: 156, fib: 20 },
    'варианты': [], 'примерка': [] } });
  await вкладка(page);
  const всё = await page.$eval('#fpod', e => e.innerText).catch(() => '');
  дано(/на сегодня всё/i.test(всё), 'когда есть нечего — сказано прямо: ' + всё.replace(/\s+/g, ' ').slice(0, 90));
  дано(!/Записать/.test(всё), 'и ничего не предлагается');
  await page.close();

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})();
