'use strict';
/* 04.11, его слова: «панель навигации сделать как у iOS или Telegram — форма углов подстраивается под
   угол экрана; три кнопки слева сгруппировать, кнопку чата — отдельно справа». Выбор — вариант B
   (выключатель panel2): капсула трёх разделов и круг ИИ-тренера; вечером — 20 px снизу и по бокам, как в iOS. */
const { chromium } = require('playwright'), M = require('./mock');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
(async () => { const b = await chromium.launch(); try {
  for (const [w, h] of [[390, 844], [320, 640]]) for (const ф of [['panel2'], []]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', '34px')); });
    const err = await M.поднять(p, { theme: 'dark', page: 'food', time: '14:10', features: ф }); await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const g = document.querySelector('.l1-grp').getBoundingClientRect(), c = document.getElementById('coachnav').getBoundingClientRect(), s = getComputedStyle(document.querySelector('.l1-grp'));
      return { низ: Math.round(innerHeight - g.bottom), гв: Math.round(g.height), рад: parseFloat(s.borderTopLeftRadius), кш: Math.round(c.width), кв: Math.round(c.height), справа: c.left > g.right, слева: Math.round(g.left), справаОт: Math.round(innerWidth - c.right), внутри: c.right <= innerWidth && g.left >= 0, разделов: document.querySelectorAll('.l1-grp button[data-page]').length }; });
    const т = w + ' ' + (ф.length ? 'panel2' : 'без флага');
    if (ф.length) {
      ok(r.разделов === 3 && r.гв === 64 && r.рад >= 32, т + ': три раздела в капсуле 64 px, радиус — половина высоты');
      ok(r.кш === 64 && r.кв === 64 && r.справа, т + ': ИИ-тренер — отдельный круг справа');
      ok(r.низ === 20 && r.слева === 20 && r.справаОт === 20, т + ': 20 px от низа, слева и справа — симметрично (' + r.слева + '/' + r.низ + '/' + r.справаОт + ')');
      await p.click('.l1-grp [data-page="gym"]'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => document.querySelector('.l1-grp [data-page="gym"]').getAttribute('aria-selected') === 'true'), т + ': разделы переключаются');
      await p.click('#coachnav'); await p.waitForTimeout(400);
      ok(await p.evaluate(() => document.body.classList.contains('coach')), т + ': круг открывает ИИ-тренера');
    } else ok(r.разделов === 3 && r.гв === 0, т + ': прежняя панель (группа не рисуется)');
    ok(err.length === 0, т + ': без ошибок ' + err.slice(0, 1).join(''));
    await p.close();
  }
} catch (e) { console.error('УПАЛО:', e.stack); bad++; }
await b.close(); console.log(bad ? '\nПРОВАЛОВ: ' + bad : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ'); process.exit(bad ? 1 : 0); })();
