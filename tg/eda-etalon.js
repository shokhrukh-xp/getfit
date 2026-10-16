'use strict';
/* ЭТАЛОН ОЦЕНКИ ЕДЫ ПО ФОТО (16.10). Запускать РУКАМИ НА МАКЕ (нужен ~/.getfit-svc):
     node tg/eda-etalon.js <метка> [повторов=2] [потоков=4] [путь-к-конечной-точке=/coach]
   Набор — docs/etalon-eda/items.json (+ картинки рядом). Каждое фото уходит на
   живой сервер от служебного uid (svc_e_eda<n>), без подписи, как «фото без
   подписи» в боте. Перед каждым фото uid стирается: соседние фото не должны
   влиять друг на друга. Пишет docs/reviews/<дата>-eda-etalon-<метка>.json и
   печатает сводку: ошибка ккал/граммов против взвешенной истины, сдвиг,
   разброс между повторами, время ответа p50/p90. Живые люди не трогаются. */
const fs = require('fs'), os = require('os'), path = require('path');
const БАЗА = process.env.GF_BASE || 'https://getfit-sync.sh-pulatov.workers.dev';
const КЛЮЧ = (() => { try { return fs.readFileSync(os.homedir() + '/.getfit-svc', 'utf8').trim(); } catch (e) { return ''; } })();
if (!КЛЮЧ) { console.error('Нет ~/.getfit-svc — запусти на маке.'); process.exit(1); }
const [метка = 'прогон', повт = '2', пот = '4', конец = '/coach'] = process.argv.slice(2);
const ПОВТ = +повт || 2, ПОТ = +пот || 4;
const КОРЕНЬ = path.resolve(__dirname, '../../../docs/etalon-eda');
const ОТЧЁТЫ = path.resolve(__dirname, '../../../docs/reviews');
const items = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'items.json'), 'utf8'))
  .filter(x => !process.env.GF_ONLY || process.env.GF_ONLY.split(',').includes(x.group))
  .slice(0, +process.env.GF_N || undefined);
const ЭП = {};
async function эпоха(uid){ if (ЭП[uid] == null) { const r = await fetch(БАЗА + '/session?uid=' + uid, { headers: { 'x-svc': КЛЮЧ } }).then(r => r.json()).catch(() => null); ЭП[uid] = (r && r.session && r.session.epoch) || 0; } return ЭП[uid]; }
async function З(p, тело, uid){
  const ep = await эпоха(uid);
  const r = await fetch(БАЗА + p, { method: 'POST', headers: { 'x-svc': КЛЮЧ, 'x-data-epoch': String(ep), 'content-type': 'application/json' }, body: JSON.stringify(тело) });
  const j = await r.json().catch(() => ({ error: 'не json ' + r.status }));
  if (j && j.session && j.session.epoch != null) ЭП[uid] = j.session.epoch;
  return j;
}
const стереть = uid => З('/forget', { uid, scope: 'all', operation: 'eda-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) }, uid);
const анкета = uid => З('/s', { uid, key: 'me', data: { me: { sex: 'm', age: 35, ht: 178, bw: 87, only: 'food', wt: 'down', gym: 'health' } } }, uid);
const сумма = (meals, k) => (meals || []).reduce((s, m) => s + (+m[k] || 0), 0);
const граммы = meals => (meals || []).reduce((s, m) => s + (m.items || []).filter(i => !/масл|соус|oil|sauce/i.test(i.name || '')).reduce((a, i) => a + (+i.g || 0), 0), 0);
async function одно(uid, it){
  await стереть(uid); ЭП[uid] = null; await анкета(uid);
  const img = fs.readFileSync(path.join(КОРЕНЬ, it.file)).toString('base64');
  const t0 = Date.now();
  const o = await З(конец, Object.assign({ uid, text: '', image: img, mime: 'image/jpeg' }, process.env.GF_VID ? { _вид: process.env.GF_VID } : {}), uid);
  const ms = Date.now() - t0;
  const meals = o.meals || [];
  return { ms, err: o.error || null, kcal: Math.round(сумма(meals, 'kcal')), prot: Math.round(сумма(meals, 'prot')), fat: Math.round(сумма(meals, 'fat')),
    carb: Math.round(сумма(meals, 'carb')), g: Math.round(граммы(meals)), n: meals.length,
    items: meals.flatMap(m => (m.items || []).map(i => (i.name || '?') + ' ' + (i.g || '?') + 'г ' + Math.round(i.kcal || 0))), reply: o.reply || '' };
}
const перц = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const мед = a => перц(a, 0.5);
(async () => {
  const задачи = []; items.forEach(it => { for (let r = 0; r < ПОВТ; r++) задачи.push({ it, r }); });
  const res = {}; let i = 0;
  const uids = Array.from({ length: ПОТ }, (_, k) => 'svc_e_eda' + k);
  await Promise.all(uids.map(async uid => {
    while (i < задачи.length) {
      const z = задачи[i++];
      let o; try { o = await одно(uid, z.it); } catch (e) { o = { err: String(e), ms: null }; }
      (res[z.it.id] = res[z.it.id] || []).push(o);
      process.stdout.write((o.err ? 'x' : '.'));
    }
  }));
  for (const uid of uids) await стереть(uid);
  console.log('');
  const строки = [], ape = {}, сдвиг = [], время = [], разброс = [], gape = [];
  for (const it of items) {
    const rr = (res[it.id] || []).filter(x => !x.err && x.kcal > 0);
    rr.forEach(x => время.push(x.ms));
    if (rr.length > 1) { const k = rr.map(x => x.kcal), m = k.reduce((a, b) => a + b, 0) / k.length; разброс.push(Math.sqrt(k.reduce((a, b) => a + (b - m) ** 2, 0) / k.length) / m); }
    if (it.truth && rr.length) {
      rr.forEach(x => { (ape[it.group] = ape[it.group] || []).push(Math.abs(x.kcal - it.truth.kcal) / it.truth.kcal); сдвиг.push((x.kcal - it.truth.kcal) / it.truth.kcal);
        if (it.truth.g && x.g) gape.push(Math.abs(x.g - it.truth.g) / it.truth.g); });
    }
    строки.push({ id: it.id, group: it.group, truth: it.truth || null, runs: res[it.id] || [] });
  }
  const все = Object.values(ape).flat(), ош = Object.values(res).flat().filter(x => x.err).length;
  const свод = {
    метка, когда: new Date().toISOString(), конец, база: БАЗА, вид: process.env.GF_VID || 'по умолчанию', фото: items.length, повторов: ПОВТ, ошибок_запроса: ош,
    ккал_MAPE: все.length ? +(все.reduce((a, b) => a + b, 0) / все.length * 100).toFixed(1) : null,
    ккал_медиана_APE: все.length ? +(мед(все) * 100).toFixed(1) : null,
    ккал_сдвиг_медиана: сдвиг.length ? +(мед(сдвиг) * 100).toFixed(1) : null,
    граммы_MAPE: gape.length ? +(gape.reduce((a, b) => a + b, 0) / gape.length * 100).toFixed(1) : null,
    по_группам: Object.fromEntries(Object.entries(ape).map(([g, a]) => [g, +(a.reduce((x, y) => x + y, 0) / a.length * 100).toFixed(1)])),
    разброс_повторов_CV: разброс.length ? +(мед(разброс) * 100).toFixed(1) : null,
    время_p50_с: время.length ? +(мед(время) / 1000).toFixed(1) : null, время_p90_с: время.length ? +(перц(время, 0.9) / 1000).toFixed(1) : null
  };
  fs.mkdirSync(ОТЧЁТЫ, { recursive: true });
  const f = path.join(ОТЧЁТЫ, new Date().toISOString().slice(0, 10) + '-eda-etalon-' + метка + '.json');
  fs.writeFileSync(f, JSON.stringify({ свод, строки }, null, 1));
  console.log(JSON.stringify(свод, null, 1)); console.log('→ ' + f);
})();
