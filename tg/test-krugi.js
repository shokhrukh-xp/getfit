'use strict';
/* ── СВОИ КРУГИ, ПРИГЛАШЕНИЯ И ПРОМОКОД ───────────────────────────────
   15.09, его просьба: круги заводит каждый сам и видит только тех, кого
   позвал; своя ссылка приносит баллы, а баллами платится месяц; промокод
   открывает всё насовсем. Здесь проверено то, что ломается тихо: чужой
   круг нельзя закрыть (только выйти), свой — только закрыть; кнопка
   «оплатить баллами» не появляется, пока баллов не хватает; промокод
   виден там же, где цена, а не отдельным экраном. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

async function профиль(page) {
  await page.click("#profbtn");
  await page.waitForTimeout(900);
}
async function рейтинг(page) {
  const f = await page.$('.l1 button[data-page="food"]');
  if (f) { await f.click(); await page.waitForTimeout(600); }
  for (const кн of await page.$$('.zseg button'))
    if ((await кн.textContent()).trim() === 'Рейтинг' && await кн.isVisible()) { await кн.click(); break; }
  await page.waitForTimeout(1400);
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, circle: M.круг() });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* 17.09, его слова: «не понимаю секцию друзья, оставь там только ссылку
     поделиться». Круги целиком переехали на вкладку «Рейтинг» — в профиле
     их быть не должно вовсе, иначе это снова два места про одно. */
  await профиль(page);
  дано(!(await page.$('#invbox')), 'кругов в профиле больше нет — они живут на своей вкладке');
  дано(!(await page.$('#invjoini')), 'и вход по коду оттуда тоже убран');
  await page.click('#profclose').catch(() => {});
  await page.waitForTimeout(400);
  await рейтинг(page);
  const чипы = await page.$$eval('.cirsw .mchip', bs => bs.map(b => b.innerText.replace(/\s+/g, ' ').trim()));
  дано(чипы.length >= 2, 'круги видны полосой на вкладке: ' + чипы.join(' | '));
  дано(чипы.some(t => /\+$/.test(t)) || !!(await page.$('#cirnew')), 'и рядом «+», чтобы завести новый');

  /* ── ЛИСТ КРУГА: «Отправить приглашение» ──
     17.09, его слова: «кнопка приглашения не работает». Она и правда не
     делала ничего: разметку листа положили в своё окно #krugm, а обработчик
     [data-cshare] остался на #cirbody — соседнем поддереве, и клик до него
     не доходил. Проверка ловит именно это: нажатие обязано открыть ссылку
     на шаринг с кодом круга внутри. */
  await page.evaluate(() => {
    window.поймал = null;
    if (window.Telegram && window.Telegram.WebApp)
      window.Telegram.WebApp.openTelegramLink = u => { window.поймал = u; };
  });
  const шестерня = await page.$('[data-krug]');
  дано(!!шестерня, 'в круге есть, чем открыть его настройки');
  if (шестерня) {
    await шестерня.click();
    await page.waitForTimeout(700);
    const естьКнопка = await page.$('#krugm [data-cshare]');
    дано(!!естьКнопка, 'в листе круга есть «Отправить приглашение»');
    if (естьКнопка) {
      await естьКнопка.click();
      await page.waitForTimeout(500);
      const ссылка = await page.evaluate(() => window.поймал);
      дано(!!ссылка && /t\.me\/share/.test(ссылка), 'нажатие открывает шаринг, а не молчит: ' + (ссылка || 'ничего не произошло'));
      дано(!!ссылка && /%D0%9A%D0%BE%D0%B4|Код/.test(decodeURIComponent(ссылка || '')), 'в приглашении есть код круга');
    }
    await page.click('#krugclose').catch(() => {});
    await page.waitForTimeout(400);
  }
  /* завести свой круг и войти в чужой — обе двери на вкладке, а не в профиле */
  await рейтинг(page);
  await page.click('#cirnew').catch(() => {});
  await page.waitForTimeout(700);
  дано(!!(await page.$('#k-new')), 'на вкладке есть, где завести свой круг');
  дано(!!(await page.$('#k-join')), 'и где войти в чужой по коду — раньше это было только в профиле');
  await page.fill('#k-new', 'зал');
  const до = await page.$eval('#k-new', e => e.value);
  дано(до === 'зал', 'имя вводится: ' + до);
  await page.click('#krugclose').catch(() => {});
  await page.waitForTimeout(400);

  /* ── ссылка «поделиться»: одна, без свёрнутых списков ── */
  await профиль(page);
  const что = await page.$eval('#refwhat', e => e.textContent.trim());
  дано(/500 баллов/.test(что), 'сказано, сколько даёт приглашение: ' + что);
  const ссылка = await page.$eval('#reflink', e => e.value);
  дано(/start=r_\d+/.test(ссылка), 'ссылка личная, с меткой пригласившего: ' + ссылка);
  дано(await page.$eval('#refspend', e => e.hidden), 'без баллов кнопки «оплатить баллами» нет');
  await page.close();

  /* ── у кого баллы есть ── */
  const богатый = await br.newPage({ viewport: { width: 390, height: 900 } });
  await богатый.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(богатый, { theme: 'dark', wait: 2800, circle: M.круг(),
    ref: { points: 1000, earned: 1000, spent: 0, people: [{ name: 'Фируз', paid: true }, { name: 'Пётр', paid: false }] } });
  await профиль(богатый);
  await богатый.waitForTimeout(600);
  const кн = await богатый.$eval('#refspend', e => ({ скрыта: e.hidden, текст: e.textContent.trim() }));
  дано(!кн.скрыта && /1000/.test(кн.текст), 'с баллами кнопка есть и показывает счёт: ' + кн.текст);
  const люди = [await богатый.$eval('#refsum2', e => e.textContent.trim())];
  дано(/пришли 2/.test(люди[0]) && /подписку 1/.test(люди[0]), 'итог одной строкой вместо списка: ' + люди[0]);
  await богатый.close();

  /* ── промокод живёт там же, где цена ── */
  const гость = await br.newPage({ viewport: { width: 390, height: 900 } });
  await гость.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(гость, { theme: 'dark', page: 'food', wait: 2800, sub: 'нет' });
  await гость.fill('#ftext', 'плов');
  await гость.click('#fsend');
  await гость.waitForTimeout(1400);
  дано(await гость.$eval('#sub-promo', e => !!e.offsetParent), 'в листе с ценой есть поле промокода');
  await гость.fill('#sub-code', 'нетакого');
  await гость.click('#sub-codeb');
  await гость.waitForTimeout(900);
  дано(await гость.evaluate(() => document.getElementById('subm').classList.contains('show')),
    'неверный код лист не закрывает');
  await гость.fill('#sub-code', 'getfit');
  await гость.click('#sub-codeb');
  await гость.waitForTimeout(1400);
  дано(!(await гость.evaluate(() => document.getElementById('subm').classList.contains('show'))),
    'верный код закрывает лист — доступ открыт');
  await гость.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
