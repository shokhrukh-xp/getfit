'use strict';
/* ── НИЗ КАРТОЧКИ УПРАЖНЕНИЯ ───────────────────────────────────────────
   18.09, его скриншот и слова: «сделай кнопки в один ряд. Кнопка нравится/
   не нравится можно делать меньше квадратными. А кнопку описание можно просто
   заменить кнопкой видео, всё равно там нет текстовых описаний».
   Он прав ровно наполовину, и это важно: у упражнений ИЗ ПРОГРАММЫ ТРЕНЕРА
   cues пустые — шторка «Описание» открывалась пустой. А у встроенной
   программы техника есть, три подсказки на движение, и терять её нельзя.
   Поэтому: в ряду — прямая ссылка на видео; техника, когда она есть,
   осталась за картинкой; довод тренера и «мешает суставу» переехали под
   палец вниз — туда, где человек решает от упражнения отказаться.
   Проверяется то, что ломается тихо: что картинка не стала мёртвой кнопкой
   (так уже было с плюсом на дуге — атрибут жил, обработчика не было). */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const у = (id, n, м, п) => ({ id, n, en: n, m: м, q: 'machine', p: п, sets: 3, reps: '8–12', rest: 90, ss: null,
  why: 'держит квадрицепс в неделю выше порога роста' });
/* мышцы — ровно теми словами, какими их зовёт каталог: иначе замена не найдёт
   ни одного кандидата и упрётся в «на эту мышцу в базе 0 движений» */
const ПРОГ = { name: 'Мышцы · 3 дня', note: 'Три дня.', focus: ['quadriceps'], days: [
  { s: 'Низ', sub: 'ноги', ex: [у('e1', 'Жим ногами', 'quadriceps', 'квадрицепс'), у('e2', 'Сгибание голеней', 'hamstrings', 'бицепс бедра'), у('e3', 'Подъёмы на носки', 'calves', 'икры')] },
  { s: 'Верх', sub: 'грудь', ex: [у('e4', 'Жим гантелей лёжа', 'chest', 'грудь'), у('e5', 'Тяга блока', 'lats', 'спина')] },
  { s: 'Руки', sub: 'руки', ex: [у('e6', 'Сгибание на бицепс', 'biceps', 'бицепс'), у('e7', 'Разгибание на блоке', 'triceps', 'трицепс')] } ] };

async function раскрыть(page) {
  if (await page.$('.card.exact .exfoot')) return;
  const r = await page.$('#list .exrow');
  if (r) { await r.click(); await page.waitForTimeout(700); }
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', page: 'gym', wait: 2800, prog: ПРОГ, profile: 'ai',
    me: { sex: 'm', age: 38, ht: 178, bw: 88.1, goal: 'muscle', wt: 'keep', gym: 'muscle', level: 'mid', place: 'gym', only: 'all', lim: [], eq: [] } });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await раскрыть(page);

  /* ── 1. один ряд ── */
  const ряд = await page.$$eval('.card.exact .exfoot > *', ns => ns.map(n => ({
    т: (n.textContent || '').trim(), тег: n.tagName, top: Math.round(n.getBoundingClientRect().top),
    w: Math.round(n.getBoundingClientRect().width), h: Math.round(n.getBoundingClientRect().height) })));
  дано(ряд.length === 4, 'в подвале четыре кнопки: ' + ряд.map(x => x.т).join(' · '));
  дано(new Set(ряд.map(x => x.top)).size === 1, 'и все они в один ряд, на одной высоте: ' + ряд.map(x => x.top).join('/'));

  /* ── 2. пальцы квадратные ── */
  const п = ряд.slice(0, 2);
  дано(п[0].т === '👍' && п[1].т === '👎', 'слева оба пальца');
  дано(п.every(x => Math.abs(x.w - x.h) <= 2 && x.w >= 44 && x.w <= 48),
    'пальцы квадратные и не мельче 44: ' + п.map(x => x.w + '×' + x.h).join(' и '));
  дано(ряд[2].w > ряд[0].w * 1.4, 'видео занимает освободившееся место: ' + ряд[2].w + 'px');

  /* ── 3. «Описание» заменено ссылкой на видео ── */
  дано(!ряд.some(x => /Описание/.test(x.т)), 'кнопки «Описание» больше нет');
  дано(ряд[2].тег === 'A' && /Видео/.test(ряд[2].т), 'вместо неё ссылка: ' + ряд[2].т);
  const href = await page.$eval('.card.exact .exfoot a', a => a.href);
  дано(/youtube\.com/.test(href) && /%D0%96%D0%B8%D0%BC/.test(href),
    'ссылка ведёт на видео именно этого движения: ' + decodeURIComponent(href).slice(-46));
  дано(await page.$eval('.card.exact .exfoot a', a => a.target === '_blank'), 'и открывается наружу, не поверх тренировки');

  /* ── 4. ничего не вылезает за карточку ── */
  const влез = await page.$eval('.card.exact', c => {
    const b = c.getBoundingClientRect();
    return Array.prototype.every.call(c.querySelectorAll('.exfoot > *'), n => {
      const r = n.getBoundingClientRect(); return r.left >= b.left - 1 && r.right <= b.right + 1; });
  });
  дано(влез, 'ряд помещается в карточку на узком экране');

  /* ── 5. палец вниз спрашивает, а не меняет молча ── */
  const было = await page.$eval('.card.exact .exname', e => e.textContent.trim());
  await page.click('.card.exact [data-nope]');
  await page.waitForTimeout(500);
  дано(await page.$eval('.card.exact .exname', e => e.textContent.trim()) === было,
    'одно касание пальца вниз упражнение не поменяло: ' + было);
  const шт = await page.$eval('.card.exact .exnope', n => ({
    видно: !n.hidden, why: (n.querySelector('.whytext') || {}).textContent || '',
    выбор: Array.prototype.map.call(n.querySelectorAll('.nope2 .ebtn'), b => b.textContent.trim()) }));
  дано(шт.видно, 'вместо этого открылась шторка');
  дано(шт.выбор.length === 2 && /^Не нравится$/.test(шт.выбор[0]) && /[Мм]ешает/.test(шт.выбор[1]),
    'и в ней два разных ответа: ' + шт.выбор.join(' · '));
  дано(шт.why.length > 15, 'рядом довод тренера, зачем это упражнение здесь: ' + шт.why.slice(0, 50));

  /* ── 6. «мешает суставу» отмечается и остаётся видно ── */
  await page.click('.card.exact .nope2 [data-hurt]');
  await page.waitForTimeout(700);
  дано(await page.$eval('.card.exact .exname', e => e.textContent.trim()) === было,
    '«мешает» упражнение не подменяет — это отметка, а не замена');
  const после = await page.$eval('.card.exact .exnope', n => ({
    видно: !n.hidden, метка: (n.querySelector('[data-hurt]') || {}).textContent || '',
    жал: (n.querySelector('[data-hurt]') || {}).getAttribute ? n.querySelector('[data-hurt]').getAttribute('aria-pressed') : '',
    подсказка: (n.querySelector('.hurthint2') || {}).textContent || '' }));
  дано(после.видно, 'шторка после отметки не схлопнулась — нажатие не выглядит холостым');
  дано(после.жал === 'true' && /отмечено/.test(после.метка), 'отметка видна на самой кнопке: ' + после.метка);
  дано(/учтёт это при замене/.test(после.подсказка), 'и сказано, что с этим будет: ' + после.подсказка.slice(0, 52));
  дано(await page.$eval('.card.exact [data-nope]', b => b.classList.contains('hrt')),
    'палец вниз покрашен — про отметку видно, не открывая шторку');
  дано(await page.evaluate(() => { const k = Object.keys(localStorage).filter(x => /_hurt$/.test(x))[0];
    return k ? Object.keys(JSON.parse(localStorage.getItem(k))).length : 0; }) === 1, 'жалоба записана и уйдёт тренеру');

  /* ── 7. «не нравится» по-прежнему меняет ── */
  await page.click('.card.exact [data-noped]');
  await page.waitForTimeout(2000);
  const стало = await page.$$eval('#list .exrow .exrn b, #list .card.exact .exname', ns => ns.map(n => n.textContent.trim()));
  дано(стало[0] && стало[0] !== было, 'второй ответ меняет упражнение, как раньше: ' + было + ' → ' + стало[0]);

  /* ── 8. картинка открывает шторку «Как делать» (24.09, его выбор «А»):
         шаги из tech.json, кадры крупно, видео — внутри шторки ── */
  await раскрыть(page);
  const кар = await page.$eval('.card.exact .exthumb', n => ({ тег: n.tagName, тех: n.getAttribute('data-tech') }));
  дано(кар.тег === 'BUTTON' && кар.тех !== null, 'картинка — кнопка шторки «Как делать»');
  дано(await page.$('.card.exact .exinfo') === null, 'пустой шторки в карточке нет');
  await page.click('.card.exact .exthumb'); await page.waitForTimeout(900);
  const ш = await page.$eval('#techm', n => ({ видно: n.classList.contains('show'), шагов: n.querySelectorAll('.tsteps li').length,
    видео: /youtube\.com/.test((n.querySelector('.tbtns a') || {}).href || ''), нет: !!n.querySelector('.tnone') }));
  дано(ш.видно, 'нажал на картинку — шторка открылась');
  дано(ш.шагов >= 2 || ш.нет, 'в ней шаги (' + ш.шагов + ') или честное «описания пока нет»');
  дано(ш.видео, 'видео — в шторке');
  await page.click('#techclose'); await page.waitForTimeout(300);
  дано(!(await page.$eval('#techm', n => n.classList.contains('show'))), 'крестик закрывает');

  await br.close();

  /* ── 9. встроенная программа: подсказки cues не пропали — они в шторке ── */
  const br2 = await chromium.launch();
  const p2 = await br2.newPage({ viewport: { width: 390, height: 900 } });
  await p2.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(p2, { theme: 'dark', page: 'gym', wait: 2800 });
  await раскрыть(p2);
  await p2.click('.card.exact .exthumb'); await p2.waitForTimeout(900);
  const тех = await p2.$eval('#techm', n => ({ видно: n.classList.contains('show'), шагов: n.querySelectorAll('.tsteps li').length,
    текст: (n.querySelector('.tsteps li') || {}).textContent || '' }));
  дано(тех.видно, 'у встроенной программы картинка тоже открывает шторку');
  дано(тех.шагов >= 2, 'шагов на месте: ' + тех.шагов);
  дано(тех.текст.length > 12, 'и это настоящий текст: ' + тех.текст.slice(0, 46));
  await p2.click('#techclose'); await p2.waitForTimeout(300);
  const ряд2 = await p2.$$eval('.card.exact .exfoot > *', ns => ns.map(n => (n.textContent || '').trim()));
  дано(ряд2.length === 4 && /Видео/.test(ряд2[2]), 'подвал у встроенной программы такой же: ' + ряд2.join(' · '));

  await br2.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
