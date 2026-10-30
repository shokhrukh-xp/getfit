'use strict';
/* 30.10, роли — этап 6г. Его слова: «приложение должно быть только для пользователей. тренеры и
   нутрициологи должны регистрироваться как-то иначе». Страница wellbol.app/experts/. Проверяется:
   (1) вход: вступление для специалистов, QR, код — для этой страницы; (2) анкета: кто, имя, опыт,
   контакт, фото диплома (уменьшается на устройстве), 18+ галочкой, если возраста нет; ушло как
   заполнено; (3) «на проверке», «Дополнить заявку»; (4) принят — ссылка для клиентов, QR, путь в
   приложение; (5) вошёл по почте — нужен Telegram; (6) английский и узбекский без кириллицы;
   всё — на 1280 и 390, в обеих темах, без вылезания и с контрастом. */
const { chromium } = require('playwright'), M = require('./mock'), bounds = require('./viewport-check'), contrast = require('./contrast-check'), path = require('path');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
const АДРЕС = M.БАЗА + 'experts/', ТОК = 'wb_' + 'a'.repeat(48), ФОТО = path.join(__dirname, 'fixtures', 'a.jpg');
function сервер(нач){
  const s = Object.assign({ опрос: 0, запросы: [], pro: [], ageKnown: false, tg: true }, нач);
  s.обработчик = async route => {
    const r = route.request(), u = new URL(r.url()), м = r.method(); let тело = null; try { тело = r.postDataJSON(); } catch (e) {}
    if (м === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    s.запросы.push({ p: u.pathname, м, тело, auth: r.headers()['authorization'] || '' });
    let b, st = 200;
    const я = () => ({ ok: true, name: 'Дилшод', tg: s.tg, ageKnown: s.ageKnown, adult: s.ageKnown, app: 'https://wellbol.app/', maxDocs: 3, pro: s.pro });
    if (u.pathname === '/web/login' && м === 'POST') b = { ok: true, id: 'ABCDEFGH2345', secret: 'f'.repeat(32), link: 'https://t.me/WellbolTestBot?start=w_ABCDEFGH2345', ttl: 300 };
    else if (u.pathname === '/web/login') { s.опрос++; b = s.опрос >= (s.послеОпросов || 3) ? { ok: true, state: 'ok', token: ТОК } : { ok: true, state: s.опрос > 1 ? 'asked' : 'wait' }; }
    else if (u.pathname === '/web/pro/me') b = я();
    else if (u.pathname === '/web/pro/apply') {
      s.заявка = тело;
      s.pro = тело.kinds.map(k => ({ kind: k, name: тело.name, about: тело.about, contact: тело.contact, docs: (s.pro[0] ? s.pro[0].docs : 0) + тело.docs.length, status: 'pending', link: null }));
      b = я();
    }
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
  if (токен) await p.addInitScript(t => { try { localStorage.setItem('wb_exp_tok', t); } catch (e) {} }, токен);
  if (нач && нач.lang) await p.addInitScript(l => { try { localStorage.setItem('wb_kab_lang', l); } catch (e) {} }, нач.lang);
  await p.goto(АДРЕС);
  return { ctx, p, s, err };
}
async function проверить(p, где, имя){
  const bb = await bounds(p), cc = await contrast(p, 'main');
  ok(!bb.length, где + имя + ': ничего не вылезает ' + JSON.stringify(bb).slice(0, 160));
  ok(cc.checked > 0 && !cc.failures.length, где + имя + ': контраст ' + JSON.stringify(cc.failures).slice(0, 160));
}
const кириллица = (p, свои) => p.evaluate(rx => {
  const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { if (/^(SCRIPT|STYLE)$/.test(n.parentElement.tagName)) continue; const t = n.nodeValue.trim(); if (t && /[А-Яа-яЁё]/.test(t.replace(/[«“]Войти[»”]/g, '')) && !(rx && new RegExp(rx).test(t))) out.push(t); }
  return out;
}, свои || null);
(async () => { const b = await chromium.launch(); try {
  for (const [w, тема] of [[1280, 'light'], [390, 'dark']]) {
    const где = w + ' ' + тема + ': ';
    /* 1. вход */
    let x = await открыть(b, w, тема);
    await x.p.waitForSelector('.qr svg', { timeout: 5000 }).catch(() => {});
    const т0 = await x.p.textContent('main');
    ok(/Ведите клиентов в Wellböl/.test(т0) && /диплом или сертификат/.test(т0) && /Нужен Telegram/.test(т0), где + 'вход: вступление для специалистов');
    ok((x.s.запросы.find(q => q.p === '/web/login' && q.м === 'POST') || {}).тело.for === 'experts', где + 'код входа — для страницы специалистов');
    await проверить(x.p, где, 'вход');
    await x.p.waitForSelector('#f-name', { timeout: 9000 }).catch(() => {});
    ok(await x.p.evaluate(() => localStorage.getItem('wb_exp_tok')) === ТОК, где + 'после «Войти» в боте — токен сохранён, открылась анкета');
    await x.ctx.close();

    /* 2. анкета */
    const { ctx, p, s, err } = await открыть(b, w, тема, {}, ТОК);
    await p.waitForSelector('#f-name', { timeout: 5000 }).catch(() => {});
    ok(await p.$('#f-adult') !== null, где + 'возраста нет — галочка 18+');
    await проверить(p, где, 'анкета');
    await p.check('[data-kind="trainer"]'); await p.check('[data-kind="nutri"]');
    await p.fill('#f-name', 'Дилшод'); await p.fill('#f-about', 'Тренер 6 лет, диплом УзГИФК, силовые и похудение.'); await p.fill('#f-contact', '+998 90 123 45 67');
    await p.setInputFiles('#f-docs', ФОТО); await p.waitForSelector('.doc img', { timeout: 5000 }).catch(() => {});
    ok((await p.$$('.doc img')).length === 1 && await p.$eval('#f-name', e => e.value) === 'Дилшод', где + 'фото диплома — превью, набранное не потерялось');
    await p.click('[data-a="send"]'); await p.waitForTimeout(200);
    ok(!s.заявка && /Подтвердите, что вам есть 18 лет/.test(await p.textContent('main')), где + 'без 18+ — не отправляем');
    await p.check('#f-adult'); await p.click('[data-a="send"]'); await p.waitForSelector('.st', { timeout: 5000 }).catch(() => {});
    const з = s.заявка || {};
    ok(з.kinds && з.kinds.join() === 'trainer,nutri' && з.name === 'Дилшод' && з.contact === '+998 90 123 45 67' && /УзГИФК/.test(з.about) && з.adult === true, где + 'заявка ушла как заполнена: ' + JSON.stringify(Object.assign({}, з, { docs: (з.docs || []).length })));
    ok(з.docs && з.docs.length === 1 && з.docs[0].mime === 'image/jpeg' && з.docs[0].b64.length > 1000 && з.docs[0].b64.length < 900000 && !/^data:/.test(з.docs[0].b64), где + 'фото — JPEG base64 без префикса, меньше предела сервера');
    ok(s.запросы.filter(q => q.p.startsWith('/web/pro')).every(q => q.auth === 'Bearer ' + ТОК), где + 'запросы — с заголовком Authorization');

    /* 3. на проверке → «Дополнить» */
    const т3 = await p.textContent('main');
    ok((т3.match(/на проверке/g) || []).length === 2 && /ответ придёт в Telegram/.test(т3), где + 'обе заявки «на проверке», ответ — в Telegram');
    await проверить(p, где, 'на проверке');
    await p.click('[data-a="edit"]'); await p.waitForSelector('#f-name', { timeout: 3000 }).catch(() => {});
    ok(await p.$eval('#f-name', e => e.value) === 'Дилшод' && /Уже приложено: 1/.test(await p.textContent('main')), где + '«Дополнить заявку» — поля заполнены, сколько документов уже есть');
    ok(!err.length, где + 'анкета: без ошибок страницы ' + err.join(' | ').slice(0, 200));
    await ctx.close();

    /* 4. принят */
    x = await открыть(b, w, тема, { ageKnown: true, pro: [{ kind: 'trainer', name: 'Дилшод', about: '…', contact: '…', docs: 1, status: 'ok', link: 'https://t.me/WellbolTestBot?start=s_TSTRNR01' }, { kind: 'nutri', name: 'Дилшод', about: '…', contact: '…', docs: 1, status: 'off', link: null }] }, ТОК);
    await x.p.waitForSelector('.link input', { timeout: 5000 }).catch(() => {});
    ok(await x.p.$eval('.link input', e => e.value) === 'https://t.me/WellbolTestBot?start=s_TSTRNR01', где + 'принят: ссылка для клиентов');
    ok(await x.p.$eval('a.btn[href="https://t.me/WellbolTestBot"]', a => a.target === '_blank').catch(() => false) && /Кабинет специалиста/.test(await x.p.textContent('main')), где + 'путь в приложение: «Кабинет специалиста», кнопка в бота');
    ok(/не принята/.test(await x.p.textContent('main')) && !(await x.p.$('[data-a="edit"]')), где + 'вторая заявка не принята — «Дополнить» нет');
    await x.p.click('[data-a="copy"]'); await x.p.waitForTimeout(200);
    ok(await x.p.evaluate(() => navigator.clipboard.readText()).catch(() => '') === 'https://t.me/WellbolTestBot?start=s_TSTRNR01', где + 'копирование ссылки');
    await проверить(x.p, где, 'принят');
    await x.ctx.close();
  }
  /* 5. вошёл по почте (без Telegram) — специалисту нужен Telegram */
  {
    const x = await открыть(b, 390, 'light', { tg: false }, ТОК);
    await x.p.waitForSelector('[data-a="out"]', { timeout: 5000 }).catch(() => {});
    ok(/Нужен вход через Telegram/.test(await x.p.textContent('main')) && !(await x.p.$('#f-name')), 'без Telegram — анкеты нет, просим войти через Telegram');
    await x.ctx.close();
  }
  /* 6. английский и узбекский */
  for (const яз of ['en', 'uz']) {
    let x = await открыть(b, 1280, 'light', { lang: яз, послеОпросов: 99 });
    await x.p.waitForSelector('.qr svg', { timeout: 5000 }).catch(() => {}); await x.p.waitForTimeout(400);
    let к = await кириллица(x.p); ok(!к.length, яз + ': вход без кириллицы: ' + к.join(' | ').slice(0, 300));
    await x.ctx.close();
    x = await открыть(b, 1280, 'light', { lang: яз }, ТОК);
    await x.p.waitForSelector('#f-name', { timeout: 5000 }).catch(() => {}); await x.p.waitForTimeout(400);
    к = await кириллица(x.p); ok(!к.length, яз + ': анкета без кириллицы: ' + к.join(' | ').slice(0, 300));
    await x.ctx.close();
    x = await открыть(b, 1280, 'light', { lang: яз, ageKnown: true, pro: [{ kind: 'trainer', name: 'Дилшод', about: '', contact: '', docs: 1, status: 'pending', link: null }] }, ТОК);
    await x.p.waitForSelector('.st', { timeout: 5000 }).catch(() => {}); await x.p.waitForTimeout(400);
    к = await кириллица(x.p, '^Дилшод$'); ok(!к.length, яз + ': статус без кириллицы: ' + к.join(' | ').slice(0, 300));
    ok(!x.err.length, яз + ': без ошибок страницы');
    await x.ctx.close();
  }
} finally { await b.close(); }
  console.log(bad ? 'ПРОВАЛ: ' + bad : 'PASS страница для специалистов');
  process.exit(bad ? 1 : 0);
})();
