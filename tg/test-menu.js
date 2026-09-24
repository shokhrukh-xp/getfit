'use strict';
/* Меню наперёд, покупки и быт (24.09, этап 2 плана). Его выбор: вкладка
   «Что съесть» — Сейчас / Завтра / Неделя / Покупки; меню только по
   нажатию или просьбе; быт — блок в профиле, который тренер заполняет и
   сам. Заперто: «Сейчас» — прежний экран; меню собирается по кнопке, пока
   собирается — это видно; итог дня против нормы, состав с граммами; рецепт
   по нажатию; покупки с отметками, которые не слетают; «В Telegram»; кнопка
   из разговора открывает нужный вид и собирает меню; быт из профиля
   сохраняется с отметкой времени; быт от тренера приходит в профиль. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ЗАВТРА = M.Д(-1);
const И = (name, g, kcal, prot) => ({ name, g, kcal, prot, fat: 5, carb: 10 });
const ДЕНЬ = { date: ЗАВТРА, зал: true, спорт: [], норма: { kcal: 1850, prot: 160 }, kcal: 1750, prot: 159, белокМало: 0, приёмы: [
  { id: 'b1', kind: 'завтрак', text: 'Омлет из 3 яиц с творогом', мин: 10, kcal: 430, prot: 42, items: [И('Яйцо куриное', 165, 250, 21), И('Творог 5%', 150, 180, 21)] },
  { id: 'b2', kind: 'обед', text: 'Плов с говядиной и салат', мин: null, kcal: 520, prot: 21, items: [И('Плов с говядиной', 250, 480, 19)] },
  { id: 'b3', kind: 'перекус', text: 'Творог с ягодами', мин: null, kcal: 280, prot: 34, items: [И('Творог 5%', 200, 240, 32)] },
  { id: 'b4', kind: 'ужин', text: 'Куриная грудка с гречкой', мин: 30, kcal: 520, prot: 62, items: [И('Куриная грудка запечённая', 220, 360, 60)] }] };
const МЕНЮ = { ok: true, span: 'day', from: ЗАВТРА, at: Date.now(), note: 'Плов оставил — белок добирает грудка.', дни: [ДЕНЬ],
  покупки: { семья: 2, дней: 1, дома: ['Рис'], отделы: [{ отдел: 'Мясо и птица', список: [{ имя: 'Куриная грудка', сколько: '600 г', g: 594 }] },
    { отдел: 'Молочное и яйца', список: [{ имя: 'Творог 5%', сколько: '700 г', g: 700 }, { имя: 'Яйцо куриное', сколько: '6 шт', g: 330 }] }] } };

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const о = { theme: 'dark', wait: 2400, page: 'eat', menuDelay: 700, menu: { завтра: ЗАВТРА },
    /* часы стенда стоят на сегодняшнем утре — метка тренера должна быть раньше */
    bytSrv: { byt: { family: 3, home: 'рис, яйца' }, at: Date.now() - 2 * 864e5 },
    onMenu: route => { о.просили = JSON.parse(route.request().postData() || '{}'); return о.просили.span === 'week' ? Object.assign({}, МЕНЮ, { span: 'week' }) : МЕНЮ; },
    onRecipe: () => ({ ok: true, id: 'b4', семья: 2, мин: 30, шаги: ['Натри грудку специями.', 'Запеки 25 минут при 200°.', 'Отвари гречку.'], совет: 'Масло не нужно.',
      состав: [{ name: 'Куриная грудка запечённая', g: 220, наСемью: 440 }] }),
    onCoach: () => ({ ok: true, reply: 'Соберу меню на неделю из твоих блюд.', menu: 'week' }) };
  const ош = await M.поднять(page, о);
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(500);
  const сег = await page.$$eval('#eatbody .eseg button', bs => bs.map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')));
  дано(сег.join(',') === 'Сейчас*,Завтра,Неделя,Покупки', 'переключатель: ' + сег.join(','));
  дано(!!(await page.$('#eatbody #fpod')), '«Сейчас» — прежний экран подбора');

  await page.click('#eatbody [data-eseg="day"]'); await page.waitForTimeout(300);
  дано(/Меню на завтра — из того, что ты обычно ешь/.test(await page.textContent('#eatbody')), 'меню ещё нет — объяснено, что это будет');
  await page.click('#eatbody [data-mgen="day"]'); await page.waitForTimeout(150);
  дано(/Собираю меню на завтра/.test(await page.textContent('#eatbody')), 'пока собирается — это видно');
  await page.waitForTimeout(1000);
  const т = (await page.textContent('#eatbody')).replace(/\s+/g, ' ');
  дано(о.просили && о.просили.span === 'day', 'попросил у сервера меню на завтра');
  дано(/Меню на завтра/.test(т) && /1750 из 1850 ккал · белок 159 из 160 г · день зала/.test(т), 'итог дня против нормы и день зала');
  дано(/Плов оставил/.test(т), 'слово тренера — на чём построено меню');
  дано(await page.$$eval('#eatbody .mrow', r => r.length) === 4, 'четыре приёма');
  дано(/яйцо куриное 165 г · творог 5% 150 г/.test(т), 'состав с граммами');
  дано(/Рецепт · 10 мин ›/.test(т), 'у блюда — рецепт и время');
  await page.click('#eatbody [data-mrec="day:b4"]'); await page.waitForTimeout(400);
  const рец = await page.$$eval('#eatbody .mrec li', l => l.map(x => x.textContent));
  дано(рец.length === 3 && /Запеки/.test(рец[1]), 'рецепт открылся шагами: ' + рец.length);
  дано(/На 2 чел\.: куриная грудка запечённая 440 г/.test((await page.textContent('#eatbody')).replace(/\s+/g, ' ')), 'на семью — граммы на всех');

  await page.click('#eatbody [data-eseg="buy"]'); await page.waitForTimeout(300);
  const б = (await page.textContent('#eatbody')).replace(/\s+/g, ' ');
  дано(/Покупки на завтра/.test(б) && /На 2 чел\., примерно · в сырых весах · дома уже есть: Рис/.test(б), 'покупки: на семью, сырые веса, что дома');
  дано(/Мясо и птица/.test(б) && /Куриная грудка — 600 г/.test(б) && /Яйцо куриное — 6 шт/.test(б), 'по отделам, с количеством');
  await page.click('#eatbody [data-buy="Творог 5%"]'); await page.waitForTimeout(150);
  await page.click('#eatbody [data-eseg="day"]'); await page.click('#eatbody [data-eseg="buy"]'); await page.waitForTimeout(200);
  дано(await page.$eval('#eatbody [data-buy="Творог 5%"]', b => b.getAttribute('aria-pressed')) === 'true', 'отметка «купил» не слетает при переключении');
  await page.click('#eatbody [data-msend="day:buy"]'); await page.waitForTimeout(300);
  дано((о.sent || []).some(x => x.span === 'day' && x.what === 'buy'), 'список ушёл в Telegram');
  дано(/Отправил ✓/.test(await page.textContent('#eatbody')), 'на кнопке — «Отправил ✓»');

  await page.click('#eatbody [data-eseg="week"]'); await page.waitForTimeout(200);
  дано(/Собрать меню на неделю/.test(await page.textContent('#eatbody')), 'меню недели ещё нет — кнопка собрать');

  /* из разговора */
  о.просили = null;
  await page.click('#coachfab'); await page.waitForTimeout(600);
  await page.fill('#ctext', 'Составь меню на неделю'); await page.click('#csend'); await page.waitForTimeout(1200);
  const кн = await page.$('#chatlog [data-cmenu="week"]');
  дано(!!кн && /Открыть меню на неделю/.test(await кн.textContent()), 'под ответом — кнопка «Открыть меню на неделю»');
  await кн.click(); await page.waitForTimeout(1800);
  дано(await page.isVisible('#p-eat'), 'кнопка открыла вкладку «Что съесть»');
  дано(о.просили && о.просили.span === 'week', 'и сама попросила собрать меню на неделю');
  дано(await page.$eval('#eatbody [data-eseg="week"]', b => b.getAttribute('aria-pressed')) === 'true', 'выбран вид «Неделя»');

  /* быт: от тренера — в профиль; правка руками — с отметкой времени */
  const me0 = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));
  дано(me0.byt && me0.byt.family === 3 && me0.byt.home === 'рис, яйца', 'быт, записанный тренером, пришёл в профиль');
  await page.click('#profbtn'); await page.waitForTimeout(600);
  дано(/готовит|на 3|дома: рис/.test(await page.textContent('#btsum')), 'в свёрнутом блоке — сводка: ' + await page.textContent('#btsum'));
  await page.click('#bttoggle'); await page.waitForTimeout(200);
  await page.click('#bt-cook button[data-v="сам"]');
  await page.click('#bt-bud button[data-v="эконом"]');
  await page.click('#bt-rules button[data-v="халяль"]');
  await page.fill('#bt-family', '4'); await page.dispatchEvent('#bt-family', 'change');
  await page.waitForTimeout(200);
  const me1 = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));
  дано(me1.byt && me1.byt.cook === 'сам' && me1.byt.family === 4 && me1.byt.budget === 'эконом' && (me1.byt.rules || []).includes('халяль') && me1.byt.home === 'рис, яйца',
    'быт из профиля сохранён: ' + JSON.stringify(me1.byt));
  дано(me1.byt_at > me0.byt_at, 'правка руками — со свежей отметкой времени');
  дано((me1.bw || null) === (me0.bw || null) && (me1.only || 'all') === (me0.only || 'all'), 'остальной профиль не тронут');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
