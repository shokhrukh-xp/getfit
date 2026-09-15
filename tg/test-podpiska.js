'use strict';
/* ── ТРЕНЕР ПО ПОДПИСКЕ ────────────────────────────────────────────────
   15.09, его решение: приложение открывается посторонним, платным
   становится только тренер. Здесь проверено три вещи, каждая из которых
   ломается тихо: свои не должны видеть цену вообще; тот, у кого доступа
   нет, должен упереться в понятный лист, а не в красную ошибку; и всё
   бесплатное — дневник, нормы, зал, журнал, рейтинг — должно работать
   при поднятой стене ровно так же, как без неё. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const ЛИСТ = () => {
  const m = document.getElementById('subm');
  return { открыт: !!(m && m.classList.contains('show')),
           текст: (document.getElementById('sub-what') || {}).textContent || '',
           пункты: Array.from(document.querySelectorAll('#sub-list li')).map(x => x.textContent.trim()),
           кнопка: (document.getElementById('sub-buy') || {}).textContent || '',
           свободно: (document.querySelector('.subfree') || {}).textContent || '' };
};

(async () => {
  const br = await chromium.launch();

  /* ── свой: цены нет нигде ── */
  const свой = await br.newPage({ viewport: { width: 390, height: 900 } });
  await свой.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(свой, { theme: 'dark', wait: 2800, hist: M.журнал() });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  дано(!(await свой.evaluate(ЛИСТ)).открыт, 'своему лист с ценой не показан');
  await свой.click('#avatar').catch(() => {});
  await свой.waitForTimeout(800);
  const строка = await свой.$eval('#subrow', e => ({ скрыта: e.hidden, текст: e.textContent })).catch(() => null);
  дано(строка && строка.скрыта, 'и в профиле про подписку ни слова: ' + JSON.stringify(строка));
  await свой.close();

  /* ── без доступа: стена там, где человек упёрся ── */
  const гость = await br.newPage({ viewport: { width: 390, height: 900 } });
  await гость.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош2 = await M.поднять(гость, { theme: 'dark', page: 'food', wait: 2800, sub: 'нет' });
  дано(ош2.length === 0, 'у гостя страница тоже поднялась без ошибок ' + (ош2[0] || ''));
  дано(!(await гость.evaluate(ЛИСТ)).открыт, 'сам по себе лист не лезет — только когда упёрся');

  /* бесплатное работает при поднятой стене */
  const день = await гость.$eval('#fday', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  дано(/Калории/.test(день), 'дневник и нормы при стене работают: ' + день.slice(0, 40));

  /* просим тренера — сервер отвечает 402 с кодом sub */
  await гость.fill('#ftext', 'плов с говядиной');
  await гость.click('#fsend');
  await гость.waitForTimeout(1400);
  const л = await гость.evaluate(ЛИСТ);
  дано(л.открыт, 'на просьбу к тренеру поднялся лист с ценой');
  дано(/500 ★/.test(л.текст), 'цена названа в Звёздах: ' + л.текст);
  дано(л.пункты.length >= 3, 'сказано, что входит: ' + л.пункты.length + ' пункта');
  дано(/Дневник/.test(л.свободно) && /бесплатн/.test(л.свободно), 'и что остаётся бесплатным: ' + л.свободно);
  дано(/500/.test(л.кнопка), 'кнопка с ценой: ' + л.кнопка.trim());

  /* в профиле у гостя строка есть */
  await гость.evaluate(() => { const m = document.getElementById('subm'); if (m) m.classList.remove('show'); });
  await гость.click('#avatar').catch(() => {});
  await гость.waitForTimeout(800);
  const стр2 = await гость.$eval('#subrow', e => ({ скрыта: e.hidden, текст: e.textContent.trim() })).catch(() => null);
  дано(стр2 && !стр2.скрыта && /500/.test(стр2.текст), 'в профиле у гостя строка с ценой: ' + (стр2 || {}).текст);
  await гость.close();

  /* ── платит: цена не мешает, но видно, когда спишут ── */
  const платит = await br.newPage({ viewport: { width: 390, height: 900 } });
  await платит.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(платит, { theme: 'dark', wait: 2800, sub: 'платит' });
  await платит.click('#avatar').catch(() => {});
  await платит.waitForTimeout(800);
  const стр3 = await платит.$eval('#subrow', e => ({ скрыта: e.hidden, текст: e.textContent.trim() })).catch(() => null);
  дано(стр3 && !стр3.скрыта && /подключён/.test(стр3.текст), 'у платящего видно состояние: ' + (стр3 || {}).текст);
  дано(стр3 && /списание/.test(стр3.текст), 'и когда следующее списание');
  дано(await платит.$eval('#sub-off', e => !!e).catch(() => false), 'и есть чем отменить');
  await платит.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
