'use strict';
/* Снимки самочувствия и боли в разговоре (25.09, этап 3): вопрос в день
   зала, «Плохо спал» → «Облегчить сегодня», зал с облегчением, боль 6–10 →
   выбор упражнения. Запуск: sh tg/srv.sh && node tg/shot-samochuvstvie.js */
const { chromium } = require('playwright');
const M = require('./mock');
const тема = process.argv[2] || 'light';
const T = M.TODAY;
const снять = (page, имя) => page.screenshot({ path: `tg/samo-${тема}-${имя}.png` }).then(() => console.log('снято', имя));
const ВОПРОС = { ts: Date.now(), role: 'assistant', text: 'Сегодня зал. Как ты? Отметь одной кнопкой — если что-то не так, подстрою тренировку под сегодня. Можно и не отвечать.',
  act: [['отл', 'Отлично'], ['норм', 'Нормально'], ['сон', 'Плохо спал'], ['устал', 'Устал'], ['боль', 'Что-то болит']].map(([v, t]) => ({ k: 'wb', v, t, d: T })) };
const ЛЕГЧЕ = 'в каждом упражнении на подход меньше, веса те же, заканчивай подход, когда мог бы сделать ещё 3–4 повтора';
const CR = [{ k: 'Craven 2022', t: 'мета-анализ 69 работ', u: 'https://pubmed.ncbi.nlm.nih.gov/35708888/', p: '' }];
const SB = [{ k: 'Silbernagel 2007', t: 'РКИ', u: 'https://pubmed.ncbi.nlm.nih.gov/17307888/', p: '' }];
function ответ(b){
  const ts = Date.now();
  if (b.k === 'wb' && b.v === 'сон') return { ok: true, ts, user: 'Плохо спал', src: CR, reply: 'После плохой ночи результат в зале в среднем ниже на 7–8%, сильнее — если лёг поздно, а тренируешься днём или вечером. Можно облегчить сегодня: ' + ЛЕГЧЕ + '. Программа не меняется.', act: [{ k: 'easy', t: 'Облегчить сегодня', d: T }] };
  if (b.k === 'wb' && b.v === 'боль') return { ok: true, ts, user: 'Что-то болит', reply: 'Насколько сильно — от 0 до 10? Если боль острая, есть отёк, онемение или болит даже в покое — нажми последнюю кнопку.',
    act: [['0-2', '0–2, чуть'], ['3-5', '3–5, терпимо'], ['6-10', '6–10, сильно'], ['red', 'Острая, отёк или онемение']].map(([v, t]) => ({ k: 'pain', v, t, d: T })) };
  if (b.k === 'easy') return { ok: true, ts, user: 'Облегчить сегодня', reply: 'Готово: сегодня ' + ЛЕГЧЕ + '. Программа прежняя — завтра всё как было.', act: [] };
  if (b.k === 'pain') return { ok: true, ts, user: 'Боль: 6–10, сильно', src: SB, reply: 'Это выше 5 из 10 — через такую боль не тренируют. Выбери упражнение, на котором болит, — отмечу «Мешает суставу» и поставлю замену на ту же мышцу. Болит и в покое — к врачу.', act: [{ k: 'pick', t: 'Выбрать упражнение', d: T }] };
  if (b.k === 'swap') return { ok: true, ts, user: 'Мешает суставу: «' + b.ex + '»', reply: 'Отметил «' + b.ex + '»: мешает суставу. Вместо него — «' + b.to + '», на ту же мышцу. Если и там заболит — скажи, подберу другое.', act: [] };
  return { ok: true, ts, user: b.k, reply: 'Понял.', act: [] };
}
async function нажать(page, текст){
  for (const x of await page.$$('#chatlog .chatacts button')) if ((await x.textContent()).trim() === текст) { await x.click(); await page.waitForTimeout(600); return; }
}
(async () => {
  const br = await chromium.launch();
  const нов = async () => { const p = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await p.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    await p.addInitScript(() => { try { localStorage.setItem('shp_v1_shp_sched', JSON.stringify({ 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 })); } catch (e) {} });
    return p; };
  let page = await нов();
  const o = { theme: тема, time: '08:40', chat: [], onAsk: () => ({ ok: true, pushed: true, turn: ВОПРОС }), onAct: ответ };
  await M.поднять(page, o);
  await page.waitForTimeout(500);
  o.chat = [ВОПРОС];
  await page.click('#coachfab'); await page.waitForTimeout(800);
  await снять(page, '1-vopros');
  await нажать(page, 'Плохо спал');
  await снять(page, '2-legche');
  await нажать(page, 'Облегчить сегодня');
  await page.click('#coachclose'); await page.waitForTimeout(300);
  await page.click('.l1 button[data-page="gym"]').catch(() => {}); await page.waitForTimeout(800);
  await снять(page, '3-zal');
  await page.close();
  page = await нов();
  const о2 = { theme: тема, time: '08:40', chat: [ВОПРОС], onAct: ответ };
  await M.поднять(page, о2);
  await page.click('#coachfab'); await page.waitForTimeout(800);
  await нажать(page, 'Что-то болит');
  await нажать(page, '6–10, сильно');
  await нажать(page, 'Выбрать упражнение');
  await page.evaluate(() => { const b = document.getElementById('chatlog'); b.scrollTop = b.scrollHeight; });
  await снять(page, '4-bol');
  const пр = await page.$$('#chatlog .chatacts.pick button'); if (пр[0]) { await пр[0].click(); await page.waitForTimeout(1000); }
  await снять(page, '5-zamena');
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
