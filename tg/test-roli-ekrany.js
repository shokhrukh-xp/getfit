'use strict';
/* 29.10, роли — этап 2а (его «дальше» после фундамента; правило «впредь всё
   только на тестовом приложении»): специалисты в профиле. Проверяется:
   (1) без функции roli нет ни строк, ни листов, ни запросов — приложение как до
   этапа; (2) по ссылке из бота (?pro=КОД) — лист с текстом согласия от сервера,
   подключение уходит с версией согласия; (3) «Мои специалисты»: что открыто,
   переключатели, «Отключить» с подтверждением, «Кто смотрел»; (4) «Я
   специалист»: заявка, ссылка, клиенты и карточка клиента; (5) заявки в
   Админ панели; всё — на 320 и 390, в обеих темах, без вылезания и с контрастом. */
const { chromium } = require('playwright'), M = require('./mock'), { opts } = require('./shot-clean'), bounds = require('./viewport-check'), contrast = require('./contrast-check');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
const ВЕР = '2026-10-29.1';
const ИМЕНА = { food: 'дневник еды', food_photo: 'фото еды', gym: 'тренировки', body: 'вес и замеры', body_photo: 'фото тела', labs: 'анализы', health: 'здоровье и ограничения', cycle: 'цикл' };
const МОЖНО = { trainer: ['gym', 'body', 'body_photo', 'food', 'health'], nutri: ['food', 'food_photo', 'body', 'body_photo', 'labs', 'health', 'cycle'] };
/* маленький «сервер ролей»: состояние и журнал запросов */
function сервер(нач){
  const s = Object.assign({ pro: [], my: [], clients: [], log: [], adm: [] }, нач), запросы = [];
  s.запросы = запросы;
  s.обработчик = async (p, u, тело, метод) => {
    запросы.push({ p, метод, тело, q: Object.fromEntries(u.searchParams) });
    if (p.endsWith('/roli/me')) return { ok: true, ver: ВЕР, cats: Object.keys(ИМЕНА), names: ИМЕНА, can: МОЖНО, pro: s.pro, my: s.my, clients: s.clients };
    if (p.endsWith('/roli/log')) return { ok: true, log: s.log };
    if (p.endsWith('/roli/join') && метод === 'GET' && s.безВозраста) return { status: 403, body: { ok: false, code: 'need_age', error: 'Укажите возраст в профиле — подключить специалиста можно с 18 лет.' } };
    if (p.endsWith('/roli/join') && метод === 'GET') return { ok: true, preview: true, pro: { name: 'Тимур Ахмедов', kind: 'trainer', about: 'Зал на Чиланзаре, 8 лет' }, cats: ['gym', 'body'], can: МОЖНО.trainer, ver: ВЕР,
      text: 'Тренер увидит: тренировки, вес и замеры. Остальное — только если вы сами откроете. Каждый просмотр видно в «Кто смотрел». Отключить можно в любой момент.' };
    if (p.endsWith('/roli/join')) { if (s.joinОтказ) return { status: 409, body: s.joinОтказ }; s.my = [{ id: 'l1', kind: 'trainer', name: 'Тимур Ахмедов', proStatus: 'ok', cats: ['gym', 'body'] }]; return { ok: true, link: 'l1' }; }
    if (p.endsWith('/roli/grant')) { const l = s.my.find(x => x.id === тело.link); if (тело.allowed) l.cats.push(тело.cat); else l.cats = l.cats.filter(c => c !== тело.cat); return { ok: true, link: l.id, cats: l.cats }; }
    if (p.endsWith('/roli/end')) { s.my = s.my.filter(x => x.id !== тело.link); return { ok: true }; }
    if (p.endsWith('/roli/pro/apply')) { s.pro = [{ kind: тело.kind, name: тело.name, about: тело.about, status: 'pending', code: null }]; return { ok: true }; }
    if (p.endsWith('/roli/client')) return { ok: true, cat: u.searchParams.get('cat'), photo: false, rows: [{ date: '2026-10-28', w: 79.5, fat: 24.1, waist: 84 }, { date: '2026-10-20', w: 80.2 }] };
    if (p.endsWith('/admin/roli') && метод === 'GET') return { ok: true, pros: s.adm };
    if (p.endsWith('/admin/roli')) { const x = s.adm.find(a => a.uid === тело.who); x.status = тело.status; return { ok: true }; }
    return { status: 404, body: { ok: false, error: 'не найдено' } };
  };
  return s;
}
const виден = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!(e && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0); }, sel);
async function проверить(p, где, имя, sel){
  const bb = await bounds(p), cc = await contrast(p, sel);
  ok(!bb.length, где + имя + ': ничего не вылезает ' + JSON.stringify(bb).slice(0, 160));
  ok(cc.checked > 0 && !cc.failures.length, где + имя + ': контраст ' + JSON.stringify(cc.failures).slice(0, 160));
}
(async () => { const b = await chromium.launch(); try {
  /* 1. выключено: ни строк, ни листов, ни запросов — даже со ссылкой специалиста */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const s = сервер(), o = opts('light'); o.roli = s.обработчик; o.base = M.БАЗА + '?pro=ABCDEFGH';
    const err = await M.поднять(p, o); await p.waitForTimeout(700);
    ok(!(await виден(p, '#roljm')), 'выключено: лист подключения не всплывает');
    await p.click('#profbtn'); await p.waitForTimeout(400);
    const гр = await p.$$eval('#pqmain .pqlab', ns => ns.filter(n => n.offsetParent).map(n => n.textContent.trim()));
    ok(!гр.includes('Специалисты'), 'выключено: группы «Специалисты» нет: ' + гр.join(' · '));
    ok(s.запросы.length === 0, 'выключено: к ручкам ролей ни одного запроса');
    ok(!err.length, 'выключено: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  for (const theme of ['light', 'dark']) for (const width of [320, 390]) {
    const где = theme + ' ' + width + ': ';
    /* 2. клиент по ссылке из бота */
    const p = await b.newPage({ viewport: { width, height: 760 } });
    const s = сервер({ log: [{ at: Date.parse('2026-10-29T09:15:00Z'), cat: 'body', what: 'просмотр', kind: 'trainer', name: 'Тимур Ахмедов' }] });
    const o = opts(theme); o.features = ['roli']; o.roli = s.обработчик; o.base = M.БАЗА + '?pro=tstrnr01';
    const err = await M.поднять(p, o);
    await p.waitForSelector('#roljok', { timeout: 5000 }).catch(() => {});
    ok(await виден(p, '#roljm'), где + 'по ссылке из бота открылся лист подключения');
    const лист = await p.$eval('#roljbody', e => e.textContent);
    ok(/Тимур Ахмедов/.test(лист) && /Тренер увидит: тренировки, вес и замеры/.test(лист), где + 'кто зовёт и что увидит — от сервера: ' + лист.slice(0, 120));
    ok(s.запросы.some(x => x.p.endsWith('/roli/join') && x.метод === 'GET' && x.q.code === 'TSTRNR01'), где + 'код уходит заглавными');
    ok(!/[?&]pro=/.test(await p.evaluate(() => location.search)), где + 'код убран из адреса — после перезагрузки лист сам не всплывёт');
    await проверить(p, где, 'лист подключения', '#roljm');
    await p.click('#roljok'); await p.waitForTimeout(300);
    const j = s.запросы.find(x => x.p.endsWith('/roli/join') && x.метод === 'POST');
    ok(j && j.тело.consent === ВЕР && j.тело.code === 'TSTRNR01' && j.тело.replace === false, где + 'подключение — с версией согласия: ' + JSON.stringify(j && j.тело));
    ok(/Подключено/.test(await p.$eval('#roljbody', e => e.textContent)), где + 'после «да» — «Подключено»');
    await p.click('#roljclose'); await p.waitForTimeout(300);
    ok(!(await виден(p, '#roljm')), где + '«Готово» закрывает лист');

    /* 3. «Мои специалисты» */
    await p.click('#profbtn'); await p.waitForTimeout(400);
    const гр = await p.$$eval('#pqmain .pqlab', ns => ns.filter(n => n.offsetParent).map(n => n.textContent.trim()));
    ok(гр.join('|') === 'О вас|Тренер|Зал|Друзья|Специалисты|Приложение', где + 'группа «Специалисты» перед «Приложением»: ' + гр.join(' · '));
    await p.waitForFunction(() => /1 подключён/.test((document.getElementById('pv-spec') || {}).textContent || ''), null, { timeout: 3000 }).catch(() => {});
    ok(/1 подключён/.test(await p.$eval('#pv-spec', e => e.textContent)), где + 'справа в строке — сколько подключено');
    await p.click('#pq-spec'); await p.waitForSelector('#rolmy .rolsw', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(400);
    const пер = await p.$$eval('#rolmy .rolsw', ns => ns.map(n => [n.dataset.cat, n.getAttribute('aria-checked')]));
    ok(JSON.stringify(пер) === JSON.stringify([['gym', 'true'], ['body', 'true'], ['body_photo', 'false'], ['food', 'false'], ['health', 'false']]), где + 'переключатели — что тренеру можно и что открыто: ' + JSON.stringify(пер));
    ok(await p.$$eval('#rolmy .rolsw', ns => ns.every(n => n.getBoundingClientRect().height >= 44)), где + 'переключатели не ниже 44 px');
    ok(/Тимур Ахмедов/.test(await p.$eval('#rollog', e => e.textContent)) && /вес и замеры/.test(await p.$eval('#rollog', e => e.textContent)), где + '«Кто смотрел»: кто и что');
    await проверить(p, где, 'Мои специалисты', '#profm');
    await p.click('#rolmy .rolsw[data-cat="food"]'); await p.waitForTimeout(300);
    const g = s.запросы.find(x => x.p.endsWith('/roli/grant'));
    ok(g && g.тело.cat === 'food' && g.тело.allowed === true && g.тело.link === 'l1', где + 'переключатель — запрос на сервер: ' + JSON.stringify(g && g.тело));
    ok(await p.$eval('#rolmy .rolsw[data-cat="food"]', e => e.getAttribute('aria-checked')) === 'true', где + 'после ответа — включён');
    await p.click('#rolmy [data-rol="endask"]'); await p.waitForTimeout(150);
    ok(!s.запросы.some(x => x.p.endsWith('/roli/end')), где + 'первое нажатие «Отключить» только спрашивает');
    await p.click('#rolmy [data-rol="end"]'); await p.waitForTimeout(400);
    ok(s.запросы.some(x => x.p.endsWith('/roli/end') && x.тело.link === 'l1'), где + 'второе — отключает');
    ok(/Пока никого/.test(await p.$eval('#rolmy', e => e.textContent)), где + 'после отключения — пусто');
    ok(!err.length, где + 'клиент: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();

    /* 4. специалист: заявка → ссылка и клиенты → карточка */
    const p2 = await b.newPage({ viewport: { width, height: 760 } });
    const s2 = сервер(), o2 = opts(theme); o2.features = ['roli']; o2.roli = s2.обработчик;
    const err2 = await M.поднять(p2, o2); await p2.waitForTimeout(400);
    await p2.click('#profbtn'); await p2.waitForTimeout(300);
    await p2.click('#pq-pro'); await p2.waitForSelector('#rol-name', { timeout: 3000 }).catch(() => {});
    await проверить(p2, где, 'заявка специалиста', '#profm');
    await p2.click('#rol-kind button[data-v="nutri"]'); await p2.fill('#rol-name', 'Нигора'); await p2.fill('#rol-about', 'Нутрициолог, 5 лет');
    await p2.click('#rolpro [data-rol="apply"]'); await p2.waitForTimeout(400);
    const a = s2.запросы.find(x => x.p.endsWith('/roli/pro/apply'));
    ok(a && a.тело.kind === 'nutri' && a.тело.name === 'Нигора' && a.тело.about === 'Нутрициолог, 5 лет', где + 'заявка уходит как заполнена: ' + JSON.stringify(a && a.тело));
    ok(/на проверке/.test(await p2.$eval('#rolpro', e => e.textContent)), где + 'после заявки — «на проверке»');
    s2.pro = [{ kind: 'trainer', name: 'Тимур Ахмедов', status: 'ok', code: 'TSTRNR01', link: 'https://t.me/WellbolTestBot?start=s_TSTRNR01' }];
    s2.clients = [{ id: 'l1', kind: 'trainer', client: '777', name: 'Карина', cats: ['gym', 'body'] }];
    await p2.click('#pqback'); await p2.waitForTimeout(200); await p2.click('#pq-pro'); await p2.waitForSelector('#rolpro [data-rol="card"]', { timeout: 3000 }).catch(() => {});
    ok(await p2.$eval('#rolpro .invcode input', e => e.value) === 'https://t.me/WellbolTestBot?start=s_TSTRNR01', где + 'ссылка для клиентов — от сервера');
    ok(/1 клиент/.test(await p2.$eval('#pv-pro', e => e.textContent)), где + 'справа в строке — сколько клиентов');
    await проверить(p2, где, 'Я специалист', '#profm');
    await p2.click('#rolpro [data-rol="card"]'); await p2.waitForFunction(() => /79,5 кг/.test((document.getElementById('rolcbody') || {}).textContent || ''), null, { timeout: 3000 }).catch(() => {});
    ok(await виден(p2, '#rolcm'), где + 'карточка клиента открылась');
    const к = s2.запросы.find(x => x.p.endsWith('/roli/client'));
    ok(к && к.q.who === '777' && к.q.cat === 'body' && к.q.uid, где + 'клиент — в who, свой uid — в uid, первым — замеры: ' + JSON.stringify(к && к.q));
    const кт = await p2.$eval('#rolcbody', e => e.textContent);
    ok(/79,5 кг · жир 24,1 % · талия 84 см/.test(кт) && /Кто смотрел/.test(кт), где + 'замеры клиента и напоминание про журнал: ' + кт.slice(0, 140));
    ok(await p2.$$eval('#rol-ccat button', ns => ns.map(n => n.dataset.v).join()) === 'body,gym', где + 'вкладки — только открытые разделы');
    await проверить(p2, где, 'карточка клиента', '#rolcm');
    await p2.click('#rol-ccat button[data-v="gym"]'); await p2.waitForTimeout(300);
    ok(s2.запросы.some(x => x.p.endsWith('/roli/client') && x.q.cat === 'gym'), где + 'вкладка «тренировки» — свой запрос');
    await p2.click('#rolcclose'); await p2.waitForTimeout(200);
    ok(!(await виден(p2, '#rolcm')), где + '«Закрыть» закрывает карточку');
    ok(!err2.length, где + 'специалист: без ошибок страницы ' + err2.join(' | ').slice(0, 200));
    await p2.close();
  }
  /* 6. живая проверка 29.10: новичок по ссылке упирается в возраст — после профиля лист возвращается */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const s = сервер({ безВозраста: true }), o = opts('light'); o.features = ['roli']; o.roli = s.обработчик; o.base = M.БАЗА + '?pro=TSTRNR01';
    const err = await M.поднять(p, o);
    await p.waitForSelector('#roljage', { timeout: 5000 }).catch(() => {});
    ok(/Укажите возраст/.test(await p.$eval('#roljbody', e => e.textContent)), 'без возраста: лист говорит, что нужно');
    await p.click('#roljage'); await p.waitForTimeout(400);
    ok(!(await виден(p, '#roljm')) && await виден(p, '#profm'), '«Указать возраст» открывает профиль');
    s.безВозраста = false;
    await p.click('#profclose'); await p.waitForTimeout(500);
    ok(await виден(p, '#roljm') && /Подключить/.test(await p.$eval('#roljbody', e => e.textContent)), 'возраст есть — лист подключения вернулся сам');
    await p.click('#roljclose'); await p.waitForTimeout(200);
    await p.click('#profbtn'); await p.waitForTimeout(400); await p.click('#profclose'); await p.waitForTimeout(400);
    ok(!(await виден(p, '#roljm')), '«Не сейчас» — больше не всплывает');
    ok(!err.length, 'без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 5. владелец: заявки в Админ панели */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const s = сервер({ adm: [{ uid: 't9', kind: 'trainer', name: 'Олег', about: 'кроссфит', status: 'pending' }] });
    const o = opts('light'); o.features = ['roli']; o.roli = s.обработчик; o.admin = { про: [], промо: [] };
    const err = await M.поднять(p, o); await p.waitForTimeout(400);
    await p.click('#profbtn'); await p.waitForTimeout(300); await p.click('#profboss');
    await p.waitForSelector('#roladmlist [data-rol="adm"]', { timeout: 4000 }).catch(() => {});
    ok(/Олег/.test(await p.$eval('#roladmlist', e => e.textContent)), 'админ: заявка видна');
    await p.click('#roladmlist [data-st="ok"]'); await p.waitForTimeout(400);
    const r = s.запросы.find(x => x.p.endsWith('/admin/roli') && x.метод === 'POST');
    ok(r && r.тело.who === 't9' && r.тело.status === 'ok' && r.тело.kind === 'trainer', 'админ: «Принять» — специалист в who: ' + JSON.stringify(r && r.тело));
    ok(/принимаю клиентов/.test(await p.$eval('#roladmlist', e => e.textContent)), 'админ: после ответа — принят');
    ok(!err.length, 'админ: без ошибок страницы ' + err.join(' | ').slice(0, 200));
  }
} finally { await b.close(); }
  console.log(bad ? 'ПРОВАЛ: ' + bad : 'PASS роли, этап 2а: экраны');
  process.exit(bad ? 1 : 0);
})();
