'use strict';
/* Группы продуктов за неделю и риски по нутриентам (24.09, этап 2 плана,
   второй заход). Его выбор из трёх снимков — «А + строка в Б»: в «Моём
   дне» под неделей — пять строк с чертой ориентира и карточки рисков; над
   меню недели — строка «в этом меню». Флаг — еда и анализ у врача, дозы
   нигде. Вопрос про метформин — в блоке здоровья, только при диабете.
   Заперто: нет данных — блока нет; статусы цветом; ссылки открываются;
   строка меню недели; метформин уезжает в профиль и стирается с диабетом. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const SRC = k => ({ k, a: k, t: 'обзор', u: 'https://pubmed.ncbi.nlm.nih.gov/1/', p: 'суть' });
/* 27.09, его выбор «всё за неделю»: строки — в порциях за неделю, с тем,
   что такое порция, и из чего набралось (раскрывается нажатием) */
const ГРУППЫ = { от: M.Д(6), до: M.Д(0), дней: 7, полных: 6, src: [SRC('Rimm 2018'), SRC('WCRF 2018')], строки: [
  { k: 'рыба', t: 'Рыба', v: 1.5, из: 2, txt: '1,5 / 2 порции', st: 'lo', порция: 'Порция — 100 г готовой рыбы.', изЧего: [{ н: 'скумбрия запечённая', п: 1.5 }] },
  { k: 'бобовые', t: 'Бобовые', v: 3, из: 3, txt: '3 / 3 порции', st: 'ok', порция: 'Порция — 150 г готовых бобовых.', изЧего: [{ н: 'суп чечевичный', п: 2 }, { н: 'маш варёный', п: 1 }] },
  { k: 'овощиФрукты', t: 'Овощи и фрукты', v: 25, из: 35, txt: '25 / 35 порций', st: 'lo', порция: 'Порция — 80 г овощей или фруктов.', изЧего: [] },
  { k: 'молочное', t: 'Молочное', v: 6, из: 14, txt: '6 / 14 порций', st: 'lo',
    порция: 'Порция — около 250 мг кальция: стакан молока, кефира или катыка, 200 г нежирного творога или 150 г творога 5–9 %, 30 г твёрдого сыра. 14 порций — это 2 в день.',
    изЧего: [{ н: 'творог обезжиренный', п: 3.4 }, { н: 'exponenta high-pro', п: 1.2 }, { н: 'молоко 1%', п: 1.4 }] },
  { k: 'красное', t: 'Красное мясо', v: 10, из: 5, max: true, txt: '10 / до 5 порций', st: 'hi', порция: 'Порция — 100 г готовой говядины или баранины.', изЧего: [{ н: 'плов', п: 6 }, { н: 'шашлык', п: 4 }] }],
  флаги: [{ k: 'железо', h: 'Железо', t: 'За две недели красное мясо — 1 раз, бобовые — 1.', врач: 'Если быстро устаёшь — спроси у врача анализ на ферритин.', src: [SRC('ODS 2025')] },
    { k: 'кальций', h: 'Кальций', t: 'Молочного — 0,6 порции в день.', врач: null, src: [SRC('Ross 2011')] }] };
async function жми(page, sel, текст) {
  for (const b of await page.$$(sel)) if ((await b.textContent()).trim() === текст) { await b.click(); return true; }
  return false;
}
(async () => {
  const br = await chromium.launch();
  /* ── «Мой день»: блок под неделей ── */
  let page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  let ош = await M.поднять(page, { theme: 'dark', wait: 2400, page: 'food', week: { группы: ГРУППЫ } });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  дано(!(await page.$eval('#grpg', e => e.hidden)), 'блок «Разнообразие недели» виден');
  const после = await page.evaluate(() => { const g = document.getElementById('fweek').parentElement; return g.nextElementSibling && g.nextElementSibling.id; });
  дано(после === 'grph', 'стоит сразу под графиком недели (его выбор — вариант А): ' + после);
  const строки = await page.$$eval('#grpg .grow', ns => ns.map(n => n.querySelector('b').innerText + '|' + n.querySelector(':scope > span').className));
  дано(строки.length === 5, 'пять групп: ' + строки.join(', '));
  дано(строки[0] === 'Рыба|lo' && строки[1] === 'Бобовые|ok' && строки[4] === 'Красное мясо|hi', 'мало — красным, в норме — зелёным, много — красным');
  дано(await page.$$eval('#grpg .gbar s', ns => ns.length) === 5, 'у каждой строки — черта ориентира');
  /* 27.09: одна единица, черта в одной точке, у каждой строки — зелёная зона */
  const числа = await page.$$eval('#grpg .grow > span', ns => ns.map(n => n.innerText));
  дано(числа.join(' | ') === '1,5 / 2 порции | 3 / 3 порции | 25 / 35 порций | 6 / 14 порций | 10 / до 5 порций', 'всё — порциями за неделю: ' + числа.join(' | '));
  const черты = await page.$$eval('#grpg .gbar s', ns => ns.map(n => parseFloat(n.style.left)));
  дано(черты.every(x => Math.abs(x - 71.4) < 0.2), 'черта ориентира у всех строк в одной точке (71 %, как у шкал дня): ' + черты.join(', '));
  const зоны = await page.$$eval('#grpg .gbar .gcor', ns => ns.map(n => n.style.left + '/' + (n.style.width || 'до конца')));
  дано(зоны.length === 5 && зоны[0] === '71.4%/до конца' && зоны[4] === '0px/71.4%', 'зелёная зона: у «от» — правее черты, у «до» — левее: ' + зоны.join(', '));
  дано(await page.$$eval('#grpg .gpor', ns => ns.length) === 0, 'свёрнуто — расшифровки нет');
  await page.click('#grpg .grow[data-g="молочное"]'); await page.waitForTimeout(300);
  const мол = await page.$eval('#grpg .grow[data-g="молочное"]', e => e.innerText);
  дано(/200 г нежирного творога/.test(мол), 'нажал «Молочное» — что такое порция: творог 200 г, а не «одна порция»');
  дано(await page.$$eval('#grpg .grow[data-g="молочное"] .fbsplit li', ns => ns.map(n => n.querySelector('.fbn').innerText).join(',')) === 'творог обезжиренный,exponenta high-pro,молоко 1%',
    'и из чего набралось — по продуктам');
  дано(await page.$eval('#grpg .grow[data-g="молочное"]', e => e.getAttribute('aria-expanded')) === 'true', 'aria-expanded = true');
  await page.click('#grpg .grow[data-g="красное"]'); await page.waitForTimeout(300);
  дано(await page.$$eval('#grpg .grow.gon', ns => ns.map(n => n.dataset.g).join(',')) === 'красное', 'открыта одна строка — другая закрылась');
  await page.click('#grpg .grow[data-g="красное"] > b'); await page.waitForTimeout(300);
  дано(await page.$$eval('#grpg .grow.gon', ns => ns.length) === 0, 'повторное нажатие на строку сворачивает (по списку — нет, как у шкал дня)');
  const флаги = await page.$$eval('#grpg .gflag', ns => ns.map(n => n.querySelector('h4').innerText + '|' + !!n.querySelector('.doc')));
  дано(флаги.join(',') === 'Железо|true,Кальций|false', 'карточки рисков: у железа — строка про врача, у кальция её нет: ' + флаги.join(','));
  дано(!/\d+\s*мкг|таблет|принимай/i.test(await page.$eval('#grpg', e => e.innerText)), 'доз и таблеток на экране нет');
  const ссылок = await page.$$eval('#grpg .srcs button', ns => ns.map(n => n.getAttribute('data-src')));
  дано(ссылок.length === 4 && ссылок.every(u => /^https:\/\//.test(u)), 'ссылки — значками, как в чате: ' + ссылок.length);
  const знак = await page.$eval('#grpg .gx .srcs button', b => b.textContent.replace(/\s+/g, ' ').trim());
  дано(/Rimm 2018$/.test(знак) && !/обзор/.test(знак), 'значки короткие — «автор год», чтобы не вставали столбиком (снимок 24.09): ' + знак);
  await page.close();
  /* мало полных дней — статусов нет, так и сказано */
  page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2400, page: 'food', week: { группы: Object.assign({}, ГРУППЫ, { полных: 2, флаги: [], строки: ГРУППЫ.строки.map(r => Object.assign({}, r, { st: '' })) }) } });
  дано(/судить о разнообразии рано/.test(await page.$eval('#grpg .gnote', e => e.innerText)), 'полных дней 2 — «судить рано»');
  дано(await page.$$eval('#grpg .grow span.lo, #grpg .grow span.hi', ns => ns.length) === 0, 'и без красного');
  await page.close();
  /* нет данных — нет блока */
  page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2400, page: 'food' });
  дано(await page.$eval('#grpg', e => e.hidden) && await page.$eval('#grph', e => e.hidden), 'без групп от сервера блока нет');
  await page.close();

  /* ── «Что съесть › Неделя»: строка «в этом меню» ── */
  const ЗАВТРА = M.Д(-1), И = (name, g) => ({ name, g, kcal: 100, prot: 10, fat: 3, carb: 10 });
  const день = d => ({ date: d, зал: false, спорт: [], норма: { kcal: 1800, prot: 150 }, kcal: 1790, prot: 152, белокМало: 0,
    приёмы: [{ id: d + 'a', kind: 'обед', text: 'Скумбрия с салатом', мин: 20, kcal: 700, prot: 50, items: [И('Скумбрия запечённая', 150)] }] });
  const НЕД = { ok: true, span: 'week', from: ЗАВТРА, at: Date.now(), note: 'ок', дни: [день(ЗАВТРА)], покупки: { семья: 1, дней: 7, дома: [], отделы: [] },
    группы: { дней: 7, рыба: 3, бобовые: 2, овощиФрукты: 40, молочное: 14, красное: 3, колбаса: 0 } };
  page = await br.newPage({ viewport: { width: 390, height: 1200 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2400, page: 'eat', menu: { завтра: ЗАВТРА, week: НЕД } });
  await page.click('#eatbody [data-eseg="week"]'); await page.waitForTimeout(600);
  const стр = await page.$eval('#eatbody .gmenu', e => e.innerText).catch(() => '');
  дано(/^В этом меню, порций за неделю: рыба 3 · бобовые 2 · овощи и фрукты 40 · молочное 14 · красное мясо 3$/.test(стр), 'над меню недели — что оно закрывает, в порциях за неделю: ' + стр);
  дано(await page.$$eval('#eatbody .gmenu b', ns => ns.map(n => n.innerText).join('|')) === 'рыба 3|овощи и фрукты 40|молочное 14|красное мясо 3', 'закрытое — зелёным, бобовые 2 из 3 — нет');
  await page.close();

  /* ── метформин в блоке здоровья ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  let ушло = null;
  page.on('request', req => { try { if (/\/s$/.test(new URL(req.url()).pathname)) { const b = JSON.parse(req.postData() || '{}'); if (b.key === 'me') ушло = b.data && b.data.me ? b.data.me : b.data; } } catch (e) {} });
  await M.поднять(page, { theme: 'dark', wait: 2600, me: { sex: 'm', age: 50, ht: 176, bw: 88, only: 'all', wt: 'down', gym: 'muscle' } });
  await page.click('#profbtn'); await page.waitForTimeout(700);
  await page.click('#zdtoggle'); await page.waitForTimeout(400);
  дано(await page.$eval('#zd-diamore', e => e.hidden), 'без диабета вопроса про метформин нет');
  await жми(page, '#zd-dia button', '2 тип'); await page.waitForTimeout(400);
  const подписи = await page.$$eval('#zd-diamore .pfl', ns => ns.map(n => n.innerText));
  дано(подписи.some(x => /метформин \(Сиофор, Глюкофаж\)/.test(x)), 'при диабете — вопрос про метформин с именами из аптеки: ' + подписи.join(' | '));
  дано(await жми(page, '#zd-met button', 'да'), 'отвечается');
  await page.waitForTimeout(600);
  дано(!!ушло && ушло.med && ушло.med.met === 1 && ушло.med.dia === 't2', 'уехал в профиль: ' + JSON.stringify((ушло || {}).med || null));
  дано(/метформин/.test(await page.$eval('#zdsum', e => e.innerText)), 'и виден в свёрнутой строке');
  await жми(page, '#zd-dia button', 'нет'); await page.waitForTimeout(600);
  дано(!!ушло && ушло.med.met === null, 'снял диабет — метформин стёрся: ' + JSON.stringify((ушло || {}).med || null));
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
