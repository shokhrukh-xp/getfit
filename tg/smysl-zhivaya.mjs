// Живая проверка на бою (02.11): смысл сообщения на любом языке (smysl) и места из Google Maps вне Узбекистана.
// Служебные uid svc_*, ключ ~/.getfit-svc. node tg/smysl-zhivaya.mjs
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
const доля = t => { const к = (t.match(/[А-Яа-яЁё]/g) || []).length, л = (t.match(/[A-Za-z]/g) || []).length; return к / Math.max(1, к + л); };
const сказать = async (uid, text) => { const t0 = Date.now(); const r = await З('/food', { uid, text }, uid); const о = String(r.reply || ''); последний = r;
  console.log('    «' + text + '» [' + Math.round((Date.now() - t0) / 1000) + ' с] → ' + о.replace(/\n+/g, ' ⏎ ').slice(0, 420) + (о.length > 420 ? ' … ' + о.replace(/\n+/g, ' ⏎ ').slice(-260) : '')); return о; };
let последний = null;
const ЛИС = 'svc_smysl_lis', ТАШ = 'svc_smysl_tash', ТАШ2 = 'svc_smysl_tash2';
(async () => {
  for (const u of [ЛИС, ТАШ, ТАШ2]) await стереть(u);
  await З('/place', { uid: ТАШ2, city: 'Tashkent' }, ТАШ2);
  await З('/place', { uid: ЛИС, city: 'Lisbon' }, ЛИС);
  await З('/place', { uid: ТАШ, city: 'Tashkent' }, ТАШ);
  // 1. Лиссабон: доставка по-английски без слова delivery → места из Google Maps
  let о = await сказать(ЛИС, 'Can you find me a place to order a healthy dinner from tonight?');
  /* /food приложения отдаёт текст: места — ссылками Google Maps в конце ответа */
  const ссылки = о.match(/https:\/\/(?:www\.)?(?:maps\.google\.com|google\.com\/maps)\S+/g) || [];
  дано(ссылки.length >= 2, 'места из Google Maps — ссылками (' + ссылки.length + ')');
  дано(!/your (?:Google Maps )?list|твоего списка/i.test(о), 'не «из твоего списка»');
  дано(!/сум\b|Uzum|Яндекс|Ташкент|Tashkent/i.test(о), 'без Uzum, Яндекса и Ташкента');
  дано(доля(о) < 0.05, 'по-английски');
  // 2. Лиссабон: «где поесть рядом» по-португальски
  о = await сказать(ЛИС, 'Onde posso almoçar aqui perto?');
  дано((о.match(/https:\/\/(?:www\.)?(?:maps\.google\.com|google\.com\/maps)\S+/g) || []).length >= 2, 'по-португальски — тоже места рядом');
  дано(/\b(?:para|com|você|de|um|uma|perto|aqui|peixe|frango|grelhad\w*)\b/i.test(о) && !/\b(?:the|with|and|for)\b/i.test(о.slice(0, 300)), 'ответ по-португальски');
  // 3. Ташкент: доставка по-английски → подбор доставки (Uzum/Яндекс), не общий совет
  о = await сказать(ТАШ, 'Can you get me some food brought to my place for dinner?');
  дано(/location|geolocation|address|deliver|Find nearby|Найти рядом|геолокац|доставк|📍/i.test(о) && !последний.meals?.length, 'подбор доставки начался (просит точку или ищет)');
  // 4. Ташкент: «где поесть рядом» по-узбекски → просит геолокацию
  о = await сказать(ТАШ2, "Yaqin atrofda qayerda ovqatlansam bo'ladi?");
  дано(/joylashuv|geolokats|lokatsiya|location|📍/i.test(о) && !/Find nearby|Найти рядом/.test(о), 'по-узбекски «рядом» понят — просит геолокацию');
  for (const u of [ЛИС, ТАШ, ТАШ2]) await стереть(u);
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e => { console.error(e); process.exit(1); });
