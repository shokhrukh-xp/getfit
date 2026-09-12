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

  console.log('\n═══ 7 · недельный разбор без зала ═══');
  /* Разбор уходит человеку в понедельник в 09:00 сам. Ветка «только питание»
     в нём написана 11.09 и до сих пор ни разу не выполнялась ни на ком —
     поэтому гоняем её здесь, на служебном uid, а не в чате у человека. */
  const дн0 = д => new Date(Date.now() - д * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' });
  const вчера = дн0(1);
  await анкета('svc_t_rev', { sex: 'm', age: 34, ht: 176, bw: 88, only: 'food', wt: 'down', gym: 'health' });
  await З('/measure', { uid: 'svc_t_rev', date: дн0(7), w: 88.6 });
  await З('/measure', { uid: 'svc_t_rev', date: вчера, w: 88 });
  for (let i = 7; i >= 1; i--) {
    await З('/meal/add', { uid: 'svc_t_rev', date: дн0(i), kind: 'обед', text: 'курица с гречкой и салат',
      kcal: 700, prot: 55, fat: 18, carb: 75, fib: 8, sug: 6 });
    await З('/meal/add', { uid: 'svc_t_rev', date: дн0(i), kind: 'ужин', text: 'творог и яблоко',
      kcal: 1150, prot: 70, fat: 30, carb: 120, fib: 10, sug: 30 });
  }
  const о7 = await З('/review?uid=svc_t_rev&end=' + вчера);
  дано(о7.ok === true, 'разбор собрался без ошибки' +
    (о7.ok ? '' : ': ' + о7.error + ' | ' + String(о7.stack || '').split('\n')[0]));
  const к7 = String(о7.ctx || ''), r7 = String(о7.reply || '');
  /* в контексте модели не должно быть строк зала — иначе она разбирает пустоту */
  дано(!/\nЗал: /.test('\n' + к7), 'в контексте нет строки «Зал: …»');
  дано(!/Прогрессия|Объём по мышцам|Режим правок|Аудит упражнений/.test(к7),
    'в контексте нет прогрессии, объёма и аудита программы');
  дано(/Еда: /.test(к7), 'еда за неделю в контексте есть');
  console.log('    ответ:', r7.split('\n')[0].slice(0, 180));
  дано(!ЗАЛ.test(r7), 'в разборе нет зала, подходов и программы');
  дано(!(о7.changes || []).length, 'правок программы не предлагает: ' + (о7.changes || []).length);
  дано(о7.deload !== true, 'лёгкую неделю без единой тренировки не назначает');
  /* число из контекста должно стоять в ответе: «около двух тысяч» — не разбор */
  const ср = (к7.match(/Среднее (\d+) ккал/) || [])[1];
  console.log('    среднее за неделю по данным:', ср, 'ккал');
  дано(!!ср && r7.indexOf(ср) >= 0, 'в разборе стоит само среднее (' + ср + ')');

  console.log('\n═══ 8 · личная поправка нормы: обе цифры в одних условиях ═══');
  /* На этой неделе у человека впервые набирается сверка дневника с весами, и
     разбор сам, без кнопки, меняет норму еды. Проверяем не формулировку, а
     то, что названное в разборе число совпадает с нормой, которую потом
     покажет приложение, а «вместо» — с той, что была до разбора. */
  await анкета('svc_t_cal', { sex: 'm', age: 34, ht: 176, bw: 88, only: 'food', wt: 'down', gym: 'health' });
  for (const i of [21, 18, 15, 12, 9, 6, 3, 1])
    await З('/measure', { uid: 'svc_t_cal', date: дн0(i), w: Math.round((88 + (i - 1) * 0.075) * 10) / 10 });
  for (let i = 21; i >= 1; i--)
    await З('/meal/add', { uid: 'svc_t_cal', date: дн0(i), kind: 'обед', text: 'день целиком',
      kcal: 2200, prot: 150, fat: 70, carb: 220, fib: 25, sug: 40 });
  const было = (((await З('/day?uid=svc_t_cal')).day || {}).targets || {}).kcal;
  const о8 = await З('/review?uid=svc_t_cal&end=' + вчера);
  дано(о8.ok === true, 'разбор со сверкой собрался' +
    (о8.ok ? '' : ': ' + о8.error + ' | ' + String(о8.stack || '').split('\n')[0]));
  const к8 = String(о8.ctx || ''), r8 = String(о8.reply || '');
  дано(/Сверка дневника с весами/.test(к8), 'сверка попала в контекст разбора');
  const стало = (((await З('/day?uid=svc_t_cal')).day || {}).targets || {}).kcal;
  console.log('    норма до разбора:', было, '→ после:', стало);
  дано(стало !== было, 'поправка применилась: норма изменилась');
  дано(r8.indexOf(String(стало)) >= 0, 'новая норма (' + стало + ') названа в разборе');
  const м8 = r8.match(/Норма еды с этой недели — (\d+) ккал в день без нагрузки вместо (\d+)/);
  if (м8) {
    console.log('    в разборе:', м8[1], 'вместо', м8[2]);
    дано(+м8[1] === стало, 'названное число равно норме приложения: ' + м8[1] + ' и ' + стало);
    дано(+м8[2] === было, 'вместо чего — та норма, что была: ' + м8[2] + ' и ' + было);
  } else дано(true, 'объяснение нормы модель написала своими словами');
  const ст8 = ((await З('/all?uid=svc_t_cal')).state || []).filter(x => x.key === 'kcal_adj')[0];
  const ка = (ст8 || {}).data || {};
  console.log('    поправка: применено', ка.k, '· по сверке вышло', ка.kraw);
  дано(ка.k > 0 && Math.abs(ка.k - 1) <= 0.1001, 'за неделю норма двинулась не больше чем на 10 %: k = ' + ка.k);
  дано(ка.kraw != null, 'полная поправка сохранена для следующих разборов: ' + ка.kraw);
  дано(Math.abs(ка.k - 1) < Math.abs((ка.kraw || 1) - 1) + 0.0001, 'шаг не перепрыгнул саму сверку');

  console.log('\n═══ 9 · разбор с залом: прогрессия и пропуски ═══');
  /* Тот же понедельничный разбор, но у человека есть программа и занятия.
     Проверяем ровно то, что 12.09 врало вживую: имя упражнения из истории
     должно сходиться с программой по id, а «пропущено» — быть правдой. */
  await анкета('svc_t_zal', { sex: 'm', age: 30, ht: 180, bw: 84, only: 'all', wt: 'down', gym: 'muscle',
    level: 'mid', place: 'gym', min: 50 });
  const прог = { name: 'Проверочная', note: '', days: [
    { s: 'День 1', sub: 'ноги', ex: [
      { id: 'Barbell_Squat', n: 'Присед', sets: 3, reps: '8–10', rest: 120 },
      { id: 'Leg_Press', n: 'Жим ногами', sets: 3, reps: '10–12', rest: 90 },
      { id: 'Standing_Calf_Raises', n: 'Носки', sets: 3, reps: '12–15', rest: 60 } ] },
    { s: 'День 2', sub: 'спина', ex: [
      { id: 'Pullups', n: 'Подтягивания', sets: 3, reps: '6–10', rest: 120 },
      { id: 'Bent_Over_Barbell_Row', n: 'Тяга', sets: 3, reps: '8–10', rest: 90 },
      { id: 'Face_Pull', n: 'К лицу', sets: 3, reps: '12–15', rest: 60 } ] } ] };
  await З('/s', { uid: 'svc_t_zal', key: 'aiprog', data: прог });
  await З('/measure', { uid: 'svc_t_zal', date: дн0(7), w: 84.6 });
  await З('/measure', { uid: 'svc_t_zal', date: вчера, w: 84 });
  const зан = (д, day, sub, ex) => З('/w', { uid: 'svc_t_zal', id: дн0(д) + '_' + day, date: дн0(д),
    day, name: day, sub, data: { date: дн0(д), day, sub, dur: 50, ex } });
  /* первое занятие ног — со СТАРЫМИ именами и без id, как записи до 12.09 */
  await зан(5, 'A1', 'ноги', [
    { n: 'Приседания со штангой', unit: 'reps', sets: [{ w: 60, r: 10 }, { w: 60, r: 10 }] },
    { n: 'Жим ногами в тренажёре', unit: 'reps', sets: [{ w: 80, r: 12 }] },
    { n: 'Подъёмы на носки стоя', unit: 'reps', sets: [{ w: 30, r: 15 }] } ]);
  /* второе — с id, как пишет приложение с 12.09 */
  await зан(2, 'A1', 'ноги', [
    { n: 'Присед (штанга, классический)', id: 'Barbell_Squat', unit: 'reps', sets: [{ w: 65, r: 10 }, { w: 65, r: 9 }] },
    { n: 'Жим ногами (тренажёр, обычный)', id: 'Leg_Press', unit: 'reps', sets: [{ w: 90, r: 12 }] },
    { n: 'Подъём на носки (тренажёр, стоя)', id: 'Standing_Calf_Raises', unit: 'reps', sets: [{ w: 35, r: 15 }] } ]);
  for (let i = 6; i >= 1; i--)
    await З('/meal/add', { uid: 'svc_t_zal', date: дн0(i), kind: 'день', text: 'еда за день',
      kcal: 2100, prot: 160, fat: 65, carb: 200, fib: 25, sug: 35 });
  const о9 = await З('/review?uid=svc_t_zal&end=' + вчера);
  дано(о9.ok === true, 'разбор с залом собрался' +
    (о9.ok ? '' : ': ' + о9.error + ' | ' + String(о9.stack || '').split('\n')[0]));
  const к9 = String(о9.ctx || ''), r9 = String(о9.reply || '');
  дано(/Зал: сделано 2/.test(к9), 'оба занятия попали в разбор');
  /* старое имя и новое — одно упражнение: иначе прогрессии нет и «первый раз» */
  const пр = (к9.match(/Прогрессия[^]*?\n(?=Веса падали)/) || [''])[0];
  console.log('   ', пр.trim().split('\n').slice(1, 4).join(' · '));
  дано(/\(было 60×10\)/.test(пр), 'присед сравнился со старой записью: 65×10 (было 60×10)');
  дано(!/Присед[^\n]*первый раз/.test(пр), 'присед не назван «первым разом»');
  дано((пр.match(/\n/g) || []).length <= 4, 'упражнения не задвоились под двумя именами');
  const ауд = (к9.match(/Аудит упражнений[^]*/) || [''])[0];
  дано(!/День 1 · Присед[^\n]*пропущено/.test(ауд), 'сделанный присед не записан в пропуски');
  дано(/День 2 · Подтягивания[^\n]*мало данных/.test(ауд), 'несделанный день 2 честно без данных');
  console.log('    ответ:', r9.split('\n')[0].slice(0, 160));
  дано(ЗАЛ.test(r9), 'в разборе есть зал');

  for (const u of ['svc_t_food', 'svc_t_gym', 'svc_t_goal', 'svc_t_rev', 'svc_t_cal', 'svc_t_zal']) await стереть(u);
  console.log('\nслужебные стёрты');
  console.log(плохо ? ('\nПРОВАЛОВ: ' + плохо + ' из ' + всего) : ('\nВСЕ ' + всего + ' ПРОВЕРОК ПРОЙДЕНЫ'));
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
