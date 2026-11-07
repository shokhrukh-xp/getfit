// 07.11: живая проверка ссылки-приглашения своего специалиста (svc_pinv, стирается в конце). node tg/priglashenie-zhivaya.mjs
import fs from 'node:fs'; import os from 'node:os';
const БАЗА = 'https://api.wellbol.com', КЛЮЧ = fs.readFileSync(os.homedir() + '/.getfit-svc', 'utf8').trim(), U = 'svc_pinv';
const З = (p, тело) => fetch(БАЗА + p, { method: тело ? 'POST' : 'GET', headers: Object.assign({ 'x-svc': КЛЮЧ }, тело ? { 'content-type': 'application/json' } : {}), body: тело ? JSON.stringify(тело) : undefined }).then(async r => Object.assign(await r.json().catch(() => ({})), { __st: r.status }));
let плохо = 0; const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const r = await З('/roli/invite', { uid: U, kind: 'trainer' });
дано(r.ok && /^https:\/\/t\.me\/WellbolBot\?start=pi_[a-z0-9]{8}$/.test(r.link), 'ссылка: ' + (r.link || r.error || r.__st));
дано(/зовёт вас в Wellböl/.test(r.text || ''), 'текст для специалиста: ' + String(r.text || '').slice(0, 90));
const r2 = await З('/roli/invite', { uid: U, kind: 'trainer' }); дано(r2.code === r.code, 'повтор — та же ссылка');
const к = await З('/roli/katalog?uid=' + U); дано(к.ok === true, 'каталог отвечает (' + ((к.list || []).length) + ' в каталоге)');
const s = await fetch(БАЗА + '/session?uid=' + U, { headers: { 'x-svc': КЛЮЧ } }).then(r => r.json()).catch(() => ({}));
const ст = await fetch(БАЗА + '/forget', { method: 'POST', headers: { 'x-svc': КЛЮЧ, 'x-data-epoch': String((s.session && s.session.epoch) || 0), 'content-type': 'application/json' }, body: JSON.stringify({ uid: U, scope: 'all', operation: 'svc-' + Date.now() }) }).then(r => r.json()).catch(() => ({}));
дано(ст.ok, 'svc_pinv стёрт');
console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
