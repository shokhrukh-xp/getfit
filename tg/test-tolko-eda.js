'use strict';
/* Режим «только питание» — его вопрос 11.09: «а что для пользователей, которые
   не ходят в зал, а только питание будут отслеживать?». Следов зала на экране
   у них быть не должно. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const НОРМА = { kcal: 1700, prot: 160, fat: { min: 45, max: 66 }, fib: 30, sug: 45,
  parts: { base: 1700, gym: 0, acts: 0, plan: 0, delta: 0, k: 1 } };
const ЕДА = [{ id: 1, t: '09:26', kind: 'завтрак', kcal: 520, prot: 48, img: '/p/a.jpg', text: 'омлет' },
             { id: 2, t: '15:35', kind: 'обед', kcal: 634, prot: 80, img: '/p/b.jpg', text: 'курица' }];
const режим = (page, v) => page.addInitScript(([v]) => {
  try { const k = 'shp_v1_me', me = JSON.parse(localStorage.getItem(k) || '{}');
    me.only = v; me.sex = 'f'; me.age = 33; me.ht = 168; me.bw = 61;
    localStorage.setItem(k, JSON.stringify(me)); } catch (e) {}
}, [v]);

(async () => {
  const br = await chromium.launch();

  /* только еда */
  let page = await br.newPage({ viewport: { width: 390, height: 1500 } });
  await режим(page, 'food');
  const ош = await M.поднять(page, { theme: 'dark', time: '16:10', day: { meals: ЕДА, targets: НОРМА }, wait: 2200 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(500);

  const вкладки = await page.$$eval('.l1-in button', bs => bs.filter(b => b.offsetParent).map(b => b.textContent.trim()));
  дано(вкладки.join(',') === 'Сегодня,Еда', 'вкладок две, «Тренировки» нет: ' + вкладки.join(' · '));

  const главная = await page.textContent('#homebody');
  дано(!/подход/.test(главная), 'дорожки зала на главной нет');
  дано(!/Завтра/.test(главная), 'строки «Завтра» с залом нет');
  дано(await page.$('.hact') === null, 'карточки тренировки нет');
  дано(await page.$('.hclk-svg .hb-gym, .hclk-svg .hb-gymon') === null, 'гантели на часах нет');
  дано(/Рейтинг/.test(главная), 'рейтинг и еда на месте');

  /* в зал не пускает даже адресом */
  await page.evaluate(() => { try { goPage('gym'); } catch (e) {} });
  await page.waitForTimeout(300);
  дано(await page.isVisible('#p-home'), 'переход в зал возвращает на главную');

  /* профиль: переключатель есть, поля зала спрятаны */
  await page.click('#profbtn');
  await page.waitForTimeout(500);
  дано(await page.isVisible('#me-only'), 'в профиле есть переключатель «веду»');
  дано(!(await page.isVisible('#me-place')), 'поля зала в профиле спрятаны');
  await page.close();

  /* обычный режим — всё на месте */
  page = await br.newPage({ viewport: { width: 390, height: 1500 } });
  await режим(page, 'all');
  await M.поднять(page, { theme: 'dark', time: '16:10', day: { meals: ЕДА, targets: НОРМА }, wait: 2200 });
  await page.waitForTimeout(400);
  const в2 = await page.$$eval('.l1-in button', bs => bs.filter(b => b.offsetParent).map(b => b.textContent.trim()));
  дано(в2.length === 3, 'в обычном режиме три вкладки: ' + в2.join(' · '));
  дано(await page.$('.hact') !== null, 'карточка тренировки вернулась');
  await page.close();

  /* знакомство: «только еда» кончается на первом шаге */
  page = await br.newPage({ viewport: { width: 390, height: 1200 } });
  await M.поднять(page, { theme: 'dark', newbie: true, wait: 2500 });
  await page.waitForTimeout(600);
  дано(await page.isVisible('#wz-only'), 'на первом шаге знакомства спрашивают, что ведём');
  await page.click('#wz-only button[data-v="food"]');
  await page.fill('#wz-age', '33'); await page.fill('#wz-ht', '168'); await page.fill('#wz-bw', '61');
  дано(/шаг 1 из 2/.test(await page.textContent('#wzstep')), 'счётчик шагов честный: ' + await page.textContent('#wzstep'));
  дано(!(await page.isVisible('#wzhave').catch(() => false)), 'готовые программы не предлагаются');
  await page.click('#wz-me-go');
  await page.waitForTimeout(900);
  /* второй и последний шаг — цель; про зал в нём не спрашивают */
  дано(await page.isVisible('#wzgoal'), 'второй шаг — цель');
  дано(!(await page.isVisible('#g-gymrow').catch(() => false)), 'вопроса «что важнее в зале» у них нет');
  await page.click('#g-go');
  await page.waitForTimeout(1400);
  дано(!(await page.isVisible('#picker .modalbox').catch(() => false)) || !(await page.$eval('#picker', e => e.classList.contains('show'))),
    'знакомство закончилось на цели, без вопросов про зал');
  const в3 = await page.$$eval('.l1-in button', bs => bs.filter(b => b.offsetParent).map(b => b.textContent.trim()));
  дано(в3.join(',') === 'Сегодня,Еда', 'после знакомства две вкладки: ' + в3.join(' · '));
  await page.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
