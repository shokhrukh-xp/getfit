'use strict';
/* ── ПРИБОРНАЯ ВЛАДЕЛЬЦА ──────────────────────────────────────────────
   15.09, его выбор из трёх эскизов: экран должен не показывать данные, а
   говорить, что с ними делать. Проверяется поэтому не «числа на месте», а
   порядок и честность: сначала ответ «я в плюсе?», под ним то, что требует
   действия, и только потом таблицы. И главное — вкладки не должно быть ни
   у кого, кроме владельца: она открывает чужие имена и деньги. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

(async () => {
  const br = await chromium.launch();

  /* ── обычный человек: вкладки нет ── */
  const чужой = await br.newPage({ viewport: { width: 390, height: 900 } });
  await чужой.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош0 = await M.поднять(чужой, { theme: 'dark', wait: 2800 });
  дано(ош0.length === 0, 'у обычного человека страница поднялась без ошибок ' + (ош0[0] || ''));
  /* 17.09, его слова: «перенеси Приборную в профиль, убери с главной
     навигации». Владелец один, а пятая вкладка стояла у него внизу всегда. */
  дано(!(await чужой.$('#l1boss')), 'в нижней полосе вкладки «Приборная» нет вовсе');
  await чужой.click('#profbtn'); await чужой.waitForTimeout(700);
  дано(await чужой.$eval('#profboss', e => e.hidden), 'и в профиле её обычный человек не видит');
  дано(!(await чужой.evaluate(() => document.body.classList.contains('boss'))), 'и панель осталась на три кнопки');
  await чужой.close();

  /* ── владелец ── */
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, admin: true });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.click('#profbtn'); await page.waitForTimeout(700);
  дано(!(await page.$eval('#profboss', e => e.hidden)), 'у владельца строка в профиле есть');
  /* 17.09, его слова: «переименуй Приборную в Админ панель». Имя одно на
     весь экран: и в строке профиля, и в шапке самой страницы. */
  дано(await page.$eval('#profboss', e => /Админ панель/.test(e.textContent)),
    'и называется «Админ панель»: ' + (await page.$eval('#profboss', e => e.textContent.trim())));
  await page.click('#profboss');
  await page.waitForTimeout(1300);
  дано(!(await page.$eval('#profm', e => e.classList.contains('show'))), 'нажатие закрывает профиль и уводит на приборную');

  /* порядок блоков — это и есть выбранный эскиз */
  const порядок = await page.evaluate(() => Array.from(document.querySelectorAll('#admbody > *')).map(e => e.className.split(' ')[0]));
  дано(порядок[0] === 'adhero', 'первым идёт ответ «я в плюсе?»: ' + порядок[0]);
  дано(порядок[1] === 'adatt', 'вторым — то, что требует действия: ' + порядок[1]);
  дано(порядок[2] === 'adstrip', 'и только третьим — числа: ' + порядок[2]);

  const герой = await page.$eval('.adhero', e => e.textContent.replace(/\s+/g, ' '));
  дано(/\+\$2,00/.test(герой), 'итог месяца назван деньгами: ' + герой.slice(0, 30));
  дано(/3 000 ★/.test(герой) && /0,013/.test(герой),
    'и рядом, из чего он: звёзды и курс вывода');
  /* 15.09: расход на ИИ перестал быть моей формулой — каждый вызов Gemini
     пишет реальные токены. Проверяем, что на экране стоит факт и что видно
     главное: какая доля входа пришла из кеша. Кеш у Gemini неявный и
     бесплатный, и пока он работает, платный явный заводить не надо. */
  дано(/по факту/.test(герой) && /Google/.test(герой),
    'расход на ИИ считается по факту, и сказано, что счетов Google мы не видим');
  дано(/из кеша/.test(герой) && /%/.test(герой),
    'видно, сколько входа пришло из кеша: ' + (герой.match(/из них[^.]*/) || [''])[0]);
  дано(/21 день/.test(герой), 'сказано и про заморозку перед выводом');

  const тревога = await page.$eval('.adatt', e => e.textContent.replace(/\s+/g, ' '));
  дано(/4 платят/.test(тревога) && /не заходили неделю/.test(тревога),
    'тревога про молчащих платящих: ' + тревога.slice(0, 50));

  const плитки = await page.$$eval('.adstrip .ads', ns => ns.map(n => n.textContent.trim()));
  дано(плитки.length >= 5, 'полоса чисел на месте: ' + плитки.length);

  const люди = await page.$$eval('.adrow', rs => rs.map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  дано(люди.some(t => /Пётр Смирнов/.test(t) && /платит/.test(t)), 'в списке видно, кто платит');
  дано(люди.some(t => /Andrew Nee/.test(t) && /не платит/.test(t)), 'и кто нет');
  дано(люди.some(t => /по ссылке/.test(t)), 'и откуда человек пришёл');
  /* 24.09, его выбор Б: когда заходил — отдельной строкой, неделя и дольше — красным */
  const заход = await page.$$eval('.adrow', rs => rs.filter(r => r.querySelector('.adseen')).map(r => ({
    кто: r.querySelector('.adn b').textContent, т: r.querySelector('.adseen').textContent,
    красн: r.querySelector('.adseen').classList.contains('old'),
    отдельно: r.querySelector('.adseen').previousElementSibling && r.querySelector('.adseen').previousElementSibling.tagName === 'I' })));
  const з = кто => заход.find(x => x.кто === кто) || {};
  дано(заход.length === 3 && заход.every(x => x.отдельно), 'строка «заходил» у каждого, отдельной строкой: ' + заход.length);
  дано(/^заходил (сегодня|вчера) в \d\d:\d\d$/.test(з('Пётр Смирнов').т) && !з('Пётр Смирнов').красн, 'недавний — со временем: ' + з('Пётр Смирнов').т);
  дано(з('Своя').т === 'заходил 3 дня назад' && !з('Своя').красн, 'несколько дней назад: ' + з('Своя').т);
  дано(з('Andrew Nee').т === 'не заходил 12 дней' && з('Andrew Nee').красн, 'неделя и дольше — красным: ' + з('Andrew Nee').т);

  /* промокоды заводятся отсюда же */
  дано(!!(await page.$('#adm-code')) && !!(await page.$('#adm-add')), 'промокод заводится здесь же');
  const код = await page.$eval('.adrow [data-pdrop]', e => e.dataset.pdrop).catch(() => '');
  дано(!!код, 'у заведённого кода есть чем его убрать: ' + код);

  /* плавающая кнопка тренера не закрывает таблицу */
  дано(await page.evaluate(() => { const f = document.querySelector('.coachfab');
    return !f || getComputedStyle(f).display === 'none'; }), 'плавающая кнопка на приборной убрана');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
