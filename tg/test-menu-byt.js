'use strict';
/* Быт перед первым меню (15.10). Живая неделя на Xplorence: быт пуст —
   тренер часть блюд счёл купленными готовыми, и курица встала в покупки
   дважды. Его выбор — «Спросить быт перед первым меню». */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
/* 20.10: под нагрузкой (6 потоков на 4 ядра) паузы 300–900 мс и «медленный
   сервер» на 1,5 с не совпадали с тем, что успела страница: проверка читала
   экран до ответа или уже после него. Теперь ждём само условие (до 15 с), а
   медленный ответ сервера держим, пока проверка его не отпустит. */
const ждать = async (f, мс = 15000) => { const до = Date.now() + мс; while (Date.now() < до) { if (await f()) return true; await new Promise(r => setTimeout(r, 50)); } return !!(await f()); };
const ЗАВТРА = M.Д(-1);
const ME = { sex: 'm', age: 34, ht: 178, bw: 88, wt: 'down', gym: 'muscle' };
const МЕНЮ = { ok: true, span: 'day', from: ЗАВТРА, at: Date.now(), note: '', дни: [{ date: ЗАВТРА, зал: false, спорт: [], норма: { kcal: 1800, prot: 140 }, kcal: 1700, prot: 130, белокМало: 0,
  приёмы: [{ id: 'b1', kind: 'обед', text: 'Курица с гречкой', мин: 30, kcal: 500, prot: 50, items: [{ name: 'Куриная грудка запечённая', g: 200, kcal: 330, prot: 50, fat: 5, carb: 0 }] }] }], покупки: { отделы: [], дома: [] } };
(async () => {
  const br = await chromium.launch();
  /* 1. «Завтра»: сначала три вопроса, ответы — в быт профиля, потом сборка */
  let page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const о = { theme: 'light', wait: 2400, page: 'eat', me: ME, bytAsk: true, menu: { завтра: ЗАВТРА },
    onMenu: route => { const б = JSON.parse(route.request().postData() || '{}'); (о.просили = о.просили || []).push(б.span); return б.span === 'today' ? { ok: false, нет: 'нет' } : МЕНЮ; } };
  const ош = await M.поднять(page, о);
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  дано(await page.isVisible('#mbyt'), '«Сегодня» не собирает молча — сначала вопросы про быт');
  дано(!(о.просили || []).length, 'и запроса меню пока нет');
  await page.click('#eatbody [data-eseg="day"]'); await page.waitForTimeout(300);
  await page.click('#eatbody [data-mgen="day"]'); await page.waitForTimeout(300);
  дано(await page.isVisible('#mbyt') && (await page.$eval('#mbyt', e => e.dataset.span)) === 'day', '«Собрать меню на завтра» — тоже сначала вопросы');
  const высоты = await page.$$eval('#mbyt button', bs => bs.map(b => b.getBoundingClientRect().height));
  дано(высоты.every(h => h >= 44), 'кнопки не меньше 44 точек');
  await page.screenshot({ path: '/tmp/gf-menu-byt.png', fullPage: true });
  await page.click('#mb-where [data-v="дом"]'); await page.click('#mb-where [data-v="столовая"]');
  await page.click('#mb-cook [data-v="сам"]'); await page.click('#mb-min [data-v="30"]');
  await page.click('[data-mbyt="save"]');
  await ждать(async () => о.просили && о.просили.includes('day') && !(await page.isVisible('#mbyt')));
  const me = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));
  дано(JSON.stringify(me.byt) === JSON.stringify({ where: ['дом', 'столовая'], cook: 'сам', min: 30 }), 'быт записан в профиль: ' + JSON.stringify(me.byt));
  дано(о.просили && о.просили.includes('day'), 'после ответов меню собирается');
  дано(!(await page.isVisible('#mbyt')), 'карточка ушла');
  await page.close();
  /* 2. «Пропустить» — больше не спрашивает */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const о2 = { theme: 'dark', wait: 2400, page: 'eat', me: ME, bytAsk: true, menu: { завтра: ЗАВТРА },
    onMenu: route => { const б = JSON.parse(route.request().postData() || '{}'); (о2.просили = о2.просили || []).push(б.span); return { ok: false, нет: 'нет' }; } };
  await M.поднять(page, о2);
  await page.click('[data-mbyt="skip"]'); await ждать(() => о2.просили && о2.просили.includes('today'));
  дано(о2.просили && о2.просили.includes('today'), '«Пропустить» — меню на сегодня собирается сразу');
  дано(await page.evaluate(() => localStorage.getItem('shp_v1_byt_ask')) === '1', 'и вопрос больше не задаётся');
  await page.click('#eatbody [data-eseg="week"]'); await page.waitForTimeout(300);
  await page.click('#eatbody [data-mgen="week"]'); await page.waitForTimeout(300);
  дано(!(await page.isVisible('#mbyt')), 'неделя после пропуска — без вопросов');
  /* 3. быт уже есть — вопросов нет */
  await page.close();
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page, { theme: 'dark', wait: 2400, page: 'eat', me: Object.assign({ byt: { cook: 'сам' } }, ME), bytAsk: true, menu: { завтра: ЗАВТРА }, onMenu: () => ({ ok: false, нет: 'нет' }) });
  дано(!(await page.isVisible('#mbyt')), 'быт заполнен — сразу меню, без вопросов');
  await page.close();
  /* 4. ревью Codex: меню уходит только после «ok» сервера на быт.
     Первая запись падает — меню не собираем, ответы целы; вторая медленная — ждём её */
  page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  let записей = 0, отпустить, придержан = new Promise(r => { отпустить = r; });
  const о4 = { theme: 'light', wait: 2400, page: 'eat', me: ME, bytAsk: true, menu: { завтра: ЗАВТРА },
    onMenu: route => { const б = JSON.parse(route.request().postData() || '{}'); (о4.просили = о4.просили || []).push(б.span); return МЕНЮ; },
    handleRoute: async route => {
      const u = new URL(route.request().url()), тело = route.request().postData() || '';
      if (u.pathname !== '/s' || !/byt/.test(тело)) return false;
      записей++;
      if (записей === 1) { await route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false}' }); return true; }
      await придержан;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); return true;
    } };
  await M.поднять(page, о4);
  await page.click('#mb-cook [data-v="семья"]'); await page.click('#mb-min [data-v="15"]');
  /* 22.10: первая запись упала (500) — это обрыв, не отказ: ответы на телефоне,
     очередь дошлёт сама, меню соберётся после «ok» сервера, без второго нажатия */
  await page.click('[data-mbyt="save"]'); await ждать(async () => записей >= 1 && await page.isVisible('#mbyt .mbwait'));
  дано(записей >= 1, 'ответы ушли на сервер: ' + записей);
  дано(!(о4.просили || []).length, 'сервер не принял — меню не собирается');
  дано(await page.isVisible('#mbyt .mbwait') && !(await page.isVisible('#mbyt .mwarn')), 'сказано спокойно: отправлю сам и соберу');
  дано(await page.$eval('#mb-cook [data-v="семья"]', b => b.getAttribute('aria-pressed')) === 'true', 'ответы на карточке целы');
  дано(await page.isDisabled('[data-mbyt="save"]'), 'кнопка «Сохраняю…» не жмётся дважды');
  await ждать(() => записей >= 2);
  дано(!(о4.просили || []).length, 'пока сервер думает над повтором — меню не просим');
  отпустить(); await ждать(() => (о4.просили || []).length === 1); await page.waitForTimeout(300);
  дано((о4.просили || []).length === 1, 'после «ok» — ровно одна сборка, сама: ' + JSON.stringify(о4.просили));
  дано(await page.evaluate(() => localStorage.getItem('shp_v1_byt_dirty')) === '0', 'флаг «не доехало» снят');
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
