'use strict';
/* ── ЗАНЯТИЕ ВНЕ ЗАЛА ──────────────────────────────────────────────────
   13.09: «хочу поиграть в теннис, но не могу найти, как добавить». Механика
   была с самого начала — тренер разбирал «сегодня теннис полтора часа» из
   чата, — но нажать было негде. Кнопка встала в конце дня на «Тренировке»:
   именно там он её искал.

   Главное, что здесь сторожится: ПРИБАВКУ СЧИТАЕТ СЕРВЕР. Формула
   (MET − 1) × вес × часы живёт в воркере одна. Стенд нарочно отвечает
   числом, которого не даст никакая формула (777): если на экране стоит оно —
   приложение показывает ответ сервера, а не считает само. Второе место про
   один факт однажды разойдётся с первым, мы это проходили. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const лист = page => page.evaluate(() => ({
  открыт: !!document.querySelector('#sportm.show'),
  виды: Array.from(document.querySelectorAll('#sp-kind button')).map(b => b.textContent.trim()),
  выбран: (document.querySelector('#sp-kind button[aria-pressed="true"]') || {}).textContent,
  мин: Array.from(document.querySelectorAll('#sp-min button')).map(b => b.textContent.trim()),
  минВыбр: (document.querySelector('#sp-min button[aria-pressed="true"]') || {}).textContent,
  какВыбр: (document.querySelector('#sp-int button[aria-pressed="true"]') || {}).textContent,
  итог: ((document.getElementById('sp-itog') || {}).textContent || '').replace(/\s+/g, ' '),
  полеСвоё: !(document.getElementById('sp-ownrow') || {}).hidden,
  полеМин: !(document.getElementById('sp-minrow') || {}).hidden
}));

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', page: 'gym', wait: 2600, hist: M.журнал() });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(800);

  /* ── кнопка там, где он её искал ── */
  const кн = await page.$('#addsport');
  дано(!!кн, 'кнопка «Занятие вне зала» стоит в конце дня на «Тренировке»');
  const рядом = await page.$eval('.dayedit', e => e.textContent.replace(/\s+/g, ' ')).catch(() => '');
  дано(/Добавить упражнение/.test(рядом) && /Занятие вне зала/.test(рядом),
    'рядом с «Добавить упражнение»: ' + рядом.slice(0, 80));
  дано(/поднимает норму еды/.test(рядом), 'и подписано, куда занятие идёт');

  await кн.scrollIntoViewIfNeeded();
  await кн.click();
  await page.waitForTimeout(900);
  let л = await лист(page);
  дано(л.открыт, 'лист открылся');
  дано(л.виды.length >= 6, 'виды спорта чипами: ' + л.виды.join(' · '));
  дано(/ещё \d+/.test(л.виды.join(' ')), 'полный справочник за «ещё»');
  дано(л.виды.indexOf('своё') >= 0, 'и есть «своё» — его условие про то, чего нет в списке');
  дано(л.мин.length >= 5 && л.мин.indexOf('своё') >= 0, 'минуты готовыми значениями и «своё»: ' + л.мин.join(' '));
  дано(!!л.выбран && !!л.минВыбр && !!л.какВыбр,
    'всё выбрано заранее, записать можно сразу: ' + л.выбран + ' · ' + л.минВыбр + ' · ' + л.какВыбр);

  /* ── ЧИСЛО НА ЭКРАНЕ — ОТВЕТ СЕРВЕРА ── */
  дано(/\+777 ккал/.test(л.итог), 'прибавку показывает сервер, а не считает приложение: ' + л.итог.slice(0, 60));
  дано(/MET/.test(л.итог) && /Compendium/.test(л.итог), 'и видно, откуда она взялась: ' + л.итог.slice(0, 90));

  /* ── «ещё» раскрывает справочник ── */
  await page.click('#sp-kind button[data-spmore]');
  await page.waitForTimeout(400);
  л = await лист(page);
  дано(л.виды.length >= 14, 'после «ещё» виден весь справочник: ' + л.виды.length + ' видов');

  /* ── СВОЁ НАЗВАНИЕ: «может чего-то не будет в списке» ── */
  await page.click('#sp-kind button[data-spown]');
  await page.waitForTimeout(300);
  л = await лист(page);
  дано(л.полеСвоё, 'нажал «своё» — открылось поле для названия');
  await page.fill('#sp-own', 'джиу-джитсу');
  await page.waitForTimeout(900);
  л = await лист(page);
  дано(/джиу-джитсу/.test(л.итог), 'своё название уходит на расчёт: ' + л.итог.slice(0, 60));
  дано(/справочник|средним/.test(л.итог),
    'и приложение честно говорит, что вида нет в справочнике: ' + л.итог.slice(0, 100));

  /* ── свои минуты ── */
  await page.click('#sp-min button[data-spm="own"]');
  await page.waitForTimeout(300);
  дано((await лист(page)).полеМин, 'нажал «своё» у минут — открылось поле');
  await page.fill('#sp-minown', '75');
  await page.waitForTimeout(900);
  дано(/75 мин/.test((await лист(page)).итог), 'свои минуты уходят на расчёт');

  /* ── запись ── */
  await page.click('#sp-save');
  await page.waitForTimeout(1400);
  дано(!(await лист(page)).открыт, 'после записи лист закрылся');
  const строка = await page.$eval('#sporttoday', e => e.textContent.replace(/\s+/g, ' ')).catch(() => '');
  дано(/Сегодня/.test(строка) && /джиу-джитсу/.test(строка),
    'под кнопкой видно, что занятие засчиталось: ' + строка.slice(0, 80));
  дано(/777/.test(строка), 'с той же прибавкой, что показывал лист: ' + строка.slice(0, 80));
  дано(/в день/.test(строка), 'и есть путь туда, где запись живёт');

  /* ── использованный вид встаёт первым ── */
  await page.click('#addsport');
  await page.waitForTimeout(800);
  л = await лист(page);
  дано(л.виды[0] === 'джиу-джитсу' && л.выбран === 'джиу-джитсу',
    'в следующий раз своё занятие стоит первым и выбрано: ' + л.виды.slice(0, 3).join(' · '));

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
