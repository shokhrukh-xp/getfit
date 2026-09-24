'use strict';
/* Одна запись — все экраны (24.09). Его слова: «когда я что-то обновляю
   внутри приложения, изменения не отображаются сразу — приходится закрыть и
   открыть приложение». Правка приёма обновляла только список на «Еде»: балл
   под записью, главная, неделя и рейтинг жили старыми числами. Здесь
   удаляем приём и проверяем, что без перезапуска перечитано всё и главная
   показывает новый итог дня. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const НОРМА = { kcal: 1850, prot: 190, fat: { min: 50, max: 90 }, fib: 26, sug: 46, parts: { base: 1850, gym: 0, acts: 0, plan: 0, delta: 0, k: 1 } };
const ЯИЧНИЦА = { id: 11, t: '09:10', kind: 'завтрак', kcal: 602, prot: 37, fat: 38, fib: 4, sug: 5, img: '/p/a.jpg', text: 'Яичница из 4 яиц' };
const ГРУША = { id: 12, t: '12:40', kind: 'перекус', kcal: 151, prot: 1, fat: 0, fib: 7, sug: 28, img: '/p/b.jpg', text: 'Груша и хурма' };
const СЧЁТ = { ok: true, closed: false, going: true, r: 7.2, n: 2, counts: true, вместе: true,
  приёмы: [{ id: 11, kind: 'завтрак', r: 6.5, why: [{ k: 'prot', v: 2.3, t: 'мало белка: 37 г из ~62', совет: '+25 г белка', нужно: 25 }], разбор: [] },
           { id: 12, kind: 'перекус', r: 10, why: [], разбор: [] }], why: [] };

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  const ош = await M.поднять(page, { theme: 'dark', time: '13:05', page: 'home',
    day: { meals: [ЯИЧНИЦА, ГРУША], targets: НОРМА }, score: СЧЁТ, wait: 2400 });
  дано(ош.length === 0, 'главная поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(600);
  const ккал = () => page.evaluate(() => { const t = document.getElementById('homebody').textContent.replace(/\s+/g, ' ');
    const m = t.match(/Калории[^0-9]*(\d+)/); return m ? +m[1] : null; });
  const было = await ккал();
  дано(было === 753, 'на главной до правки — 753 ккал: ' + было);

  /* на «Еде» открываем яичницу и удаляем её из шторки */
  await page.click('.l1 button[data-page="food"]'); await page.waitForTimeout(900);
  await page.click('.fmeal[data-mid="11"] .ft'); await page.waitForTimeout(400);
  /* сервер после удаления отдаёт день без яичницы */
  const после = M.день({ meals: [ГРУША], targets: НОРМА });
  await page.route(u => /\/day\?/.test(u.toString()), r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, day: после }) }));
  await page.route(u => /\/day\/score\?/.test(u.toString()), r => r.fulfill({ contentType: 'application/json',
    body: JSON.stringify(Object.assign({}, СЧЁТ, { n: 1, приёмы: [СЧЁТ.приёмы[1]] })) }));
  const спросили = [];
  page.on('request', r => { const u = r.url(); ['/day/score', '/week', '/circle', '/day?'].forEach(k => { if (u.indexOf(k) >= 0) спросили.push(k); }); });

  спросили.length = 0;
  await page.click('#mv-del'); await page.waitForTimeout(1200);
  дано(['/day/score', '/week', '/circle'].every(k => спросили.includes(k)), 'после удаления перечитаны оценка, неделя и рейтинг: ' + Array.from(new Set(спросили)).join(', '));
  const строки = await page.$$eval('.fmeal[data-mid]', рр => рр.map(р => р.dataset.mid));
  дано(строки.join(',') === '12', 'на «Еде» осталась одна груша: ' + строки.join(','));

  /* главная — без перезапуска */
  await page.click('.l1 button[data-page="home"]'); await page.waitForTimeout(700);
  const стало = await ккал();
  дано(стало === 151, 'главная сразу показывает новый итог — 151 ккал: ' + стало);
  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
