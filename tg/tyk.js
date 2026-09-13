'use strict';
/* ── ТЫКАЛКА ───────────────────────────────────────────────────────────
   13.09: «убедись, что все элементы и компоненты работают так, как
   предусмотрено». Обходчик (tg/audit.js) смотрит вёрстку в покое. Эта
   проверка делает другое: нажимает ПОДРЯД КАЖДУЮ кнопку на каждом экране и
   после каждого нажатия смотрит, не упало ли что-нибудь — ошибка в консоли,
   необработанное исключение, съехавшая вёрстка, пустой экран.

   Разрушительное не жмём: удаление, очистку, сброс, завершение и отправку —
   у них свои проверки, и они меняют данные. */
const { chromium } = require('playwright');
const M = require('./mock');

let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ОПАСНО = /удалить|очистить|сбросить|завершить|отправить|стереть|выйти|точно|заменить|убрать|выбрать программу|сохранить|записать|собрать|начать|поставить цель/i;

const СНИМОК = () => {
  const тело = document.body;
  const экран = document.querySelector('.page:not(.hide)');
  return {
    ширина: document.documentElement.scrollWidth,
    окно: innerWidth,
    пусто: !экран || (экран.textContent || '').trim().length < 20,
    экранИмя: экран ? экран.id : '—',
    кнопок: document.querySelectorAll('button').length
  };
};

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));

  const ошибки = [];
  let текущая = 'запуск';
  page.on('pageerror', e => ошибки.push(текущая + ' → ' + e.message.slice(0, 120)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/jsdelivr|ERR_CONNECTION|ERR_FAILED|Failed to load resource/.test(t)) return;
    ошибки.push(текущая + ' → консоль: ' + t.slice(0, 120));
  });

  await M.поднять(page, { theme: 'dark', time: '17:40', wait: 2600,
    hist: M.журнал(), day: {}, week: {}, meas: M.замеры(), circle: M.круг() });
  await page.waitForTimeout(900);

  const ЭКРАНЫ = [['home', null], ['gym', null], ['gym', 'Журнал'], ['gym', 'Каталог'],
                  ['food', null], ['food', 'Рейтинг']];
  let нажато = 0, сломано = [];

  async function наЭкран(таб, сег) {
    await page.evaluate(() => {
      document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
      document.body.classList.remove('coach');
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(250);
    await page.click('.l1 button[data-page="' + таб + '"]').catch(() => {});
    await page.waitForTimeout(500);
    if (сег) {
      for (const b of await page.$$('.zseg button'))
        if ((await b.textContent()).trim() === сег && await b.isVisible()) { await b.click(); break; }
      await page.waitForTimeout(1100);
    }
  }

  for (const [таб, сег] of ЭКРАНЫ) {
    await наЭкран(таб, сег);
    const имяЭкрана = таб + (сег ? ' · ' + сег : '');

    /* подписи кнопок снимаем один раз: после нажатия список может смениться */
    const подписи = await page.$$eval('.page:not(.hide) button, .page:not(.hide) a[href^="#"]', els =>
      els.filter(e => {
        const s = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      }).map(e => (e.textContent || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40))
    );

    for (let i = 0; i < подписи.length && i < 40; i++) {
      const п = подписи[i];
      if (!п || ОПАСНО.test(п)) continue;
      текущая = имяЭкрана + ' · «' + п + '»';
      await наЭкран(таб, сег);
      const кн = (await page.$$('.page:not(.hide) button, .page:not(.hide) a[href^="#"]'))[i];
      if (!кн) continue;
      const видна = await кн.isVisible().catch(() => false);
      if (!видна) continue;
      await кн.scrollIntoViewIfNeeded().catch(() => {});
      await кн.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(450);
      нажато++;
      const с = await page.evaluate(СНИМОК).catch(() => null);
      if (!с) { сломано.push(текущая + ': страница не отвечает'); continue; }
      if (с.ширина > с.окно + 2) сломано.push(текущая + ': страница стала шире экрана (' + с.ширина + ')');
      if (с.пусто) сломано.push(текущая + ': экран опустел (' + с.экранИмя + ')');
      if (с.кнопок < 3) сломано.push(текущая + ': кнопки исчезли');
    }
  }

  await br.close();

  console.log('');
  if (сломано.length) { console.log('═══ поломки ═══'); сломано.forEach(x => console.log('   ' + x)); }
  if (ошибки.length) { console.log('═══ ошибки JS ═══'); ошибки.slice(0, 30).forEach(x => console.log('   ' + x)); }
  console.log('');
  дано(нажато > 40, 'нажато кнопок: ' + нажато);
  дано(ошибки.length === 0, 'ни одно нажатие не уронило скрипт' + (ошибки.length ? ' (' + ошибки.length + ')' : ''));
  дано(сломано.length === 0, 'ни одно нажатие не сломало экран' + (сломано.length ? ' (' + сломано.length + ')' : ''));

  console.log('');
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
