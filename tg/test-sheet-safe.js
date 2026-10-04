'use strict';
/* 04.10, его снимок с телефона: в полноэкранном Telegram кнопки «Close» и
   «⌄ …» лежат поверх верха экрана, а лист тренера занимал весь viewport
   минус 24 px — крестик оказался под ними, закрыть чат было нечем.
   Стенд моделирует полноэкранный режим теми же переменными, что ставит
   Telegram (Bot API 8.0): вырез 59 px + интерфейс Telegram 46 px.
   Заперто: верх КАЖДОГО листа (и его крестик) ниже этой зоны — на 390 и 320,
   в том числе когда содержимое длиннее экрана; без полноэкранного режима
   листы по-прежнему почти во весь экран. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ВЫРЕЗ = 59, TG = 46;

async function листы(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.modal')).map(m => {
    const box = m.querySelector('.modalbox'); if (!box) return null;
    /* содержимое длиннее экрана: проверяем именно ограничение высоты листа */
    const filler = document.createElement('div'); filler.style.height = '3000px'; box.appendChild(filler);
    m.classList.add('show');
    const r = box.getBoundingClientRect(), x = box.querySelector('.xbtn');
    const out = { id: m.id, top: Math.round(r.top), x: x && x.offsetParent ? Math.round(x.getBoundingClientRect().top) : null };
    m.classList.remove('show'); filler.remove();
    return out;
  }).filter(Boolean));
}

(async () => {
  const br = await chromium.launch();
  for (const [w, h] of [[390, 844], [320, 568]]) {
    const page = await br.newPage({ viewport: { width: w, height: h } });
    const ош = await M.поднять(page, { theme: 'dark', time: '17:30' });
    дано(ош.length === 0, w + ': страница поднялась без ошибок ' + (ош[0] || ''));

    /* обычный режим (шапка Telegram своя): листы как были — почти во весь экран */
    const обычные = await листы(page);
    const тренер0 = обычные.find(x => x.id === 'coachm');
    дано(тренер0 && тренер0.top <= 24 + 1, w + ': без полноэкранного режима лист тренера во весь экран: верх ' + (тренер0 && тренер0.top));

    /* полноэкранный Telegram */
    await page.evaluate(([a, b]) => {
      const s = document.documentElement.style;
      s.setProperty('--tg-safe-area-inset-top', a + 'px'); s.setProperty('--tg-content-safe-area-inset-top', b + 'px');
    }, [ВЫРЕЗ, TG]);
    const зона = ВЫРЕЗ + TG;
    const все = await листы(page);
    дано(все.length >= 15, w + ': проверено листов: ' + все.length);
    const под = все.filter(x => x.top < зона || (x.x != null && x.x < зона));
    дано(под.length === 0, w + ': ни один лист не заходит под кнопки Telegram (' + зона + ' px): ' + JSON.stringify(под));

    /* настоящий путь: открыть чат тренера и закрыть его крестиком */
    await page.click('#coachnav');
    await page.waitForTimeout(200);
    const крестик = await page.locator('#coachclose').boundingBox();
    дано(!!крестик && крестик.y >= зона, w + ': крестик чата ниже кнопок Telegram: y=' + (крестик && Math.round(крестик.y)));
    await page.locator('#coachclose').click();
    await page.waitForTimeout(200);
    дано(!(await page.evaluate(() => document.getElementById('coachm').classList.contains('show'))), w + ': чат закрывается крестиком');
    /* поле ввода остаётся внизу экрана */
    await page.click('#coachnav');
    await page.waitForTimeout(200);
    const поле = await page.locator('#ctext').boundingBox();
    дано(!!поле && поле.y + поле.height <= h, w + ': поле ввода в пределах экрана');
    await page.close();
  }
  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
