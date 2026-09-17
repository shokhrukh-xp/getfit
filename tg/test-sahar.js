'use strict';
/* ── САХАР В КРОВИ ────────────────────────────────────────────────────
   17.09, его вопрос: «у сестры высокий сахар, она должна его снижать —
   это учитывается?» Не учитывалось никак: слов «глюкоза» и «ммоль» в
   приложении не было вовсе, а слово «сахар» значило добавленный сахар в
   ЕДЕ — человек с диабетом видел «сахар 12 г» и думал, что это про него.

   Здесь проверено то, что ломается тихо: раздел не показывается тем, кому
   он не нужен; число с глюкометра в мг/дл не записывается как ммоль/л
   молча; низкий сахар не теряется среди высоких; и приложение не выходит
   за свою границу — про дозы и лечение оно говорит одно и то же слово. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const БАЗА = { sex: 'm', age: 34, ht: 176, bw: 88, only: 'all', wt: 'down', gym: 'muscle' };
const МЕД = д => Object.assign({}, БАЗА, { med: Object.assign(
  { dia: '', ins: null, low: null, eyes: 0, feet: 0, kid: 0, bp: 0, preg: 0, no: '', at: '2026-09-17T10:00:00Z' }, д) });

async function еда(page) {
  const f = await page.$('.l1 button[data-page="food"]');
  if (f) { await f.click(); await page.waitForTimeout(1400); }
}

(async () => {
  const br = await chromium.launch();

  /* ── кому раздела не видно ── */
  let page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, page: 'food', me: БАЗА });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await еда(page);
  дано(await page.$eval('#glugroup', e => e.hidden), 'у кого нет диабета — раздела нет');
  дано(await page.$eval('#gluh', e => e.hidden), 'и заголовка тоже');

  /* слово «сахар» в еде теперь названо своим именем */
  const день = await page.$eval('#fday', e => e.innerText);
  дано(!/(^|[^в] )Сахар\b/.test(день.replace(/Сахар в еде/g, '')),
    'на экране дня «сахар» больше не голый — он «сахар в еде»: ' + (день.match(/Сахар[^\n]*/) || ['нет'])[0]);
  await page.close();

  /* ── кому видно ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  let ушло = null;
  page.on('request', req => {
    try { if (/\/glu\/add$/.test(new URL(req.url()).pathname)) ушло = JSON.parse(req.postData() || '{}'); } catch (e) {}
  });
  await M.поднять(page, { theme: 'dark', wait: 2800, page: 'food', me: МЕД({ dia: 't2', ins: 1, low: 1 }) });
  await еда(page);
  дано(!(await page.$eval('#glugroup', e => e.hidden)), 'у кого диабет — раздел есть');

  const чипы = await page.$$eval('#glutoday .glchip', ns => ns.map(n => n.innerText.replace(/\s+/g, ' ').trim()));
  дано(чипы.length === 2, 'сегодняшние замеры показаны: ' + чипы.join(' | '));
  дано(/5,6/.test(чипы[0]) && /натощак/.test(чипы[0]), 'с временем и видом: ' + чипы[0]);
  const классы = await page.$$eval('#glutoday .glchip', ns => ns.map(n => n.className));
  дано(/gl-ok/.test(классы[0]) && /gl-hi/.test(классы[1]),
    'в коридоре и выше коридора выглядят по-разному: ' + классы.join(' | '));

  /* ради чего всё и делалось */
  const после = await page.$eval('#glupost', e => e.innerText.replace(/\s+/g, ' '));
  дано(/Плов/.test(после) && /12,4/.test(после), 'видно, после какой еды сахар был выше: ' + после.slice(0, 110));
  дано(/через 1 ч 35 мин/.test(после), 'и через сколько он замерен: ' + после.slice(0, 140));

  /* ── симметрия: про высокий сахар тоже сказано ──
     17.09, его вопрос: «почему акцент на низкий, а на высокий что?» Был прав:
     про высокий приложение только красило число красным. */
  const сводка = await page.$eval('.glsum', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  дано(/4 выше коридора/.test(сводка) && /3 в коридоре/.test(сводка) && /1 низких/.test(сводка),
    'обе стороны посчитаны, а не только низкая: ' + сводка);
  const тренд = await page.$eval('.gltrend', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  дано(/9,1/.test(тренд) && /10,4/.test(тренд) && /ниже на 1,3/.test(тренд),
    'видно, снижается ли — ради этого всё и делается: ' + тренд);
  const тревоги = await page.$$eval('.glwarn', ns => ns.map(n => n.innerText.replace(/\s+/g, ' ')));
  дано(тревоги.some(t => /больше половины замеров выше/i.test(t) && /врачу/.test(t)),
    'устойчиво высокий — такой же повод к врачу, как низкий: ' + (тревоги[0] || 'ничего не сказано'));
  дано(тревоги.some(t => /низкий сахар повторяется/i.test(t)), 'и низкий по-прежнему сказан отдельно');

  /* углеводы приёма — то, чем человек может двигать подъём */
  дано(/78 г углеводов/.test(после) && /12 г углеводов/.test(после),
    'у каждого приёма видны углеводы, а не только калории: ' + (после.match(/78[^·]*/) || [''])[0]);
  const дельта = await page.$eval('.gldelta', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  дано(/3,5/.test(дельта) && /78 г и 12 г/.test(дельта),
    'и названа разница между лучшим и худшим приёмом: ' + дельта);
  дано(!/Плов с говядиной полпорци…/.test(дельта), 'название в середине фразы обрезано по слову, а не по букве');

  /* прогулка — единственный рычаг, который приложению можно предлагать */
  const ходьба = await page.$eval('.glwalk', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  дано(/прогулка сразу после еды/.test(ходьба), 'при высоких предложено то, что реально помогает: ' + ходьба.slice(0, 70));
  дано(/быстрые углеводы/.test(ходьба), 'и для того, у кого бывает низкий сахар, — оговорка про них');
  дано(!/доз|инсулин\b/i.test(ходьба.replace('на инсулине', '')), 'по-прежнему ни слова про дозы');

  /* низкий не теряется среди высоких */
  дано(/низкий сахар/i.test(после), 'низкий сахар вынесен отдельно, а не утонул в списке высоких');
  дано(/3,4/.test(после), 'с числом: ' + (после.match(/3,4[^\n]*/) || [''])[0].slice(0, 80));
  дано(/врачу/.test(после), 'и сказано, что с этим идут к врачу, а не к приложению');
  дано(!!(await page.$('.glwarn')), 'и это сказано отдельной строкой, а не в общей сноске');

  /* ── мг/дл с глюкометра ── */
  await page.fill('#glv', '101');
  await page.click('#glsave'); await page.waitForTimeout(700);
  дано(!!ушло && ушло.v === 101, 'число уходит как введено: ' + JSON.stringify(ушло));
  const ответ = await page.$eval('#glreply', e => e.innerText);
  дано(/5,6/.test(ответ) && /мг\/дл/.test(ответ),
    'а приложение говорит, КАК поняло, вместо тихой догадки: ' + ответ);
  дано(!/доз|лечени|инсулин/i.test(ответ), 'и ничего про дозы не советует: ' + ответ);

  /* ── низкий замер: что говорит приложение ── */
  await page.fill('#glv', '3,2');
  await page.click('#glsave'); await page.waitForTimeout(700);
  const низ = await page.$eval('#glreply', e => e.innerText);
  дано(/15 г/.test(низ) && /15 минут/.test(низ), 'на низкий сахар — правило пятнадцати: ' + низ);
  дано(!/доз|уменьш|инсулин/i.test(низ), 'и опять ни слова про дозу: ' + низ);

  /* ── высокий: граница приложения ── */
  await page.fill('#glv', '13,5');
  await page.click('#glsave'); await page.waitForTimeout(700);
  const выс = await page.$eval('#glreply', e => e.innerText);
  дано(/врач/.test(выс), 'на высокий — прямо к врачу, без своих советов: ' + выс);

  /* ── вид замера переключается и уезжает ── */
  for (const b of await page.$$('[data-glk]')) if ((await b.textContent()).trim() === 'после еды') { await b.click(); break; }
  await page.waitForTimeout(300);
  await page.fill('#glv', '9,1');
  await page.click('#glsave'); await page.waitForTimeout(700);
  дано(!!ушло && ушло.kind === 'post', 'вид замера уходит тот, что выбран: ' + ((ушло || {}).kind));

  /* ── мусор не записывается ── */
  ушло = null;
  await page.fill('#glv', '');
  await page.click('#glsave'); await page.waitForTimeout(500);
  дано(ушло === null, 'пустое поле ничего не отправляет');
  const пусто = await page.$eval('#glreply', e => e.innerText);
  дано(/5,6/.test(пусто) || /Впиши/.test(пусто), 'и объясняет, что нужно: ' + пусто);

  /* ── запятая ──
     «88,1» в input[type=number] не вводится вовсе: браузер отдаёт пустую
     строку, и число молча теряется. А запятая — ровно то, что наберёт
     человек. Нашлось на поле сахара, чинилось везде. */
  ушло = null;
  await page.fill('#glv', '6,3');
  await page.click('#glsave'); await page.waitForTimeout(700);
  дано(!!ушло && ушло.v === 6.3, 'запятая в замере понимается: ' + JSON.stringify((ушло || {}).v));
  const десятичные = await page.$$eval('#fw, #ffat, #fwaist, #glv', ns => ns.map(n => n.id + ':' + n.type));
  дано(десятичные.every(x => /:text$/.test(x)), 'и все десятичные поля text, а не number: ' + десятичные.join(' | '));
  const вес = await page.evaluate(() => { const el = document.getElementById('fw'); el.value = '88,1'; return el.value; });
  дано(вес === '88,1', 'вес с запятой не теряется на вводе: «' + вес + '»');

  /* коридоры названы общими, а не его собственными */
  const нота = await page.$eval('.glunote', e => e.innerText.replace(/\s+/g, ' '));
  дано(/общие/.test(нота) && /врач/.test(нота), 'коридоры названы общими, а не его целью: ' + нота.slice(0, 120));
  await page.close();

  /* ── когда замеров с прогулкой хватает, говорим ЕГО числами ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2800, page: 'food', me: МЕД({ dia: 't2', ins: 1, low: 1 }),
    walk: { 'с': 8.4, 'без': 11.1, nС: 5, nБез: 6, 'д': 2.7 } });
  await еда(page);
  const своё = await page.$eval('.glwalk', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  дано(/8,4/.test(своё) && /11,1/.test(своё), 'вместо чужого исследования — его собственные замеры: ' + своё);
  дано(!/срезает подъём/.test(своё), 'и общий совет уступает место числам');
  await page.close();

  /* ── преддиабет: раздел есть, а ограничений быть не должно ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2800, page: 'food', me: МЕД({ dia: 'pre' }) });
  await еда(page);
  дано(!(await page.$eval('#glugroup', e => e.hidden)), 'при преддиабете замеры тоже нужны');
  await page.click('#profbtn'); await page.waitForTimeout(600);
  await page.click('#zdtoggle'); await page.waitForTimeout(400);
  const виды = await page.$$eval('#zd-dia button', ns => ns.map(n => n.innerText));
  дано(виды.indexOf('преддиабет') >= 0, 'и в анкете он отдельным вариантом: ' + виды.join(' | '));
  дано((await page.$eval('#zdsum', e => e.innerText)) === 'преддиабет',
    'сводка называет его своим именем: ' + (await page.$eval('#zdsum', e => e.innerText)));
  const низкоП = await page.$$eval('#zd-diamore .pfl', ns => ns.map(n => n.innerText));
  дано(низкоП.join(' ').indexOf('сахар в крови падает низко') >= 0,
    'и вопрос про сахар теперь уточняет, что он в крови: ' + низкоП.join(' | '));
  await page.close();

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})();
