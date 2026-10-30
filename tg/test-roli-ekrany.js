'use strict';
/* 29.10, роли — этап 2а (его «дальше» после фундамента; правило «впредь всё
   только на тестовом приложении»): специалисты в профиле. Проверяется:
   (1) без функции roli нет ни строк, ни листов, ни запросов — приложение как до
   этапа; (2) по ссылке из бота (?pro=КОД) — лист с текстом согласия от сервера,
   подключение уходит с версией согласия; (3) «Мои специалисты»: что открыто,
   переключатели, «Отключить» с подтверждением, «Кто смотрел»; (4) «Я
   специалист» (с 30.10 «Кабинет специалиста», только принятому): ссылка, клиенты и карточка клиента; (5) заявки в
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
    if (p.endsWith('/roli/me')) { if (s.сбойMe) return { status: 502, body: { error: 'Load failed' } }; return { ok: true, ver: ВЕР, cats: Object.keys(ИМЕНА), names: ИМЕНА, can: МОЖНО, pro: s.pro, my: s.my, clients: s.clients, offer: s.offer || null, normOffer: s.normOffer || null, norm: s.norm || null }; }
    if (p.endsWith('/roli/prog') && метод === 'GET') return { ok: true, prog: null, at: 0 };
    if (p.endsWith('/roli/prog')) { s.отправлено = тело.prog; return { ok: true, at: 5 }; }
    if (p.endsWith('/roli/prog/take')) { const пр = s.offer && s.offer.prog; s.offer = null; return { ok: true, take: тело.take, prog: тело.take ? пр : null }; }
    if (p.endsWith('/roli/complain')) { s.жалоба = тело; return { ok: true }; }
    if (p.endsWith('/roli/norm') && метод === 'GET') return { ok: true, sent: null, current: { kcal: 2100, prot: 150, fat: 70, pro: false }, flags: s.отметки || [] };
    if (p.endsWith('/roli/norm')) { s.норма = тело; return { ok: true, at: 9 }; }
    if (p.endsWith('/roli/norm/take')) { s.взял = тело; const о = s.normOffer; s.normOffer = null; if (тело.take) s.norm = { name: о.name, kcal: о.kcal, prot: о.prot, fat: о.fat, rules: о.rules, note: '' }; return { ok: true, take: тело.take }; }
    if (p.endsWith('/roli/norm/off')) { s.norm = null; s.сняла = true; return { ok: true }; }
    if (p.endsWith('/roli/meal-note')) { s.заметка = тело; return { ok: true }; }
    if (p.endsWith('/roli/ex') && метод === 'GET') return { ok: true, ex: s.упр || [], lic: '2026-10-30.1' };
    if (p.endsWith('/roli/ex')) { s.сохр = тело; const x = { id: 'uабв', n: тело.n, m: тело.m, sm: тело.sm, q: тело.q, c: тело.c, cues: тело.cues.filter(Boolean), img: (тело.photos || []).map((_, i) => 'exphoto0000' + (i + 1)), video: тело.video, own: true }; s.упр = [x]; return { ok: true, ex: x }; }
    if (p.endsWith('/roli/chat') && метод === 'GET') return { ok: true, link: u.searchParams.get('link'), msgs: s.msgs || [] };
    if (p.endsWith('/roli/chat')) { (s.msgs = s.msgs || []).push({ id: s.msgs.length + 1, me: true, text: тело.text, at: Date.parse('2026-10-30T07:00:00Z'), seen: false }); s.написано = тело; return { ok: true, id: s.msgs.length }; }
    if (p.endsWith('/roli/log')) return { ok: true, log: s.log };
    if (p.endsWith('/roli/join') && метод === 'GET' && s.нутри) return { ok: true, preview: true, parq: 0, health: 4, prefill: [true, false, false, false], pro: { name: 'Нигора', kind: 'nutri', about: '' }, cats: ['food', 'food_photo', 'body'], can: МОЖНО.nutri, ver: ВЕР, text: 'Нутрициолог увидит: дневник еды, фото еды, вес и замеры.' };
    if (p.endsWith('/roli/join') && метод === 'GET' && s.безВозраста) return { status: 403, body: { ok: false, code: 'need_age', error: 'Укажите возраст в профиле — подключить специалиста можно с 18 лет.' } };
    if (p.endsWith('/roli/join') && метод === 'GET') return { ok: true, preview: true, parq: s.анкета ? 7 : 0, pro: { name: 'Тимур Ахмедов', kind: 'trainer', about: 'Зал на Чиланзаре, 8 лет' }, cats: ['gym', 'body'], can: МОЖНО.trainer, ver: ВЕР,
      text: 'Тренер увидит: тренировки, вес и замеры. Остальное — только если вы сами откроете. Каждый просмотр видно в «Кто смотрел». Отключить можно в любой момент.' };
    if (p.endsWith('/roli/join')) { if (s.joinОтказ) return { status: 409, body: s.joinОтказ }; s.my = [{ id: 'l1', kind: 'trainer', name: 'Тимур Ахмедов', proStatus: 'ok', cats: ['gym', 'body'] }]; return { ok: true, link: 'l1' }; }
    if (p.endsWith('/roli/grant')) { const l = s.my.find(x => x.id === тело.link); if (тело.allowed) l.cats.push(тело.cat); else l.cats = l.cats.filter(c => c !== тело.cat); return { ok: true, link: l.id, cats: l.cats }; }
    if (p.endsWith('/roli/end')) { s.my = s.my.filter(x => x.id !== тело.link); return { ok: true }; }
    if (p.endsWith('/roli/pro/apply')) { s.pro = [{ kind: тело.kind, name: тело.name, about: тело.about, status: 'pending', code: null }]; return { ok: true }; }
    if (p.endsWith('/roli/client') && u.searchParams.get('cat') === 'food') return { ok: true, cat: 'food', photo: true, rows: [{ id: 'm1', date: '2026-10-29', t: '13:00', kind: 'обед', text: 'плов', kcal: 800 }, { id: 'm2', date: '2026-10-29', t: '19:00', kind: 'ужин', text: 'салат', kcal: 300, note: { text: 'Отлично', mark: 'ok' } }] };
    if (p.endsWith('/roli/client')) return { ok: true, cat: u.searchParams.get('cat'), photo: false, rows: [{ date: '2026-10-28', w: 79.5, fat: 24.1, waist: 84 }, { date: '2026-10-20', w: 80.2 }] };
    if (p.endsWith('/admin/roli') && метод === 'GET') return { ok: true, pros: s.adm };
    if (p.endsWith('/admin/roli')) { const x = s.adm.find(a => a.uid === тело.who); x.status = тело.status; return { ok: true }; }
    /* этап 6: компания */
    if (p.endsWith('/roli/co') && метод === 'GET') return { ok: true, ver: 'КВ1', min: 10, team: s.coTeam || [], member: s.coMember || null, web: s.coWeb || 0 };
    if (p.endsWith('/roli/co/web/end')) { s.coВебВыход = true; s.coWeb = 0; return { ok: true }; }
    if (p.endsWith('/roli/co/card')) return s.coCard ? Object.assign({ ok: true }, s.coCard) : { status: 404, body: { ok: false, error: 'нет' } };
    if (p.endsWith('/roli/co/join') && метод === 'GET') return s.coJoin || { ok: true, preview: true, kind: 'member', co: { name: 'Альфа', about: 'IT, 40 человек' }, ver: 'КВ1',
      text: 'Компания увидит только общие цифры по группе от 10 человек: сколько участвуют, доля активных и средние за прошлую неделю, в челленджах — доля дошедших. Кто именно участвует, ваши еда, вес, тренировки и здоровье компании не видны. Свой прогресс в челлендже видите только вы. Выйти можно в любой момент.' };
    if (p.endsWith('/roli/co/join')) { if (s.coОтказ && !тело.replace) return { status: 409, body: s.coОтказ }; s.coВошёл = тело; s.coMember = { co: 'c1', name: 'Альфа', joined: 1, ch: s.coCh || [] }; return { ok: true, joined: true }; }
    if (p.endsWith('/roli/co/ch/join')) { s.coУчастие = тело; s.coMember.ch.forEach(c => { if (c.id === тело.id) { c.joined = тело.on; c.mine = тело.on ? 2 : undefined; } }); return { ok: true, joined: тело.on }; }
    if (p.endsWith('/roli/co/leave')) { s.coВышел = тело; s.coMember = null; return { ok: true }; }
    if (p.endsWith('/roli/co/apply')) { s.coЗаявка = тело; s.coTeam = [{ id: 'c9', name: тело.name, status: 'pending', role: 'admin' }]; return { ok: true }; }
    if (p.endsWith('/roli/co/ch')) { s.coЧелл = тело; return { ok: true }; }
    if (p.endsWith('/roli/co/invite')) { s.coПригл = тело; return { ok: true, role: тело.role, link: 'https://t.me/WellbolTestBot?start=c_TEAMCODE01' }; }
    if (p.endsWith('/roli/co/team')) { s.coКоманда = тело; return { ok: true }; }
    if (p.endsWith('/roli/co/admin') && метод === 'GET') return { ok: true, companies: s.coAdm || [] };
    if (p.endsWith('/roli/co/admin')) { const x = s.coAdm.find(a => a.id === тело.co); x.status = тело.status; return { ok: true }; }
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

    /* 4. этап 6г (его слова: «приложение должно быть только для пользователей»): заявки в приложении нет —
       обычному пользователю ни «Специалистов», ни «Компании»; на проверке — тоже ничего; принят — «Кабинет специалиста» */
    const p0 = await b.newPage({ viewport: { width, height: 760 } });
    const s0 = сервер(), o0 = opts(theme); o0.features = ['roli']; o0.roli = s0.обработчик;
    const err0 = await M.поднять(p0, o0); await p0.waitForTimeout(600);
    await p0.click('#profbtn'); await p0.waitForTimeout(300);
    const гр2 = await p0.$$eval('#pqmain .pqlab', ns => ns.filter(n => n.offsetParent).map(n => n.textContent.trim()));
    ok(гр2.join('|') === 'О вас|Тренер|Зал|Друзья|Приложение', где + 'обычному пользователю — ни «Специалистов», ни «Компании»: ' + гр2.join(' · '));
    ok(!(await виден(p0, '#pq-spec')) && !(await виден(p0, '#pq-pro')) && !(await виден(p0, '#pq-co')), где + 'строк ролей не видно');
    ok(!err0.length, где + 'обычный пользователь: без ошибок страницы ' + err0.join(' | ').slice(0, 200));
    await p0.close();
    const sП = сервер({ pro: [{ kind: 'nutri', name: 'Нигора', status: 'pending', code: null }] }), pП = await b.newPage({ viewport: { width, height: 760 } });
    const oП = opts(theme); oП.features = ['roli']; oП.roli = sП.обработчик; await M.поднять(pП, oП); await pП.waitForTimeout(600);
    await pП.click('#profbtn'); await pП.waitForTimeout(300);
    ok(!(await виден(pП, '#pq-pro')) && !(await виден(pП, '#pq-roli')), где + 'заявка на проверке — кабинета в приложении ещё нет');
    await pП.close();
    const s2 = сервер({ pro: [{ kind: 'trainer', name: 'Тимур Ахмедов', status: 'ok', code: 'TSTRNR01', link: 'https://t.me/WellbolTestBot?start=s_TSTRNR01' }],
      clients: [{ id: 'l1', kind: 'trainer', client: '777', name: 'Карина', cats: ['gym', 'body'] }] });
    const o2 = opts(theme); o2.features = ['roli']; o2.roli = s2.обработчик; o2.base = M.БАЗА + '?pp=rolpro';
    const p2 = await b.newPage({ viewport: { width, height: 760 } });
    const err2 = await M.поднять(p2, o2); await p2.waitForTimeout(800);
    ok(await виден(p2, '#rolpro') && !/[?&]pp=/.test(await p2.evaluate(() => location.search)), где + 'из сообщения «Заявка принята» (?pp=rolpro) — сразу кабинет специалиста');
    await p2.click('#pqback'); await p2.waitForTimeout(300);
    ok(await виден(p2, '#pq-pro') && /Кабинет специалиста/.test(await p2.$eval('#pq-pro', e => e.textContent)), где + 'принятому — «Кабинет специалиста»');
    ok(!(await виден(p2, '#pq-spec')) && !(await виден(p2, '#pq-co')), где + 'остальные строки — нет (он не клиент и не в компании)');
    await p2.click('#pq-pro'); await p2.waitForSelector('#rolpro [data-rol="card"]', { timeout: 3000 }).catch(() => {});
    ok(await p2.$eval('#rolpro .invcode input', e => e.value) === 'https://t.me/WellbolTestBot?start=s_TSTRNR01', где + 'ссылка для клиентов — от сервера');
    ok(/1 клиент/.test(await p2.$eval('#pv-pro', e => e.textContent)), где + 'справа в строке — сколько клиентов');
    await проверить(p2, где, 'Кабинет специалиста', '#profm');
    await p2.click('#rolpro [data-rol="card"]'); await p2.waitForFunction(() => /79,5 кг/.test((document.getElementById('rolcbody') || {}).textContent || ''), null, { timeout: 3000 }).catch(() => {});
    ok(await виден(p2, '#rolcm'), где + 'карточка клиента открылась');
    const к = s2.запросы.find(x => x.p.endsWith('/roli/client'));
    ok(к && к.q.who === '777' && к.q.cat === 'body' && к.q.uid, где + 'клиент — в who, свой uid — в uid, первым — замеры: ' + JSON.stringify(к && к.q));
    const кт = await p2.$eval('#rolcbody', e => e.textContent);
    ok(/79,5 кг · жир 24,1 % · талия 84 см/.test(кт) && /Кто смотрел/.test(кт), где + 'замеры клиента и напоминание про журнал: ' + кт.slice(0, 140));
    ok(await p2.$$eval('#rol-ccat button', ns => ns.map(n => n.dataset.v).join()) === 'body,gym,prog,chat', где + 'вкладки — открытые разделы, программа и переписка');
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
  /* 7. этап 2б, тренер: итог анкеты и программа клиенту из каталога */
  for (const width of [320, 390]) {
    const где = 'программа ' + width + ': ';
    const p = await b.newPage({ viewport: { width, height: 800 } });
    const s = сервер({ pro: [{ kind: 'trainer', name: 'Тимур', status: 'ok', code: 'TSTRNR01', link: 'https://t.me/WellbolTestBot?start=s_TSTRNR01' }],
      clients: [{ id: 'l1', kind: 'trainer', client: '777', name: 'Карина', cats: [], parq: 'doctor' }] });
    const o = opts('light'); o.features = ['roli']; o.roli = s.обработчик;
    const err = await M.поднять(p, o); await p.waitForTimeout(300);
    await p.click('#profbtn'); await p.waitForTimeout(300); await p.click('#pq-pro');
    await p.waitForSelector('#rolpro [data-rol="card"]', { timeout: 3000 }).catch(() => {});
    await p.click('#rolpro [data-rol="card"]'); await p.waitForSelector('#rolp-name', { timeout: 3000 }).catch(() => {});
    const т = await p.$eval('#rolcbody', e => e.textContent);
    ok(/нужен допуск врача/.test(т), где + 'итог анкеты виден тренеру: ' + т.slice(0, 80));
    ok(/Отправить клиенту/.test(т), где + 'ничего не открыто — сразу программа');
    await p.fill('#rolp-name', 'Сила · 2 дня');
    await p.click('#rolcbody [data-rp="add"]'); await p.waitForSelector('#rolp-q', { timeout: 2000 }).catch(() => {});
    await p.fill('#rolp-q', 'жим лёжа'); await p.waitForSelector('#rolp-res [data-rp="pick"]', { timeout: 4000 }).catch(() => {});
    const нашёл = await p.$$eval('#rolp-res [data-rp="pick"]', ns => ns.map(n => n.textContent));
    ok(нашёл.length > 0 && нашёл.every(t => /жим/i.test(t) && /лёжа/i.test(t)), где + 'поиск по каталогу: ' + нашёл.slice(0, 3).join(' | '));
    await p.click('#rolp-res [data-rp="pick"]'); await p.waitForTimeout(150);
    await p.click('#rolcbody [data-rp="sets+"]'); await p.fill('#rolcbody .rolp-reps', '6–8');
    await p.click('#rolcbody [data-rp="dayadd"]'); await p.waitForTimeout(100);
    await p.click('#rolcbody [data-rp="send"]'); await p.waitForTimeout(200);
    ok(/хотя бы одно упражнение/.test(await p.$eval('#rolcbody', e => e.textContent)) && !s.отправлено, где + 'пустой день не отправляется');
    await p.click('#rolcbody [data-rp="dayrm"][data-d="1"]'); await p.waitForTimeout(100);
    await проверить(p, где, 'конструктор программы', '#rolcm');
    await p.click('#rolcbody [data-rp="send"]'); await p.waitForTimeout(400);
    const от = s.отправлено, x = от && от.days[0].ex[0];
    ok(от && от.name === 'Сила · 2 дня' && от.days.length === 1 && x && x.sets === 4 && x.reps === '6–8' && x.id && /лёжа/i.test(x.n), где + 'программа ушла как собрана: ' + JSON.stringify(от).slice(0, 200));
    ok(/Отправлено/.test(await p.$eval('#rolcbody', e => e.textContent)), где + '«Отправлено» после ответа');
    ok(!err.length, где + 'без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 8. этап 2б, клиент: анкета при подключении, предложение программы, жалоба, сбой связи */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const s = сервер({ анкета: true }), o = opts('light'); o.features = ['roli']; o.roli = s.обработчик; o.base = M.БАЗА + '?pro=TSTRNR01';
    const err = await M.поднять(p, o);
    await p.waitForSelector('#roljbody [data-parq]', { timeout: 5000 }).catch(() => {});
    ok(await p.$$eval('#roljbody .rolq', ns => ns.length) === 7, 'анкета: 7 вопросов');
    ok(await p.$eval('#roljok', e => e.disabled), 'анкета: пока не ответил — «Подключить» неактивна');
    for (let i = 0; i < 7; i++) await p.click('#roljbody [data-parq="' + i + '"][data-v="' + (i === 1 ? 1 : 0) + '"]');
    ok(/нужен допуск врача/.test(await p.$eval('#roljbody', e => e.textContent)), 'анкета: при «да» — совет показаться врачу');
    await проверить(p, '', 'анкета готовности', '#roljm');
    await p.click('#roljok'); await p.waitForTimeout(300);
    const j = s.запросы.find(x => x.p.endsWith('/roli/join') && x.метод === 'POST');
    ok(j && JSON.stringify(j.тело.parq) === JSON.stringify([false, true, false, false, false, false, false]), 'анкета: ответы уходят с подключением: ' + JSON.stringify(j && j.тело.parq));
    await p.click('#roljclose'); await p.waitForTimeout(200);
    /* предложение программы — вверху «Тренировки» */
    s.offer = { name: 'Тимур Ахмедов', kind: 'trainer', at: 77, prog: { name: 'Сила · 1 день', note: '', author: { name: 'Тимур Ахмедов', kind: 'trainer' },
      days: [{ s: 'Низ', sub: '', ex: [{ id: 'Barbell_Squat', n: 'Присед со штангой', en: 'Barbell Squat', m: 'quadriceps', q: 'barbell', sets: 4, reps: '5–8', rest: 150 }] }] } };
    await p.click('#profbtn'); await p.waitForTimeout(300); await p.click('#pq-spec'); await p.waitForTimeout(600);
    ok(/Тимур Ахмедов прислал программу/.test(await p.$eval('#rolmy', e => e.textContent)), 'предложение видно в «Моих специалистах»');
    /* ✕ внутри листа профиля — сначала в список (решение 17.10), второй — закрыть */
    await p.click('#profclose'); await p.waitForTimeout(200); await p.click('#profclose'); await p.waitForTimeout(200);
    await p.evaluate(() => { const b = document.querySelector('button[role="tab"][data-page="gym"]'); if (b) b.click(); });
    await p.waitForTimeout(400);
    const оф = await p.$eval('#roloffer', e => e.textContent).catch(() => '');
    ok(/Присед со штангой 4×5–8/.test(оф) && /Перейти на неё/.test(оф), 'на «Тренировке» — что в программе и «Перейти»: ' + оф.slice(0, 120));
    await p.click('#roloffer [data-rol="take"]'); await p.waitForTimeout(800);
    ok(s.запросы.some(x => x.p.endsWith('/roli/prog/take') && x.тело.take === true && x.тело.at === 77), '«Перейти» — решение уходит с версией предложения');
    const прог = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /ai_prog$/.test(k)))); } catch (e) { return null; } });
    ok(прог && прог.author && прог.author.name === 'Тимур Ахмедов' && прог.days[0].ex[0].sets === 4, 'программа тренера стала текущей и подписана автором: ' + JSON.stringify(прог && прог.author));
    ok(!(await p.$eval('#roloffer', e => e.textContent)), 'после «Перейти» карточки нет');
    /* жалоба */
    await p.click('#profbtn'); await p.waitForTimeout(300); await p.click('#pq-spec'); await p.waitForTimeout(600);
    await p.click('#rolmy [data-rol="compask"]'); await p.fill('#rol-comp', 'Грубо ответил'); await p.click('#rolmy [data-rol="comp"]'); await p.waitForTimeout(300);
    ok(s.жалоба && s.жалоба.text === 'Грубо ответил' && s.жалоба.link === 'l1', 'жалоба уходит по подключению: ' + JSON.stringify(s.жалоба));
    ok(/Жалоба отправлена/.test(await p.$eval('#rolmy', e => e.textContent)), '«Жалоба отправлена»');
    /* сбой связи при обновлении не стирает показанное (живая проверка 29.10) */
    s.сбойMe = true; await p.click('#pqback'); await p.waitForTimeout(200); await p.click('#pq-spec'); await p.waitForTimeout(600);
    const т = await p.$eval('#rolmy', e => e.textContent);
    ok(/Не удалось загрузить/.test(т) && /Тимур Ахмедов/.test(т), 'сбой: ошибка строкой, список на месте: ' + т.slice(0, 120));
    ok(!err.length, 'клиент 2б: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 9. этап 2в: переписка — у клиента лист «Написать», у тренера вкладка; из бота ?chat= */
  for (const theme of ['light', 'dark']) {
    const где = 'переписка ' + theme + ': ';
    const p = await b.newPage({ viewport: { width: 320, height: 760 } });
    const s = сервер({ my: [{ id: 'l1', kind: 'trainer', name: 'Тимур Ахмедов', proStatus: 'ok', cats: ['gym'], unread: 2 }],
      msgs: [{ id: 1, me: false, text: 'Как колено после приседа?', at: Date.parse('2026-10-29T15:00:00Z'), seen: false },
             { id: 2, me: true, text: 'Ноет немного', at: Date.parse('2026-10-29T15:05:00Z'), seen: true }] });
    const o = opts(theme); o.features = ['roli']; o.roli = s.обработчик;
    const err = await M.поднять(p, o); await p.waitForTimeout(400);
    await p.click('#profbtn'); await p.waitForTimeout(300);
    ok(/2 новых/.test(await p.$eval('#pv-spec', e => e.textContent)), где + 'в строке профиля — новые сообщения');
    await p.click('#pq-spec'); await p.waitForSelector('#rolmy [data-rol="chat"]', { timeout: 3000 }).catch(() => {});
    ok(/Написать · 2/.test(await p.$eval('#rolmy [data-rol="chat"]', e => e.textContent)), где + '«Написать» с числом новых');
    await p.click('#rolmy [data-rol="chat"]'); await p.waitForSelector('#rolmsgs .rolb', { timeout: 3000 }).catch(() => {});
    const пуз = await p.$$eval('#rolmsgs .rolb', ns => ns.map(n => n.className.replace('rolb rol', '') + ':' + n.querySelector('p').textContent + ':' + n.querySelector('small').textContent));
    const раскладка = await p.$$eval('#rolmsgs .rolb', ns => ns.map(n => { const a = n.querySelector('p').getBoundingClientRect(), b = n.querySelector('small').getBoundingClientRect(); return b.top >= a.bottom - 1; }));
    ok(раскладка.every(Boolean), где + 'время — под текстом в каждом пузыре: ' + JSON.stringify(раскладка));
    ok(пуз.length === 2 && /^them:Как колено/.test(пуз[0]) && /^me:Ноет немного:.*прочитано$/.test(пуз[1]), где + 'сообщения — его слева, мои справа с «прочитано»: ' + пуз.join(' | '));
    await проверить(p, где, 'лист переписки', '#rolchatm');
    await p.fill('#rolmsg', 'Сделаю жим ногами вместо приседа');
    await p.click('#rolmsgsend'); await p.waitForTimeout(500);
    ok(s.написано && s.написано.link === 'l1' && s.написано.text === 'Сделаю жим ногами вместо приседа', где + 'сообщение уходит по подключению: ' + JSON.stringify(s.написано));
    ok(await p.$eval('#rolmsg', e => e.value) === '' && (await p.$$eval('#rolmsgs .rolb', ns => ns.length)) === 3, где + 'поле очищено, сообщение в ленте');
    await p.click('#rolchatclose'); await p.waitForTimeout(200);
    ok(!(await виден(p, '#rolchatm')), где + '«Закрыть» закрывает переписку');
    ok(!err.length, где + 'без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  {
    /* тренер: вкладка «переписка» и вход из бота ?chat=l1 */
    const p = await b.newPage({ viewport: { width: 390, height: 800 } });
    const s = сервер({ pro: [{ kind: 'trainer', name: 'Тимур', status: 'ok', code: 'TSTRNR01', link: 'https://t.me/x?start=s_TSTRNR01' }],
      clients: [{ id: 'l1', kind: 'trainer', client: '777', name: 'Карина', cats: ['body'], parq: 'ok', unread: 1 }],
      msgs: [{ id: 1, me: false, text: 'Колено ноет', at: Date.parse('2026-10-29T15:00:00Z'), seen: false }] });
    const o = opts('light'); o.features = ['roli']; o.roli = s.обработчик; o.base = M.БАЗА + '?chat=l1';
    const err = await M.поднять(p, o);
    await p.waitForSelector('#rolcm #rolmsgs .rolb', { timeout: 5000 }).catch(() => {});
    ok(await виден(p, '#rolcm') && /Колено ноет/.test(await p.$eval('#rolcbody', e => e.textContent)), 'тренер: из бота открылась переписка с клиентом');
    ok(/переписка/.test(await p.$eval('#rol-ccat button[aria-pressed="true"]', e => e.textContent)), 'тренер: открыта вкладка «переписка»');
    ok(!/[?&]chat=/.test(await p.evaluate(() => location.search)), 'тренер: ссылка из адреса убрана');
    ok(!err.length, 'тренер: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 10. этап 2г: новые экраны на английском и узбекском — без кириллицы (кроме имён и текстов сервера) */
  for (const яз of ['en', 'uz']) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const s = сервер({ анкета: true, my: [{ id: 'l1', kind: 'trainer', name: 'Тимур Ахмедов', proStatus: 'ok', cats: ['gym', 'body'], unread: 1 }], msgs: [] });
    const o = opts('light'); o.features = ['roli']; o.roli = s.обработчик; o.me = Object.assign({}, o.me, { lang: яз }); o.base = M.БАЗА + '?pro=TSTRNR01';
    const err = await M.поднять(p, o);
    await p.waitForSelector('#roljbody [data-parq]', { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(300);
    const кир = sel => p.$$eval(sel, ns => ns.filter(n => n.offsetParent || n.getClientRects().length).map(n => (n.innerText || n.placeholder || '').trim()).filter(t => /[А-Яа-яЁё]/.test(t)));
    let ост = await кир('#roljm h3, #roljbody .rolq, #roljbody h4, #roljok, #roljclose');
    ok(!ост.length, яз + ': лист подключения и анкета без кириллицы: ' + ост.join(' | ').slice(0, 200));
    await p.click('#roljclose'); await p.waitForTimeout(200);
    await p.click('#profbtn'); await p.waitForTimeout(300);
    ост = await кир('#pq-spec .pqt, #pq-pro .pqt, #pv-spec');
    ok(!ост.length, яз + ': строки «Специалисты» в профиле: ' + ост.join(' | '));
    await p.click('#pq-spec'); await p.waitForSelector('#rolmy .rolsw', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(300);
    ост = await кир('.pqpage[data-pp="rolspec"] .pqlead, .pqpage[data-pp="rolspec"] .pqlab, #rolmy .rolsw span, #rolmy .rolbtns button, #rollog');
    ok(!ост.length, яз + ': «Мои специалисты» без кириллицы: ' + ост.join(' | ').slice(0, 200));
    await p.click('#rolmy [data-rol="chat"]'); await p.waitForSelector('#rolmsgs .empt', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(300);
    ост = await кир('#rolchatbody .empt, #rolchatbody .rolnote, #rolmsg, #rolmsgsend, #rolchatclose');
    ok(!ост.length, яз + ': переписка без кириллицы: ' + ост.join(' | '));
    ok(!err.length, яз + ': без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 11. этап 3: нутрициолог — норма и комментарии; клиент — принять норму, видеть комментарий у приёма */
  for (const width of [320, 390]) {
    const где = 'нутрициолог ' + width + ': ';
    const p = await b.newPage({ viewport: { width, height: 800 } });
    const s = сервер({ pro: [{ kind: 'nutri', name: 'Нигора', status: 'ok', code: 'TSTNTR01', link: 'https://t.me/x?start=s_TSTNTR01' }],
      clients: [{ id: 'l2', kind: 'nutri', client: '777', name: 'Карина', cats: ['food', 'body'] }] });
    const o = opts('dark'); o.features = ['roli']; o.roli = s.обработчик;
    const err = await M.поднять(p, o); await p.waitForTimeout(300);
    await p.click('#profbtn'); await p.waitForTimeout(300); await p.click('#pq-pro');
    await p.waitForSelector('#rolpro [data-rol="card"]', { timeout: 3000 }).catch(() => {});
    await p.click('#rolpro [data-rol="card"]'); await p.waitForTimeout(400);
    ok(await p.$$eval('#rol-ccat button', ns => ns.map(n => n.dataset.v).join()) === 'body,food,norm,chat', где + 'вкладки нутрициолога: ' + await p.$$eval('#rol-ccat button', ns => ns.map(n => n.dataset.v).join()));
    await p.click('#rol-ccat button[data-v="norm"]'); await p.waitForSelector('#roln-kcal', { timeout: 3000 }).catch(() => {});
    ok(/Сейчас у клиента: 2100 ккал · белок 150 г · жиры 70 г/.test(await p.$eval('#rolcbody', e => e.textContent)), где + 'видна норма приложения');
    ok(await p.$eval('#roln-kcal', e => e.value) === '2100', где + 'форма начинается с нормы приложения');
    await p.fill('#roln-kcal', '1800'); await p.fill('#roln-prot', '140'); await p.fill('#roln-fat', '60');
    await p.fill('#rolcbody .roln-rule[data-i="0"]', 'Без сладкого после 18:00');
    await проверить(p, где, 'форма нормы', '#rolcm');
    await p.click('#rolcbody [data-rn="normsend"]'); await p.waitForTimeout(400);
    ok(s.норма && s.норма.kcal === 1800 && s.норма.prot === 140 && s.норма.fat === 60 && s.норма.rules[0] === 'Без сладкого после 18:00' && s.норма.who === '777', где + 'норма ушла: ' + JSON.stringify(s.норма));
    ok(/Отправлено/.test(await p.$eval('#rolcbody', e => e.textContent)), где + '«Отправлено»');
    await p.click('#rol-ccat button[data-v="food"]'); await p.waitForSelector('#rolcbody [data-rn="edit"]', { timeout: 3000 }).catch(() => {});
    ok(/Ваш комментарий: хорошо\. Отлично/.test(await p.$eval('#rolcbody', e => e.textContent)), где + 'свой прошлый комментарий виден');
    await p.click('#rolcbody [data-rn="edit"][data-id="m1"]'); await p.waitForTimeout(150);
    await p.click('#rol-nmark button[data-v="q"]'); await p.fill('#rol-ntext', 'Многовато масла');
    await проверить(p, где, 'комментарий к приёму', '#rolcm');
    await p.click('#rolcbody [data-rn="save"]'); await p.waitForTimeout(300);
    ok(s.заметка && s.заметка.id === 'm1' && s.заметка.mark === 'q' && s.заметка.text === 'Многовато масла' && s.заметка.who === '777', где + 'комментарий ушёл: ' + JSON.stringify(s.заметка));
    ok(/Ваш комментарий: есть вопрос\. Многовато масла/.test(await p.$eval('#rolcbody', e => e.textContent)), где + 'после сохранения — виден');
    ok(!err.length, где + 'без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const s = сервер({ my: [{ id: 'l2', kind: 'nutri', name: 'Нигора', proStatus: 'ok', cats: ['food', 'body'] }],
      normOffer: { name: 'Нигора', at: 55, kcal: 1800, prot: 140, fat: 60, rules: ['Без сладкого после 18:00', 'Овощи в каждый приём'], note: 'Пробуем 2 недели' } });
    const o = opts('light'); o.features = ['roli']; o.roli = s.обработчик; o.page = 'food';
    o.day = { proNotes: { '2': [{ name: 'Нигора', mark: 'q', text: 'Многовато масла', at: 1 }] } };
    const err = await M.поднять(p, o);
    await p.waitForSelector('#rolnormbox .roloffer', { timeout: 5000 }).catch(() => {});
    const кн = await p.$eval('#rolnormbox', e => e.textContent).catch(() => '');
    ok(/Нигора прислала норму питания/.test(кн) && /1800 ккал · белок 140 г · жиры 60 г/.test(кн) && /Без сладкого после 18:00/.test(кн), 'клиент: предложение нормы на «Еде»: ' + кн.slice(0, 140));
    const зм = await p.$eval('#fmeals .fmeal[data-mid="2"] .rolmnote', e => e.textContent).catch(() => '');
    ok(зм === 'Нигора · есть вопрос: Многовато масла', 'клиент: комментарий нутрициолога под приёмом: ' + зм);
    await проверить(p, '', 'норма на «Еде»', '#p-food');
    await p.click('#rolnormbox [data-rol="normtake"]'); await p.waitForTimeout(600);
    ok(s.взял && s.взял.take === true && s.взял.at === 55, 'клиент: «Принять» — с версией предложения');
    const ак = await p.$eval('#rolnormbox', e => e.textContent).catch(() => '');
    ok(/Норма от Нигора/.test(ак) && /Овощи в каждый приём/.test(ак) && !/Вернуть/.test(ак), 'клиент: на «Еде» — действующая норма и правила: ' + ак.slice(0, 120));
    await p.click('#profbtn'); await p.waitForTimeout(300); await p.click('#pq-spec'); await p.waitForTimeout(600);
    await p.click('#rolmy [data-rol="normoff"]'); await p.waitForTimeout(500);
    ok(s.сняла === true && !/Норма от/.test(await p.$eval('#rolmy', e => e.textContent)), 'клиент: «Вернуть норму приложения»');
    ok(!err.length, 'клиент: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 12. этап 3б: анкета здоровья у нутрициолога, отметки и предупреждения */
  {
    const p = await b.newPage({ viewport: { width: 320, height: 760 } });
    const s = сервер({ нутри: true }), o = opts('dark'); o.features = ['roli']; o.roli = s.обработчик; o.base = M.БАЗА + '?pro=TSTNTR01';
    const err = await M.поднять(p, o);
    await p.waitForSelector('#roljbody [data-zd]', { timeout: 5000 }).catch(() => {});
    ok(await p.$$eval('#roljbody [data-zd][data-v="1"]', ns => ns.map(n => n.getAttribute('aria-pressed')).join()) === 'true,false,false,false', 'анкета здоровья: диабет из профиля подставлен');
    ok(await p.$eval('#roljok', e => e.disabled), 'анкета здоровья: пока не ответил на все — «Подключить» неактивна');
    for (let i = 1; i < 4; i++) await p.click('#roljbody [data-zd="' + i + '"][data-v="' + (i === 2 ? 1 : 0) + '"]');
    await проверить(p, '', 'анкета здоровья', '#roljm');
    await p.click('#roljok'); await p.waitForTimeout(300);
    const j = s.запросы.find(x => x.p.endsWith('/roli/join') && x.метод === 'POST');
    ok(j && JSON.stringify(j.тело.health) === JSON.stringify([true, false, true, false]) && !('parq' in j.тело), 'анкета здоровья уходит с подключением: ' + JSON.stringify(j && j.тело.health));
    ok(!err.length, 'анкета здоровья: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  {
    const p = await b.newPage({ viewport: { width: 390, height: 800 } });
    const s = сервер({ pro: [{ kind: 'nutri', name: 'Нигора', status: 'ok', code: 'TSTNTR01', link: 'https://t.me/x?start=s_TSTNTR01' }],
      clients: [{ id: 'l2', kind: 'nutri', client: '777', name: 'Карина', cats: ['food', 'body'], flags: ['preg', 'diabetes'] }], отметки: ['preg', 'diabetes'] });
    const o = opts('light'); o.features = ['roli']; o.roli = s.обработчик;
    const err = await M.поднять(p, o); await p.waitForTimeout(300);
    await p.click('#profbtn'); await p.waitForTimeout(300); await p.click('#pq-pro');
    await p.waitForSelector('#rolpro [data-rol="card"]', { timeout: 3000 }).catch(() => {});
    await p.click('#rolpro [data-rol="card"]'); await p.waitForTimeout(400);
    ok(/Отметки здоровья: беременность или кормление, диабет\./.test(await p.$eval('#rolcbody', e => e.textContent)), 'нутрициолог: отметки в карточке');
    await p.click('#rol-ccat button[data-v="norm"]'); await p.waitForSelector('#roln-kcal', { timeout: 3000 }).catch(() => {});
    const т = await p.$eval('#rolcbody', e => e.textContent);
    ok(/норма не ниже нормы приложения \(2100 ккал\)/.test(т) && /Диабет: углеводы ровно по приёмам/.test(т), 'нутрициолог: предупреждения в форме нормы: ' + т.slice(0, 160));
    await проверить(p, '', 'форма нормы с предупреждениями', '#rolcm');
    ok(!err.length, 'нутрициолог 3б: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 13. этап 4: своё упражнение тренера — форма, похожие, фото с правами, в конструкторе «моё» */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 820 } });
    const s = сервер({ pro: [{ kind: 'trainer', name: 'Тимур', status: 'ok', code: 'TSTRNR01', link: 'https://t.me/x?start=s_TSTRNR01' }],
      clients: [{ id: 'l1', kind: 'trainer', client: '777', name: 'Карина', cats: [], parq: 'ok' }] });
    const o = opts('light'); o.features = ['roli']; o.roli = s.обработчик;
    const err = await M.поднять(p, o); await p.waitForTimeout(300);
    await p.click('#profbtn'); await p.waitForTimeout(300); await p.click('#pq-pro');
    await p.waitForSelector('#rolpro [data-rol="exnew"]', { timeout: 3000 }).catch(() => {});
    ok(/Своих пока нет/.test(await p.$eval('#rolpro', e => e.textContent)), 'своё: пустой список с подсказкой');
    await p.click('#rolpro [data-rol="exnew"]'); await p.waitForSelector('#rolx-n', { timeout: 3000 }).catch(() => {});
    await p.fill('#rolx-n', 'Присед со штангой у стены'); await p.waitForTimeout(500);
    ok(/Похожие в каталоге: .*Присед/.test(await p.$eval('#rolx-similar', e => e.textContent)), 'своё: похожие из каталога — подсказкой: ' + (await p.$eval('#rolx-similar', e => e.textContent)).slice(0, 120));
    await p.selectOption('#rolx-m', 'glutes'); await p.waitForTimeout(100);
    await p.click('#rolexbody [data-rx="sm"][data-v="quadriceps"]'); await p.click('#rolexbody [data-rx="sm"][data-v="hamstrings"]');
    await p.selectOption('#rolx-q', 'barbell');
    await p.fill('#rolexbody .rolx-cue >> nth=0', 'Спина к стене'); await p.fill('#rolexbody .rolx-cue >> nth=1', 'Присед до параллели');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHwABAzS9JQAAAABJRU5ErkJggg==', 'base64');
    await p.setInputFiles('#rolx-file', { name: 'a.png', mimeType: 'image/png', buffer: png }); await p.waitForSelector('#rolx-lic', { timeout: 3000 }).catch(() => {});
    await p.click('#rolexbody [data-rx="save"]'); await p.waitForTimeout(200);
    ok(/Подтвердите права на фото/.test(await p.$eval('#rolexbody', e => e.textContent)) && !s.сохр, 'своё: без галочки прав фото не уходит');
    await p.check('#rolx-lic');
    await проверить(p, '', 'форма своего упражнения', '#rolexm');
    await p.click('#rolexbody [data-rx="save"]'); await p.waitForTimeout(500);
    const x = s.сохр || {};
    ok(x.n === 'Присед со штангой у стены' && x.m === 'glutes' && JSON.stringify(x.sm) === '["quadriceps","hamstrings"]' && x.q === 'barbell' && x.cues[0] === 'Спина к стене' && x.photos.length === 1 && x.lic === '2026-10-30.1',
      'своё: ушло как заполнено, с лицензией: ' + JSON.stringify({ ...x, photos: (x.photos || []).length }).slice(0, 220));
    ok(!(await виден(p, '#rolexm')) && /Присед со штангой у стены/.test(await p.$eval('#rolpro', e => e.textContent)), 'своё: лист закрылся, упражнение в списке');
    await p.click('#rolpro [data-rol="card"]'); await p.waitForSelector('#rolcbody [data-rp="add"]', { timeout: 3000 }).catch(() => {});
    await p.click('#rolcbody [data-rp="add"]'); await p.fill('#rolp-q', 'присед'); await p.waitForTimeout(600);
    const перв = await p.$eval('#rolp-res .rolpick', e => e.textContent).catch(() => '');
    ok(/^моё Присед со штангой у стены/.test(перв), 'своё: в конструкторе первым и с пометкой «моё»: ' + перв);
    ok(!err.length, 'своё: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 14. этап 4: у клиента своё упражнение тренера — с его фото с нашего сервера */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const s = сервер({ my: [{ id: 'l1', kind: 'trainer', name: 'Тимур', proStatus: 'ok', cats: ['gym'] }],
      offer: { name: 'Тимур', kind: 'trainer', at: 66, prog: { name: 'Своё · 1 день', note: '', author: { uid: 't1', name: 'Тимур', kind: 'trainer' },
        days: [{ s: 'Низ', sub: '', ex: [{ id: 'uабв', n: 'Выпады у стены', en: 'Выпады у стены', m: 'glutes', q: 'kettlebells', sets: 3, reps: '10–12', rest: 90, img: ['exphoto00001'], cues: ['Спина к стене'], own: 'Тимур' }] }] } } });
    const o = opts('light'); o.features = ['roli']; o.roli = s.обработчик;
    const err = await M.поднять(p, o); await p.waitForTimeout(400);
    await p.evaluate(() => { const b = document.querySelector('button[role="tab"][data-page="gym"]'); if (b) b.click(); });
    await p.waitForSelector('#roloffer [data-rol="take"]', { timeout: 4000 }).catch(() => {});
    await p.click('#roloffer [data-rol="take"]'); await p.waitForTimeout(1200);
    const фото = await p.evaluate(() => !!document.querySelector('#p-gym [data-private-photo="exphoto00001"]'));
    ok(фото, 'своё у клиента: в тренировке — фото тренера с нашего сервера');
    ok(!err.length, 'своё у клиента: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 15. этап 6: сотрудник — по ссылке ?co= лист согласия, потом «Компания»: челлендж, свой прогресс, выход */
  const ЧЕЛЛ = () => [{ id: 'h1', title: 'Неделя хороших дней', metric: 'good_days', metricName: 'дни с оценкой от 7', target: 5, start: M.Д(2), end: M.Д(-5), joined: false, group: { n: 14, done: 35, avg: 50 } },
    { id: 'h2', title: 'Шаги', metric: 'steps', metricName: 'шаги', target: 70000, start: M.Д(-3), end: M.Д(-10), joined: false, group: { n: null, few: true } }];
  for (const [width, theme] of [[320, 'dark'], [390, 'light']]) {
    const где = 'сотрудник ' + width + ': ';
    const p = await b.newPage({ viewport: { width, height: 820 } });
    const s = сервер({ coCh: ЧЕЛЛ(), coОтказ: { ok: false, code: 'other_co', error: 'Вы уже в компании «Бета». Перейти в «Альфа»?' } });
    const o = opts(theme); o.features = ['roli']; o.roli = s.обработчик; o.base = M.БАЗА + '?co=alfakod1';
    const err = await M.поднять(p, o);
    await p.waitForSelector('#rolcook', { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(300);
    const лист = await p.$eval('#rolcobody', e => e.textContent).catch(() => '');
    ok(/Альфа/.test(лист) && /только общие цифры/.test(лист), где + 'лист: компания и текст согласия от сервера');
    ok(s.запросы.some(x => x.p.endsWith('/roli/co/join') && x.метод === 'GET' && x.q.code === 'ALFAKOD1'), где + 'код из ссылки — в запросе');
    ok(!s.запросы.some(x => x.p.endsWith('/roli/co/join') && x.метод === 'POST'), где + 'без нажатия никуда не вписан');
    await проверить(p, где, 'лист компании', '#rolcom');
    await p.click('#rolcook'); await p.waitForTimeout(400);
    ok(/Перейти в эту компанию/.test(await p.$eval('#rolcook', e => e.textContent)) && /уже в компании/.test(await p.$eval('#rolcobody', e => e.textContent)), где + 'уже в другой — спрашиваем «перейти»');
    await p.click('#rolcook'); await p.waitForTimeout(400);
    ok(s.coВошёл && s.coВошёл.consent === 'КВ1' && s.coВошёл.code === 'ALFAKOD1' && s.coВошёл.replace === true, где + 'вписан с версией согласия: ' + JSON.stringify(s.coВошёл));
    ok(/Профиль → Компания/.test(await p.$eval('#rolcobody', e => e.textContent)), где + 'после — куда смотреть');
    await p.click('#rolcoclose'); await p.waitForTimeout(300);
    ok(!(await виден(p, '#rolcom')), где + 'лист закрылся');
    await p.click('#profbtn'); await p.waitForTimeout(300);
    ok(/Альфа/.test(await p.$eval('#pv-co', e => e.textContent)), где + 'в строке профиля — компания');
    await p.click('#pq-co'); await p.waitForSelector('#rolco [data-ko="chin"]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(300);
    const стр = await p.$eval('#rolco', e => e.textContent);
    ok(/ни вас, ни ваших данных/.test(стр) && /В группе 14 · дошли 35%/.test(стр) && /когда участников будет от 10/.test(стр), где + 'челленджи: цифры группы от 10, иначе — пояснение');
    await p.click('#rolco [data-ko="chin"][data-id="h1"]'); await p.waitForTimeout(500);
    ok(s.coУчастие && s.coУчастие.id === 'h1' && s.coУчастие.on === true, где + '«Участвую» ушло');
    ok(/У вас: 2 из 5/.test(await p.$eval('#rolco', e => e.textContent)) && await виден(p, '#rolco .kobar'), где + 'свой прогресс — полоской');
    await проверить(p, где, 'страница «Компания»', '#rolco');
    await p.click('#rolco [data-ko="leaveask"]'); await p.waitForTimeout(150);
    ok(!s.coВышел, где + 'выход — только после подтверждения');
    await p.click('#rolco [data-ko="leave"]'); await p.waitForTimeout(500);
    ok(s.coВышел && s.coВышел.co === 'c1' && /Работодатель пришлёт ссылку/.test(await p.$eval('#rolco', e => e.textContent)), где + 'вышел — снова «пришлёт ссылку»');
    ok(!err.length, где + 'без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 16. этап 6: кабинет компании — цифры недель, челлендж, команда; и заявка новой компании */
  for (const [width, theme] of [[320, 'light'], [390, 'dark']]) {
    const где = 'кабинет ' + width + ': ';
    const p = await b.newPage({ viewport: { width, height: 820 } });
    const s = сервер({ coWeb: 2, coTeam: [{ id: 'c1', name: 'Альфа', status: 'ok', role: 'admin' }], coCard: {
      co: { id: 'c1', name: 'Альфа', status: 'ok', role: 'admin' }, min: 10, members: 12, link: 'https://t.me/WellbolTestBot?start=c_ALFAKOD1',
      team: [{ uid: '1', name: 'Азиз', role: 'admin', me: true }, { uid: 'm1', name: 'Мадина', role: 'manager' }],
      ch: [{ id: 'h1', title: 'Неделя хороших дней', metric: 'good_days', target: 5, start: M.Д(2), end: M.Д(-5), group: { n: 14, done: 35, avg: 50 } }],
      stats: [{ week: M.Д(30), ok: false, few: true }, { week: M.Д(23), ok: false, few: true }, { week: M.Д(16), ok: true, n5: 10, active: 45, foodDays: 3.5, workouts: 1.5, goodDays: 2, steps: null },
        { week: M.Д(9), ok: true, n5: 10, active: 50, foodDays: 4, workouts: 2, goodDays: 2.5, steps: 7500 }] } });
    const o = opts(theme); o.features = ['roli']; o.roli = s.обработчик;
    const err = await M.поднять(p, o); await p.waitForTimeout(300);
    await p.click('#profbtn'); await p.waitForTimeout(300); await p.click('#pq-co');
    await p.waitForSelector('#rolco .kostat', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(300);
    const т = await p.$eval('#rolco', e => e.textContent);
    ok(/Присоединились: 12/.test(т) && /Меньше 10 человек — не показываем/.test(т) && /Активны 3 дня и больше50%/.test(т) && /Шагов в день7500/.test(т) && /Дней с записанной едой3,5/.test(т), где + 'цифры недель: от 10, округлённо, «мало» — без цифр');
    ok(т.indexOf('Кабинет компании') >= 0 && т.indexOf('Я сотрудник') < 0, где + 'у команды, которая сама не участвует, — только кабинет (этап 6г: без пустого «Я сотрудник»)');
    await p.click('#rolco [data-ko="chnew"]'); await p.waitForSelector('#ko-title', { timeout: 2000 }).catch(() => {});
    await p.fill('#ko-title', 'Октябрь в движении'); await p.selectOption('#ko-metric', 'workouts'); await p.fill('#ko-target', '8'); await p.fill('#ko-days', '14');
    await проверить(p, где, 'форма челленджа', '#rolco');
    await p.click('#rolco [data-ko="chsave"]'); await p.waitForTimeout(500);
    const ч = s.coЧелл || {};
    ok(ч.co === 'c1' && ч.title === 'Октябрь в движении' && ч.metric === 'workouts' && ч.target === 8 && ч.days === 14 && /^\d{4}-\d{2}-\d{2}$/.test(ч.start), где + 'челлендж ушёл как заполнен: ' + JSON.stringify(ч));
    await p.click('#rolco [data-ko="inv"][data-role="manager"]'); await p.waitForTimeout(400);
    ok(s.coПригл && s.coПригл.role === 'manager' && await p.$eval('#rolco', e => /TEAMCODE01/.test(e.innerHTML)), где + 'приглашение в команду — ссылка показана');
    await p.selectOption('#rolco select[data-who="m1"]', 'observer'); await p.waitForTimeout(400);
    ok(s.coКоманда && s.coКоманда.who === 'm1' && s.coКоманда.role === 'observer', где + 'смена роли ушла: ' + JSON.stringify(s.coКоманда));
    ok(!(await p.$('#rolco [data-ko="rm"][data-who="1"]')), где + 'себя убрать нельзя — кнопки нет');
    ok(/Входов с компьютера: 2/.test(await p.$eval('#rolco', e => e.textContent)) && await p.$eval('#rolco input[aria-label="ссылка на кабинет"]', e => /\/business\/$/.test(e.value)), где + '«С компьютера»: ссылка на кабинет и число входов');
    await p.click('#rolco [data-ko="webask"]'); await p.waitForTimeout(150);
    ok(!s.coВебВыход, где + 'завершить входы — только после подтверждения');
    await p.click('#rolco [data-ko="webend"]'); await p.waitForTimeout(500);
    ok(s.coВебВыход && !/Входов с компьютера/.test(await p.$eval('#rolco', e => e.textContent)), где + '«Завершить все входы» ушло');
    await проверить(p, где, 'кабинет компании', '#rolco');
    ok(!err.length, где + 'без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  {
    const p = await b.newPage({ viewport: { width: 390, height: 820 } });
    /* этап 6г: заявка компании — на странице wellbol.app/business/; в приложении у человека без компании пункта нет,
       у подавшего заявку (команда, на проверке) — есть, с «на проверке» и без формы */
    const s = сервер({ coTeam: [{ id: 'c9', name: 'Гамма', status: 'pending', role: 'admin' }] }), o = opts('light'); o.features = ['roli']; o.roli = s.обработчик;
    const err = await M.поднять(p, o); await p.waitForTimeout(600);
    await p.click('#profbtn'); await p.waitForTimeout(300);
    ok(await виден(p, '#pq-co') && (await p.$$eval('#pqmain .pqlab', ns => ns.filter(n => n.offsetParent).map(n => n.textContent.trim()))).includes('Компания'), 'подал заявку на странице — строка «Компания» под заголовком «Компания»');
    await p.click('#pq-co'); await p.waitForTimeout(400);
    const тк = await p.$eval('#rolco', e => e.textContent);
    ok(/Заявка на проверке/.test(тк) && !(await p.$('#ko-name')) && !/Я сотрудник/.test(тк), 'на проверке — без формы и без «Я сотрудник»: ' + тк.slice(0, 120));
    ok(!s.запросы.some(x => x.p.endsWith('/roli/co/apply')), 'из приложения заявку не шлём');
    ok(!err.length, 'компания на проверке: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 17. этап 6 на английском и узбекском: страница «Компания» и лист без кириллицы (кроме названий и текста сервера) */
  for (const яз of ['en', 'uz']) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const s = сервер({ coCh: ЧЕЛЛ() });
    const o = opts('light'); o.features = ['roli']; o.roli = s.обработчик; o.me = Object.assign({}, o.me, { lang: яз }); o.base = M.БАЗА + '?co=ALFAKOD1';
    const err = await M.поднять(p, o);
    await p.waitForSelector('#rolcook', { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(300);
    const кир = sel => p.$$eval(sel, ns => ns.filter(n => n.offsetParent || n.getClientRects().length).map(n => (n.innerText || n.placeholder || '').trim()).filter(t => /[А-Яа-яЁё]/.test(t)));
    let ост = await кир('#rolcom h3, #rolcobody .rolhd span, #rolcook, #rolcoclose');
    ok(!ост.length, яз + ': лист компании без кириллицы: ' + ост.join(' | ').slice(0, 200));
    await p.click('#rolcook'); await p.waitForTimeout(400); await p.click('#rolcoclose'); await p.waitForTimeout(200);
    await p.click('#profbtn'); await p.waitForTimeout(300);
    await p.click('#pq-co'); await p.waitForSelector('#rolco [data-ko="chin"]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(300);
    await p.click('#rolco [data-ko="chin"][data-id="h1"]'); await p.waitForTimeout(500);
    ост = await кир('#pq-co .pqt, #rolco .pqlab, #rolco .pqlead, #rolco label.rolfld, #rolco .rolnote, #rolco .rolhd span, #rolco .rolbtns button, #rolco .empt');
    ok(!ост.length, яз + ': «Компания» без кириллицы: ' + ост.join(' | ').slice(0, 300));
    ok(!err.length, яз + ': без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 18. этап 6: владелец — заявки компаний в Админ панели */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const s = сервер({ coAdm: [{ id: 'c9', name: 'Гамма', about: 'логистика', status: 'pending', by: '55', byName: 'Рустам', members: 0 }] });
    const o = opts('light'); o.features = ['roli']; o.roli = s.обработчик; o.admin = { про: [], промо: [] };
    const err = await M.поднять(p, o); await p.waitForTimeout(400);
    await p.click('#profbtn'); await p.waitForTimeout(300); await p.click('#profboss');
    await p.waitForSelector('#roladmcolist [data-ko="adm"]', { timeout: 4000 }).catch(() => {});
    ok(/Гамма/.test(await p.$eval('#roladmcolist', e => e.textContent)) && /Рустам/.test(await p.$eval('#roladmcolist', e => e.textContent)), 'админ: заявка компании видна');
    await p.click('#roladmcolist [data-st="ok"]'); await p.waitForTimeout(400);
    const r = s.запросы.find(x => x.p.endsWith('/roli/co/admin') && x.метод === 'POST');
    ok(r && r.тело.co === 'c9' && r.тело.status === 'ok', 'админ: «Принять» компанию: ' + JSON.stringify(r && r.тело));
    ok(/работает/.test(await p.$eval('#roladmcolist', e => e.textContent)), 'админ: после ответа — работает');
    ok(!err.length, 'админ компаний: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await p.close();
  }
  /* 5. владелец: заявки в Админ панели */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const s = сервер({ adm: [{ uid: 't9', kind: 'trainer', name: 'Олег', about: 'кроссфит', status: 'pending', contact: '+998 90 111 22 33', adult: 1, docs: ['docphoto0001', 'docphoto0002'],
      ai: { decision: 'doubt', confidence: 0.7, reasons: ['Имя на документе другое'], doc: { readable: true, type: 'Диплом', org: 'УзГИФК', year: '2015', name: 'Олег П.' } } }] });
    const o = opts('light'); o.features = ['roli']; o.roli = s.обработчик; o.admin = { про: [], промо: [] };
    const err = await M.поднять(p, o); await p.waitForTimeout(400);
    await p.click('#profbtn'); await p.waitForTimeout(300); await p.click('#profboss');
    await p.waitForSelector('#roladmlist [data-rol="adm"]', { timeout: 4000 }).catch(() => {});
    ok(/Олег/.test(await p.$eval('#roladmlist', e => e.textContent)), 'админ: заявка видна');
    /* этап 6г: заявка со страницы /experts/ — контакт, 18+ со слов, фото документов */
    const ат = await p.$eval('#roladmlist', e => e.textContent);
    /* этап 6д: вывод ИИ — сомневается, причина, что прочитано на документе */
    ok(/ИИ: сомневается · 70 % — Имя на документе другое/.test(ат) && /На документе: Диплом, УзГИФК, 2015, «Олег П\.»/.test(ат), 'админ: вывод ИИ и прочитанное с документа: ' + ат.slice(0, 200));
    ok(/Контакт: \+998 90 111 22 33/.test(ат) && /18\+ — со слов/.test(ат) && (await p.$$('#roladmlist .roldocs img')).length === 2, 'админ: контакт, 18+ со слов, два фото документа');
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
