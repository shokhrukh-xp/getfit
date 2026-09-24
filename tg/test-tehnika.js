'use strict';
/* Техника и разминка (24.09, этап 3 плана). Его выбор из снимков: техника —
   шторка по нажатию на картинку (А), разминка — кнопки над таблицей (Б).
   Заперто: шторка открывается и закрывается; в ней кадры, шаги из tech.json,
   видео и строка об источнике; разминка — 40 % × 6 и 80 % × 6 от рабочего
   веса, кратно шагу, гриф не легче 20; только первое базовое на мышцу; в
   подходы и счёт дня не идёт; отметка переживает перерисовку. И сам файл
   tech.json: 2–5 шагов, без латиницы, без мифа «колени не за носки». */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

/* ── файл ── */
const T = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tech.json'), 'utf8'));
const CAT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog.json'), 'utf8'));
const все = Object.entries(T.ex);
дано(все.length >= 850, 'техника есть у ' + все.length + ' упражнений каталога');
дано(все.every(([, s]) => Array.isArray(s) && s.length >= 2 && s.length <= 5), 'у каждого 2–5 шагов');
дано(все.every(([, s]) => s.every(x => typeof x === 'string' && x.length <= 200)), 'шаг не длиннее 200 знаков');
const латиница = все.filter(([, s]) => s.some(x => /[A-Za-z]/.test(x.replace(/EZ/g, ''))));
дано(латиница.length === 0, 'без латиницы (кроме EZ): ' + латиница.map(x => x[0]).slice(0, 3).join(', '));
const миф = все.filter(([, s]) => s.some(x => /колен\S* не (должн\S* )?выход\S* за (линию )?нос|не выводи колено за носок/.test(x)));
дано(миф.length === 0, 'мифа «колени не за носки» нет: ' + миф.map(x => x[0]).join(', '));
const ids = new Set(CAT.ex.map(x => x.i));
дано(все.every(([i]) => ids.has(i)), 'все ключи — id каталога');
дано(/free-exercise-db/.test(T.src), 'источник назван в самом файле');

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1000 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  /* как в снимке выбора: главная → «Тренировка», вечер — история уже на месте */
  const ош = await M.поднять(page, { theme: 'dark', time: '18:20', page: 'home', wait: 2400 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.click('.l1 button[data-page="gym"]'); await page.waitForTimeout(900);
  const стр = await page.$('#list .exrow'); if (стр) { await стр.click(); await page.waitForTimeout(700); }

  /* ── разминка ── */
  const имя = await page.$eval('.card.exact .exname', n => n.textContent.trim());
  const W = parseFloat(String(await page.$eval('.card.exact .setrow input[data-f="w"]', n => n.placeholder || n.value)).replace(',', '.'));
  const кнопки = await page.$$eval('.card.exact .wuline button', ns => ns.map(n => n.textContent.trim()));
  const ждём = [Math.max(20, Math.round(W * 0.4 / 2.5) * 2.5), Math.max(20, Math.round(W * 0.8 / 2.5) * 2.5)].filter(w => w < W)
    .map(w => String(w).replace('.', ',') + ' кг × 6');
  дано(JSON.stringify(кнопки) === JSON.stringify(ждём), имя + ' на ' + W + ' кг: разминка ' + кнопки.join(' · ') + ' (ждали ' + ждём.join(' · ') + ')');
  дано(await page.$eval('.card.exact .wuline', n => n.nextElementSibling && n.nextElementSibling.classList.contains('setgrid')), 'кнопки — прямо над таблицей подходов');
  дано(!!(await page.$('.card.exact .wuline i')), 'в первый раз — подсказка, что это');
  const рядов = await page.$$eval('.card.exact .settbl .setrow', ns => ns.length);
  const счёт = await page.$eval('#nexthint', n => n.textContent).catch(() => '');
  await page.click('.card.exact .wuline button'); await page.waitForTimeout(300);
  дано(await page.$eval('.card.exact .wuline button', n => n.getAttribute('aria-pressed')) === 'true', 'нажал — разминочный подход отмечен');
  дано(await page.$$eval('.card.exact .settbl .setrow', ns => ns.length) === рядов, 'рабочих подходов столько же — разминка в них не входит');
  дано(await page.$eval('#nexthint', n => n.textContent).catch(() => '') === счёт, 'и счёт подходов дня не изменился');
  await page.evaluate(() => { const b = document.querySelector('.card.exact .exttl'); b.click(); });
  await page.waitForTimeout(300);
  const стр2 = await page.$('#list .exrow'); if (стр2) { await стр2.click(); await page.waitForTimeout(500); }
  const после = await page.$$eval('.card.exact .wuline button', ns => ns.map(n => n.getAttribute('aria-pressed')));
  дано(после[0] === 'true', 'отметка пережила сворачивание карточки');
  дано(!(await page.$('.card.exact .wuline i')), 'подсказка больше не нужна — её нет');

  /* ── шторка техники ── */
  await page.click('.card.exact .exthumb'); await page.waitForTimeout(900);
  const ш = await page.$eval('#techm', n => ({ видно: n.classList.contains('show'), заголовок: n.querySelector('#techtitle').textContent,
    шагов: n.querySelectorAll('.tsteps li').length, кадров: n.querySelectorAll('.tfr img').length,
    видео: (n.querySelector('.tbtns a') || {}).href || '', ист: (n.querySelector('.tsrc') || {}).textContent || '', подп: (n.querySelector('.tsub') || {}).textContent || '' }));
  дано(ш.видно && ш.заголовок === имя, 'шторка открылась, в заголовке — упражнение: ' + ш.заголовок);
  дано(ш.шагов >= 2, 'шаги: ' + ш.шагов + ' («' + ш.подп + '»)');
  дано(/\d (шаг|шага|шагов)$/.test(ш.подп) && !/4 шагов|2 шагов|3 шагов/.test(ш.подп), 'число шагов — по-русски: ' + ш.подп);
  дано(ш.кадров === 2 || ш.кадров === 0, 'кадры крупно: ' + ш.кадров);
  дано(/youtube\.com/.test(ш.видео), 'видео — в шторке');
  дано(/free-exercise-db/.test(ш.ист), 'и откуда текст: ' + ш.ист.slice(0, 40));
  await page.mouse.click(195, 30); await page.waitForTimeout(300);
  дано(!(await page.$eval('#techm', n => n.classList.contains('show'))), 'нажатие мимо шторки закрывает её');

  /* ── кому разминка: только первое базовое на мышцу ── */
  const итог = [];
  const всего = await page.$$eval('#list .exrow, #list .card.exact', ns => ns.length);
  for (let di = 0; di < всего; di++) {
    const кн = await page.$('#list [data-pickex="' + di + '"]');
    if (кн) { await кн.click(); await page.waitForTimeout(400); }
    const имяК = await page.$eval('.card.exact .exname', n => n.textContent.trim()).catch(() => '');
    const есть = !!(await page.$('.card.exact .wuline'));
    const вес = await page.$eval('.card.exact .setrow input[data-f="w"]', n => n.placeholder || n.value).catch(() => '');
    if (имяК) итог.push([имяК, есть, вес]);
  }
  console.log('     упражнения дня: ' + итог.map(x => x[0] + ' ' + (x[2] || '—') + (x[1] ? ' [разминка]' : '')).join(' · '));
  const жим = итог.find(x => /Жим ногами/.test(x[0]));
  дано(!жим || !жим[1], 'жим ногами после приседа — без разминки: квадрицепс уже тёплый');
  const изол = итог.filter(x => /разгибан|сгибан|подъём на носки|Подъёмы на носки/i.test(x[0]) && x[1]);
  дано(изол.length === 0, 'изоляции разминка не ставится: ' + изол.map(x => x[0]).join(', '));
  дано(итог.filter(x => x[1]).length >= 1 && итог[0][1], 'первое базовое дня — с разминкой');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
