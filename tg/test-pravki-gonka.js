'use strict';
/* Гонка копий правок дня (21.10). В 16:16 его правки программы на сервере
   перезаписались копией от 18.10: CloudStorage Telegram отвечает в вебе
   секундами, сервер успевал прислать свежие правки раньше, а запоздавшая
   копия ложилась поверх — и первая же правка уходила на сервер «изменением».
   Заперто: сервер прислал свежее, копия Telegram пришла позже — в памяти и на
   экране свежее, и на сервер старое не уходит. */
const { chromium } = require('playwright');
const M = require('./mock');
const fs = require('fs'), path = require('path'), vm = require('vm'), { DatabaseSync } = require('node:sqlite');
/* настоящий серверный /s поверх SQLite — как в test-settings-save */
const source = fs.readFileSync(path.join(__dirname, '../../getfit-sync/src/index.js'), 'utf8');
const c = vm.createContext({ console, Date, Response, Request, URL, TextEncoder, crypto, setTimeout, clearTimeout });
vm.runInContext(source.replace(/^import[^\n]+\n/, 'const БЛЮДА=[];\n').replace('export default {', 'globalThis.worker={'), c);
const sq = new DatabaseSync(':memory:');
sq.exec('CREATE TABLE state(uid TEXT,key TEXT,data TEXT,updated INTEGER,PRIMARY KEY(uid,key));');
const st = sql => { let a = []; const o = { bind(...v) { a = v; return o; }, async first() { return sq.prepare(sql).get(...a) || null; },
  async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { return { meta: { changes: sq.prepare(sql).run(...a).changes } }; } }; return o; };
let цепь = Promise.resolve();
const DB = { prepare: st, batch(qs) { const run = async () => { sq.exec('BEGIN'); try { const a = []; for (const q of qs) a.push(await q.run()); sq.exec('COMMIT'); return a; } catch (e) { sq.exec('ROLLBACK'); throw e; } }; const p = цепь.then(run); цепь = p.catch(() => {}); return p; } };
const ENV = { DB, SVC_KEY: 'fixture' };
const всеВызовы = [];
async function маршрут(r) {
  const u = new URL(r.request().url());
  if (u.pathname === '/all') { всеВызовы.push('/all');
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ syncVersion: 2,
      state: sq.prepare("SELECT key,data,updated FROM state WHERE uid='svc_settings' AND key NOT LIKE 'settings_op_%'").all().map(x => ({ ...x, data: JSON.parse(x.data) })), workouts: [], deleted: [] }) });
    return true; }
  if (u.pathname !== '/s') return false;
  const body = JSON.parse(r.request().postData()); body.uid = 'svc_settings'; всеВызовы.push('/s ' + body.key);
  const res = await c.worker.fetch(new Request('https://fixture/s', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-svc': 'fixture', 'x-data-epoch': '0' }, body: JSON.stringify(body) }), ENV, { waitUntil() {} });
  await r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
  return true;
}
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const у = (id, n, м) => ({ id, n, en: n, m: м, q: 'dumbbell', p: 'плечи', sets: 3, reps: '10–15', rest: 60, ss: null, why: '' });
const ПРОГ = { name: 'Мышцы · 1 день', note: '', focus: ['shoulders'], days: [
  { s: 'Верх', sub: 'плечи', ex: [у('Side_Lateral_Raise', 'Подъём через сторону (гантели, сбоку)', 'shoulders'), у('Dumbbell_Shoulder_Press', 'Жим над головой (гантели)', 'shoulders')] } ] };
const СВЕЖЕЕ = { s: { 'A1:1': { n: 'Жим (сидя, гантели)', e: 'Seated Dumbbell Press', i: 'Seated_Dumbbell_Press' } }, adj: { 'A1:0': 4 }, x: {}, sk: {}, ord: {}, pr: {}, at: '2026-10-21T10:31:00Z' };
const СТАРОЕ = { s: { 'A1:1': { n: 'Подъём (блок, стоя)', e: 'Standing Cable Lift', i: 'Standing_Cable_Lift' } }, adj: { 'A1:0': 3 }, x: {}, sk: {}, ord: {}, pr: {}, at: '2026-10-18T09:00:00Z' };
const ME = { sex: 'm', age: 38, ht: 178, bw: 86, goal: 'muscle', wt: 'keep', gym: 'muscle', level: 'mid', place: 'gym', only: 'all', lim: [], eq: [] };

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  /* копия в Telegram — старая и отвечает через 4 секунды */
  if (process.env.NODELAY) await page.addInitScript(() => localStorage.setItem('__nodelay', '1'));
  await page.addInitScript(([старое]) => {
    try { localStorage.setItem('cs_state_subs', JSON.stringify(старое)); } catch (e) {}
    if (localStorage.getItem('__nodelay')) return;
    let tg;
    Object.defineProperty(window, 'Telegram', { configurable: true, get: () => tg, set: v => {
      tg = v; const cs = v && v.WebApp && v.WebApp.CloudStorage; if (!cs || cs.__медленно) return;
      cs.__медленно = 1;
      const gi = cs.getItem.bind(cs), gs = cs.getItems.bind(cs);
      cs.getItem = (k, cb) => /state_subs$/.test(k) ? setTimeout(() => gi(k, cb), 4000) : gi(k, cb);
      cs.getItems = (ks, cb) => ks.some(k => /state_subs$/.test(k)) ? setTimeout(() => gs(ks, cb), 4000) : gs(ks, cb);
    } });
  }, [СТАРОЕ]);
  const ушло = [];
  const все = [];
  page.on('pageerror', e => все.push('pageerror ' + e.message));
  page.on('console', m => { if (process.env.DBG) все.push('console ' + m.text().slice(0, 150)); });
  page.on('request', r => { if (process.env.DBG && !/workers\.dev/.test(r.url())) все.push('other ' + r.url().slice(0, 100)); if (/workers\.dev/.test(r.url())) все.push(r.method() + ' ' + new URL(r.url()).pathname); if (r.method() === 'POST' && /workers\.dev/.test(r.url())) ушло.push(r.postData() || ''); });
  sq.prepare('INSERT INTO state VALUES(?,?,?,?)').run('svc_settings', 'subs', JSON.stringify(СВЕЖЕЕ), Date.now());
  const ош = await M.поднять(page, { page: 'gym', wait: 7500, preserveReload: true, prog: ПРОГ, profile: 'ai', me: ME,
    handleRoute: маршрут });
  /* сервер приходит на 1,5 с, копия Telegram — на 4-й: ждём обе и ещё чуть */
  await page.waitForTimeout(7000);
  if (process.env.DBG) { console.log(все.join('\n')); console.log(await page.evaluate(() => Object.keys(localStorage).filter(k => /subs|adj/.test(k)).map(k => k + '=' + localStorage.getItem(k).slice(0, 120)).join('\n'))); }
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  const слой = await page.evaluate(() => ({ s: JSON.parse(localStorage.getItem('shp_v1_ai_subs') || 'null'), adj: JSON.parse(localStorage.getItem('shp_v1_ai_adj') || 'null') }));
  дано(слой.s && слой.s['A1:1'] && слой.s['A1:1'].i === 'Seated_Dumbbell_Press', 'в памяти свежая замена с сервера: ' + JSON.stringify(слой.s));
  дано(слой.adj && слой.adj['A1:0'] === 4, 'и свежие подходы: ' + JSON.stringify(слой.adj));
  const экран = await page.$eval('#list', e => e.textContent).catch(() => '');
  дано(/Жим \(сидя, гантели\)/.test(экран) && !/Подъём \(блок, стоя\)/.test(экран), 'на экране свежее, а не копия от 18.10');
  дано(!ушло.some(b => /Standing_Cable_Lift/.test(b)), 'старое на сервер не ушло (POST: ' + ушло.length + ')');
  const наСервере = JSON.parse(sq.prepare("SELECT data FROM state WHERE uid='svc_settings' AND key='subs'").get().data);
  дано(наСервере.s['A1:1'].i === 'Seated_Dumbbell_Press' && наСервере.adj['A1:0'] === 4, 'на сервере правки целы: ' + JSON.stringify(наСервере.s));
  if (process.env.DBG) console.log(всеВызовы.join(' | '));
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
