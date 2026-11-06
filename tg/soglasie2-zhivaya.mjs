// Живая проверка на бою (07.11): soglasie2 — согласия во всех каналах. Служебный svc_sg2, стирается в начале и в конце.
// Без согласий: окно просит оба, запись еды — 403 zd_net, тренер — без ИИ. После «Согласен» — всё работает; отзыв — снова 403.
// Ключ ~/.getfit-svc — только в заголовке x-svc. node tg/soglasie2-zhivaya.mjs
import fs from 'node:fs'; import os from 'node:os';
const БАЗА = 'https://api.wellbol.com', КЛЮЧ = fs.readFileSync(os.homedir() + '/.getfit-svc', 'utf8').trim();
const ЭП = {};
async function З(p, тело, uid){
  if (uid && ЭП[uid] == null) { const s = await fetch(БАЗА + '/session?uid=' + uid, { headers: { 'x-svc': КЛЮЧ } }).then(r => r.json()).catch(() => ({})); ЭП[uid] = (s.session && s.session.epoch) || 0; }
  const r = await fetch(БАЗА + p, { method: тело ? 'POST' : 'GET', headers: Object.assign({ 'x-svc': КЛЮЧ, 'x-data-epoch': String(ЭП[uid] || 0) }, тело ? { 'content-type': 'application/json' } : {}), body: тело ? JSON.stringify(тело) : undefined });
  const j = await r.json().catch(() => ({})); j.__st = r.status; if (uid && j && j.session && j.session.epoch != null) ЭП[uid] = j.session.epoch; return j;
}
let плохо = 0; const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const стереть = async uid => { const r = await З('/forget', { uid, scope: 'all', operation: 'svc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) }, uid); delete ЭП[uid]; return r; };
const U = 'svc_sg2';
(async () => {
  await стереть(U);
  const сегодня = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' });
  let s = await З('/ii-soglasie?uid=' + U, null, U);
  дано(s.s2 === 1 && s.nado === true && !s.zdYes && !s.yes, 'новичок (после стирания): оба согласия пусты ' + JSON.stringify(s).slice(0, 140));
  let r = await З('/meal/add', { uid: U, date: сегодня, text: '2 яйца', items: [{ name: 'Яйцо', kcal: 150 }] }, U);
  дано(r.__st === 403 && r.code === 'zd_net', 'еда без согласия на здоровье — 403 zd_net (' + r.__st + ' ' + (r.code || '') + ')');
  r = await З('/coach', { uid: U, text: 'Привет' }, U);
  дано(!/яйц/i.test(JSON.stringify(r)) && r.__st < 500, 'тренер без согласий не зовёт ИИ (' + r.__st + ' ' + String(r.reply || r.code || r.error || '').slice(0, 80) + ')');
  r = await З('/ii-soglasie', { uid: U, kind: 'zd', yes: true }, U);
  дано(r.__st === 200, 'согласие на здоровье записано');
  r = await З('/ii-soglasie', { uid: U, kind: 'ai', yes: true }, U);
  дано(r.__st === 200, 'согласие на ИИ записано');
  s = await З('/ii-soglasie?uid=' + U, null, U);
  дано(s.zdYes && s.yes === true, 'после обоих «Согласен» оба отмечены (окно не покажется) ' + JSON.stringify(s).slice(0, 140));
  r = await З('/coach', { uid: U, text: 'Съел 2 яйца на завтрак' }, U);
  дано(r.__st === 200 && (r.reply || r.text), 'тренер отвечает: ' + String(r.reply || r.text || '').slice(0, 90).replace(/\n/g, ' '));
  const д = await З('/day?uid=' + U + '&date=' + сегодня, null, U);
  дано(((д.day && д.day.meals) || []).length >= 1, 'еда в дневнике (' + ((д.day && д.day.meals) || []).length + ')');
  r = await З('/ii-soglasie', { uid: U, kind: 'zd', yes: false }, U);
  r = await З('/meal/add', { uid: U, date: сегодня, text: 'банан', items: [{ name: 'Банан', kcal: 100 }] }, U);
  дано(r.__st === 403 && r.code === 'zd_net', 'отозвал согласие — запись снова закрыта (' + r.__st + ')');
  const ст = await стереть(U);
  дано(ст.ok, 'svc_sg2 стёрт');
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e => { console.error(e); process.exit(1); });
