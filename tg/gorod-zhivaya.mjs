// Живая проверка «город и заведения» на бою (служебные uid svc_gorod_*, ключ ~/.getfit-svc).
import fs from 'node:fs'; import os from 'node:os';
const БАЗА = 'https://api.wellbol.com', КЛЮЧ = fs.readFileSync(os.homedir() + '/.getfit-svc', 'utf8').trim();
const ЭП = {};
async function З(p, тело, uid){
  if (uid && ЭП[uid] == null) { const s = await fetch(БАЗА + '/session?uid=' + uid, { headers: { 'x-svc': КЛЮЧ } }).then(r => r.json()).catch(() => ({})); ЭП[uid] = (s.session && s.session.epoch) || 0; }
  const r = await fetch(БАЗА + p, { method: тело ? 'POST' : 'GET', headers: Object.assign({ 'x-svc': КЛЮЧ, 'x-data-epoch': String(ЭП[uid] || 0) }, тело ? { 'content-type': 'application/json' } : {}), body: тело ? JSON.stringify(тело) : undefined });
  const j = await r.json().catch(() => ({ status: r.status })); if (uid && j && j.session && j.session.epoch != null) ЭП[uid] = j.session.epoch; if (!r.ok) console.log('    [' + r.status + '] ' + JSON.stringify(j).slice(0, 200)); return j;
}
let плохо = 0; const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const стереть = async uid => { const r = await З('/forget', { uid, scope: 'all', operation: 'svc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) }, uid); delete ЭП[uid]; return r; };
const ЛИС = 'svc_gorod_lis', ТАШ = 'svc_gorod_tash';
const режим = process.argv[2] || 'все';
(async () => {
  for (const u of [ЛИС, ТАШ]) await стереть(u);
  // 1. место
  let r = await З('/place', { uid: ЛИС, city: 'Lisbon' }, ЛИС);
  дано(r.ok && r.place.city === 'Лиссабон' && r.place.cc === 'PT', 'Lisbon → ' + JSON.stringify(r.place || r));
  r = await З('/place?uid=' + ТАШ, null, ТАШ);
  дано(r.ok && r.place.city === 'Ташкент' && r.place.cc === 'UZ', 'без пояса и точки — Ташкент: ' + JSON.stringify(r.place || r));
  r = await З('/place', { uid: ТАШ, city: 'Атлантидаааа' }, ТАШ);
  дано(r.code === 'not_found', 'незнакомый город — not_found');
  if (режим === 'место') return;
  // 2. Лиссабон: английский, заведение по смыслу; ни сумов, ни Uzum/Яндекса
  const t0 = Date.now();
  r = await З('/food', { uid: ЛИС, text: 'Going to Time Out Market Lisboa for lunch tomorrow — what should I get there?' }, ЛИС);
  const о1 = String(r.reply || '');
  console.log('    [' + Math.round((Date.now() - t0) / 1000) + ' с] ' + о1.replace(/\n+/g, ' ⏎ ').slice(0, 400));
  дано(о1.length > 20, 'ответ есть');
  дано(!/сум\b|so'm|Uzum|Яндекс|Ташкент|Toshkent/i.test(о1), 'нет сумов, Uzum, Яндекса и Ташкента');
  // 3. Лиссабон спрашивает про Bon — ташкентское меню Bon не берётся
  r = await З('/food', { uid: ЛИС, text: 'What can I take at Bon cafe today?' }, ЛИС);
  const о2 = String(r.reply || '');
  console.log('    ' + о2.replace(/\n+/g, ' ⏎ ').slice(0, 400));
  дано(!/сум\b|Uzum|Ташкент/i.test(о2), 'Bon у человека в Лиссабоне — не ташкентский');
  // 4. Лиссабон: доставка — подбор не запускается
  r = await З('/food', { uid: ЛИС, text: 'хочу заказать ужин с доставкой' }, ЛИС);
  const о3 = String(r.reply || '');
  console.log('    ' + о3.replace(/\n+/g, ' ⏎ ').slice(0, 300));
  дано(!/Уже ищу|Ищу в|нашёл.{0,40}(Яндекс|Uzum)/i.test(о3) && /только в Узбекистане/.test(о3), 'вне Узбекистана подбор доставки не запускается');
  // 5. Ташкент: узбекский, заведение по смыслу
  r = await З('/food', { uid: ТАШ, text: "Bugun tushlikka Bon-ga boraman, u yerda nima olsam bo'ladi?" }, ТАШ);
  const о4 = String(r.reply || '');
  console.log('    ' + о4.replace(/\n+/g, ' ⏎ ').slice(0, 400));
  дано(о4.length > 20, 'узбекский — ответ есть');
  for (const u of [ЛИС, ТАШ]) await стереть(u);
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e => { console.error(e); process.exit(1); });
