// Живая проверка на бою (02.11): человек сам удаляет аккаунт (udalit). Служебный svc_udalit: записать еду и вес,
// без слова «удалить» — отказ, со словом — дневник пуст. Ключ ~/.getfit-svc. node tg/udalit-zhivaya.mjs
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
const U = 'svc_udalit';
(async () => {
  await стереть(U);
  const сегодня = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' });
  let r = await З('/coach', { uid: U, text: 'Съел 2 яйца на завтрак' }, U);
  let д = await З('/day?uid=' + U + '&date=' + сегодня, null, U);
  const было = ((д.day && д.day.meals) || []).length;
  дано(было >= 1, 'перед удалением в дневнике есть еда (' + было + ')');
  r = await З('/account/delete', { uid: U, confirm: 'да' }, U);
  дано(r.code === 'confirm', 'без слова «удалить» — отказ');
  r = await З('/account/delete', { uid: U, confirm: 'удалить' }, U);
  дано(r.ok === true, 'со словом «удалить» — удалено ' + JSON.stringify(r).slice(0, 120));
  delete ЭП[U];
  д = await З('/day?uid=' + U + '&date=' + сегодня, null, U);
  дано(((д.day && д.day.meals) || []).length === 0, 'после удаления дневник пуст');
  r = await З('/account/delete', { uid: '308687648', confirm: 'удалить' }, U);
  дано(!r.ok, 'чужой аккаунт так не удалить (' + (r.code || r.error || r.status) + ')');
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e => { console.error(e); process.exit(1); });
