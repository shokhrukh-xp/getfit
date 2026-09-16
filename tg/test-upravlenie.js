'use strict';
/* ── УПРАВЛЕНИЕ КРУГАМИ ТАМ, ГДЕ КРУГИ ────────────────────────────────
   16.09, его слова: «не вижу, как редактировать круги, удалять, создавать».
   Управление стояло в профиле, под свёрнутой строкой «круги» — то есть его
   не было. Круги живут на «Рейтинге», значит и управление живёт там.
   Проверяется то, что ломается тихо: полоса кругов видна даже когда круг
   один; в СВОЁМ круге можно всё, в ЧУЖОМ — только посмотреть и выйти. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

async function рейтинг(page) {
  const f = await page.$('.l1 button[data-page="food"]');
  if (f) { await f.click(); await page.waitForTimeout(600); }
  for (const b of await page.$$('.zseg button'))
    if ((await b.textContent()).trim() === 'Рейтинг' && await b.isVisible()) { await b.click(); break; }
  await page.waitForTimeout(1400);
}
const ЛИСТ = () => {
  const m = document.getElementById('krugm');
  return { открыт: !!(m && m.classList.contains('show')),
           имя: (document.getElementById('krugtitle') || {}).textContent || '',
           поля: Array.from(document.querySelectorAll('#krugbody input')).map(i => i.id + (i.readOnly ? ':только чтение' : '')),
           кнопки: Array.from(document.querySelectorAll('#krugbody button')).map(b => (b.id || b.className) + '|' + b.textContent.trim()),
           люди: Array.from(document.querySelectorAll('#krugbody .krow .kn')).map(n => n.textContent.trim()) };
};

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', page: 'circle', wait: 2800, circle: M.круг() });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  const чипы = await page.$$eval('.cirsw .mchip', ns => ns.map(n => n.textContent.trim()));
  дано(чипы.length >= 4, 'полоса кругов на месте: ' + чипы.join(' · '));
  дано(чипы.indexOf('+') >= 0, 'есть чем завести новый круг');
  дано(чипы.indexOf('⚙') >= 0, 'и чем настроить текущий');

  /* ── свой круг: можно всё ── */
  await page.click('.cirgear');
  await page.waitForTimeout(1000);
  const свой = await page.evaluate(ЛИСТ);
  дано(свой.открыт, 'лист круга открылся');
  дано(свой.имя === 'семья', 'в заголовке имя круга: ' + свой.имя);
  дано(свой.поля.indexOf('k-name') >= 0, 'имя можно переименовать');
  дано(свой.поля.indexOf('k-code') >= 0, 'код виден и меняется: ' + свой.поля.join(' · '));
  дано(свой.люди.length === 2, 'видно, кто внутри: ' + свой.люди.join(' · '));
  дано(свой.кнопки.some(b => /k-drop/.test(b)), 'свой круг можно закрыть');
  дано(!свой.кнопки.some(b => /k-leave/.test(b)), 'а «выйти» из своего нет — его можно только закрыть');
  дано(/×/.test(свой.кнопки.join(' ')), 'участника можно убрать');

  /* ── чужой круг: только посмотреть и выйти ── */
  await page.click('#krugclose'); await page.waitForTimeout(400);
  for (const b of await page.$$('.cirsw .mchip'))
    if (/зал/.test(await b.textContent())) { await b.click(); break; }
  await page.waitForTimeout(1400);
  await page.click('.cirgear'); await page.waitForTimeout(1000);
  const чужой = await page.evaluate(ЛИСТ);
  дано(чужой.имя === 'зал', 'открылся чужой круг: ' + чужой.имя);
  дано(чужой.поля.indexOf('k-name') < 0, 'чужой круг не переименовать');
  дано(чужой.поля.some(f => /k-code:только чтение/.test(f)), 'код виден, но не меняется: ' + чужой.поля.join(' · '));
  дано(чужой.кнопки.some(b => /k-leave/.test(b)), 'из чужого можно выйти');
  дано(!чужой.кнопки.some(b => /k-drop/.test(b)), 'а закрыть чужой нечем');
  дано(!/×/.test(чужой.кнопки.join(' ')), 'и людей из чужого не убрать');

  /* ── новый круг заводится отсюда же ── */
  await page.click('#krugclose'); await page.waitForTimeout(400);
  await page.click('#cirnew'); await page.waitForTimeout(700);
  const новый = await page.evaluate(ЛИСТ);
  дано(новый.имя === 'Новый круг', 'лист нового круга: ' + новый.имя);
  дано(новый.поля.indexOf('k-new') >= 0, 'есть поле имени');
  await page.fill('#k-new', 'беговой клуб');
  дано((await page.$eval('#k-new', e => e.value)) === 'беговой клуб', 'имя вводится');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
