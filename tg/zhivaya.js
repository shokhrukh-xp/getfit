'use strict';
/* ЖИВАЯ СКВОЗНАЯ ПРОВЕРКА 04.10 (Claude). Запускать РУКАМИ НА МАКЕ:
     node tg/zhivaya.js
   Его выбор 04.10: «Живая сквозная проверка» — аудит Codex показал, что
   серверные функции 04.10 (строгая оценка фото, смещение по правкам,
   вердикт/срок, сила, запись задним числом) проверялись только на стенде с
   подставным сервером. Здесь — настоящий Worker и D1, но только служебные
   uid svc_z_*: стираются в начале и в конце. Людей, деньги и чужие данные
   не трогаем. Ключ ~/.getfit-svc не печатается. */
const fs = require('fs'), os = require('os'), path = require('path');
const БАЗА = 'https://getfit-sync.sh-pulatov.workers.dev';
let КЛЮЧ = '';
try { КЛЮЧ = fs.readFileSync(os.homedir() + '/.getfit-svc', 'utf8').trim(); } catch (e) {}
if (!КЛЮЧ) { console.error('Нет ~/.getfit-svc — запусти на маке.'); process.exit(1); }
let плохо = 0, всего = 0, мягко = 0;
const дано = (у, т) => { всего++; console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const заметка = (у, т) => { console.log((у ? '  ok  ' : '  ВНИМАНИЕ  ') + т); if (!у) мягко++; };
const ЭПОХА = {};
const uidИз = (p, тело) => (тело && тело.uid) || decodeURIComponent((p.match(/[?&]uid=([^&]+)/) || [])[1] || '');
async function эпоха(uid){
  if (!uid) return 0;
  if (ЭПОХА[uid] == null) {
    const r = await fetch(БАЗА + '/session?uid=' + encodeURIComponent(uid), { headers: { 'x-svc': КЛЮЧ } }).then(r => r.json()).catch(() => null);
    ЭПОХА[uid] = (r && r.session && r.session.epoch) || 0;
  }
  return ЭПОХА[uid];
}
const З = async (p, тело) => {
  const uid = uidИз(p, тело), ep = await эпоха(uid);
  const r = await fetch(БАЗА + p, {
    method: тело ? 'POST' : 'GET',
    headers: Object.assign({ 'x-svc': КЛЮЧ, 'x-data-epoch': String(ep) }, тело ? { 'content-type': 'application/json' } : {}),
    body: тело ? JSON.stringify(тело) : undefined
  });
  let j = null; try { j = await r.json(); } catch (e) { j = { error: 'не JSON, HTTP ' + r.status }; }
  if (j && typeof j === 'object') j.__http = r.status;
  if (uid && j && j.session && j.session.epoch != null) ЭПОХА[uid] = j.session.epoch;
  return j;
};
const стереть = async uid => {
  const r = await З('/forget', { uid, scope: 'all', operation: 'svc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) });
  delete ЭПОХА[uid];
  if (!(r && r.ok)) console.log('    (не стёрлось ' + uid + ': ' + ((r && (r.error || r.code)) || '?') + ')');
  return r;
};
const анкета = (uid, me) => З('/s', { uid, key: 'me', data: { me } });
const ТЗ = 5 * 3600e3;                                    /* даты — по Ташкенту, как у сервера */
const день = (сдвиг) => new Date(Date.now() + ТЗ + сдвиг * 864e5).toISOString().slice(0, 10);
const фото = имя => fs.readFileSync(path.join(__dirname, 'fixtures', 'zhivaya', имя)).toString('base64');
const js = (x, n) => String(JSON.stringify(x === undefined ? null : x)).slice(0, n || 240);
const сумма = (meals, k) => (meals || []).reduce((s, m) => s + (+m[k] || 0), 0);
const UIDS = ['svc_z_foto', 'svc_z_telo', 'svc_z_sila', 'svc_z_retro'];

(async () => {
  for (const u of UIDS) await стереть(u);

  console.log('\n═══ 1 · фото яичницы: строгая оценка (масло считается) ═══');
  const U1 = 'svc_z_foto';
  await анкета(U1, { sex: 'm', age: 34, ht: 176, bw: 88, wt: 'down', gym: 'muscle' });
  const ф1 = await З('/food', { uid: U1, image: фото('yaichnitsa.jpg'), mime: 'image/jpeg', text: '' });
  дано(ф1 && ф1.ok, 'фото принято (HTTP ' + (ф1 && ф1.__http) + (ф1 && ф1.error ? ', ' + ф1.error : '') + ')');
  const м1 = (ф1 && ф1.day && ф1.day.meals) || [];
  console.log('    ответ:', String((ф1 && ф1.reply) || '').split('\n')[0].slice(0, 160));
  м1.forEach(m => console.log('    приём:', m.kind, '·', m.text, '·', m.kcal, 'ккал · белок', m.prot, '· жир', m.fat, '· src', m.src, '· out', m.out));
  if (м1[0]) console.log('    поля приёма:', Object.keys(м1[0]).join(','));
  дано(м1.length >= 1, 'приём записан в дневник');
  const к1 = сумма(м1, 'kcal');
  заметка(к1 >= 170 && к1 <= 360, 'две глазуньи на сковороде: ' + к1 + ' ккал (ждём 170–360 — яйца + масло)');
  дано(м1.some(m => /фото|photo|img/i.test(String(m.src || '')) || m.img || m.photo), 'приём помечен как из фото');

  console.log('\n═══ 2 · фото плова: порция с общего ляганa ═══');
  const ф2 = await З('/food', { uid: U1, image: фото('plov.jpg'), mime: 'image/jpeg', text: 'моя порция — примерно шестая часть этого ляганa' });
  дано(ф2 && ф2.ok, 'фото принято (HTTP ' + (ф2 && ф2.__http) + ')');
  console.log('    ответ:', String((ф2 && ф2.reply) || '').split('\n')[0].slice(0, 160));
  const м2 = ((ф2 && ф2.day && ф2.day.meals) || []).filter(m => !м1.some(x => x.id === m.id));
  м2.forEach(m => console.log('    приём:', m.kind, '·', m.text, '·', m.kcal, 'ккал · белок', m.prot, '· жир', m.fat, '· out', m.out));
  const к2 = сумма(м2, 'kcal');
  заметка(к2 >= 550 && к2 <= 1300, 'шестая часть ляганa плова с мясом: ' + к2 + ' ккал (ждём 550–1300)');

  console.log('\n═══ 3 · правка оценки → смещение фото копится ═══');
  const пр = м1[0];
  if (пр) {
    const нов = Math.round((+пр.kcal || 200) * 1.35);
    const u = await З('/meal/upd', { uid: U1, id: пр.id, kcal: нов });
    дано(u && u.ok !== false && !u.error, 'правка принята (' + пр.kcal + ' → ' + нов + ')' + (u && u.error ? ': ' + u.error : ''));
    const все = await З('/all?uid=' + U1);
    const строки = (все && (все.rows || все.state || все.items)) || [];
    const pb = (Array.isArray(строки) ? строки : []).find(r => (r.key || r.k) === 'photo_bias');
    let данные = null; try { данные = pb ? (typeof pb.data === 'string' ? JSON.parse(pb.data) : (pb.data || pb.v)) : null; } catch (e) {}
    if (!pb) console.log('    /all ключи:', JSON.stringify(Object.keys(все || {})).slice(0, 200), Array.isArray(строки) ? строки.map(r => r.key || r.k).join(',') : '');
    const список = данные && (данные.log || данные.list || данные.p || (Array.isArray(данные) ? данные : null));
    console.log('    photo_bias:', JSON.stringify(данные).slice(0, 220));
    дано(!!(список && список.length >= 1), 'пара «оценка → факт» записана в photo_bias');
  } else дано(false, 'нет приёма для правки');

  console.log('\n═══ 4 · «Тело»: один замер → «мало», потом история → вердикт и срок ═══');
  const U4 = 'svc_z_telo';
  await анкета(U4, { sex: 'm', age: 34, ht: 176, bw: 93, wt: 'down', gym: 'muscle' });
  await З('/measure', { uid: U4, w: 93.0, date: день(0) });
  const ц4 = await З('/goal', { uid: U4, wt: 'down', target: 80, gym: 'muscle' });
  дано(ц4 && !ц4.error, 'цель поставлена' + (ц4 && ц4.error ? ': ' + ц4.error : ''));
  let г4 = await З('/goal?uid=' + U4);
  const п4 = г4 && г4.progress;
  console.log('    один замер:', js(п4 && { verdict: п4.verdict, eta: п4.eta, keys: Object.keys(п4) }));
  дано(!п4 || !п4.verdict || п4.verdict.state === 'мало', 'с одним замером вердикт не выдумывается (нет или «мало»)');
  /* цель «поставлена» три недели назад: вердикт сравнивает недели внутри цели,
     а POST /goal ставит её сегодня. Переносим начало через /s, как будто
     человек поставил цель 21 день назад и с тех пор взвешивается. */
  const цель4 = (await З('/goal?uid=' + U4)).goal || {};
  await З('/s', { uid: U4, key: 'goal', data: Object.assign({}, цель4, { from: день(-21), w0: 94.6 }) });
  /* 20 дней назад — от 94,6 вниз по ~0,08 кг/день с шумом, вода не нужна */
  const шум = [0.1, -0.2, 0.15, 0, -0.1, 0.2, -0.15, 0.05, 0.1, -0.05, 0.2, -0.2, 0, 0.1, -0.1, 0.05, 0.15, -0.15, 0.1, 0];
  for (let i = 20; i >= 1; i--) await З('/measure', { uid: U4, w: Math.round((93.0 + i * 0.08 + шум[i - 1]) * 10) / 10, date: день(-i) });
  г4 = await З('/goal?uid=' + U4);
  const в4 = г4 && г4.progress && г4.progress.verdict, е4 = г4 && г4.progress && г4.progress.eta;
  console.log('    вердикт:', js(в4));
  console.log('    срок:', js(е4));
  дано(!!(в4 && в4.state && в4.state !== 'мало'), 'с историей 3 недель вердикт есть: ' + (в4 && в4.state));
  дано(!!(е4 && /^\d{4}-\d\d-\d\d$/.test(е4.date || '') && е4.date > день(0)), 'срок при текущем темпе — дата в будущем: ' + (е4 && е4.date));
  /* последние две недели — ровно, без снижения: должно стать «стоит» или «плато» */
  const ровно = [93.1, 93.0, 93.2, 93.1, 93.0, 93.2, 93.1, 93.0, 93.1, 93.2, 93.0, 93.1, 93.2, 93.0, 93.1];
  for (let i = 14; i >= 0; i--) await З('/measure', { uid: U4, w: ровно[14 - i], date: день(-i) });
  г4 = await З('/goal?uid=' + U4);
  const в4б = г4 && г4.progress && г4.progress.verdict;
  console.log('    после ровных двух недель:', js(в4б));
  дано(!!(в4б && /стоит|плато/.test(в4б.state || '')), 'ровные две недели → «стоит» или «плато»: ' + (в4б && в4б.state));

  console.log('\n═══ 5 · сила за две недели, включая упражнение без веса ═══');
  const U5 = 'svc_z_sila';
  await анкета(U5, { sex: 'm', age: 34, ht: 176, bw: 88, wt: 'down', gym: 'muscle' });
  await З('/measure', { uid: U5, w: 88.0, date: день(0) });
  await З('/goal', { uid: U5, wt: 'down', target: 80, gym: 'muscle' });
  const цель5 = (await З('/goal?uid=' + U5)).goal || {};
  await З('/s', { uid: U5, key: 'goal', data: Object.assign({}, цель5, { from: день(-21) }) });
  const сессии = [
    [-20, { 'Жим лёжа': [60, 8], 'Присед': [80, 6], 'Подтягивания': [0, 6] }],
    [-13, { 'Жим лёжа': [60, 9], 'Присед': [80, 6], 'Подтягивания': [0, 7] }],
    [-6, { 'Жим лёжа': [62.5, 8], 'Присед': [77.5, 6], 'Подтягивания': [0, 7] }],
    [-1, { 'Жим лёжа': [65, 8], 'Присед': [75, 6], 'Подтягивания': [0, 8] }]];
  /* Как приложение: сначала /all, версии из удалённых (после сброса id тренировок
     по дате повторяются — без версии сервер ответит конфликтом). */
  const все5 = await З('/all?uid=' + U5);
  const верс5 = {}; ((все5 && все5.deleted) || []).forEach(w => { верс5[w.id] = w.version; });
  let сохранено5 = 0, послеСброса5 = 0;
  for (const [сд, ex] of сессии) {
    const data = { ex: Object.keys(ex).map(n => ({ n, sets: [{ w: ex[n][0], r: ex[n][1] }, { w: ex[n][0], r: ex[n][1] - 1 }] })), dur: 45 };
    const id = 'svc-' + день(сд);
    if (верс5[id]) послеСброса5++;
    const r = await З('/w', { uid: U5, id, version: верс5[id] || 0, operation: 'z' + Date.now() + сд, date: день(сд), data });
    if (r && r.ok) сохранено5++; else console.log('    /w', день(сд), js(r, 160));
  }
  console.log('    тренировок с id, уже бывшими до сброса:', послеСброса5);
  дано(сохранено5 === сессии.length, 'все 4 тренировки сохранены (в т.ч. повторные id после сброса): ' + сохранено5);
  const г5 = await З('/goal?uid=' + U5);
  const с5 = г5 && г5.progress && г5.progress.sila;
  console.log('    сила:', js(с5 && { verdict: с5.verdict, up: с5.up, flat: с5.flat, down: с5.down }));
  console.log('    текст:', с5 && с5.text);
  дано(!!(с5 && с5.verdict && с5.verdict !== 'мало'), 'вердикт силы посчитан: ' + (с5 && с5.verdict));
  const подт = с5 && (с5.rows || []).find(r => /Подтяг/.test(r.name));
  дано(!!(подт && подт.now && +подт.now.w === 0 && +подт.now.r === 8), 'подтягивания: вес 0, повторы 8 (приложение покажет «8 повт.»)');
  дано(!!(с5 && /6 → 8|7 → 8/.test(с5.text || '')), 'в тексте тренера повторы без «0×»');
  const жим = с5 && (с5.rows || []).find(r => /Жим/.test(r.name)), прис = с5 && (с5.rows || []).find(r => /Присед/.test(r.name));
  дано(!!(жим && жим.pct > 0 && прис && прис.pct < 0), 'жим растёт (' + (жим && жим.pct) + ' %), присед падает (' + (прис && прис.pct) + ' %)');

  console.log('\n═══ 6 · запись задним числом и закрытие дня ═══');
  const U6 = 'svc_z_retro';
  await анкета(U6, { sex: 'f', age: 35, ht: 165, bw: 70, wt: 'down', gym: 'health' });
  const вчера = день(-1);
  const д6 = await З('/meal/add', { uid: U6, date: вчера, t: '13:00', kind: 'обед', text: 'гречка с курицей', kcal: 520, prot: 38, fat: 14, carb: 60 });
  дано(д6 && д6.ok, 'приём на вчера записан');
  const вч = await З('/day?uid=' + U6 + '&date=' + вчера), сг = await З('/day?uid=' + U6);
  дано(!!(вч && вч.day && (вч.day.meals || []).some(m => m.text === 'гречка с курицей')), 'он во вчерашнем дне');
  дано(!!(сг && сг.day && !(сг.day.meals || []).some(m => m.text === 'гречка с курицей')), 'и не попал в сегодня');
  const нед = await З('/week?uid=' + U6);
  const дн = nед => ((nед && nед.week && (nед.week.days || nед.week.d)) || []);
  const вчН = дн(нед).find(d => d.date === вчера);
  дано(!!(вчН && +вчН.kcal >= 520), 'неделя учитывает вчерашние 520 ккал: ' + (вчН && вчН.kcal));
  const з6 = await З('/day/close', { uid: U6, date: вчера });
  console.log('    закрытие:', js(з6, 200));
  дано(!!(з6 && з6.ok && з6.score != null), 'вчерашний день закрывается, оценка ' + (з6 && з6.score));

  console.log('\n═══ 7 · вечер и «тренер замечает» без отправки ═══');
  const в7 = await З('/svc/vecher?uid=' + U1 + '&kto=' + U1);
  console.log('    вечер (ел сегодня):', js(в7, 220));
  дано(!!(в7 && в7.ok && /замечает/.test(в7.ветка || '')), 'у того, кто ел, ветка «тренер замечает»');
  const в7б = await З('/svc/vecher?uid=' + U6 + '&kto=' + U6);
  console.log('    вечер (сегодня пусто):', js(в7б, 220));
  дано(!!(в7б && в7б.ok && в7б.ветка), 'у того, кто сегодня молчит, своя ветка: ' + (в7б && в7б.ветка));
  const тмп = await З('/svc/temp?uid=' + U4 + '&kto=' + U4);
  console.log('    темп «Тела»:', js(тмп && { темп7: тмп.темп7, наклон20: тмп.наклон20, вердикт: тмп.план && тмп.план.verdict && тмп.план.verdict.state }));
  дано(!!(тмп && тмп.ok), 'служебный темп отвечает (общий вход по uid + ключ)');

  console.log('\n═══ уборка ═══');
  for (const u of UIDS) { const r = await стереть(u); дано(!!(r && r.ok), 'стёрт ' + u); }
  console.log('\n' + (плохо ? 'ПРОВАЛОВ: ' + плохо + ' из ' + всего : 'ВСЕ ' + всего + ' ПРОВЕРОК ПРОЙДЕНЫ') + (мягко ? ' · вниманий: ' + мягко : ''));
  process.exitCode = плохо ? 1 : 0;
})().catch(async e => { console.error('УПАЛО:', e && e.stack || e); for (const u of UIDS) { try { await стереть(u); } catch (x) {} } process.exit(1); });
