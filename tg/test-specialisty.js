'use strict';
/* 06.11, его пункт 11: «в чате уже нужно показать вкладки куда можно добавить живых тренеров, нутрициологов и
   диетологов. Нажав на них нужно показать чат с ними, или если пока никого нет, предложить выбрать из каталога.
   Нужен каталог с фильтрами и сортировками». Его выбор: A — список чатов; только настоящие + «Стать специалистом».
   Проверяется: список чатов открывается всегда (с chat2), строки «Фитнес-тренер / Нутрициолог / Диетолог» ведут в
   каталог с нужной вкладкой; поиск, фильтры, сортировка; пустой каталог; «Подключить» — тот же лист согласия;
   кабинет специалиста — карточка в каталоге; без chat2 — как было; вёрстка 320/390, светлая/тёмная. */
const { chromium } = require('playwright'), M = require('./mock'), { opts } = require('./shot-clean'), bounds = require('./viewport-check'), contrast = require('./contrast-check');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
const КАТАЛОГ = [
  { code: 'TRNR0001', kind: 'trainer', name: 'Тимур Ахмедов', about: 'Зал на Чиланзаре. Силовые, спина без боли.', title: '', langs: ['ru', 'uz'], format: ['gym', 'online'], city: 'Ташкент', price: 600000, cur: 'UZS', exp: 8, topics: ['спина', 'набор массы'], clients: 12, rating: null, reviews: 0, me: false },
  { code: 'TRNR0002', kind: 'trainer', name: 'Анна Ли', about: 'Онлайн-ведение, домашние тренировки.', title: 'Фитнес-тренер, мастер спорта', langs: ['ru', 'en'], format: ['online', 'home'], city: 'Самарканд', price: 300000, cur: 'UZS', exp: 3, topics: ['похудение'], clients: 4, rating: null, reviews: 0, me: false },
  { code: 'NUTR0001', kind: 'nutri', name: 'Нигора Каримова', about: 'Питание под тренировки.', title: '', langs: ['uz', 'ru'], format: ['online'], city: 'Ташкент', price: null, cur: 'UZS', exp: 5, topics: ['похудение'], clients: 7, rating: null, reviews: 0, me: false }
];
function сервер(нач){
  const s = Object.assign({ pro: [], my: [], clients: [], log: [], каталог: КАТАЛОГ }, нач), запросы = [];
  s.запросы = запросы;
  s.обработчик = async (p, u, тело, метод) => {
    запросы.push({ p, метод, тело, q: Object.fromEntries(u.searchParams) });
    if (p.endsWith('/roli/me')) return { ok: true, ver: 'В1', cats: ['gym', 'body', 'food'], names: { gym: 'тренировки', body: 'вес и замеры', food: 'дневник еды' }, can: { trainer: ['gym', 'body'], nutri: ['food', 'body'], diet: ['food', 'body'] }, pro: s.pro, my: s.my, clients: s.clients, offer: null, normOffer: null, norm: null };
    if (p.endsWith('/roli/katalog/me')) { s.карточка = тело; const к = { show: тело.show, title: тело.title, langs: тело.langs, format: тело.format, city: тело.city, price: тело.price, cur: 'UZS', exp: тело.exp, topics: тело.topics }; s.pro[0].katalog = к; return { ok: true, kind: тело.kind, katalog: к }; }
    if (p.endsWith('/roli/katalog')) return { ok: true, kinds: ['trainer', 'nutri', 'diet'], list: s.каталог };
    if (p.endsWith('/roli/join') && метод === 'GET') return { ok: true, preview: true, parq: 0, pro: { name: 'Анна Ли', kind: 'trainer', about: '' }, cats: ['gym', 'body'], can: ['gym', 'body'], ver: 'В1', text: 'Тренер увидит: тренировки, вес и замеры.' };
    if (p.endsWith('/roli/log')) return { ok: true, log: [] };
    if (p.endsWith('/roli/ai/attention')) return { ok: true, clients: [] };
    if (p.endsWith('/roli/ex') && метод === 'GET') return { ok: true, ex: [], lic: '1' };
    if (p.endsWith('/roli/chat') && метод === 'GET') return { ok: true, link: u.searchParams.get('link'), msgs: [] };
    return { status: 404, body: { ok: false, error: 'не найдено' } };
  };
  return s;
}
const виден = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!(e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0); }, sel);
const СНИМОК = (p, где, имя) => process.env.SHOT && /390/.test(где) ? p.screenshot({ path: '/tmp/wbf/spec-' + где.split(':')[0].replace(' ', '-') + '-' + имя + '.png' }) : null;
const имена = p => p.$$eval('#katlist .katcard .katwho b', ns => ns.map(n => n.textContent));
async function проверить(p, где, имя, sel){
  const bb = await bounds(p), cc = await contrast(p, sel);
  ok(!bb.length, где + имя + ': ничего не вылезает ' + JSON.stringify(bb).slice(0, 160));
  ok(cc.checked > 0 && !cc.failures.length, где + имя + ': контраст ' + JSON.stringify(cc.failures).slice(0, 200));
}
(async () => { const b = await chromium.launch(); try {
  /* 1. без chat2 — кнопка чата открывает чат с ИИ-тренером, как было */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } }), s = сервер(), o = opts('light');
    o.features = ['roli', 'panel2', 'ui3']; o.roli = s.обработчик;
    const err = await M.поднять(p, o); await p.waitForTimeout(500);
    await p.click('#coachnav'); await p.waitForTimeout(500);
    ok(await виден(p, '#coachm') && !(await виден(p, '#chatlist')), 'без chat2: сразу чат с ИИ-тренером, списка нет');
    ok(!s.запросы.some(x => x.p.endsWith('/roli/katalog')), 'без chat2: каталог не запрашивается');
    ok(!err.length, 'без chat2: без ошибок ' + err.join(' | ').slice(0, 200));
    await p.close(); }

  for (const theme of ['light', 'dark']) for (const width of [320, 390]) {
    const где = theme + ' ' + width + ': ', p = await b.newPage({ viewport: { width, height: 760 } }), s = сервер(), o = opts(theme);
    o.features = ['roli', 'chat2', 'panel2', 'ui3']; o.roli = s.обработчик;
    const err = await M.поднять(p, o); await p.waitForTimeout(500);
    /* 2. список чатов — всегда, с вкладками живых специалистов */
    await p.click('#coachnav'); await p.waitForTimeout(600);
    ok(await виден(p, '#chatlist'), где + 'кнопка чата открывает список чатов, даже без специалистов');
    const строки = await p.$$eval('#clrows .clrow', ns => ns.map(n => (n.dataset.kat || n.dataset.chat || 'ии') + ':' + n.querySelector('b').textContent));
    ok(строки.length === 4 && /^ии:/.test(строки[0]) && строки.slice(1).join('|') === 'trainer:Фитнес-тренер|nutri:Нутрициолог|diet:Диетолог', где + 'ИИ-тренер и «Фитнес-тренер / Нутрициолог / Диетолог»: ' + строки.join(' · '));
    await проверить(p, где, 'список чатов', '#chatlist'); await СНИМОК(p, где, '1-chaty');
    /* 3. «Фитнес-тренер» → каталог на вкладке тренеров */
    await p.click('#clrows [data-kat="trainer"]'); await p.waitForTimeout(500);
    ok(await виден(p, '#katm'), где + 'строка открывает каталог');
    ok(s.запросы.some(x => x.p.endsWith('/roli/katalog') && x.q.uid), где + 'каталог — с сервера');
    ok(await p.$eval('#katkinds [aria-pressed="true"]', e => e.textContent) === 'Фитнес-тренер', где + 'вкладка «Фитнес-тренер» выбрана');
    ok((await имена(p)).join('|') === 'Тимур Ахмедов|Анна Ли', где + 'только тренеры, «рекомендуем» — по числу клиентов: ' + (await имена(p)).join(', '));
    const карта = (await p.$eval('#katlist .katcard', e => e.textContent)).replace(/[  ]/g, ' ');
    ok(/600 000 сум/.test(карта) && /стаж 8 лет/.test(карта) && /12 клиентов/.test(карта) && /В зале/.test(карта) && /Oʻzbekcha/.test(карта), где + 'на карточке цена, стаж, клиенты, формат и язык');
    await проверить(p, где, 'каталог', '#katm'); await СНИМОК(p, где, '2-katalog');
    /* 4. сортировка и поиск */
    await p.selectOption('#katsort', 'cheap'); await p.waitForTimeout(150);
    ok((await имена(p))[0] === 'Анна Ли', где + 'сортировка «Дешевле»');
    await p.fill('#katq', 'спина'); await p.waitForTimeout(150);
    ok((await имена(p)).join('|') === 'Тимур Ахмедов', где + 'поиск по запросам («спина»)');
    await p.fill('#katq', ''); await p.waitForTimeout(150);
    /* 5. фильтры: формат и язык, счётчик, «никого» и сброс */
    await p.click('#katfbtn'); await p.waitForTimeout(150);
    await p.click('#katf [data-katf="format"][data-v="home"]'); await p.waitForTimeout(150);
    ok((await имена(p)).join('|') === 'Анна Ли' && await p.$eval('#katfn', e => e.textContent) === '1', где + 'фильтр «На дому» и счётчик фильтров');
    await p.click('#katf [data-katf="langs"][data-v="uz"]'); await p.waitForTimeout(150);
    ok(/Никого не нашлось/.test(await p.$eval('#katlist', e => e.textContent)), где + 'фильтры без совпадений — «Никого не нашлось»');
    await проверить(p, где, 'фильтры', '#katm'); await СНИМОК(p, где, '3-filtry');
    await p.click('#katf [data-katreset]'); await p.waitForTimeout(150);
    ok((await имена(p)).length === 2, где + '«Сбросить фильтры» возвращает всех');
    await p.fill('#katmax', '400000'); await p.waitForTimeout(150);
    ok((await имена(p)).join('|') === 'Анна Ли', где + 'цена до 400 000');
    await p.click('#katf [data-katreset]'); await p.waitForTimeout(150);
    /* 6. «Все» и «Диетолог» (пусто) + «Стать специалистом» */
    await p.click('#katkinds [data-katk=""]'); await p.waitForTimeout(150);
    ok((await имена(p)).length === 3, где + 'вкладка «Все» — все три');
    await p.click('#katkinds [data-katk="diet"]'); await p.waitForTimeout(150);
    ok(/Диетологов в каталоге пока нет/.test(await p.$eval('#katlist', e => e.textContent)) && await виден(p, '[data-katpro]'), где + 'диетологов нет — честно и «Стать специалистом»');
    await проверить(p, где, 'пустой каталог', '#katm'); await СНИМОК(p, где, '4-pusto');
    /* 7. «Подключить» — тот же лист согласия, что по ссылке специалиста */
    await p.click('#katkinds [data-katk="trainer"]'); await p.waitForTimeout(150);
    await p.click('#katlist [data-katgo="TRNR0002"]'); await p.waitForTimeout(600);
    ok(!(await виден(p, '#katm')) && await виден(p, '#roljm'), где + '«Подключить» → лист «что ему будет видно»');
    ok(s.запросы.some(x => x.p.endsWith('/roli/join') && x.метод === 'GET' && x.q.code === 'TRNR0002'), где + 'лист — по коду из карточки');
    ok(!/[?&]pro=/.test(await p.evaluate(() => location.search)), где + 'код не остаётся в адресе');
    ok(!err.length, где + 'без ошибок ' + err.join(' | ').slice(0, 200));
    await p.close();
  }

  /* 8. специалист: карточка в каталоге в кабинете */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const s = сервер({ pro: [{ kind: 'trainer', name: 'Тимур Ахмедов', about: '', status: 'ok', code: 'TRNR0001', link: 'https://t.me/WellbolTestBot?start=s_TRNR0001', katalog: { show: false, langs: [], format: [], topics: [] } }] });
    const o = opts('light'); o.features = ['roli', 'chat2']; o.roli = s.обработчик; o.base = M.БАЗА + '?pp=rolpro';
    const err = await M.поднять(p, o); await p.waitForTimeout(800);
    ok(await виден(p, '#rolpro .rolkat'), 'кабинет: блок «Карточка в каталоге»');
    await p.click('#rolpro [data-rol="katshow"]');
    await p.fill('#rk-title-trainer', 'Фитнес-тренер, КМС'); await p.fill('#rk-city-trainer', 'Ташкент'); await p.fill('#rk-exp-trainer', '8'); await p.fill('#rk-price-trainer', '500000');
    await p.fill('#rk-topics-trainer', 'спина, набор массы');
    await p.click('#rolpro [data-grp="langs"][data-kv="ru"]'); await p.click('#rolpro [data-grp="format"][data-kv="gym"]');
    await p.click('#rolpro [data-rol="katsave"]'); await p.waitForTimeout(500);
    const т = s.карточка || {};
    ok(т.kind === 'trainer' && т.show === true && т.title === 'Фитнес-тренер, КМС' && т.city === 'Ташкент' && т.exp === 8 && т.price === 500000 && (т.langs || []).join() === 'ru' && (т.format || []).join() === 'gym' && (т.topics || []).join('|') === 'спина|набор массы', 'кабинет: карточка уходит на сервер целиком: ' + JSON.stringify(т));
    ok(/Сохранено\. Карточка видна в каталоге/.test(await p.$eval('#rolpro .rolkat', e => e.textContent)), 'кабинет: «Сохранено. Карточка видна в каталоге»');
    ok(await p.$eval('#rk-title-trainer', e => e.value) === 'Фитнес-тренер, КМС', 'кабинет: после сохранения поля не сбросились');
    await проверить(p, 'кабинет: ', 'карточка', '#rolpro'); if (process.env.SHOT) { await p.$eval('#rolpro .rolkat', e => e.scrollIntoView()); await p.screenshot({ path: '/tmp/wbf/spec-kabinet.png' }); }
    ok(!err.length, 'кабинет: без ошибок ' + err.join(' | ').slice(0, 200));
    await p.close(); }
} finally { await b.close(); }
console.log(bad ? '\nПРОВАЛОВ: ' + bad : '\nВсё прошло'); process.exit(bad ? 1 : 0); })();
