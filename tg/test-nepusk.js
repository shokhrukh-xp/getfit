'use strict';
/* ── УБРАННЫЙ ИЗ КРУГА ─────────────────────────────────────────────────
   19.09. Крестик рядом с человеком до сегодня ничего не решал: код круга
   у него оставался, и он входил обратно тем же шагом, каким вошёл в
   первый раз. Хозяин при этом был уверен, что убрал.
   Теперь убранный виден списком «не пускаю», и его можно вернуть.
   Проверено: список показан только хозяину, «вернуть» уходит на сервер с
   тем человеком, на которого нажали, и рядом с составом сказано, что
   делает крестик — иначе это снова кнопка без последствий. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

async function лист(page) {
  const f = await page.$('.l1 button[data-page="food"]');
  if (f) { await f.click(); await page.waitForTimeout(600); }
  for (const кн of await page.$$('.zseg button'))
    if ((await кн.textContent()).trim() === 'Рейтинг' && await кн.isVisible()) { await кн.click(); break; }
  await page.waitForTimeout(1400);
  const ш = await page.$('[data-krug]');
  if (ш) { await ш.click(); await page.waitForTimeout(900); }
  return !!ш;
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, circle: M.круг(),
    banned: [{ uid: '777000111', name: 'Сосед' }] });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  дано(await лист(page), 'лист круга открывается');
  const текст = await page.evaluate(() => (document.getElementById('krugbody') || {}).innerText || '');
  дано(/не войд[её]т по коду/i.test(текст), 'сказано, что делает крестик: ' + (текст.match(/[^\n]*по коду[^\n]*/i) || [''])[0].slice(0, 90));
  дано(/не пускаю/i.test(текст), 'убранные видны отдельным списком');

  let ушло = null;
  page.on('request', r => { if (/\/circle\/unban/.test(r.url())) { try { ушло = JSON.parse(r.postData() || '{}'); } catch (e) {} } });
  const вернуть = await page.$('[data-kunban]');
  дано(!!вернуть, 'у убранного есть «Вернуть»');
  if (вернуть) {
    const кого = await вернуть.getAttribute('data-kunban');
    await вернуть.click();
    await page.waitForTimeout(900);
    дано(!!ушло, 'нажатие «Вернуть» уходит на сервер');
    дано(!!ушло && ушло.who === кого, 'и возвращает именно того, на кого нажали: ' + (ушло && ушло.who));
    дано(!!ушло && !!ушло.id, 'с указанием круга: ' + (ушло && ушло.id));
  }
  await page.close();

  /* никого не убирали — раздела быть не должно, пустой заголовок хуже, чем его отсутствие */
  const чисто = await br.newPage({ viewport: { width: 390, height: 900 } });
  await чисто.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(чисто, { theme: 'dark', wait: 2800, circle: M.круг(), banned: [] });
  await лист(чисто);
  const т2 = await чисто.evaluate(() => (document.getElementById('krugbody') || {}).innerText || '');
  дано(!/не пускаю/i.test(т2), 'в круге без убранных раздела нет');
  дано(/не войд[её]т по коду/i.test(т2), 'а объяснение про крестик стоит всегда');
  await чисто.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
