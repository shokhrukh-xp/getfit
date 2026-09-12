'use strict';
/* ЖИВЫЕ ПРОВЕРКИ ТРЕНЕРА. Запускать РУКАМИ НА МАКЕ: node tg/trener.js
   В run.sh не входит — контейнеру нужен ключ SVC_KEY, а он только на маке
   (~/.getfit-svc, значения я не вижу и не печатаю).
   Каждый сценарий живёт на своём служебном uid и стирается в конце:
   прогон на настоящем uid писал бы человеку в дневник и в чат. */
const fs = require('fs'), os = require('os');
const БАЗА = 'https://getfit-sync.sh-pulatov.workers.dev';
let КЛЮЧ = '';
try { КЛЮЧ = fs.readFileSync(os.homedir() + '/.getfit-svc', 'utf8').trim(); } catch (e) {}
if (!КЛЮЧ) { console.error('Нет ~/.getfit-svc — запусти на маке.'); process.exit(1); }

let плохо = 0, всего = 0;
const дано = (у, т) => { всего++; console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const З = (p, тело) => fetch(БАЗА + p, {
  method: тело ? 'POST' : 'GET',
  headers: Object.assign({ 'x-svc': КЛЮЧ }, тело ? { 'content-type': 'application/json' } : {}),
  body: тело ? JSON.stringify(тело) : undefined
}).then(r => r.json());

const анкета = (uid, me) => З('/s', { uid, key: 'me', data: { me } });
const стереть = uid => З('/forget', { uid, scope: 'all' });
const чат = (uid, text) => З('/food', { uid, text });

/* слова, которых у человека без зала быть не должно */
const ЗАЛ = /зал|подход|упражнен|программ|тренировк|прогресси/i;

(async () => {
  console.log('\n═══ 1 · только питание: тренер не зовёт в зал ═══');
  await анкета('svc_t_food', { sex: 'm', age: 30, ht: 178, bw: 92, only: 'food', wt: 'down', gym: 'health' });
  const о1 = await чат('svc_t_food', 'Что делать, чтобы не потерять мышцы, пока худею?');
  const r1 = String(о1.reply || '');
  console.log('    ответ:', r1.split('\n')[0].slice(0, 150));
  дано(!ЗАЛ.test(r1), 'в ответе нет зала, подходов и программы');
  дано(!(о1.changes || []).length, 'правок программы не предлагает');

  console.log('\n═══ 2 · обычный режим: зал на месте ═══');
  await анкета('svc_t_gym', { sex: 'm', age: 30, ht: 178, bw: 92, only: 'all', wt: 'down', gym: 'muscle', level: 'mid', place: 'gym' });
  const о2 = await чат('svc_t_gym', 'Что делать, чтобы не потерять мышцы, пока худею?');
  const r2 = String(о2.reply || '');
  console.log('    ответ:', r2.split('\n')[0].slice(0, 150));
  дано(ЗАЛ.test(r2), 'тому, кто ходит в зал, про нагрузку сказано');

  console.log('\n═══ 3 · белок — число из нормы, а не диапазон ═══');
  const д3 = await З('/day?uid=svc_t_gym');
  const норма = ((д3.day || {}).targets || {}).prot;
  console.log('    норма белка по серверу:', норма, 'г');
  const о3 = await чат('svc_t_gym', 'Сколько мне белка в день и почему столько?');
  const r3 = String(о3.reply || '');
  console.log('    ответ:', r3.split('\n')[0].slice(0, 180));
  дано(норма > 0 && r3.indexOf(String(норма)) >= 0, 'в ответе стоит само число нормы (' + норма + ')');
  const диап = /\d[,.]\d\s*[–—-]\s*\d[,.]\d\s*г\s*(на|\/)\s*кг/i;
  дано(!диап.test(r3), 'диапазоном «1,6–2,2 г на кг» не отвечает');

  console.log('\n═══ 4 · цель не обещает быстрее достижимого ═══');
  await анкета('svc_t_goal', { sex: 'm', age: 19, ht: 180, bw: 79 });
  const гр = await З('/goal?uid=svc_t_goal');
  const б = гр.safe || {};
  console.log('    предел:', б.max, 'кг/нед · ограничивает:', б.limit, '· пол веса:', б.floor);
  const ц4 = await З('/goal', { uid: 'svc_t_goal', wt: 'down', gym: 'health', target: 73 });
  const g4 = ц4.goal || {};
  console.log('    цель:', g4.text, '· темп', g4.rate, '· недель', g4.weeks);
  дано(Math.abs(g4.rate) <= б.max + 0.001, 'темп не быстрее достижимого (' + Math.abs(g4.rate) + ' ≤ ' + б.max + ')');
  дано(g4.weeks === Math.max(1, Math.round(g4.kg / Math.abs(g4.rate))), 'срок пересчитан под этот темп: ' + g4.weeks + ' нед');
  const д4 = await З('/day?uid=svc_t_goal');
  const t4 = (д4.day || {}).targets || {};
  const реально = Math.round((t4.tdee - t4.kcal) * 7 / 7700 * 100) / 100;
  console.log('    норма', t4.kcal, 'при поддержке', t4.tdee, '→ по факту', реально, 'кг/нед');
  дано(Math.abs(реально - Math.abs(g4.rate)) <= 0.05,
    'обещанный темп совпадает с тем, что даёт норма: ' + Math.abs(g4.rate) + ' и ' + реально);

  console.log('\n═══ 5 · цель ниже границы нормы срезается ═══');
  const ц5 = await З('/goal', { uid: 'svc_t_goal', wt: 'down', gym: 'health', target: 45 });
  console.log('    попросили 45 кг →', (ц5.goal || {}).text);
  дано(ц5['срезано'] === true, 'сервер сказал, что срезал');
  дано(ц5.target >= (б.floor || 0), 'цель не ниже границы нормы: ' + ц5.target + ' ≥ ' + б.floor);

  console.log('\n═══ 6 · итог приёма — сумма состава ═══');
  const о6 = await чат('svc_t_food', '200 г творога 5% и два варёных яйца');
  const дн = (о6.day || {}).meals || [];
  const м = дн[дн.length - 1] || {};
  /* items обязан приходить массивом с любой ручки: до 12.09 `/day` отдавал
     строку, а `/circle` — массив, и состав то показывался, то молча пустел */
  дано(Array.isArray(м.items), 'состав пришёл массивом, а не строкой: ' + (typeof м.items));
  const шт = Array.isArray(м.items) ? м.items : [];
  console.log('    состав:', шт.map(i => i.name + ' ' + i.g + ' г').join(', ') || 'пусто');
  дано(шт.length >= 2, 'состав разложен по продуктам: ' + шт.length);
  const сум = Math.round(шт.reduce((a, i) => a + (+i.kcal || 0), 0));
  дано(Math.abs(сум - Math.round(+м.kcal || 0)) <= 2,
    'итог равен сумме состава: ' + м.kcal + ' и ' + сум);

  for (const u of ['svc_t_food', 'svc_t_gym', 'svc_t_goal']) await стереть(u);
  console.log('\nслужебные стёрты');
  console.log(плохо ? ('\nПРОВАЛОВ: ' + плохо + ' из ' + всего) : ('\nВСЕ ' + всего + ' ПРОВЕРОК ПРОЙДЕНЫ'));
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
