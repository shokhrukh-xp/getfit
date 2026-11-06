'use strict';
/* 06.11, его выбор «Живой прогон новичка»: настоящий интерфейс (index.html из этой копии) и настоящий сервер
   api.wellbol.com, служебный uid svc_nov — стирается в начале и в конце. Людей и его данные не трогаем.
   Шаги как у человека: анкета → цель → программа → первый «Сегодня» → первое сообщение еды тренеру → «Еда».
   На каждом шаге снимок 390×844 в папку (по умолчанию ../shots-zhiv). Запуск на маке:
     NODE_PATH=~/pw/node_modules node tg/novichok-zhivaya.js [папка]
   Ключ ~/.getfit-svc — только в заголовке x-svc, не печатается. */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const M = require('./mock');
const API = 'https://api.wellbol.com', U = 'svc_nov';
const КЛЮЧ = fs.readFileSync(os.homedir() + '/.getfit-svc', 'utf8').trim();
const out = process.argv[2] || path.join(__dirname, '..', '..', 'shots-zhiv'); fs.mkdirSync(out, { recursive: true });
const лог = []; const L = (...a) => { const s = a.join(' '); лог.push(s); console.log(s); };
async function стереть(){
  const s = await fetch(API + '/session?uid=' + U, { headers: { 'x-svc': КЛЮЧ } }).then(r => r.json()).catch(() => ({}));
  const ep = (s.session && s.session.epoch) || 0;
  const r = await fetch(API + '/forget', { method: 'POST', headers: { 'x-svc': КЛЮЧ, 'x-data-epoch': String(ep), 'content-type': 'application/json' },
    body: JSON.stringify({ uid: U, scope: 'all', operation: 'svc-' + Date.now() }) }).then(r => r.json()).catch(e => ({ error: e.message }));
  L('стёрт', U + ':', r.ok ? 'да' : JSON.stringify(r).slice(0, 120));
}
/* index.html — из этой копии, свой порт */
const сайт = http.createServer((q, a) => { const f = path.join(__dirname, '..', decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { a.writeHead(404); return a.end(); } a.writeHead(200, { 'content-type': /\.html$/.test(f) ? 'text/html; charset=utf-8' : /\.js$/.test(f) ? 'text/javascript' : /\.json$/.test(f) ? 'application/json' : /\.css$/.test(f) ? 'text/css' : /\.svg$/.test(f) ? 'image/svg+xml' : 'application/octet-stream' }); a.end(d); }); });
(async () => {
  await стереть();
  await new Promise(r => сайт.listen(0, '127.0.0.1', r)); const порт = сайт.address().port;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU', timezoneId: 'Asia/Tashkent' });
  const p = await ctx.newPage();
  const ошибки = []; p.on('pageerror', e => ошибки.push(e.message)); p.on('console', m => { if (m.type() === 'error') ошибки.push(m.text().slice(0, 200)); });
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' };
  const времена = [];
  await p.route(/^https:\/\/(api\.wellbol\.com|getfit-sync\.sh-pulatov\.workers\.dev)\//, async route => {
    const q = route.request(); if (q.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const h = Object.assign({}, q.headers(), { 'x-svc': КЛЮЧ }); delete h['x-tg-init'];
    const t0 = Date.now();
    try { const r = await route.fetch({ url: q.url().replace('getfit-sync.sh-pulatov.workers.dev', 'api.wellbol.com'), headers: h, timeout: 240000 });
      времена.push([new URL(q.url()).pathname, Date.now() - t0, r.status()]);
      return route.fulfill({ status: r.status(), headers: Object.assign({}, r.headers(), CORS), body: await r.body() }); }
    catch (e) { времена.push([new URL(q.url()).pathname, Date.now() - t0, 'ошибка']); return route.abort(); }
  });
  await p.route('**://telegram.org/**', r => r.abort().catch(() => {}));
  await p.addInitScript(uid => {
    const мем = {};
    window.Telegram = { WebApp: { initData: 'svc', initDataUnsafe: { user: { id: uid, first_name: 'Алия', language_code: 'ru' } },
      colorScheme: 'dark', themeParams: {}, version: '7.0', platform: 'ios',
      expand(){}, ready(){}, close(){}, disableVerticalSwipes(){}, enableVerticalSwipes(){}, enableClosingConfirmation(){}, disableClosingConfirmation(){}, requestFullscreen(){},
      setHeaderColor(){}, setBackgroundColor(){}, onEvent(){}, offEvent(){}, openLink(){}, openTelegramLink(){},
      showAlert(t, cb){ (window.__окна = window.__окна || []).push(String(t)); cb && cb(); }, showConfirm(t, cb){ (window.__окна = window.__окна || []).push(String(t)); cb && cb(true); },
      HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
      MainButton: { show(){}, hide(){}, setText(){}, onClick(){}, offClick(){} },
      BackButton: { isVisible: false, show(){}, hide(){}, onClick(){}, offClick(){} },
      CloudStorage: { getItem(k, cb){ cb(null, мем[k] || ''); }, setItem(k, v, cb){ мем[k] = v; cb && cb(null, true); },
        getItems(ks, cb){ const o = {}; ks.forEach(k => { o[k] = мем[k] || ''; }); cb(null, o); }, getKeys(cb){ cb(null, Object.keys(мем)); }, removeItem(k, cb){ delete мем[k]; cb && cb(null, true); }, removeItems(ks, cb){ ks.forEach(k => delete мем[k]); cb && cb(null, true); } } } };
  }, U);
  let n = 0; const снять = async имя => { await p.waitForTimeout(800); await p.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '-' + имя + '.png') }); L('снимок', n, имя); };
  const текст = async sel => (await p.locator(sel).first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  const t0 = Date.now();
  await p.goto('http://127.0.0.1:' + порт + '/index.html');
  await p.waitForTimeout(3000); L('открылось за', ((Date.now() - t0) / 1000).toFixed(1), 'с; заголовок:', await текст('#picktitle'));
  await снять('start');
  try {
    if (await p.locator('#wz-only-go').isVisible()) await p.click('#wz-only-go');
    await снять('cel-vvod');
    await M.цельШаги(p, { sex: 'f', age: 31, ht: 165, bw: 74, intent: 'loss', до: 'goal' });
    await снять('cel-ekran');
    await M.цельШаги(p, { sex: 'f', age: 31, ht: 165, bw: 74, intent: 'loss' });
    await снять('posle-celi'); L('дни анкеты:', await текст('#wz-wd [aria-pressed="true"]') , '·', (await p.locator('#wz-wd [aria-pressed="true"]').allInnerTexts()).join(' '));
    L('после цели:', await текст('#picktitle'));
    if (process.env.STOP3) throw new Error('STOP3'); if (await p.locator('#wz-go').isVisible()) { const t1 = Date.now(); await p.click('#wz-go');
      await p.waitForSelector('.aiprev,#wzapply', { timeout: 240000 }).catch(() => {}); L('программа собралась за', ((Date.now() - t1) / 1000).toFixed(0), 'с');
      await снять('programma');
      await p.waitForTimeout(4000); await p.evaluate(() => { const e = document.querySelector('#wzapply'); if (e) e.scrollIntoView({ block: 'start' }); }); await снять('programma-voprosy'); L('под программой:', (await текст('.wzdone,.wzq,.wzai,.wznote')).slice(0, 300));
      if (await p.locator('#wzapply').isVisible()) { await p.click('#wzapply'); await p.waitForTimeout(3000); } }
  } catch (e) { L('анкета:', e.message.slice(0, 300)); await снять('anketa-oshibka'); }
  await снять('segodnya-1');
  await p.evaluate(() => window.scrollTo(0, 900)); await снять('segodnya-2'); await p.evaluate(() => window.scrollTo(0, 0));
  /* первая еда — словами, как написал бы человек */
  try {
    await p.mouse.click(338, 792); await p.waitForTimeout(1500); await снять('chat-spisok'); await p.click('.clrow[data-chat=""]'); await p.waitForTimeout(1500);
    await снять('chat-pustoy');
    const поле = p.locator('#ctext'); await поле.fill('На завтрак овсянка на молоке и банан');
    const t2 = Date.now(); await поле.press('Enter'); await p.waitForTimeout(1000);
    await p.waitForFunction(() => /ккал/.test(document.body.innerText.split('овсянка на молоке').pop() || ''), null, { timeout: 120000 }).catch(() => {});
    L('ответ тренера за', ((Date.now() - t2) / 1000).toFixed(0), 'с:', (await p.evaluate(() => document.body.innerText.split('овсянка на молоке').pop() || '')).replace(/\s+/g, ' ').slice(0, 400)); await снять('chat-otvet');
  } catch (e) { L('чат:', e.message.slice(0, 200)); await снять('chat-oshibka'); }
  for (const [sel, имя] of [['[data-page="food"],[data-tab="food"]', 'eda'], ['[data-page="home"],[data-tab="home"]', 'segodnya-posle-edy'], ['[data-page="gym"],[data-tab="gym"]', 'trenirovka']]) {
    try { await p.keyboard.press('Escape'); await p.click(sel, { timeout: 4000 }); } catch (e) { L(имя + ':', e.message.slice(0, 120)); }
    await p.waitForTimeout(1500); await снять(имя);
  }
  L('окна:', JSON.stringify(await p.evaluate(() => window.__окна || [])));
  L('ошибки страницы:', ошибки.length ? ошибки.slice(0, 8).join(' | ') : 'нет');
  L('медленные запросы:', времена.filter(x => x[1] > 3000).map(x => x[0] + ' ' + (x[1] / 1000).toFixed(1) + 'с ' + x[2]).join('; ') || 'нет');
  L('ошибки сервера:', времена.filter(x => !(x[2] >= 200 && x[2] < 400)).map(x => x[0] + ' ' + x[2]).join('; ') || 'нет');
  await b.close(); сайт.close();
  await стереть();
  fs.writeFileSync(path.join(out, 'log.txt'), лог.join('\n'));
})().catch(async e => { console.error(e); try { await стереть(); } catch (x) {} process.exit(1); });
