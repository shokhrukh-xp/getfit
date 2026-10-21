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
   4. каталог не загрузился — «Повторить» вместо тупика, после повтора список. */
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
  /* 👎 на одном из похожих — его в вариантах быть не должно */
  await page.addInitScript(() => { try { localStorage.setItem('shp_v1_ai_nope', JSON.stringify({ 'One-Arm_Side_Laterals': { n: 'x', at: 1, m: 'shoulders' } })); } catch (e) {} });
  const ош = await M.поднять(page, { page: 'gym', wait: 2600, prog: o.prog || ПРОГ, profile: 'ai', me: ME, reco: o.reco || RECO });
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
  дано(к.кнопки.join('|') === 'Весь каталог|Не сейчас', 'внизу «Весь каталог» и «Не сейчас»: ' + к.кнопки.join('|'));

  /* ── 2. нажал вариант ── */
  const второй = к.опц[1];
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
  await page.click('#coachreco button[data-reco2="cat"]');
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
  await page.click('#coachreco button[data-reco2="cat"]');
  await page.waitForTimeout(2000);
  дано((await page.$$('#catbody [data-pick]')).length > 3, 'после пустого ответа каталог загрузился заново');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
