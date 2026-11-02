// Живая проверка на бою (02.11): город неизвестен — тренер спрашивает город и зачем; ответ городом продолжает
// вопрос; язык ответа = язык сообщения (yazyk). Служебные uid svc_*, ключ ~/.getfit-svc. node tg/gorod-yazyk-zhivaya.mjs
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
const сказать = async (uid, text) => { const t0 = Date.now(); const r = await З('/food', { uid, text }, uid); const о = String(r.reply || '');
  console.log('    «' + text + '» [' + Math.round((Date.now() - t0) / 1000) + ' с] → ' + о.replace(/\n+/g, ' ⏎ ').slice(0, 420)); return о; };
const НЕИЗ = 'svc_gorod_neiz', ЯЗ = 'svc_yazyk';
(async () => {
  for (const u of [НЕИЗ, ЯЗ]) await стереть(u);
  // 1. город неизвестен
  let r = await З('/place?uid=' + НЕИЗ, null, НЕИЗ);
  дано(r.ok && r.place.src === 'неизвестно', 'место неизвестно: ' + JSON.stringify(r.place || r));
  let о = await сказать(НЕИЗ, 'Going to Bon for lunch, what should I get there?');
  дано(/city|where (?:are|do) you|which town/i.test(о), 'спрашивает город');
  дано(/menu|same name|other countr|different (?:city|countr)|right place/i.test(о), 'объясняет зачем');
  дано(!/сум\b|so'm|Uzum|Яндекс|Ташкент|Tashkent/i.test(о), 'не Ташкент, без сумов и служб');
  дано(доля(о) < 0.05, 'по-английски, как спросил');
  о = await сказать(НЕИЗ, 'Lisbon');
  r = await З('/place?uid=' + НЕИЗ, null, НЕИЗ);
  дано(r.place && r.place.city === 'Лиссабон' && r.place.src === 'ручное', 'ответ городом запомнен: ' + JSON.stringify(r.place));
  дано(о.length > 20 && !/сум\b|Uzum|Ташкент|Tashkent/i.test(о), 'продолжил про Bon в Лиссабоне, не ташкентский');
  дано(доля(о) < 0.05, 'и дальше по-английски');
  // 2. язык ответа = язык сообщения
  о = await сказать(ЯЗ, 'Что мне съесть на ужин, чтобы добрать белок?');
  дано(доля(о) > 0.8, 'по-русски — ответ по-русски');
  о = await сказать(ЯЗ, 'What should I eat for dinner to get more protein?');
  дано(доля(о) < 0.05, 'по-английски — ответ по-английски');
  о = await сказать(ЯЗ, "Kechki ovqatga nima yesam bo'ladi? Oqsil kam bo'lyapti");
  дано(доля(о) < 0.05 && /\b(?:siz|sizga|uchun|bilan|kerak|yaxshi|oqsil|ovqat|gramm|bo[ʻ']?ladi)\b/i.test(о), 'по-узбекски — ответ по-узбекски');
  for (const u of [НЕИЗ, ЯЗ]) await стереть(u);
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e => { console.error(e); process.exit(1); });
