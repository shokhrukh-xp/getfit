'use strict';
/* 30.10, роли — этап 6б (его «хорошо, делай» на «кабинет компании в браузере»):
   страница wellbol.app/kabinet/ (с 30.10, этап 6г — /business/, с заявкой компании). Проверяется: (1) вход по QR — код, ожидание,
   «подтвердите в Telegram», токен сохраняется и уходит заголовком Authorization;
   (2) кабинет: цифры недель таблицей («—» для групп меньше 10), челлендж из
   формы, смена роли, ссылка в команду, копирование; (3) сессия кончилась —
   назад ко входу; (4) «Выйти на всех компьютерах»; (5) английский без
   кириллицы (кроме названий); всё — на 1280 и 390, в обеих темах, без
   вылезания и с контрастом. */
const { chromium } = require('playwright'), M = require('./mock'), bounds = require('./viewport-check'), contrast = require('./contrast-check');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
const АДРЕС = M.БАЗА + 'business/';   /* 30.10, этап 6г: кабинет переехал с /kabinet/ */
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
    else if (u.pathname === '/web/mail/code') { s.кодПросили = тело; b = { ok: true, sent: true, ttl: 600 }; }
    else if (u.pathname === '/web/mail/login') { s.вход = тело; if (тело.code === '123456') b = { ok: true, state: 'ok', token: 'wb_' + 'e'.repeat(48) }; else { st = 400; b = { ok: false, code: 'code_bad', error: 'Код не подошёл.' }; } }
    else if (u.pathname === '/web/invite') b = { ok: true, co: { name: 'Альфа Банк' }, role: 'observer', email: 'hr@bank.uz', known: false };
    else if (u.pathname === '/web/mail/link') { s.привязка = тело; b = тело.code ? { ok: true, email: тело.email } : { ok: true, sent: true }; }
    else if (u.pathname === '/web/co/invite-mail') { s.позвал = тело; b = { ok: true, email: тело.email, role: тело.role }; }
    else if (u.pathname === '/web/co/mailing') { s.рассылка = тело; (s.mailings = s.mailings || []).unshift({ id: 'm1', created: Date.now(), total: тело.emails.length, queued: тело.emails.length, sent: тело.emails.length, failed: 0, dup: 0, status: 'done' }); b = { ok: true, id: 'm1', total: тело.emails.length, queued: тело.emails.length, dup: 0, invalid: [] }; }
    else if (u.pathname === '/web/co/mailings') b = { ok: true, mailings: s.mailings || [], max: 2000, dayLimit: 80, sentToday: 12 };
    else if (u.pathname === '/web/co/apply') { s.заявка = тело; b = { ok: true, co: { id: 'c9', name: тело.name, status: 'pending' } }; }
    else if (u.pathname === '/web/me' && s.безКоманды) b = { ok: true, name: 'Азиз', ageKnown: false, adult: false, sizes: ['до 50', '50–250', '250–1000', 'больше 1000'], min: 10,
      team: s.заявка ? [{ id: 'c9', name: s.заявка.name, status: 'pending', role: 'admin' }] : [] };
    else if (u.pathname === '/web/me') b = { ok: true, name: 'Азиз', email: s.email || '', min: 10, team: [{ id: 'c1', name: 'Альфа Банк', status: 'ok', role: 'admin' }, { id: 'c2', name: 'Бета', status: 'pending', role: 'admin' }] };
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
  /* этап 6в: вход по почте */
  for (const [w, тема] of [[1280, 'dark'], [390, 'light']]) {
    const где = 'почта ' + w + ': ';
    const { ctx, p, s, err } = await открыть(b, w, тема);
    await p.waitForSelector('[data-a="how"][data-v="mail"]', { timeout: 5000 }).catch(() => {});
    await p.click('[data-a="how"][data-v="mail"]'); await p.fill('#m-email', 'aziz@bank.uz');
    await проверить(p, где, 'вход по почте');
    await p.click('[data-a="mcode"]'); await p.waitForSelector('#m-code', { timeout: 3000 }).catch(() => {});
    ok(s.кодПросили && s.кодПросили.email === 'aziz@bank.uz' && /Если адрес aziz@bank\.uz есть в команде/.test(await p.textContent('main')), где + 'код запрошен, ответ не выдаёт, есть ли адрес');
    await p.fill('#m-code', '000000'); await p.waitForTimeout(400);
    ok(/Код не подошёл/.test(await p.textContent('main')), где + 'неверный код — понятная ошибка');
    await p.fill('#m-code', '123456'); await p.waitForSelector('.tiles', { timeout: 5000 }).catch(() => {});
    ok(await p.evaluate(() => localStorage.getItem('wb_kab_tok')) === 'wb_' + 'e'.repeat(48), где + '6 цифр — вход сам, токен сохранён');
    ok(!err.length, где + 'без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await ctx.close();
  }
  /* приглашение в команду по почте: человек без Telegram */
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 900 } }); const s = сервер(), p = await ctx.newPage(), err = [];
    p.on('pageerror', e => err.push(String(e))); await ctx.route('https://api.wellbol.com/**', s.обработчик);
    await p.goto(АДРЕС + '?invite=ABCDEFGHJK'); await p.waitForSelector('#m-name', { timeout: 5000 }).catch(() => {});
    const т = await p.textContent('main');
    ok(/Вас позвали в команду компании/.test(т) && /Альфа Банк/.test(т) && /наблюдатель/.test(т) && /hr@bank\.uz/.test(т), 'приглашение: компания, роль, адрес');
    await p.click('[data-a="mcode"]'); await p.waitForTimeout(200);
    ok(!s.кодПросили && /имя от 2 знаков/.test(await p.textContent('main')), 'приглашение: без имени код не просим');
    await p.fill('#m-name', 'Гульнора'); await p.click('[data-a="mcode"]'); await p.waitForSelector('#m-code', { timeout: 3000 }).catch(() => {});
    ok(s.кодПросили && s.кодПросили.email === 'hr@bank.uz' && s.кодПросили.invite === 'ABCDEFGHJK', 'приглашение: код — на адрес из приглашения');
    await проверить(p, 'приглашение 390: ', 'ввод кода');
    await p.fill('#m-code', '123456'); await p.waitForSelector('.tiles', { timeout: 5000 }).catch(() => {});
    ok(s.вход && s.вход.name === 'Гульнора' && s.вход.invite === 'ABCDEFGHJK' && !/invite=/.test(p.url()), 'приглашение: вход с именем, адрес страницы очищен');
    ok(!err.length, 'приглашение: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await ctx.close();
  }
  /* кабинет: привязать почту, позвать по почте, рассылка сотрудникам */
  for (const [w, тема] of [[1280, 'light'], [390, 'dark']]) {
    const где = 'рассылка ' + w + ': ';
    const { ctx, p, s, err } = await открыть(b, w, тема, {}, 'wb_' + 'f'.repeat(48));
    await p.waitForSelector('#ml-text', { timeout: 5000 }).catch(() => {});
    await p.fill('#ln-email', 'aziz@bank.uz'); await p.click('[data-a="lncode"]'); await p.waitForSelector('#ln-code', { timeout: 3000 }).catch(() => {});
    await p.fill('#ln-code', '123456'); await p.click('[data-a="lnok"]'); await p.waitForTimeout(300);
    ok(s.привязка && s.привязка.code === '123456' && /Входите в кабинет кодом на адрес/.test(await p.textContent('main')), где + 'почта привязана');
    await p.fill('#i-email', 'hr@bank.uz'); await p.selectOption('#i-role', 'observer'); await p.click('[data-a="invmail"]'); await p.waitForTimeout(300);
    ok(s.позвал && s.позвал.email === 'hr@bank.uz' && s.позвал.role === 'observer' && s.позвал.co === 'c1', где + 'позвать по почте: ' + JSON.stringify(s.позвал));
    await p.fill('#ml-text', 'Иванов Иван, ivanov@bank.uz\npetrova@bank.uz; IVANOV@bank.uz плохой@');
    ok(/Адресов: 2 · с ошибкой: 1 · повторов: 1/.test(await p.textContent('#ml-count')), где + 'разбор списка: ' + await p.textContent('#ml-count'));
    await p.click('[data-a="ask"][data-k="ml"]'); await p.waitForTimeout(100);
    ok(!s.рассылка && /Отправить 2 писем от имени «Альфа Банк»/.test(await p.textContent('main')), где + 'рассылка — только после подтверждения');
    await p.click('[data-a="mlsend"]'); await p.waitForTimeout(500);
    ok(s.рассылка && JSON.stringify(s.рассылка.emails) === '["ivanov@bank.uz","petrova@bank.uz"]', где + 'ушли только адреса, без имён и повторов');
    ok(/Рассылки/.test(await p.textContent('main')) && /готово/.test(await p.textContent('main')), где + 'история рассылок');
    ok(/до 80 приглашений в сутки, сегодня ушло 12/.test(await p.textContent('main')), где + 'лимит тарифа почты виден');
    await проверить(p, где, 'кабинет с рассылкой');
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
  /* этап 6г: страница для компаний — вступление на входе, заявка компании вместо «вы не в команде», старый /kabinet/ ведёт сюда */
  for (const [w, тема] of [[1280, 'light'], [390, 'dark']]) {
    const где = w + ' ' + тема + ': ';
    const x = await открыть(b, w, тема, { послеОпросов: 99 });
    await x.p.waitForSelector('.qr svg', { timeout: 5000 }).catch(() => {});
    ok(/Wellböl для компаний/.test(await x.p.textContent('main')) && /от 10 человек/.test(await x.p.textContent('main')), где + 'вход: вступление для компаний');
    ok((x.s.запросы.find(q => q.p === '/web/login' && q.м === 'POST') || {}).тело.for === 'business', где + 'код входа — для страницы компаний');
    await проверить(x.p, где, 'вход со вступлением');
    await x.ctx.close();
    const { ctx, p, s, err } = await открыть(b, w, тема, { безКоманды: true }, 'wb_' + 'f'.repeat(48));
    await p.waitForSelector('#c-name', { timeout: 5000 }).catch(() => {});
    ok(/Заявка компании/.test(await p.textContent('main')) && await p.$('#c-adult') !== null, где + 'не в команде — форма заявки, 18+ — галочкой (возраста нет)');
    ok(await p.$$eval('#c-size option', o => o.map(x => x.value).join('|')) === '|до 50|50–250|250–1000|больше 1000', где + 'размер — из ответа сервера');
    await проверить(p, где, 'заявка компании');
    await p.fill('#c-name', 'Банк Бета'); await p.fill('#c-site', 'beta.uz'); await p.fill('#c-about', 'Банк'); await p.fill('#c-contact', 'hr@beta.uz'); await p.selectOption('#c-size', '250–1000');
    await p.click('[data-a="coapply"]'); await p.waitForTimeout(200);
    ok(!s.заявка && /Подтвердите, что вам есть 18 лет/.test(await p.textContent('main')), где + 'без галочки 18+ — не отправляем');
    ok(await p.$eval('#c-name', e => e.value) === 'Банк Бета', где + 'набранное не теряется');
    await p.check('#c-adult'); await p.click('[data-a="coapply"]'); await p.waitForTimeout(500);
    ok(s.заявка && s.заявка.name === 'Банк Бета' && s.заявка.site === 'beta.uz' && s.заявка.contact === 'hr@beta.uz' && s.заявка.size === '250–1000' && s.заявка.adult === true, где + 'заявка ушла как заполнена: ' + JSON.stringify(s.заявка));
    ok(/Заявка на проверке/.test(await p.textContent('main')) && /Ответ придёт в Telegram/.test(await p.textContent('main')), где + 'после заявки — «на проверке», ответ в Telegram');
    ok(!err.length, где + 'заявка: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await ctx.close();
  }
  {
    const ctx = await b.newContext(), p = await ctx.newPage();
    await ctx.route('https://api.wellbol.com/**', сервер().обработчик);
    await p.goto(M.БАЗА + 'kabinet/?invite=ABCDEFGH23'); await p.waitForURL(/\/business\/\?invite=ABCDEFGH23$/, { timeout: 5000 }).catch(() => {});
    ok(/\/business\/\?invite=ABCDEFGH23$/.test(p.url()), 'старый адрес /kabinet/ ведёт на /business/ с приглашением: ' + p.url());
    await ctx.close();
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
    await p.fill('#ml-text', 'a@b.uz c@d.uz'); await p.click('[data-a="ask"][data-k="ml"]'); await p.waitForTimeout(100);
    const кир2 = await p.evaluate(() => [...document.querySelectorAll('#ml-count, .confirm span')].map(e => e.textContent).filter(t => /[А-Яа-яЁё]/.test(t.replace(/Альфа Банк/g, ''))));
    ok(!кир2.length, яз + ': рассылка без кириллицы: ' + кир2.join(' | '));
    await ctx.close();
    const x = await открыть(b, 1280, 'light', { lang: яз });
    await x.p.waitForSelector('[data-a="how"][data-v="mail"]', { timeout: 5000 }).catch(() => {}); await x.p.click('[data-a="how"][data-v="mail"]'); await x.p.waitForTimeout(200);
    const кир3 = await x.p.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.nodeValue.trim(); if (t && /[А-Яа-яЁё]/.test(t)) out.push(t); } return out; });
    ok(!кир3.length, яз + ': вход по почте без кириллицы: ' + кир3.join(' | '));
    await x.p.click('[data-a="how"][data-v="qr"]'); await x.p.waitForTimeout(300);
    /* «Войти» в кавычках — это надпись кнопки в боте, бот пишет по-русски (перевод рядом в скобках) */
    const кир4 = await x.p.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.nodeValue.trim(); if (t && /[А-Яа-яЁё]/.test(t.replace(/[«“]Войти[»”]/g, ''))) out.push(t); } return out; });
    ok(!кир4.length, яз + ': вступление и вход по QR без кириллицы: ' + кир4.join(' | '));
    const з = await открыть(b, 1280, 'light', { lang: яз, безКоманды: true }, 'wb_' + 'f'.repeat(48));
    await з.p.waitForSelector('#c-name', { timeout: 5000 }).catch(() => {}); await з.p.waitForTimeout(400);
    const кир5 = await з.p.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.nodeValue.trim(); if (t && /[А-Яа-яЁё]/.test(t)) out.push(t); } return out; });
    ok(!кир5.length, яз + ': заявка компании без кириллицы: ' + кир5.join(' | '));
    await з.ctx.close();
    ok(!err.length && !x.err.length, яз + ': без ошибок страницы ' + err.concat(x.err).join(' | ').slice(0, 200));
    await x.ctx.close();
  }
} finally { await b.close(); }
  console.log(bad ? 'ПРОВАЛ: ' + bad : 'PASS кабинет компании в браузере');
  process.exit(bad ? 1 : 0);
})();
