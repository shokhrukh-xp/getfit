'use strict';
/* ── ПЕРЕДАТЬ КРУГ ─────────────────────────────────────────────────────
   19.09. Из своего круга хозяин выйти не мог — только закрыть его, а это
   значит убрать таблицу у всех, кто в ней жил. Тупик: человек либо ведёт
   круг вечно, либо ломает его остальным.
   Теперь круг отдаётся тому, кто в нём есть. Проверено: передача стоит
   только у хозяина, спрашивает подтверждение (случайное нажатие меняет
   хозяина круга — это не то, что делают с первого касания), и уходит с
   тем человеком, на которого нажали. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

async function лист(page, чей) {
  const f = await page.$('.l1 button[data-page="food"]');
  if (f) { await f.click(); await page.waitForTimeout(600); }
  for (const кн of await page.$$('.zseg button'))
    if ((await кн.textContent()).trim() === 'Рейтинг' && await кн.isVisible()) { await кн.click(); break; }
  await page.waitForTimeout(1400);
  const ш = await page.$('[data-krug="' + чей + '"]');
  if (ш) { await ш.click(); await page.waitForTimeout(900); }
  return !!ш;
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, circle: M.круг() });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  дано(await лист(page, 'family'), 'лист своего круга открывается');
  const текст = await page.evaluate(() => (document.getElementById('krugbody') || {}).innerText || '');
  дано(!!(await page.$('[data-kboss]')), 'у хозяина есть, кому передать круг');
  дано((await page.$$('[data-kboss]')).length === (await page.$$('[data-kdel]')).length,
    'передача живёт в строке человека, а не вторым списком тех же имён');
  дано(/останешься участником/i.test(текст), 'и сказано, что будет с ним самим: ' + (текст.match(/[^\n]*останешься[^\n]*/i) || [''])[0].slice(0, 80));

  let ушло = null;
  page.on('request', r => { if (/\/circle\/owner/.test(r.url())) { try { ушло = JSON.parse(r.postData() || '{}'); } catch (e) {} } });
  const кн = await page.$('[data-kboss]');
  дано(!!кн, 'кнопка передачи на месте');
  if (кн) {
    const кого = await кн.getAttribute('data-kboss');
    await кн.click();
    await page.waitForTimeout(500);
    дано(!ушло, 'с первого нажатия круг не уходит');
    дано(/Точно передать\?/.test(await кн.textContent()), 'кнопка переспрашивает: ' + (await кн.textContent()));
    await кн.click();
    await page.waitForTimeout(900);
    дано(!!ушло, 'со второго — уходит');
    дано(!!ушло && ушло.who === кого, 'и передаёт именно тому, на кого нажали: ' + (ушло && ушло.who));
    дано(!!ушло && ушло.id === 'family', 'именно тот круг, который открыт: ' + (ушло && ушло.id));
  }
  await page.close();

  /* чужой круг: передавать нечего, там и состав меняет не ты */
  const чужой = await br.newPage({ viewport: { width: 390, height: 900 } });
  await чужой.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(чужой, { theme: 'dark', wait: 2800, circle: M.круг() });
  await чужой.evaluate(() => { const b = document.querySelector('[data-cir="c_zal"]'); if (b) b.click(); });
  await чужой.waitForTimeout(1200);
  await лист(чужой, 'c_zal');
  const т2 = await чужой.evaluate(() => (document.getElementById('krugbody') || {}).innerText || '');
  дано(!(await чужой.$('[data-kboss]')), 'в чужом кругу передачи нет');
  дано(/выйти из круга/i.test(т2), 'зато есть выход: ' + (т2.match(/[^\n]*[Вв]ыйти[^\n]*/) || [''])[0].slice(0, 60));
  await чужой.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
