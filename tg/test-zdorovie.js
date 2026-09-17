'use strict';
/* ── ЗДОРОВЬЕ ─────────────────────────────────────────────────────────
   17.09, его просьба: у сестры диабет, и всё, что советует приложение,
   обязано это учитывать. Здесь проверяется ВОПРОС и его судьба: блок есть
   в двух местах, подвопросы появляются только когда есть о чём, ответ
   уезжает на сервер, а тем, кто уже пользуется приложением, про это вообще
   сказали — иначе они не узнали бы никогда.

   Числа по этим ответам зажимает сервер (норму, белок, темп цели) — это
   проверяется живой проверкой на служебном пользователе, не отсюда. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const ПРОФИЛЬ = { sex: 'm', age: 34, ht: 176, bw: 88, only: 'all', wt: 'down', gym: 'muscle' };

async function жми(page, sel, текст) {
  for (const b of await page.$$(sel)) if ((await b.textContent()).trim() === текст) { await b.click(); return true; }
  return false;
}

(async () => {
  const br = await chromium.launch();

  /* ── профиль: блок, подвопросы, сохранение ── */
  let page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  let ушло = null;
  page.on('request', req => {
    try { if (/\/s$/.test(new URL(req.url()).pathname)) {
      const b = JSON.parse(req.postData() || '{}');
      if (b.key === 'me') ушло = b.data && b.data.me ? b.data.me : b.data;
    } } catch (e) {}
  });
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, me: ПРОФИЛЬ });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  await page.click('#profbtn'); await page.waitForTimeout(700);
  дано(!!(await page.$('#zdbox')), 'в профиле есть блок «здоровье»');
  дано((await page.$eval('#zdsum', e => e.innerText)) === 'не заполнено',
    'пока не спрашивали — так и написано: ' + (await page.$eval('#zdsum', e => e.innerText)));
  дано(await page.$eval('#zdbody', e => e.hidden), 'свёрнут — одна строка, а не простыня');

  /* стоит под целью: здоровье меняет норму, а не дополняет её */
  const порядок = await page.$$eval('#profm .goalcard, #profm #zdbox, #profm .psec',
    ns => ns.map(n => n.id || n.className.split(' ')[0]));
  дано(порядок.indexOf('zdbox') === 1, 'стоит сразу под целью, до всех разделов: ' + порядок.join(' → '));

  await page.click('#zdtoggle'); await page.waitForTimeout(400);
  дано(!(await page.$eval('#zdbody', e => e.hidden)), 'раскрывается');
  дано(await page.$eval('#zd-diamore', e => e.hidden), 'подвопросов про диабет пока нет — не о чем спрашивать');

  дано(await жми(page, '#zd-dia button', '2 тип'), 'выбирается тип диабета');
  await page.waitForTimeout(400);
  дано(!(await page.$eval('#zd-diamore', e => e.hidden)), 'и подвопросы появляются');
  const подписи = await page.$$eval('#zd-diamore .pfl', ns => ns.map(n => n.innerText));
  /* «сахар в крови», а не просто «сахар»: в этом же приложении «сахар» —
     это добавленный сахар в ЕДЕ, и путать их нельзя. */
  дано(подписи.join(' | ').indexOf('колешь инсулин') >= 0 && подписи.join(' | ').indexOf('сахар в крови падает низко') >= 0,
    'спрашиваем то, что человек про себя знает, а не группу препарата: ' + подписи.join(' | '));
  дано(!/таблетк|секретагог|препарат/i.test(подписи.join(' ')), 'и без слов, которых он не обязан знать');

  дано(await жми(page, '#zd-ins button', 'колю'), 'отмечается инсулин');
  await page.waitForTimeout(500);
  дано((await page.$eval('#zdsum', e => e.innerText)).indexOf('диабет 2 типа') === 0,
    'сводка в свёрнутой строке говорит, что внутри: ' + (await page.$eval('#zdsum', e => e.innerText)));
  дано((await page.$eval('#zdsum', e => e.innerText)).indexOf('инсулин') > 0, 'и инсулин в ней виден');

  дано(!!ушло && !!ушло.med, 'ответ уехал на сервер в профиле');
  дано(!!ушло && ушло.med.dia === 't2' && ушло.med.ins === 1,
    'ровно тем, что отмечено: ' + JSON.stringify((ушло || {}).med || null));
  /* Вес тут 88,1, а не 88: приложение подтягивает его из последнего замера.
     Проверяем то, что здоровье не трогает — рост, возраст и цель. */
  дано(!!ушло && ушло.ht === 176 && ушло.age === 34 && ушло.wt === 'down' && ушло.bw > 0,
    'и остальной профиль при этом цел: рост ' + (ушло||{}).ht + ', вес ' + (ушло||{}).bw);

  /* «нет» убирает и подвопросы, и всё, что под ними: данные о здоровье,
     которые нельзя забрать обратно, — это ловушка */
  await жми(page, '#zd-dia button', 'нет');
  await page.waitForTimeout(500);
  дано(await page.$eval('#zd-diamore', e => e.hidden), 'снял диабет — подвопросы ушли');
  дано(!!ушло && !ушло.med.dia && ушло.med.ins === null,
    'и ответы под ними стёрлись: ' + JSON.stringify((ушло || {}).med || null));
  дано((await page.$eval('#zdsum', e => e.innerText)) === 'ничего из этого нет',
    'сводка честная: ' + (await page.$eval('#zdsum', e => e.innerText)));

  /* аллергия живёт отдельно от диабета */
  await page.fill('#zd-no', 'лактоза'); await page.waitForTimeout(600);
  дано(!!ушло && ушло.med.no === 'лактоза', 'чего не ешь — уезжает отдельно: ' + JSON.stringify((ушло || {}).med || null));
  await page.close();

  /* ── карточка тем, кто уже пользуется ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2800, me: ПРОФИЛЬ });
  const карточка = await page.$('#zdnudge');
  дано(!!карточка && !(await карточка.evaluate(e => e.hidden)), 'кто уже внутри — видит карточку на главной');
  const текст = await page.$eval('#zdnudge', e => e.innerText);
  дано(/здоровье/i.test(текст) && /диабет/i.test(текст), 'и она говорит, о чём речь: ' + текст.slice(0, 80));
  await page.click('#zdnudge'); await page.waitForTimeout(700);
  дано(await page.$eval('#profm', e => e.classList.contains('show')), 'нажатие открывает профиль');
  дано(!(await page.$eval('#zdbody', e => e.hidden)), 'сразу на раскрытом блоке, а не «ищи сам»');
  дано(await page.$eval('#zdnudge', e => e.hidden), 'и второй раз карточка не появляется');
  await page.close();

  /* у кого здоровье уже заполнено — карточки нет */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2800,
    me: Object.assign({}, ПРОФИЛЬ, { med: { dia: '', no: '', bp: 0, preg: 0, at: '2026-09-17T10:00:00Z' } }) });
  дано(await page.$eval('#zdnudge', e => e.hidden), 'кто уже ответил — карточку не видит, даже если ответил «ничего»');
  await page.close();

  /* ── знакомство ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2800, newbie: true });
  await page.waitForTimeout(900);
  const зн = await page.$('#wzzd');
  дано(!!зн, 'в знакомстве блок тоже есть');
  дано(!!зн && await зн.evaluate(e => !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'),
    'и он на виду, а не спрятан за шагом');
  дано(await page.$eval('#wzzdbody', e => e.hidden), 'свёрнут: у кого ничего нет, знакомство не удлиняется');
  const пояс = await page.$eval('#wzzdsum', e => e.innerText);
  дано(/диабет/.test(пояс) && /если есть/.test(пояс), 'строка сама объясняет, зачем её открывать: ' + пояс);
  await page.click('#wzzdtoggle'); await page.waitForTimeout(400);
  дано(!!(await page.$('#wz-dia')), 'внутри тот же набор вопросов, что и в профиле');
  дано(await жми(page, '#wz-dia button', '1 тип'), 'диабет выбирается и тут');
  await page.waitForTimeout(300);
  дано(!(await page.$eval('#wz-diamore', e => e.hidden)), 'и подвопросы раскрываются так же');
  await page.close();

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})();
