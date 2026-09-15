'use strict';
/* ── ОТКРЫВАЕМСЯ С ГЛАВНОЙ ─────────────────────────────────────────────
   15.09, его слова: «сделай так, чтобы при каждом открытии приложение
   открывалось с главной, сейчас как попало». Приложение помнило последнюю
   вкладку между заходами: закрыл на «Упражнениях» — открыл на них же.
   Внутри одного захода вкладка по-прежнему живёт (её листают туда-сюда),
   и ссылка из утреннего сообщения бота по-прежнему ведёт прямо в круг. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const ЭКРАН = () => {
  const b = document.querySelector('.l1 button[aria-selected="true"]');
  const p = Array.from(document.querySelectorAll('.page')).filter(x => !x.classList.contains('hide'))[0];
  return { вкладка: b ? b.textContent.trim() : '', экран: p ? p.id : '' };
};

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2600, hist: M.журнал() });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  const старт = await page.evaluate(ЭКРАН);
  дано(старт.экран === 'p-home', 'первый заход открылся на главной: ' + старт.экран);

  /* уходим на «Тренировку» и внутри неё на «Упражнения» — вкладка живёт */
  await page.click('.l1 button[data-page="gym"]');
  await page.waitForTimeout(700);
  for (const b of await page.$$('.zseg button'))
    if ((await b.textContent()).trim() === 'Упражнения' && await b.isVisible()) { await b.click(); break; }
  await page.waitForTimeout(900);
  const ушли = await page.evaluate(ЭКРАН);
  дано(ушли.экран !== 'p-home', 'внутри захода вкладка переключается как раньше: ' + ушли.экран);

  /* закрыли и открыли снова — тот же профиль, та же память браузера */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  const снова = await page.evaluate(ЭКРАН);
  дано(снова.экран === 'p-home', 'новый заход снова начался с главной, а не там, где закрыли: ' + снова.экран);
  дано(/Сегодня/.test(снова.вкладка), 'и подсвечена вкладка «Сегодня»: ' + снова.вкладка);

  /* ссылка из утреннего сообщения бота — исключение: она ведёт прямо в круг */
  const page2 = await ctx.newPage();
  await page2.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page2, { theme: 'dark', wait: 2600, circle: M.круг(),
                           base: M.БАЗА + '?p=circle' });
  const круг = await page2.evaluate(ЭКРАН);
  дано(круг.экран === 'p-circle', 'ссылка бота по-прежнему открывает круг: ' + круг.экран);

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
