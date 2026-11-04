'use strict';
/* 04.11, его слова: «не нравится, что секция про „новый замер“ идёт как часть большого бокса»
   (выбор «C — в нужный момент») и «кнопка „Свободного дня“ слишком не заметна… спрашивали,
   где это и что это значит» (выбор «1, потом короче»). Выключатели zamer2 и svob2. */
const { chromium } = require('playwright'), M = require('./mock');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
const me = { sex: 'm', age: 34, ht: 178, bw: 88.1, med: { at: 1 }, coach_at: 1 };
(async () => { const b = await chromium.launch(); try {
  const стр = async (o) => { const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const err = await M.поднять(p, Object.assign({ theme: 'dark', me }, o)); await p.waitForTimeout(900); return { p, err }; };
  for (const theme of ['dark', 'light']) {
    /* утро, вчерашний замер: карточка «встаньте на весы», в «Теле» нет секции, есть «+ Замер» */
    { const { p, err } = await стр({ theme, page: 'home', time: '07:50', meas: M.замеры().slice(1), features: ['zamer2'] });
      await p.waitForSelector('#homebody .zm-card.zm-warm', { timeout: 6000 }).catch(() => {});
      const к = await p.locator('#homebody .zm-card.zm-warm').count();
      ok(к === 1 && /Утро — встаньте на весы/.test(await p.textContent('#homebody .zm-card')), theme + ': утром без замера — карточка «встаньте на весы»');
      ok(!(await p.locator('#homebody .vz #hmeasslot, #homebody .vz #hmeas').count()), theme + ': в «Теле» больше нет секции нового замера');
      ok(await p.locator('#homebody .vz [data-zam="open"]').count() === 1, theme + ': в шапке «Тела» — «+ Замер»');
      await p.click('#homebody .zm-card'); await p.waitForTimeout(400);
      ok(await p.evaluate(() => document.getElementById('zamm').classList.contains('show') && document.getElementById('hmeas').parentNode.id === 'zamslot'), theme + ': карточка открывает шторку с вводом замера');
      await p.click('#zamclose'); await p.waitForTimeout(300);
      await p.evaluate(() => { scrollTo(0, 0); }); await p.click('#homebody .vz [data-zam="open"]'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => document.getElementById('zamm').classList.contains('show')), theme + ': «+ Замер» открывает ту же шторку');
      ok(err.length === 0, theme + ': без ошибок ' + err.slice(0, 1).join(''));
      await p.close(); }
    /* утро, замер сегодня — «записано»; вечер с недавним замером — ничего */
    { const { p } = await стр({ theme, page: 'home', time: '08:05', meas: M.замеры(), features: ['zamer2'] });
      await p.waitForSelector('#homebody .zm-card.zm-done', { timeout: 6000 }).catch(() => {});
      ok(/записано/.test(await p.textContent('#homebody .zm-card.zm-done').catch(() => '')), theme + ': после замера — «… кг — записано»'); await p.close(); }
    { const { p } = await стр({ theme, page: 'home', time: '19:40', meas: M.замеры().slice(1), features: ['zamer2'] });
      ok(!(await p.locator('#homebody .zm-card').count()), theme + ': вечером со вчерашним замером карточки нет'); await p.close(); }
    { const { p } = await стр({ theme, page: 'home', time: '19:40', meas: M.замеры().slice(4), features: ['zamer2'] });
      await p.waitForSelector('#homebody .zm-card', { timeout: 6000 }).catch(() => {});
      ok(/Давно не взвешивались/.test(await p.textContent('#homebody .zm-card').catch(() => '')), theme + ': 4 дня без замера — «Давно не взвешивались» в любое время'); await p.close(); }
    /* без выключателя — как было */
    { const { p } = await стр({ theme, page: 'home', time: '07:50', meas: M.замеры().slice(1) });
      ok(!(await p.locator('#homebody .zm-card').count()) && await p.locator('#homebody .vz #hmeas').count() === 1, theme + ': без zamer2 — прежняя секция в «Теле»'); await p.close(); }
    /* «Свободный день»: карточка с объяснением → «Понятно» → короткая строка; строки в норме нет */
    { const { p, err } = await стр({ theme, page: 'food', time: '13:40', features: ['svob2'] });
      await p.waitForSelector('#fday .sv2', { timeout: 6000 }).catch(() => {});
      ok(/День отдыха от подсчёта/.test(await p.textContent('#fday .sv2').catch(() => '')), theme + ': на «Еде» — карточка «Свободный день» с объяснением');
      ok(!(await p.locator('#fday .svrow').count()), theme + ': прежней незаметной строки нет');
      await p.click('#fday [data-sv2x]'); await p.waitForTimeout(300);
      ok(await p.locator('#fday .sv2p').count() === 1 && !(await p.locator('#fday .sv2').count()), theme + ': «Понятно» — короткая строка');
      await p.click('#fday .sv2p'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => !!document.querySelector('.modal.show')), theme + ': строка открывает шторку «Свободный день»');
      ok(err.length === 0, theme + ': без ошибок ' + err.slice(0, 1).join(''));
      await p.close(); }
    /* 04.11, его правка: вне окна — дата следующего, без «вне окна»; шторка — простыми словами */
    { const { p } = await стр({ theme, page: 'food', time: '13:40', features: ['svob2'], окно: { '*': { открыто: false, след: M.Д(-13), шаг: 21, цена: { ккал: 2100, кг: 0.27, дней: 4 } } } });
      await p.waitForSelector('#fday .sv2', { timeout: 6000 }).catch(() => {});
      const т = await p.textContent('#fday .sv2').catch(() => '');
      ok(/следующий — \d+ [а-я]+/.test(т) && !/вне окна/.test(т), theme + ': вне окна — «следующий — <дата>»');
      await p.click('#fday .sv2 [data-svob]'); await p.waitForTimeout(300);
      const ш = await p.textContent('#svbody').catch(() => '');
      ok(/Следующий — \d+ [а-я]+/.test(ш) && /цель сдвинется примерно на 4 дня/.test(ш) && !/окно/i.test(ш.replace(/Как считается[\s\S]*$/, '')), theme + ': шторка — дата следующего и цена простыми словами');
      await p.close(); }
  }
} catch (e) { console.error('УПАЛО:', e.stack); bad++; }
await b.close(); console.log(bad ? '\nПРОВАЛОВ: ' + bad : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ'); process.exit(bad ? 1 : 0); })();
