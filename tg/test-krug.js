'use strict';
/* ── СТРАНИЦА ЧЕЛОВЕКА В КРУГЕ ────────────────────────────────────────
   14.09: «почему фото еды других не отображаются». Оказалось, что у тех
   приёмов фото не было вовсе — их записали текстом; механика показа
   работала. Но проверок на неё не было ни одной, и ответить пришлось
   запросом в базу. Теперь оба случая заперты проверкой: есть фото —
   показываем снимок, нет — честную заглушку, а не пустое место. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

async function круг(page) {
  const f = await page.$('.l1 button[data-page="food"]');
  if (f) { await f.click(); await page.waitForTimeout(600); }
  for (const b of await page.$$('.zseg button'))
    if ((await b.textContent()).trim() === 'Рейтинг' && await b.isVisible()) { await b.click(); break; }
  await page.waitForTimeout(1400);
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2600, circle: M.круг(), hist: M.журнал() });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  await круг(page);
  /* нажимаем на ДРУГОГО человека, не на себя: страница чужого дня — весь смысл */
  const люди = await page.$$('[data-lbwho]:not(.lbme)');
  дано(люди.length >= 1, 'в рейтинге есть на кого нажать: ' + люди.length);
  if (!люди.length) { await br.close(); process.exit(1); }

  await люди[0].click();
  await page.waitForTimeout(1600);

  const с = await page.evaluate(() => {
    const пл = Array.from(document.querySelectorAll('.plate'));
    return {
      всего: пл.length,
      строки: пл.map(p => ({
        текст: (p.querySelector('.pltx i') || {}).textContent || '',
        снимок: (p.querySelector('.plph img') || {}).getAttribute ? p.querySelector('.plph img').getAttribute('src') : null,
        заглушка: ((p.querySelector('.plph') || {}).textContent || '').trim(),
        загрузилось: p.querySelector('.plph img') ? p.querySelector('.plph img').naturalWidth : 0,
        высотаФото: p.querySelector('.plph') ? Math.round(p.querySelector('.plph').getBoundingClientRect().height) : 0
      }))
    };
  });
  дано(с.всего >= 2, 'день человека открылся, приёмы видны: ' + с.всего);

  const сФото = с.строки.filter(r => r.снимок), безФото = с.строки.filter(r => !r.снимок);
  дано(сФото.length >= 1, 'приём с фото показан снимком: ' + (сФото[0] || {}).снимок);
  if (сФото[0]) дано(/^\/p\/|^https?:/.test(сФото[0].снимок),
    'и адрес снимка тот, что прислал сервер: ' + сФото[0].снимок);
  /* мало отдать правильный адрес — снимок должен ещё и открыться:
     пустая плитка на месте фото выглядит ровно как «фото не отображаются» */
  дано(сФото.every(r => r.загрузилось > 0),
    'снимок действительно загрузился, а не отвалился: ' + сФото.map(r => r.загрузилось + 'px').join(', '));
  дано(безФото.length >= 1 && /без фото/.test(безФото[0].заглушка),
    'приём без фото честно подписан, а не пустой: «' + (безФото[0] || {}).заглушка + '»');
  дано(с.строки.every(r => r.высотаФото > 20),
    'обе плитки одного размера, ряд не съезжает: ' + с.строки.map(r => r.высотаФото).join(' и '));

  /* раскрытая карточка тоже показывает снимок */
  await page.click('.plate');
  await page.waitForTimeout(600);
  const откр = await page.evaluate(() => {
    const o = document.querySelector('.plate.open');
    if (!o) return null;
    return { есть: !!o.querySelector('.plph img'),
             кнопки: Array.from(o.querySelectorAll('.plact button')).map(b => b.textContent.trim().slice(0, 22)) };
  });
  дано(!!откр, 'карточка приёма раскрывается');
  if (откр) {
    дано(откр.есть, 'и в раскрытой снимок на месте');
    дано(откр.кнопки.some(k => /Отправить себе/.test(k)), 'рецепт можно забрать себе: ' + откр.кнопки.join(' · '));
  }

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
