'use strict';
/* Самочувствие и боль в разговоре с тренером (25.09, остаток этапа 3; его
   выбор — всё внутри чата). Заперто:
   • в день зала тренер спрашивает сам: запрос раз в день, точка на кнопке,
     в разговоре пять кнопок; не день зала — не спрашивает;
   • кнопки живые только у последней реплики и только сегодня;
   • «Плохо спал» → «Облегчить сегодня» → на подход меньше в каждом
     упражнении (кроме упражнений на время), строка над днём, пометка в
     записи тренировки; «Вернуть как было» — всё назад и сервер знает;
   • боль 6–10 → «Выбрать упражнение» → список дня → отметка «Мешает
     суставу» и замена на ту же мышцу, сервер получает что на что;
   • кнопка «Отметить и заменить» с упражнением из слов делает то же сразу. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const T = M.TODAY, ВЧЕРА = M.Д(1);
const ВСЕ_ДНИ = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
const ВОПРОС = { ts: Date.now(), role: 'assistant', text: 'Сегодня зал. Как ты? Отметь одной кнопкой — если что-то не так, подстрою тренировку под сегодня. Можно и не отвечать.',
  act: [['отл', 'Отлично'], ['норм', 'Нормально'], ['сон', 'Плохо спал'], ['устал', 'Устал'], ['боль', 'Что-то болит']].map(([v, t]) => ({ k: 'wb', v, t, d: T })) };
const БОЛЬ = [['0-2', '0–2, чуть'], ['3-5', '3–5, терпимо'], ['6-10', '6–10, сильно'], ['red', 'Острая, отёк или онемение']].map(([v, t]) => ({ k: 'pain', v, t, d: T }));
function ответ(b){
  const ts = Date.now();
  if (b.k === 'wb' && b.v === 'сон') return { ok: true, ts, user: 'Плохо спал', reply: 'После плохой ночи результат в зале в среднем ниже на 7–8%. Можно облегчить сегодня.', act: [{ k: 'easy', t: 'Облегчить сегодня', d: T }] };
  if (b.k === 'wb' && b.v === 'боль') return { ok: true, ts, user: 'Что-то болит', reply: 'Насколько сильно — от 0 до 10?', act: БОЛЬ };
  if (b.k === 'easy') return { ok: true, ts, user: 'Облегчить сегодня', reply: 'Готово: сегодня в каждом упражнении на подход меньше.', act: [] };
  if (b.k === 'pain' && b.v === '6-10') return { ok: true, ts, user: 'Боль: 6–10, сильно', reply: 'Это выше 5 из 10 — через такую боль не тренируют.', act: [{ k: 'pick', t: 'Выбрать упражнение', d: T }] };
  if (b.k === 'swap') return { ok: true, ts, user: 'Мешает суставу: «' + b.ex + '»', reply: 'Отметил «' + b.ex + '»: мешает суставу. Вместо него — «' + b.to + '».', act: [] };
  return { ok: true, ts, user: b.k, reply: 'Понял.', act: [] };
}
const расписание = page => page.addInitScript(д => { try { localStorage.setItem('shp_v1_shp_sched', JSON.stringify(д)); } catch (e) {} }, ВСЕ_ДНИ);
const кнопки = page => page.$$eval('#chatlog .chatacts button', ns => ns.map(n => n.textContent.trim() + (n.disabled ? '[x]' : '')));
async function нажать(page, текст){
  const b = await page.$$('#chatlog .chatacts button');
  for (const x of b) if ((await x.textContent()).trim() === текст) { await x.click(); await page.waitForTimeout(500); return true; }
  return false;
}
(async () => {
  const br = await chromium.launch();
  /* ── 1. вопрос в день зала, «Плохо спал» → «Облегчить сегодня» ── */
  let page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await расписание(page);
  const o = { theme: 'dark', wait: 2400, time: '09:10', chat: [], onAsk: () => ({ ok: true, pushed: true, turn: ВОПРОС }), onAct: ответ };
  const ош = await M.поднять(page, o);
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  дано((o.спрошено || []).length === 1 && o.спрошено[0].date === T, 'в день зала тренер спросил сам — один запрос за сегодня');
  дано(await page.$eval('#coachfab', n => n.classList.contains('attn')), 'на кнопке тренера точка — пришло новое');
  o.chat = [ВОПРОС];
  await page.click('#coachfab'); await page.waitForTimeout(700);
  дано((await кнопки(page)).join(' · ') === 'Отлично · Нормально · Плохо спал · Устал · Что-то болит', 'в разговоре пять кнопок: ' + (await кнопки(page)).join(' · '));
  const высоты = await page.$$eval('#chatlog .chatacts button', ns => ns.map(n => n.getBoundingClientRect().height));
  дано(высоты.every(h => h >= 44), 'кнопки не меньше 44 точек');
  const ширина = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  дано(ширина, 'кнопки не распирают экран вбок');
  await нажать(page, 'Плохо спал');
  дано(o.нажато && o.нажато[0].k === 'wb' && o.нажато[0].v === 'сон' && o.нажато[0].date === T, 'нажатие ушло на сервер: самочувствие «сон»');
  const лента = await page.$$eval('#chatlog .msg.me', ns => ns.map(n => n.textContent));
  дано(лента[лента.length - 1] === 'Плохо спал', 'в ленте реплика человека — «Плохо спал»');
  дано((await кнопки(page)).join(' · ') === 'Облегчить сегодня', 'старые кнопки ушли, под ответом — «Облегчить сегодня»');
  const строки = () => page.$$eval('#list .exrow', ns => ns.map(n => {
    const b = n.querySelector('.exrn b'), i = n.querySelector('.exrn i'), u = n.querySelector('.exrv u');
    return { n: b.childNodes[b.childNodes.length - 1].textContent.trim(), план: +(/^(\d+)/.exec(i.textContent) || [0, 0])[1],
      таблица: +(/из (\d+)/.exec(u.textContent) || [0, 0])[1], время: /\sс$/.test(i.textContent.trim()) };
  }));
  const было = await строки();
  дано(было.length >= 3, 'в зале видно упражнения дня: ' + было.length);
  await нажать(page, 'Облегчить сегодня');
  дано(o.нажато[1].k === 'easy', 'облегчение ушло на сервер');
  дано(await page.evaluate(t => localStorage.getItem('shp_v1_shp_easy') === JSON.stringify(t), T), 'облегчение записано на сегодня');
  дано((await кнопки(page)).join(' · ') === '', 'после нажатия кнопка ушла вместе с репликой');
  const стало = await строки();
  const ждём = было.map(x => x.время ? x.план : Math.max(1, x.план - 1));
  дано(стало.map(x => x.план).join(',') === ждём.join(',') && было.some(x => !x.время && x.план > 1),
    'на подход меньше в каждом упражнении, кроме упражнений на время: ' + было.map(x => x.план).join(',') + ' → ' + стало.map(x => x.план).join(','));
  дано(стало.every(x => x.таблица === x.план), 'таблица подходов пересобрана: ' + стало.map(x => x.таблица).join(','));
  await page.click('#coachclose'); await page.waitForTimeout(300);
  await page.click('[data-hgo="gym"]').catch(() => {}); await page.waitForTimeout(700);
  const строка = await page.$eval('#phaseline', n => n.textContent);
  дано(/Облегчено на сегодня/.test(строка) && /на подход меньше/.test(строка) && /3–4 повтора/.test(строка) && /Программа прежняя/.test(строка), 'над днём строка: ' + строка.slice(0, 80));
  const назад = await page.$('#easyoff');
  const рамка = назад && await назад.boundingBox();
  дано(!!рамка && рамка.height >= 44, 'кнопка «Вернуть как было» видна и не мельче 44 точек');
  if (назад) { await назад.click(); await page.waitForTimeout(500); }
  const вернулось = await строки();
  дано(вернулось.map(x => x.план).join(',') === было.map(x => x.план).join(','), 'всё назад: ' + вернулось.map(x => x.план).join(','));
  дано(o.нажато[o.нажато.length - 1].k === 'easyoff', 'и сервер узнал об отмене');
  дано(!/Облегчено/.test(await page.$eval('#phaseline', n => n.textContent)), 'строки облегчения больше нет');
  /* повторный запуск в тот же день — не спрашивает */
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
  дано(o.спрошено.length === 1, 'в тот же день второй раз не спрашивает');
  await page.close();

  /* ── 2. боль 6–10 → выбрать упражнение → отметка и замена ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await расписание(page);
  const о2 = { theme: 'dark', wait: 2400, time: '09:10', chat: [ВОПРОС], onAct: ответ };
  await M.поднять(page, о2);
  const дня = (await page.$$eval('#list .exrow .exrn b', ns => ns.map(b => b.childNodes[b.childNodes.length - 1].textContent.trim())));
  await page.click('#coachfab'); await page.waitForTimeout(700);
  await нажать(page, 'Что-то болит');
  дано((await кнопки(page)).join(' · ') === '0–2, чуть · 3–5, терпимо · 6–10, сильно · Острая, отёк или онемение', 'шкала боли кнопками');
  дано(await page.$$eval('#chatlog .chatacts button.warn', ns => ns.length === 1 && /Острая/.test(ns[0].textContent)), '«Острая, отёк» выделена предупреждением');
  await нажать(page, '6–10, сильно');
  дано(о2.нажато[1].k === 'pain' && о2.нажато[1].v === '6-10', 'сила боли ушла на сервер');
  await нажать(page, 'Выбрать упражнение');
  const список = await page.$$eval('#chatlog .chatacts.pick button', ns => ns.map(n => n.textContent.trim()));
  дано(список.length >= 3 && дня.every(n => список.indexOf(n) >= 0), 'список — упражнения сегодняшнего дня (' + список.length + ')');
  const цель = список.filter(n => дня.indexOf(n) >= 0)[0];
  await нажать(page, цель); await page.waitForTimeout(900);
  const посл = о2.нажато[о2.нажато.length - 1];
  дано(посл.k === 'swap' && посл.ex === цель && !!посл.to && посл.to !== цель, 'сервер получил что на что: «' + посл.ex + '» → «' + посл.to + '»');
  const отмечено = await page.evaluate(n => { const h = JSON.parse(localStorage.getItem('shp_v1_hurt') || '{}'); return !!(h[n] && h[n].last); }, цель);
  дано(отмечено, 'упражнение отмечено «Мешает суставу» — та же отметка, что под 👎');
  const теперь = await page.$$eval('#list .exrow .exrn b', ns => ns.map(b => b.childNodes[b.childNodes.length - 1].textContent.trim()));
  дано(теперь.indexOf(посл.to) >= 0 && теперь.indexOf(цель) < 0, 'в зале на его месте теперь «' + посл.to + '»');
  const мышцы = await page.evaluate(async ([a, b]) => { const j = await (await fetch('catalog.json')).json();
    const м = n => ((j.ex || []).filter(x => x.n === n)[0] || {}).m || null; return [м(a), м(b)]; }, [цель, посл.to]);
  дано(!!мышцы[1] && (мышцы[0] == null || мышцы[0] === мышцы[1]), 'замена из каталога, на ту же мышцу: ' + мышцы.join(' / '));
  const уровень = await page.evaluate(async n => { const j = await (await fetch('catalog.json')).json(); return ((j.ex || []).filter(x => x.n === n)[0] || {}).l; }, посл.to);
  дано(уровень !== 'expert', 'при боли — не «экспертное» по технике: уровень «' + уровень + '»');
  const сн2 = await page.evaluate(async n => { const j = await (await fetch('catalog.json')).json(); return ((j.ex || []).filter(x => x.n === n)[0] || {}).q; }, посл.to);
  дано(сн2 === 'machine' || сн2 === 'cable', 'на больное — сначала тренажёр или блок: ' + сн2);
  const нет = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('shp_v1_shp_nope') || '{}')).length);
  дано(нет === 0, 'в «не нравится» не записано — упражнение болит, а не разонравилось');
  await page.close();

  /* ── 3. «Отметить и заменить» из слов; кнопки только у последней реплики и только сегодня ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const о3 = { theme: 'dark', wait: 2400, time: '09:10', chat: [], onAct: ответ };
  await M.поднять(page, о3);
  const второе = (await page.$$eval('#list .exrow', ns => ns.filter(n => !/\sс$/.test(n.querySelector('.exrn i').textContent.trim()))
    .map(n => { const b = n.querySelector('.exrn b'); return b.childNodes[b.childNodes.length - 1].textContent.trim(); })))[1];
  о3.chat = [{ ts: 1, role: 'assistant', text: 'Это выше 5.', act: [{ k: 'hurt', ex: второе, t: 'Отметить и заменить', d: T }] }];
  await page.click('#coachfab'); await page.waitForTimeout(700);
  await нажать(page, 'Отметить и заменить'); await page.waitForTimeout(700);
  const п3 = (о3.нажато || [])[0] || {};
  дано(п3.k === 'swap' && п3.ex === второе && !!п3.to, 'кнопка из слов: отметил и заменил «' + второе + '» → «' + п3.to + '»');
  const [ур3, сн3] = await page.evaluate(async n => { const j = await (await fetch('catalog.json')).json(); const x = (j.ex || []).filter(x => x.n === n)[0] || {}; return [x.l, x.q]; }, п3.to);
  дано(ур3 !== 'expert', 'взрывное «экспертное» на больной сустав не ставится: «' + п3.to + '», ' + ур3);
  дано(['dumbbell', 'machine', 'cable', 'barbell'].indexOf(сн3) >= 0, 'снаряд из тех, что в зале есть, а не резинка: ' + сн3);
  await page.close();
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const о4 = { theme: 'dark', wait: 2400, time: '09:10', chat: [
    { ts: 1, role: 'assistant', text: 'Вчерашнее.', act: [{ k: 'easy', t: 'Облегчить сегодня', d: ВЧЕРА }] }] };
  await M.поднять(page, о4);
  await page.click('#coachfab'); await page.waitForTimeout(700);
  дано((await кнопки(page)).length === 0, 'вчерашняя кнопка «Облегчить сегодня» не показана');
  await page.click('#coachclose'); await page.waitForTimeout(300);
  о4.chat = [{ ts: 1, role: 'assistant', text: 'Как ты?', act: [{ k: 'wb', v: 'отл', t: 'Отлично', d: T }] }, { ts: 2, role: 'user', text: 'а что с белком?' }];
  await page.click('#coachfab'); await page.waitForTimeout(700);
  дано((await кнопки(page)).length === 0, 'после вопроса человека прежние кнопки не висят');
  await page.close();

  /* ── 4. не день зала — не спрашивает ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const нетЗала = {}; const wd = new Date(T + 'T12:00:00').getDay(); for (let i = 0; i < 7; i++) if (i !== wd) нетЗала[i] = 1;
  await page.addInitScript(д => { try { localStorage.setItem('shp_v1_shp_sched', JSON.stringify(д)); } catch (e) {} }, нетЗала);
  const о5 = { theme: 'dark', wait: 2400, time: '09:10', onAsk: () => ({ ok: true, pushed: true, turn: ВОПРОС }) };
  await M.поднять(page, о5);
  дано(!(о5.спрошено || []).length, 'в день отдыха тренер не спрашивает');
  await page.close();
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
