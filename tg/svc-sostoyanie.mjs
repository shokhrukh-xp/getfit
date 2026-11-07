// 07.11: что лежит на сервере у служебного uid (только svc_*): согласия, анкета, цель. node tg/svc-sostoyanie.mjs svc_nov_uz
import fs from 'node:fs'; import os from 'node:os';
const БАЗА = 'https://api.wellbol.com', КЛЮЧ = fs.readFileSync(os.homedir() + '/.getfit-svc', 'utf8').trim();
const U = process.argv[2] || 'svc_nov_uz'; if (!/^svc_/.test(U)) { console.log('только svc_*'); process.exit(1); }
const g = p => fetch(БАЗА + p, { headers: { 'x-svc': КЛЮЧ } }).then(r => r.json()).catch(e => ({ e: e.message }));
const s = await g('/ii-soglasie?uid=' + U);
console.log('согласия: ии', s.yes, 'здоровье', s.zdYes);
const ses = await g('/session?uid=' + U); console.log('сессия', JSON.stringify(ses.session || ses).slice(0, 200));
const me = await g('/g?uid=' + U + '&key=me'); console.log('me', JSON.stringify(me).slice(0, 300));
