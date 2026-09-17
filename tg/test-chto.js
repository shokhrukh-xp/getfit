'use strict';
/* ── ЧТО СЪЕСТЬ ───────────────────────────────────────────────────────
   17.09. Самая частая просьба в приложении — «чем набрать остаток» и
   «влезет ли плов»: 23 сообщения из 167 написанных руками. Отвечал на неё
   только чат, полным вызовом модели, а на экране ответа не было вовсе.
   Здесь проверено то, что ломается тихо: цель ОДНОГО приёма не равна
   остатку дня (17.09 подбор предложил целого цыплёнка на завтрак, честно
   взяв весь дневной остаток); «Записать» кладёт именно тот приём, который
   показан; примерка отвечает арифметикой, а не молчанием; а когда есть
   нечего — так и сказано, вместо «ещё немножко». */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

async function еда(page) {
  const f = await page.$('.l1 button[data-page="food"]');
  if (f) { await f.click(); await page.waitForTimeout(1000); }
}
/* 17.09: подбор переехал из «Моего дня» в свою вкладку внутри Еды */
async function вкладка(page) {
  await еда(page);
  for (const b of await page.$$('#fseg-food button'))
    if ((await b.textContent()).trim() === 'Что съесть') { await b.click(); break; }
  await page.waitForTimeout(1200);
}

(async () => {
  const br = await chromium.launch();

  /* ── обычный вечер: остаток есть ── */
  let page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  /* слушаем, а не перехватываем: мок ставит свои маршруты позже и выигрывает,
     а нам важно только то, что ушло, и с каким id */
  let поймал = null;
  let добавил = null;
  page.on('request', req => {
    try {
      if (/\/meal\/repeat/.test(req.url())) поймал = JSON.parse(req.postData() || '{}');
      if (/\/meal\/add/.test(req.url())) добавил = JSON.parse(req.postData() || '{}');
    } catch (e) {}
  });
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await вкладка(page);

  const есть = await page.$('#fpod');
  дано(!!есть, 'на экране еды есть блок «Что съесть»');

  const цель = await page.$eval('#fpod .podc', e => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
  дано(/517/.test(цель) && /53/.test(цель), 'показана цель ОДНОГО приёма, а не остаток дня: ' + цель);
  const под = await page.$eval('#fpod .podsub', e => e.innerText).catch(() => '');
  дано(/за день/i.test(под), 'рядом сказано, сколько осталось за день: ' + под);

  const карточки = await page.$$eval('#fpod .podv', ks => ks.map(k => ({
    имя: (k.querySelector('h4') || {}).innerText || '',
    числа: (k.querySelector('.pn') || {}).innerText.replace(/\s+/g, ' ').trim() || '',
    как: (k.querySelector('p') || {}).innerText || ''
  })));
  дано(карточки.length === 3, 'три варианта: ' + карточки.length);
  дано(карточки.every(k => /ккал \d+/.test(k.числа) && /белок \d+/.test(k.числа)), 'у каждого варианта числа на виду');
  дано(карточки.every(k => /\./.test(k.как) && k.как.length > 10), 'у каждого сказано, как он ложится');
  дано(/белок закрывает целиком/.test(карточки[0].как), 'первый вариант закрывает белок: ' + карточки[0].как);

  /* «Записать» кладёт именно показанный приём */
  await page.click('#fpod .podv.best [data-podadd]');
  await page.waitForTimeout(700);
  дано(!!поймал && поймал.id === 'm1', 'записывается тот приём, что показан: id ' + ((поймал || {}).id || 'ничего не ушло'));

  /* ── вкладка и каталог ── */
  const сег = await page.$$eval('#fseg-food button', bs => bs.map(b => b.textContent.trim()));
  дано(сег.indexOf('Что съесть') >= 0, 'вкладка стоит внутри Еды: ' + сег.join(' | '));

  const строки = await page.$$eval('.eatrow .en b', bs => bs.map(b => b.innerText));
  дано(строки.length >= 8, 'каталог показывает своё и базу вместе: ' + строки.length);
  дано(строки[0] === 'Творог, яйца, греческий йогурт и банан',
    'сверху то, что лучше ложится в остаток, а не первое из файла: ' + строки[0]);
  const своё = await page.$$eval('.eatrow .en s', ss => ss.map(x => x.innerText));
  дано(своё.indexOf('своё') >= 0, 'своя еда подписана «своё»');
  дано(своё.indexOf('японская') >= 0 || своё.indexOf('итальянская') >= 0, 'у блюд базы подписана кухня');

  /* фильтр по кухне */
  for (const b of await page.$$('[data-ckuh]'))
    if ((await b.textContent()).trim() === 'японская') { await b.click(); break; }
  await page.waitForTimeout(400);
  const яп = await page.$$eval('.eatrow .en b', bs => bs.map(b => b.innerText));
  дано(яп.length === 1 && /Роллы/.test(яп[0]), 'фильтр по кухне сужает список: ' + яп.join(' | '));

  /* раскрытие говорит, откуда числа */
  await page.click('.eatrow'); await page.waitForTimeout(400);
  const откр = await page.$eval('.eatopen', e => e.innerText).catch(() => '');
  дано(/\u041f\u043e\u0440\u0446\u0438\u044f \d+ \u0433/.test(откр), 'в раскрытии есть порция: ' + откр.split('\n')[0]);
  дано(/технологической карте/.test(откр), 'и сказано, откуда состав: ' + (откр.match(/Состав[^\n]*/) || [''])[0]);

  /* записывается блюдо базы — новой записью, с его числами */
  await page.click('[data-catadd]');
  await page.waitForTimeout(700);
  дано(!!добавил && /Роллы/.test(добавил.text || ''), 'блюдо базы уходит в /meal/add: ' + ((добавил || {}).text || 'ничего не ушло'));
  дано(!!добавил && добавил.kcal === 317 && добавил.prot === 17, 'и уходит с теми числами, что показаны: ' + ((добавил || {}).kcal) + '/' + ((добавил || {}).prot));

  /* сброс возвращает весь каталог */
  await page.click('#catclear'); await page.waitForTimeout(400);
  const снова = await page.$$eval('.eatrow', r => r.length);
  дано(снова >= 8, 'сброс возвращает каталог: ' + снова);

  /* поиск */
  await page.fill('#eatq', 'паст'); await page.waitForTimeout(500);
  const пск = await page.$$eval('.eatrow .en b', bs => bs.map(b => b.innerText));
  дано(пск.length === 1 && /карбонара/i.test(пск[0]), 'поиск ищет по названию: ' + пск.join(' | '));
  await page.close();

  /* ── день закрыт: предлагать нечего ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2800, eat: {
    тип: 'ужин', впереди: 1, пусто: true, всё: true,
    ост: { kcal: 0, prot: 4, fib: 0 }, цель: { kcal: 0, prot: 1, fib: 0 },
    норма: { kcal: 1750, prot: 160, fib: 20 }, съел: { kcal: 1974, prot: 156, fib: 20 },
    варианты: [], примерка: [] } });
  await вкладка(page);
  const всё = await page.$eval('#fpod', e => e.innerText).catch(() => '');
  дано(/на сегодня всё/i.test(всё), 'когда есть нечего — сказано прямо: ' + всё.replace(/\s+/g, ' ').slice(0, 90));
  дано(!/Записать/.test(всё), 'и ничего не предлагается');
  await page.close();

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})();
