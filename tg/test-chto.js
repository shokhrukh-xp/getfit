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
  if (f) { await f.click(); await page.waitForTimeout(1400); }
}

(async () => {
  const br = await chromium.launch();

  /* ── обычный вечер: остаток есть ── */
  let page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  /* слушаем, а не перехватываем: мок ставит свои маршруты позже и выигрывает,
     а нам важно только то, что ушло, и с каким id */
  let поймал = null;
  page.on('request', req => {
    if (!/\/meal\/repeat/.test(req.url())) return;
    try { поймал = JSON.parse(req.postData() || '{}'); } catch (e) {}
  });
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await еда(page);

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

  /* ── примерка ── */
  const чипы = await page.$$('#podchips button');
  дано(чипы.length >= 4, 'есть ряд блюд для примерки: ' + чипы.length);
  if (чипы[3]) { await чипы[3].click(); await page.waitForTimeout(400); }
  const строка = await page.$eval('#fpod .podfit', e => e.innerText).catch(() => '');
  дано(/перебор \d+ ккал/.test(строка), 'примерка отвечает арифметикой, а не молчанием: ' + строка);
  дано(/белка не хватит \d+/.test(строка), 'и говорит про белок тоже');
  const ещёРаз = await page.$$('#podchips button');
  if (ещёРаз[3]) { await ещёРаз[3].click(); await page.waitForTimeout(350); }
  const пусто = await page.$('#fpod .podfit');
  дано(!пусто, 'повторное нажатие снимает примерку');
  await page.close();

  /* ── день закрыт: предлагать нечего ── */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2800, eat: {
    тип: 'ужин', впереди: 1, пусто: true, всё: true,
    ост: { kcal: 0, prot: 4, fib: 0 }, цель: { kcal: 0, prot: 1, fib: 0 },
    норма: { kcal: 1750, prot: 160, fib: 20 }, съел: { kcal: 1974, prot: 156, fib: 20 },
    варианты: [], примерка: [] } });
  await еда(page);
  const всё = await page.$eval('#fpod', e => e.innerText).catch(() => '');
  дано(/на сегодня всё/i.test(всё), 'когда есть нечего — сказано прямо: ' + всё.replace(/\s+/g, ' ').slice(0, 90));
  дано(!/Записать/.test(всё), 'и ничего не предлагается');
  await page.close();

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})();
