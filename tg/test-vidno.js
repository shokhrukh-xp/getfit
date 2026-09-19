'use strict';
/* ── ЧТО ВИДНО СОСЕДЯМ ─────────────────────────────────────────────────
   19.09, его решение: каждый решает за себя. Таблица открыта всегда — в
   ней балл, ради него круг и собран, и человек без балла в нём просто
   пустая строка. А тарелки с фото показывает тот, кто хочет: закрывшийся
   остаётся в таблице и пропадает из ленты.
   Проверено то, что ломается тихо: переключатель стоит под таблицей и
   знает своё состояние; нажатие уходит на сервер тем же значением, какое
   показано; страница закрытого человека говорит про балл, а не «ничего не
   записано» — это разные вещи, и путать их нельзя. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

async function рейтинг(page) {
  const f = await page.$('.l1 button[data-page="food"]');
  if (f) { await f.click(); await page.waitForTimeout(600); }
  for (const кн of await page.$$('.zseg button'))
    if ((await кн.textContent()).trim() === 'Рейтинг' && await кн.isVisible()) { await кн.click(); break; }
  await page.waitForTimeout(1400);
}
const нажат = (page, v) => page.$eval('[data-vid="' + v + '"]', b => b.getAttribute('aria-pressed'));

(async () => {
  const br = await chromium.launch();

  /* ── открыто: так было до настройки, и таким остаётся по умолчанию ── */
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, circle: M.круг() });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await рейтинг(page);

  дано(!!(await page.$('[data-vid="1"]')) && !!(await page.$('[data-vid="0"]')),
    'под таблицей есть выбор, что видно соседям');
  дано(await нажат(page, '1') === 'true' && await нажат(page, '0') === 'false',
    'по умолчанию открыто — тарелки и фото');

  let ушло = null;
  page.on('request', r => { if (/\/circle\/vid/.test(r.url())) { try { ушло = JSON.parse(r.postData() || '{}'); } catch (e) {} } });

  await page.click('[data-vid="0"]');
  await page.waitForTimeout(900);
  дано(!!ушло, 'нажатие «только балл» уходит на сервер');
  дано(!!ушло && ушло.open === false, 'и уходит именно тем значением, какое показано: open=' + (ушло && ушло.open));
  дано(await нажат(page, '0') === 'true' && await нажат(page, '1') === 'false',
    'переключатель сразу показывает выбранное, не дожидаясь ответа');
  const подпись = await page.$eval('[data-vid="0"]', b => {
    const p = b.closest('.lbseg').nextElementSibling; return p ? p.innerText.replace(/\s+/g, ' ').trim() : '';
  });
  дано(/таблице/i.test(подпись) && /не увид|не покаж/i.test(подпись),
    'и объясняет, что в таблице человек остаётся: ' + подпись.slice(0, 90));

  /* повторное нажатие того же — не должно ничего слать заново */
  ушло = null;
  await page.click('[data-vid="0"]');
  await page.waitForTimeout(700);
  дано(!ушло, 'повторное нажатие того же ничего не шлёт');
  await page.close();

  /* ── закрыто: сервер сказал me.open=false, приложение обязано это показать ── */
  const свой = M.круг(); свой.me.open = false;
  const закр = await br.newPage({ viewport: { width: 390, height: 900 } });
  await закр.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(закр, { theme: 'dark', wait: 2800, circle: свой });
  await рейтинг(закр);
  дано(await нажат(закр, '0') === 'true', 'закрытый видит свой выбор, а не чужой по умолчанию');
  const строки = await закр.$$('.lbrow');
  дано(строки.length >= 2, 'и сам остаётся в таблице: строк ' + строки.length);
  await закр.close();

  /* ── страница закрытого соседа: балл есть, тарелок нет, и сказано почему ── */
  const гость = await br.newPage({ viewport: { width: 390, height: 900 } });
  await гость.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(гость, { theme: 'dark', wait: 2800, circle: M.круг(), open: false });
  await рейтинг(гость);
  const чужой = await гость.$('.lbrow:not(.lbme)');
  дано(!!чужой, 'в таблице есть сосед, к которому можно зайти');
  if (чужой) {
    await чужой.click();
    await гость.waitForTimeout(1200);
    const текст = await гость.evaluate(() => (document.getElementById('cirbody') || {}).innerText || '');
    дано(/только балл/i.test(текст), 'страница закрытого говорит про балл: ' + (текст.match(/[^\n]*только балл[^\n]*/i) || [''])[0].slice(0, 80));
    дано(!/ничего не записано/i.test(текст), 'и не выдаёт закрытость за пустой день');
    дано(/7,2|7\.2/.test(текст), 'при этом балл дня виден — таблица не закрывается');
  }
  await гость.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
