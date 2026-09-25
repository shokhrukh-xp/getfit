'use strict';
/* Готовое в меню — без рецепта (25.09). Его слова: «некоторые рецепты просто
   говорят возьми готовую еду и разогрей — это же глупо писать как рецепт».
   Его выбор из трёх — «без кнопки „Рецепт“». Заперто: у блюда, где всё
   готовое, кнопки нет — строка «Готовить не нужно»; у смешанного и
   домашнего кнопка на месте; меню до 25.09 (без пометок): сервер по нажатию
   отвечает «готовое» — кнопка сменяется той же строкой, шагов нет. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ЗАВТРА = M.Д(-1);
const И = (name, g, kcal, prot) => ({ name, g, kcal, prot, fat: 5, carb: 10 });
const ДЕНЬ = { date: ЗАВТРА, зал: false, спорт: [], норма: { kcal: 1900, prot: 150 }, kcal: 1850, prot: 148, белокМало: 0, приёмы: [
  { id: 'b1', kind: 'завтрак', text: 'Творог с бананом', мин: null, kcal: 380, prot: 34, items: [И('Творог 5%', 200, 240, 32), И('Банан', 120, 110, 1)] },
  { id: 'b2', kind: 'обед', text: 'Куриная грудка гриль с рисом и салатом «витаминка»', мин: 25, kcal: 710, prot: 73, гот: ['салат «витаминка» mazzali'],
    items: [И('Куриная грудка гриль', 220, 360, 66), И('Рис варёный', 200, 260, 5), И('салат «витаминка» mazzali', 180, 90, 2)] },
  { id: 'b3', kind: 'ужин', text: 'Паровые куриные котлеты Mazzali с помидорами и лепёшкой', мин: null, готовое: 1, kcal: 388, prot: 42,
    гот: ['котлеты куриные паровые mazzali', 'помидор свежий', 'лепёшка узбекская'],
    items: [И('котлеты куриные паровые mazzali', 160, 290, 38), И('помидор свежий', 150, 30, 1), И('лепёшка узбекская', 30, 68, 3)] }] };
const МЕНЮ = { ok: true, span: 'day', from: ЗАВТРА, at: Date.now(), note: 'Котлеты Mazzali оставил на ужин.', дни: [ДЕНЬ],
  покупки: { семья: 1, дней: 1, дома: [], отделы: [] } };

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const о = { theme: 'dark', wait: 2400, page: 'eat', menuDelay: 300, menu: { завтра: ЗАВТРА },
    onMenu: route => { const б = JSON.parse(route.request().postData() || '{}');
      if (б.span === 'today') return { ok: false, нет: 'на стенде меню на сегодня нет' };
      return МЕНЮ; },
    /* творог с бананом — меню «до 25.09», без пометки: сервер говорит «готовое» */
    onRecipe: route => { const б = JSON.parse(route.request().postData() || '{}'); о.рецепт = б.id;
      return б.id === 'b1' ? { ok: true, id: 'b1', text: 'Творог с бананом', готовое: 1 }
        : { ok: true, id: б.id, семья: 1, мин: 25, шаги: ['Отвари рис.', 'Обжарь грудку.', 'Подавай с салатом.'], совет: null, состав: [] }; } };
  const ош = await M.поднять(page, о);
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(400);
  await page.click('#eatbody [data-eseg="day"]'); await page.waitForTimeout(200);
  await page.click('#eatbody [data-mgen="day"]'); await page.waitForTimeout(800);
  const строка = async i => (await page.$$eval('#eatbody .mnrow', (r, i) => r[i] ? r[i].textContent : '', i)).replace(/\s+/g, ' ');
  дано(await page.$$eval('#eatbody .mnrow', r => r.length) === 3, 'три приёма');

  const ужин = await строка(2);
  дано(!(await page.$('#eatbody [data-mrec="day:b3"]')), 'у котлет Mazzali с помидором и лепёшкой кнопки «Рецепт» нет');
  дано(/Готовить не нужно/.test(ужин), 'вместо неё — «Готовить не нужно»: ' + ужин.slice(-40));
  дано(/котлеты куриные паровые mazzali 160 г/.test(ужин), 'состав с граммами на месте');

  дано(!!(await page.$('#eatbody [data-mrec="day:b2"]')) && /Рецепт · 25 мин ›/.test(await строка(1)), 'у грудки с рисом и готовым салатом кнопка на месте');
  await page.click('#eatbody [data-mrec="day:b2"]'); await page.waitForTimeout(400);
  дано(await page.$$eval('#eatbody .mnrow:nth-child(n) .mrec li', l => l.length) === 3, 'рецепт смешанного блюда открылся шагами');

  дано(!!(await page.$('#eatbody [data-mrec="day:b1"]')), 'меню без пометки (до 25.09): у творога с бананом кнопка пока есть');
  await page.click('#eatbody [data-mrec="day:b1"]'); await page.waitForTimeout(400);
  const завтрак = await строка(0);
  дано(о.рецепт === 'b1' && !(await page.$('#eatbody [data-mrec="day:b1"]')), 'сервер сказал «готовое» — кнопка ушла');
  дано(/Готовить не нужно/.test(завтрак) && !/Пишу рецепт|не сложился/.test(завтрак), 'и встала строка «Готовить не нужно», без ошибки');
  дано(await page.$$eval('#eatbody .mrec', l => l.length) === 1, 'шагов у готового нет — только у грудки');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
