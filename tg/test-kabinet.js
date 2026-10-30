'use strict';
/* 30.10, роли — этап 6б (его «хорошо, делай» на «кабинет компании в браузере»):
   страница wellbol.app/kabinet/. Проверяется: (1) вход по QR — код, ожидание,
   «подтвердите в Telegram», токен сохраняется и уходит заголовком Authorization;
   (2) кабинет: цифры недель таблицей («—» для групп меньше 10), челлендж из
   формы, смена роли, ссылка в команду, копирование; (3) сессия кончилась —
   назад ко входу; (4) «Выйти на всех компьютерах»; (5) английский без
   кириллицы (кроме названий); всё — на 1280 и 390, в обеих темах, без
   вылезания и с контрастом. */
const { chromium } = require('playwright'), M = require('./mock'), bounds = require('./viewport-check'), contrast = require('./contrast-check');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
const АДРЕС = M.БАЗА + 'kabinet/';
const Д = n => M.Д(n);
function сервер(нач){
  const s = Object.assign({ опрос: 0, запросы: [] }, нач);
  s.card = s.card || { ok: true, co: { id: 'c1', name: 'Альфа Банк', status: 'ok', role: 'admin' }, min: 10, members: 124, link: 'https://t.me/WellbolTestBot?start=c_ALFAKOD1',
    team: [{ uid: '1', name: 'Азиз', role: 'admin', me: true }, { uid: 'm1', name: 'Мадина', role: 'manager' }],
    ch: [{ id: 'h1', title: 'Октябрь в движении', metric: 'workouts', target: 8, start: Д(10), end: Д(-4), group: { n: 46, done: 35, avg: 50 } },
      { id: 'h2', title: 'Шаги', metric: 'steps', target: 70000, start: Д(-3), end: Д(-10), group: { n: null, few: true } }],
    stats: [{ week: Д(30), ok: false, few: true }, { week: Д(23), ok: true, n5: 95, active: 45, foodDays: 3.5, workouts: 1.5, goodDays: 2, steps: null },
      { week: Д(16), ok: true, n5: 100, active: 50, foodDays: 4, workouts: 2, goodDays: 2.5, steps: 7500 }, { week: Д(9), ok: true, n5: 110, active: 55, foodDays: 4, workouts: 2, goodDays: 3, steps: 8000 }] };
  s.обработчик = async route => {
    const r = route.request(), u = new URL(r.url()), м = r.method(); let тело = null; try { тело = r.postDataJSON(); } catch (e) {}
    if (м === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    s.запросы.push({ p: u.pathname, м, тело, auth: r.headers()['authorization'] || '' });
    let b, st = 200;
    if (u.pathname === '/web/login' && м === 'POST') b = { ok: true, id: 'ABCDEFGH2345', secret: 'f'.repeat(32), link: 'https://t.me/WellbolTestBot?start=w_ABCDEFGH2345', ttl: 300 };
    else if (u.pathname === '/web/login') { s.опрос++; b = s.опрос >= (s.послеОпросов || 3) ? { ok: true, state: 'ok', token: 'wb_' + 'a'.repeat(48) } : { ok: true, state: s.опрос > 1 ? 'asked' : 'wait' }; }
    else if (s.протух) { st = 401; b = { ok: false, code: 'web_auth', error: 'Войдите заново.' }; }
    else if (u.pathname === '/web/me') b = { ok: true, name: 'Азиз', min: 10, team: [{ id: 'c1', name: 'Альфа Банк', status: 'ok', role: 'admin' }, { id: 'c2', name: 'Бета', status: 'pending', role: 'admin' }] };
    else if (u.pathname === '/web/co/card') b = s.card;
    else if (u.pathname === '/web/co/invite') b = { ok: true, role: тело.role, link: 'https://t.me/WellbolTestBot?start=c_TEAMCODE01' };
    else b = { ok: true };
    return route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
  };
  return s;
}
async function открыть(b, w, тема, нач, токен){
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: тема, permissions: ['clipboard-read', 'clipboard-write'] });
  const s = сервер(нач), p = await ctx.newPage(), err = [];
  p.on('pageerror', e => err.push(String(e)));
  await ctx.route('https://api.wellbol.com/**', s.обработчик);
  if (токен) await p.addInitScript(t => { try { localStorage.setItem('wb_kab_tok', t); } catch (e) {} }, токен);
  if (нач && нач.lang) await p.addInitScript(l => { try { localStorage.setItem('wb_kab_lang', l); } catch (e) {} }, нач.lang);
  await p.goto(АДРЕС);
  return { ctx, p, s, err };
}
async function проверить(p, где, имя){
  const bb = await bounds(p), cc = await contrast(p, 'main');
  ok(!bb.length, где + имя + ': ничего не вылезает ' + JSON.stringify(bb).slice(0, 160));
  ok(cc.checked > 0 && !cc.failures.length, где + имя + ': контраст ' + JSON.stringify(cc.failures).slice(0, 160));
}
(async () => { const b = await chromium.launch(); try {
  for (const [w, тема] of [[1280, 'light'], [390, 'dark']]) {
    const где = w + ' ' + тема + ': ';
    const { ctx, p, s, err } = await открыть(b, w, тема);
    await p.waitForSelector('.qr svg', { timeout: 5000 }).catch(() => {});
    ok(await p.$('.qr svg') !== null && /Наведите камеру/.test(await p.textContent('main')), где + 'вход: QR и шаги');
    ok(/Код действует ещё 5 мин/.test(await p.textContent('.state')), где + 'вход: срок кода');
    ok(await p.$eval('a.btn[href^="https://t.me/WellbolTestBot?start=w_"]', a => a.target === '_blank').catch(() => false), где + 'вход: ссылка «открыть Telegram на этом устройстве»');
    await проверить(p, где, 'экран входа');
    await p.waitForFunction(() => /Подтвердите вход/.test(document.querySelector('.state') && document.querySelector('.state').textContent || ''), null, { timeout: 7000 }).catch(() => {});
    ok(/Подтвердите вход в Telegram/.test(await p.textContent('main')), где + 'вход: «подтвердите в Telegram»');
    await p.waitForSelector('.tiles', { timeout: 9000 }).catch(() => {}); await p.waitForTimeout(300);
    ok(await p.evaluate(() => localStorage.getItem('wb_kab_tok')) === 'wb_' + 'a'.repeat(48), где + 'токен сохранён');
    ok(s.запросы.filter(x => x.p.startsWith('/web/co') || x.p === '/web/me').every(x => x.auth === 'Bearer wb_' + 'a'.repeat(48)), где + 'запросы кабинета — с заголовком Authorization');
    const т = await p.textContent('main');
    ok(/124/.test(т) && /не меньше 110/.test(т) && /3,5/.test(т) && /7500/.test(т) && /меньше 10/.test(т), где + 'кабинет: участники, цифры недель, «меньше 10»');
    ok(await p.$$eval('.tbl tbody tr:first-child td', tds => tds[0].textContent === '—'), где + 'неделя меньше 10 — прочерк');
    await проверить(p, где, 'кабинет');
    await p.click('[data-a="chnew"]'); await p.fill('#f-title', 'Ноябрь без пропусков'); await p.selectOption('#f-metric', 'good_days'); await p.fill('#f-target', '10'); await p.fill('#f-days', '21');
    await проверить(p, где, 'форма челленджа');
    await p.click('[data-a="chsave"]'); await p.waitForTimeout(300);
    const ч = (s.запросы.find(x => x.p === '/web/co/ch') || {}).тело || {};
    ok(ч.co === 'c1' && ч.title === 'Ноябрь без пропусков' && ч.metric === 'good_days' && ч.target === 10 && ч.days === 21 && /^\d{4}-\d{2}-\d{2}$/.test(ч.start), где + 'челлендж ушёл как заполнен: ' + JSON.stringify(ч));
    await p.selectOption('select[data-who="m1"]', 'observer'); await p.waitForTimeout(300);
    const к = (s.запросы.find(x => x.p === '/web/co/team') || {}).тело || {};
    ok(к.who === 'm1' && к.role === 'observer', где + 'смена роли ушла');
    await p.click('[data-a="inv"][data-role="manager"]'); await p.waitForTimeout(300);
    ok(await p.$('input[value="https://t.me/WellbolTestBot?start=c_TEAMCODE01"]') !== null, где + 'ссылка в команду показана');
    await p.click('[data-a="copy"]'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => navigator.clipboard.readText()).catch(() => '') === 'https://t.me/WellbolTestBot?start=c_ALFAKOD1' && /Скопировано/.test(await p.textContent('#toast')), где + 'копирование ссылки для сотрудников');
    await p.click('[data-a="co"][data-id="c2"]'); await p.waitForTimeout(200);
    ok(/Заявка на проверке/.test(await p.textContent('main')), где + 'вторая компания — на проверке');
    ok(!err.length, где + 'без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await ctx.close();
  }
  /* сессия кончилась — назад ко входу с объяснением; «выйти на всех» */
  {
    const { ctx, p, s } = await открыть(b, 1280, 'light', { протух: true }, 'wb_' + 'b'.repeat(48));
    await p.waitForSelector('.qr svg', { timeout: 5000 }).catch(() => {});
    ok(/Сессия закончилась/.test(await p.textContent('main')) && await p.evaluate(() => localStorage.getItem('wb_kab_tok')) === null, 'протухла сессия: вход заново, токен стёрт');
    await ctx.close();
    const x = await открыть(b, 1280, 'light', {}, 'wb_' + 'c'.repeat(48));
    await x.p.waitForSelector('.tiles', { timeout: 5000 }).catch(() => {});
    await x.p.click('[data-a="ask"][data-k="all"]'); await x.p.click('[data-a="outall"]'); await x.p.waitForTimeout(400);
    const в = x.s.запросы.find(q => q.p === '/web/logout');
    ok(в && в.тело && в.тело.all === true && await x.p.$('.qr svg') !== null, 'выйти на всех компьютерах: запрос и снова вход');
    await x.ctx.close();
  }
  /* английский и узбекский: без кириллицы, кроме названий компаний и имён */
  for (const яз of ['en', 'uz']) {
    const { ctx, p, err } = await открыть(b, 1280, 'light', { lang: яз }, 'wb_' + 'd'.repeat(48));
    await p.waitForSelector('.tiles', { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(500);
    await p.click('[data-a="chnew"]'); await p.waitForTimeout(200);
    const кир = await p.evaluate(() => {
      const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { if (/^(SCRIPT|STYLE)$/.test(n.parentElement.tagName)) continue; const t = n.nodeValue.trim(); if (t && /[А-Яа-яЁё]/.test(t) && !/^(Альфа Банк|Бета|Азиз|Мадина|Октябрь в движении|Шаги)$/.test(t)) out.push(t); }
      return out;
    });
    ok(!кир.length, яз + ': кабинет без кириллицы: ' + кир.join(' | ').slice(0, 300));
    ok(!err.length, яз + ': без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await ctx.close();
  }
} finally { await b.close(); }
  console.log(bad ? 'ПРОВАЛ: ' + bad : 'PASS кабинет компании в браузере');
  process.exit(bad ? 1 : 0);
})();
