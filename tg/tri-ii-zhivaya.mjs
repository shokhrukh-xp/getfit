// Живая проверка на бою (02.11): три ИИ страхуют друг друга. /coach с полем _tri:1 (только svc_*) ключи OpenAI и Claude
// подменяются нерабочими — должен ответить Gemini. Служебные uid svc_*, ключ ~/.getfit-svc. node tg/tri-ii-zhivaya.mjs
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
const U = 'svc_tri';
(async () => {
  await стереть(U);
  let t0 = Date.now(), r = await З('/coach', { uid: U, text: 'Съел 2 яйца и 150 г творога на завтрак', _tri: 1 }, U);
  console.log('    [' + Math.round((Date.now() - t0) / 1000) + ' с] ' + String(r.reply || JSON.stringify(r)).replace(/\n+/g, ' ⏎ ').slice(0, 300));
  /* какая модель ответила, ответ /coach не говорит — смотри журнал сервера: «[svc-test] svc_tri ai_резерв … ответил Gemini» */
  дано(String(r.reply || '').length > 20, 'OpenAI и Claude «легли» — тренер всё равно ответил (Gemini)');
  дано((r.meals || []).length >= 1, 'и записал еду (' + (r.meals || []).length + ')');
  t0 = Date.now(); r = await З('/coach', { uid: U, text: 'Что мне съесть на обед?' }, U);
  console.log('    [' + Math.round((Date.now() - t0) / 1000) + ' с] ' + String(r.reply || '').replace(/\n+/g, ' ⏎ ').slice(0, 200));
  дано(String(r.reply || '').length > 20, 'без _tri — ответ как обычно');
  await стереть(U);
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e => { console.error(e); process.exit(1); });
