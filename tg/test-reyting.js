'use strict';
/* ── ВЕРХ РЕЙТИНГА: ДЕНЬ, НЕДЕЛЯ И БАЛЛ ПРОШЛОЙ НЕДЕЛИ ────────────────
   20.09, его слова: «просто внутри бокса „Неделя“ покажи балл прошлой
   недели. всё, ничего лишнего. И ниже не нужно делить на Сегодня и
   Неделя». До этого прошлая неделя жила отдельным блоком внизу —
   двумя плитками с именами победителей, а таблица переключалась
   тумблером. Здесь заперто и то, и другое: балл прошлой недели стоит
   в плитке «неделя», тумблера нет, таблица всегда за сегодня, а балл
   недели каждого стоит второй строкой в его же ряду. */
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
const снять = page => page.evaluate(() => {
  const пл = Array.from(document.querySelectorAll('.cirtiles .tile')).map(t => ({
    шапка: (t.querySelector('u') || {}).textContent || '',
    число: (t.querySelector('b') || {}).textContent || '',
    низ: (t.querySelector('i') || {}).textContent || '',
    ширина: Math.round(t.getBoundingClientRect().width),
    влезло: t.querySelector('i') ? t.querySelector('i').scrollWidth <= t.querySelector('i').clientWidth + 1 : true
  }));
  const ряды = Array.from(document.querySelectorAll('.lbrow')).map(r => ({
    имя: (r.querySelector('.who b') || {}).textContent || '',
    под: (r.querySelector('.who i') || {}).textContent || '',
    число: (r.querySelector('.sc') || {}).textContent || ''
  }));
  return {
    плитки: пл, ряды,
    тумблер: !!document.querySelector('[data-lbmode]'),
    колонки: Array.from(document.querySelectorAll('.lbhead span')).map(s => s.textContent.trim()),
    заголовки: Array.from(document.querySelectorAll('#cirbody h3')).map(s => s.textContent.trim()),
    весь: (document.getElementById('cirbody') || {}).textContent || ''
  };
});

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, circle: M.круг({ lastr: 7.2 }) });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  await рейтинг(page);
  const с = await снять(page);
  дано(с.плитки.length === 2, 'наверху две плитки: день и неделя — ' + с.плитки.map(p => p.шапка).join(', '));
  const нед = с.плитки.find(p => /неделя/.test(p.шапка));
  дано(!!нед, 'плитка «неделя» на месте');
  if (нед) {
    дано(/8,4|7,9/.test(с.плитки[0].число + нед.число), 'свои баллы в плитках есть: ' + с.плитки.map(p => p.число.trim()).join(' | '));
    дано(/7,2/.test(нед.низ), 'балл прошлой недели стоит внутри плитки «неделя»: «' + нед.низ + '»');
    /* «ничего лишнего»: в плитке одна строка — балл прошлой недели,
       а не он же плюс «в среднем за N дней» вторым хвостом */
    дано(!/среднем|дн(я|ей|ь)/.test(нед.низ), 'и ничего сверх него: «' + нед.низ + '»');
    дано(нед.влезло, 'строка целиком влезла в плитку, не обрезана многоточием (' + нед.ширина + 'px)');
  }

  дано(!с.тумблер, 'переключателя «Сегодня / Неделя» больше нет');
  дано(!/Прошлая неделя/.test(с.весь), 'и отдельного блока «Прошлая неделя» внизу тоже нет');
  дано(!/точность|рост/.test(с.весь), 'плиток с именами победителей нет');
  дано(с.заголовки.length === 0, 'лишних заголовков на экране не появилось: ' + с.заголовки.join(', '));

  /* таблица осталась дневной — и это должно быть видно в шапке колонки,
     иначе число в столбце читается как балл недели */
  дано(с.колонки.indexOf('сегодня') >= 0, 'колонка подписана «сегодня»: ' + с.колонки.join(' · '));
  дано(с.ряды.length >= 2, 'в таблице есть люди: ' + с.ряды.length);
  дано(с.ряды.every(r => /неделя \d/.test(r.под)), 'у каждого под именем стоит его балл недели: ' + с.ряды.map(r => r.под).join(' | '));
  /* сортировка дневная: 9,1 у жены выше 8,4 у меня, хотя недельные баллы
     идут в том же порядке — проверяем на дневных числах */
  дано(с.ряды[0].число.trim() === '9,1', 'первым стоит лучший за сегодня: ' + с.ряды.map(r => r.число.trim()).join(' > '));

  /* первая неделя: прошлой ещё не было — плитка не должна показывать «—»
     или пустоту, она возвращается к объяснению своего же числа */
  await page.evaluate(() => { try { location.reload(); } catch (e) {} });
  await page.waitForTimeout(300);
  const br2 = await chromium.launch();
  const p2 = await br2.newPage({ viewport: { width: 390, height: 900 } });
  await p2.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(p2, { theme: 'dark', wait: 2800, circle: M.круг({ lastr: null }) });
  await рейтинг(p2);
  const с2 = await снять(p2);
  const нед2 = с2.плитки.find(p => /неделя/.test(p.шапка)) || {};
  дано(/среднем|началась|дн/.test(нед2.низ || ''), 'без прошлой недели плитка объясняет своё число: «' + (нед2.низ || '') + '»');
  дано(!/прошлая/.test(нед2.низ || ''), 'и не пишет «прошлая —»');
  await br2.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
