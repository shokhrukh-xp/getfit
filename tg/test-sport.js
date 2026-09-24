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
  /* 24.09, его просьба: не рядом с «+ Добавить упражнение» (путается),
     а под «Завершить и сохранить», над «Очистить день» */
  const место = await page.evaluate(() => {
    const b = document.getElementById('addsport'), f = document.getElementById('finish'),
          r = document.getElementById('reset'), d = document.querySelector('.dayedit');
    const после = (x, y) => !!(x && y && (x.compareDocumentPosition(y) & 4));
    return { вДне: !!(d && d.contains(b)), подЗавершить: после(f, b), надОчистить: после(b, r),
      ниже: b && f ? Math.round(b.getBoundingClientRect().top - f.getBoundingClientRect().bottom) : null,
      подпись: (document.getElementById('sportlow') || {}).textContent || '' };
  });
  дано(!место.вДне, 'не в блоке «+ Добавить упражнение»');
  дано(место.подЗавершить && место.надОчистить && место.ниже >= 0,
    'под «Завершить и сохранить» и над «Очистить день»: ' + JSON.stringify(место).slice(0, 120));
  дано(/поднимает норму еды/.test(место.подпись), 'и подписано, куда занятие идёт');
  дано(await page.$('#sporttoday .actcard') === null, 'пока занятий нет — пусто, без лишней карточки');

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

  /* ── ЗАНЯТИЕ ПОКАЗАНО КАРТОЧКОЙ, А НЕ СТРОЧКОЙ ──
     Сначала это была одна подпись под кнопкой; его слова: «добавь нормальной
     отдельной карточкой, а не просто одной незаметной строкой». Сделанное
     занятие — такой же факт дня, как закрытое упражнение. */
  const к = await page.evaluate(() => {
    const c = document.querySelector('#sporttoday .actcard');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const спис = document.querySelector('#list .exrow, #list .card');
    return { имя: (c.querySelector('.exname') || {}).textContent || '',
      над: (c.querySelector('.eyebrow') || {}).textContent || '',
      чем: (c.querySelector('.spec') || {}).textContent.replace(/\s+/g, ' ') || '',
      дало: (c.querySelector('.actgain') || {}).textContent.replace(/\s+/g, ' ') || '',
      убрать: !!c.querySelector('[data-actdel]'),
      высота: Math.round(r.height),
      /* карточка стоит в дне, а не под кнопками */
      доКнопок: !!(spис_before()) };
    function spис_before(){
      const c2 = document.querySelector('#sporttoday'), d = document.querySelector('.dayedit');
      return c2 && d && (c2.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });
  дано(!!к, 'занятие показано отдельной карточкой, а не строчкой');
  if (к) {
    дано(/Джиу-джитсу/i.test(к.имя), 'название крупно и с большой буквы: ' + к.имя);
    дано(/вне зала/.test(к.над), 'надкласс говорит, что это за нагрузка: ' + к.над);
    дано(/75 мин/.test(к.чем), 'под ним — чем занятие было: ' + к.чем);
    дано(/777/.test(к.дало) && /норме еды/.test(к.дало), 'отдельной строкой — что оно дало: ' + к.дало);
    дано(к.убрать, 'убрать можно здесь же, не уходя на «Еду»');
    дано(к.высота >= 90, 'карточка заметная, а не строчка: ' + к.высота + 'px');
    дано(!!к.доКнопок, 'и стоит в дне, до кнопок, вместе с упражнениями');
  }

  /* ── крестик убирает занятие ── */
  await page.click('#sporttoday [data-actdel]');
  await page.waitForTimeout(1100);
  дано(await page.$('#sporttoday .actcard') === null, 'крестик убрал занятие из дня');

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
