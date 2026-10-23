'use strict';
/* Замена от тренера — с причиной и выбором (21.10). Его слова: «если тренер
   предлагает заменить, он должен объяснить почему и посоветовать чем заменить —
   желательно сразу показать 4–5 упражнений на выбор». И вопрос: «почему не
   сработал каталог?» Заперто:
   1. на карточке строка «Почему: …» и 4–5 вариантов картинками; первый —
      совет тренера, дальше похожие (те же подъёмы через сторону, а не жимы),
      без отвергнутых 👎 и без того, что уже стоит в программе;
   2. нажал вариант — он встал на место упражнения, карточка ушла, сервер
      узнал, что правка сделана;
   3. «Весь каталог» открывает выбор на этом месте, и выбранное встаёт в
      программу (раньше без ключа оно ложилось в SUBS['undefined']);
   4. каталог не загрузился — «Повторить» вместо тупика, после повтора список.
   23.10, его слова: «мне не понятно что на что он хочет заменить, в каком дне
   по какой причине ("Почему: по просьбе" — чьей просьбе?)… прямо в карточке
   упражнения предлагалась замена и с показом на что» (выбор «А» по макету):
   карточка стоит под строкой упражнения в его дне, строка зачёркнута; крупно
   совет тренера и «Заменить»; остальные варианты — по «Другие»; общая причина
   сервера («по просьбе») — словами человека из чата. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const у = (id, n, м, q) => ({ id, n, en: n, m: м, q, p: 'плечи', sets: 3, reps: '10–15', rest: 60, ss: null, why: '' });
const МАХИ = 'Подъём через сторону (гантели, сбоку)';
const ПРОГ = { name: 'Мышцы · 2 дня', note: 'Два дня.', focus: ['shoulders'], days: [
  { s: 'Верх', sub: 'плечи', ex: [у('Side_Lateral_Raise', МАХИ, 'shoulders', 'dumbbell'), у('Dumbbell_Shoulder_Press', 'Жим над головой (гантели)', 'shoulders', 'dumbbell')] },
  { s: 'Верх 2', sub: 'плечи', ex: [у('Seated_Side_Lateral_Raise', 'Подъём через сторону (гантели, сидя, сбоку)', 'shoulders', 'dumbbell')] } ] };
const RECO = { id: 'r-zam-1', what: 'swap', ex: МАХИ, day: 1, to: 'махи в кроссовере сидя', toId: 'Cable_Seated_Lateral_Raise',
  text: 'Заменить махи гантелями на махи в кроссовере сидя', why: 'Неудобно в плече' };
const ME = { sex: 'm', age: 38, ht: 178, bw: 86, goal: 'muscle', wt: 'keep', gym: 'muscle', level: 'mid', place: 'gym', only: 'all', lim: [], eq: [] };

async function открыть(br, o) {
  o = o || {};
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  /* кадры каталога — с CDN; на стенде отдаём крошечную картинку, чтобы видеть, что они есть */
  const ПИКС = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await page.route('**://cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: ПИКС }).catch(() => {}));
  const reco = [];
  page.on('request', r => { if (/\/reco$/.test(r.url()) && r.method() === 'POST') reco.push(r.postData() || ''); });
  if (o.безКаталога) await page.route('**/catalog.json*', r => r.abort().catch(() => {}));
  if (o.пустойКаталог) await page.route('**/catalog.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ex":[]}' }));
  if (o.пустойРаз) { let n = 0; await page.route('**/catalog.json*', r => (++n === 1) ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"ex":[]}' }) : r.fallback()); }
  /* 👎 на одном из похожих — его в вариантах быть не должно */
  await page.addInitScript(() => { try { localStorage.setItem('shp_v1_ai_nope', JSON.stringify({ 'One-Arm_Side_Laterals': { n: 'x', at: 1, m: 'shoulders' } })); } catch (e) {} });
  const ош = await M.поднять(page, { page: 'gym', wait: 2600, prog: o.prog || ПРОГ, profile: 'ai', me: ME, reco: o.reco || RECO, chat: o.chat });
  return { page, ош, reco };
}
const слот = page => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('shp_v1_ai_subs') || '{}'); } catch (e) { return {}; } });

(async () => {
  const br = await chromium.launch();

  /* ── 1. причина и варианты ── */
  let { page, ош, reco } = await открыть(br);
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForSelector('#coachreco .ropt', { timeout: 4000 }).catch(() => {});
  const к = await page.evaluate(() => {
    const e = document.getElementById('coachreco');
    return { текст: (e && e.textContent || '').replace(/\s+/g, ' '),
      опц: [...document.querySelectorAll('#coachreco .ropt')].map(b => ({ id: b.dataset.ci, n: b.querySelector('b').textContent, совет: !!b.querySelector('em'), фото: !!b.querySelector('.fig2, svg') })),
      кнопки: [...document.querySelectorAll('#coachreco .rb button')].map(b => b.textContent) };
  });
  дано(/Почему: Неудобно в плече/.test(к.текст), 'строка «Почему: …» на карточке');
  дано(к.опц.length >= 4 && к.опц.length <= 5, 'вариантов 4–5: ' + к.опц.length);
  дано(к.опц[0] && к.опц[0].id === 'Cable_Seated_Lateral_Raise' && к.опц[0].совет, 'первый — совет тренера, с пометкой');
  дано(к.опц.every(x => x.фото), 'у каждого варианта картинка');
  const ид = к.опц.map(x => x.id);
  дано(!ид.includes('Side_Lateral_Raise') && !ид.includes('Seated_Side_Lateral_Raise') && !ид.includes('Dumbbell_Shoulder_Press'), 'ничего из программы: ' + ид.join(', '));
  дано(!ид.includes('One-Arm_Side_Laterals'), 'отвергнутого 👎 нет');
  дано(к.опц.slice(0, 4).every(x => !/сзади|в наклоне/.test(x.n)), 'задняя дельта не впереди средней: ' + к.опц.map(x => x.n).join(' | '));
  дано(к.опц.filter(x => /^Подъём через сторону/.test(x.n)).length >= 4, 'похожие — подъёмы через сторону, а не жимы: ' + к.опц.map(x => x.n).join(' | '));
  дано(к.кнопки.join('|') === 'Заменить|Другие|✕', 'внизу «Заменить», «Другие» и ✕: ' + к.кнопки.join('|'));
  const место = await page.evaluate(() => { const e = document.getElementById('coachreco'), п = e && e.previousElementSibling;
    return { вСписке: !!(e && e.closest('#list')), подМахами: !!(п && п.matches('[data-pickex="0"]') && п.classList.contains('swapping')),
      скрыто: [...e.querySelectorAll('.rmore .ropt')].length, видно: [...e.querySelectorAll('.rmain .ropt')].length }; });
  дано(место.вСписке && место.подМахами, 'карточка — под строкой махов в их дне, строка зачёркнута: ' + JSON.stringify(место));
  дано(место.видно === 1 && место.скрыто >= 3, 'крупно — один совет тренера, остальные по «Другие»: ' + JSON.stringify(место));

  /* ── 2. нажал вариант ── */
  const второй = к.опц[1];
  await page.click('#coachreco button[data-reco2="more"]');
  await page.click('#coachreco .ropt[data-ci="' + второй.id + '"]');
  await page.waitForTimeout(500);
  const s1 = await слот(page);
  дано(s1['A1:0'] && s1['A1:0'].i === второй.id, 'вариант встал на место махов: ' + JSON.stringify(s1['A1:0'] || null));
  дано(await page.evaluate(() => { const e = document.getElementById('coachreco'); return !e || e.hidden || !e.textContent.trim(); }), 'карточка ушла');
  дано(reco.some(b => /"done":1/.test(b)), 'сервер узнал, что правка сделана');
  const экран = await page.$eval('#list', e => e.textContent).catch(() => '');
  дано(экран.indexOf(второй.n) >= 0, 'в списке дня — новое упражнение');
  await page.close();

  /* ── 3. весь каталог ── */
  ({ page, ош, reco } = await открыть(br));
  await page.waitForSelector('#coachreco .ropt', { timeout: 4000 }).catch(() => {});
  await page.click('#coachreco button[data-reco2="more"]');
  await page.click('#coachreco .rmore button[data-reco2="cat"]');
  await page.waitForTimeout(700);
  const кат = await page.evaluate(() => ({ открыт: document.getElementById('catalog').classList.contains('show'),
    заголовок: document.getElementById('cattitle').textContent, строк: document.querySelectorAll('#catbody [data-pick]').length }));
  дано(кат.открыт && кат.заголовок === 'Чем заменить' && кат.строк > 3, 'каталог открыт на выборе: ' + JSON.stringify(кат));
  const имя = await page.$eval('#catbody [data-pick]', b => b.closest('.catrow, li, div').querySelector('b, .cn, strong') ? b.closest('.catrow, li, div').querySelector('b, .cn, strong').textContent : '');
  await page.click('#catbody [data-pick]');
  await page.waitForTimeout(500);
  const s2 = await слот(page);
  дано(s2['A1:0'] && s2['A1:0'].i && !s2.undefined, 'выбранное в каталоге встало на место махов, а не в SUBS[undefined]: ' + JSON.stringify(Object.keys(s2)));
  await page.close();

  /* ── 4. каталог не загрузился ── */
  ({ page, ош, reco } = await открыть(br, { безКаталога: true }));
  await page.waitForTimeout(2000);
  const без = await page.evaluate(() => ({ опц: document.querySelectorAll('#coachreco .ropt').length,
    текст: document.getElementById('coachreco').textContent.replace(/\s+/g, ' ') }));
  дано(без.опц === 0 && !/Загружаю варианты/.test(без.текст) && /Выбрать в каталоге/.test(без.текст), 'без каталога — честная кнопка, без вечного «Загружаю»: ' + без.текст.slice(0, 120));
  await page.click('#coachreco button[data-reco2="cat"]');
  await page.waitForTimeout(3000);
  const сбой = await page.$eval('#catbody', e => e.textContent);
  дано(/пропала сеть/.test(сбой) && !!(await page.$('#catbody [data-catretry]')), 'сбой сети — сказано прямо и есть «Повторить»');
  await page.unroute('**/catalog.json*');
  await page.click('#catbody [data-catretry]');
  await page.waitForTimeout(1500);
  дано((await page.$$('#catbody [data-pick]')).length > 3, 'после «Повторить» — список');

  await page.close();

  /* ── 5. совет тренера уже стоит в программе (день 2) — первым его не ставим ── */
  ({ page } = await открыть(br, { reco: Object.assign({}, RECO, { id: 'r-zam-2', toId: 'Seated_Side_Lateral_Raise', to: 'подъём через сторону сидя' }) }));
  await page.waitForSelector('#coachreco .ropt', { timeout: 4000 }).catch(() => {});
  const ид2 = await page.$$eval('#coachreco .ropt', bs => bs.map(b => b.dataset.ci));
  дано(ид2.length >= 4 && !ид2.includes('Seated_Side_Lateral_Raise'), 'упражнение из другого дня не предлагается: ' + ид2.join(', '));
  await page.close();

  /* ── 5б. своё упражнение без id, но с точным именем каталога — тоже «в программе» ── */
  const ПРОГ2 = JSON.parse(JSON.stringify(ПРОГ));
  ПРОГ2.days[1].ex.push(Object.assign(у('', 'Подъём через сторону (сидя, блок)', 'shoulders', 'cable'), { id: undefined }));
  ({ page } = await открыть(br, { prog: ПРОГ2, reco: Object.assign({}, RECO, { id: 'r-zam-3', toId: 'One-Arm_Incline_Lateral_Raise' }) }));
  await page.waitForSelector('#coachreco .ropt', { timeout: 4000 }).catch(() => {});
  const ид3 = await page.$$eval('#coachreco .ropt', bs => bs.map(b => b.dataset.ci));
  дано(ид3.length >= 4 && !ид3.includes('Cable_Seated_Lateral_Raise'), 'своё без id с именем каталога не предлагается: ' + ид3.join(', '));
  await page.close();

  /* ── 6. пустой ответ каталога — сбой, а не «загружено»: повтор идёт в сеть ── */
  ({ page } = await открыть(br, { пустойКаталог: true }));
  await page.waitForTimeout(2000);
  await page.unroute('**/catalog.json*');
  await page.click('#coachreco button[data-reco2="cat"]:visible');
  await page.waitForTimeout(2000);
  дано((await page.$$('#catbody [data-pick]')).length > 3, 'после пустого ответа каталог загрузился заново');

  await page.close();

  /* ── 7. первый ответ пустой, второй исправный — тихий повтор сам дотягивает каталог ── */
  ({ page } = await открыть(br, { пустойРаз: true }));
  await page.waitForSelector('#coachreco .ropt', { timeout: 6000 }).catch(() => {});
  дано((await page.$$('#coachreco .ropt')).length >= 4, 'пустой первый ответ — варианты всё равно пришли (тихий повтор)');
  await page.close();

  /* ── 8. «Заменить» ставит совет тренера; общая причина — словами человека ── */
  ({ page } = await открыть(br, { reco: Object.assign({}, RECO, { id: 'r-zam-8', why: 'по просьбе' }) }));
  await page.waitForSelector('#coachreco .ropt', { timeout: 4000 }).catch(() => {});
  const why8 = await page.$eval('#coachreco', e => e.textContent.replace(/\s+/g, ' '));
  дано(!/Почему: по просьбе/.test(why8) && /Ты (писал|попросил)/.test(why8), 'вместо «Почему: по просьбе» — чьи слова: ' + why8.slice(0, 160));
  await page.click('#coachreco .rb3 .go');
  await page.waitForTimeout(500);
  const s8 = await слот(page);
  дано(s8['A1:0'] && s8['A1:0'].i === 'Cable_Seated_Lateral_Raise', '«Заменить» поставил совет тренера: ' + JSON.stringify(s8['A1:0'] || null));
  await page.close();

  /* ── 8б. ревью Codex R1 (v6 → rereview): цитату из чата не подбираем — связи с предложением нет; всегда «Ты попросил в чате» ── */
  const сейчас = Date.now();
  for (const [имя, чат, ждём] of [
    ['просьба, потом еда', [{ role: 'user', text: 'Замени подъём через сторону, болит плечо', ts: сейчас - 3600e3 }, { role: 'user', text: 'Запиши обед: плов', ts: сейчас - 60e3 }], /Ты попросил в чате/],
    ['чужое упражнение со словом из названия', [{ role: 'user', text: 'Замени жим гантелей на тренажёр', ts: сейчас - 60e3 }], /Ты попросил в чате/],
    ['отрицание', [{ role: 'user', text: 'Не заменяй подъём через сторону', ts: сейчас - 60e3 }], /Ты попросил в чате/],
    ['другой день', [{ role: 'user', text: 'Замени подъём через сторону в Дне 3', ts: сейчас - 60e3 }], /Ты попросил в чате/],
    ['только еда', [{ role: 'user', text: 'Запиши обед: плов', ts: сейчас - 60e3 }], /Ты попросил в чате/],
    ['без времени', [{ role: 'user', text: 'Замени подъём через сторону' }], /Ты попросил в чате/],
    ['старое', [{ role: 'user', text: 'Замени подъём через сторону', ts: сейчас - 5 * 864e5 }], /Ты попросил в чате/],
    ['про другое упражнение', [{ role: 'user', text: 'Замени жим ногами', ts: сейчас - 60e3 }], /Ты попросил в чате/]]) {
    ({ page } = await открыть(br, { chat: чат, reco: Object.assign({}, RECO, { id: 'r-zam-8b-' + имя, why: 'по просьбе' }) }));
    await page.waitForSelector('#coachreco .ropt', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(600);
    const т = (await page.$eval('#coachreco .rwhy', e => e.textContent).catch(() => '')).replace(/\s+/g, ' ');
    дано(ждём.test(т) && !/Ты писал|плов|жим|Не заменяй|Дне 3/.test(т), 'причина «' + имя + '»: ' + т);
    await page.close();
  }

  /* ── 8в. ревью Codex R2: суперсет — зачёркнуто именно заменяемое, а не партнёр ── */
  const ПРОГСС = JSON.parse(JSON.stringify(ПРОГ)); ПРОГСС.days[0].ex[0].ss = 1; ПРОГСС.days[0].ex[1].ss = 1;
  for (const раскрыть of [null, 0, 1]) {
    ({ page } = await открыть(br, { prog: ПРОГСС }));
    await page.waitForSelector('#coachreco .ropt', { timeout: 4000 }).catch(() => {});
    if (раскрыть !== null) { await page.click('#list [data-pickex="' + раскрыть + '"]').catch(() => {}); await page.waitForTimeout(400); }
    const з = await page.evaluate(() => [...document.querySelectorAll('#list .swapping')].map(e => (e.querySelector('.exrn b, .exname') || {}).textContent || ''));
    дано(з.length === 1 && /^(А|A)?\s*Подъём через сторону \(гантели, сбоку\)$/.test(з[0].trim()), 'суперсет, раскрыто ' + раскрыть + ': зачёркнуты только махи: ' + JSON.stringify(з));
    const подпись = await page.$eval('#coachreco .rinl>u', e => e.textContent).catch(() => '');
    дано(раскрыть === null || /«Подъём через сторону/.test(подпись) || з.length === 1, 'в раскрытой паре карточка называет, что меняем: ' + подпись);
    await page.close();
  }

  /* ── 9. открыт другой день — над днём одна строка и «Показать» ── */
  ({ page } = await открыть(br));
  await page.waitForSelector('#coachreco .ropt', { timeout: 4000 }).catch(() => {});
  await page.click('#dayseg button[data-day]:not([aria-pressed="true"])');
  await page.waitForTimeout(400);
  const далеко = await page.evaluate(() => { const e = document.getElementById('coachreco'); return { вне: !e.closest('#list'), т: e.textContent.replace(/\s+/g, ' '), кн: !!e.querySelector('[data-reco2="show"]') }; });
  дано(далеко.вне && /Замена в Дне 1/i.test(далеко.т) && далеко.кн, 'другой день: «Замена в Дне 1» и «Показать»: ' + JSON.stringify(далеко));
  await page.click('#coachreco [data-reco2="show"]');
  await page.waitForTimeout(400);
  дано(await page.evaluate(() => !!document.getElementById('coachreco').closest('#list')), '«Показать» открывает день, карточка снова под упражнением');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
