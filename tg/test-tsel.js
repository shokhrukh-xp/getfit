'use strict';
/* Обязательный шаг «Цель» со шкалой. Без цели приложение молча считало
   поддержание — 11.09 так зашёл первый человек на режиме «только питание».
   Пределы (предел темпа и вес, ниже которого цель не ставится) приходят с
   сервера; экран их только рисует и не даёт перетащить ручку за границу. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const тянуть = (page, v) => page.$eval('#g-rng', (el, x) => {
  el.value = x; el.dispatchEvent(new Event('input', { bubbles: true }));
}, String(v));

(async () => {
  const br = await chromium.launch();

  /* ── обычный режим: еда и зал ── */
  let page = await br.newPage({ viewport: { width: 390, height: 1300 } });
  const ош = await M.поднять(page, { theme: 'dark', newbie: true, wait: 2500 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  дано(await page.isVisible('#wzgoal'), 'цель стоит на той же странице, что рост и вес');
  дано(!(await page.isVisible('#wzstep').catch(() => false)), 'счётчика шагов у одной страницы нет');
  дано(/Заполни возраст, рост и вес/.test(await page.textContent('#g-body')),
    'пока веса нет — темп не считаем и «не получилось» не показываем: ' + (await page.textContent('#g-body')).trim());
  await page.fill('#wz-age', '34'); await page.fill('#wz-ht', '176'); await page.fill('#wz-bw', '88');
  await page.waitForTimeout(1200);
  дано(await page.isVisible('#g-rng'), 'шкала на месте');
  дано(await page.isVisible('#g-gymrow'), 'у того, кто ходит в зал, спрашивают, что важнее');

  /* по умолчанию — четыре недели безопасного темпа: 88,1 − 0,88×4 = 84,58 → 84,5 */
  дано((await page.textContent('#g-body .gbig b')) === '84,5',
    'цель по умолчанию — месяц безопасного темпа: ' + await page.textContent('#g-body .gbig b'));
  дано(/0,88 кг в неделю/.test(await page.textContent('#g-body .gsub')),
    'темп показан: ' + await page.textContent('#g-body .gsub'));

  /* красная зона нарисована и ручка в неё не идёт */
  const грунт = await page.$eval('#g-rng', e => e.getAttribute('style') || '');
  дано(/--warn/.test(грунт) && /--done/.test(грунт), 'на дорожке есть и красный отрезок, и зелёный');
  await тянуть(page, 60);
  await page.waitForTimeout(150);
  дано(+(await page.$eval('#g-rng', e => e.value)) === 71,
    'ручка упёрлась в границу нормы: ' + await page.$eval('#g-rng', e => e.value));
  дано((await page.textContent('#g-body .gbig b')) === "71",
    'число под шкалой тоже упёрлось: ' + await page.textContent('#g-body .gbig b'));

  /* тянем к разумной цели — срок пересчитывается на месте */
  await тянуть(page, 75);
  await page.waitForTimeout(150);
  const подпись = await page.textContent('#g-body .gsub');
  дано(/−13,1 кг/.test(подпись), 'разница считается от текущего веса: ' + подпись);
  дано(/Так и делаем · до /.test(await page.textContent('#g-go')),
    'на кнопке — срок: ' + await page.textContent('#g-go'));

  /* «держать» — шкала не нужна */
  await page.click('#g-wt button[data-v="keep"]');
  await page.waitForTimeout(700);
  дано(!(await page.isVisible('#g-rng').catch(() => false)), 'у «держать» шкалы нет');
  await page.click('#g-wt button[data-v="down"]');
  await page.waitForTimeout(700);
  дано(await page.isVisible('#g-rng'), 'вернулись к «похудеть» — шкала снова на месте');

  дано(await page.isVisible('#wzform'), 'анкета «где и когда» тут же, ниже цели');
  дано(await page.isVisible('#wz-one'), 'и одна кнопка на всё: ' + (await page.textContent('#wz-one')).trim());
  дано(!(await page.isVisible('#g-go').catch(() => false)), 'своей кнопки у шага цели больше нет');
  await page.close();

  /* ── только питание: цель тоже обязательна, но зала в ней нет ── */
  page = await br.newPage({ viewport: { width: 390, height: 1300 } });
  await M.поднять(page, { theme: 'dark', newbie: true, wait: 2500 });
  await page.click('#wz-only button[data-v="food"]');
  await page.fill('#wz-age', '19'); await page.fill('#wz-ht', '180'); await page.fill('#wz-bw', '79');
  await page.waitForTimeout(1200);
  дано(await page.isVisible('#wzgoal'), 'цель спрашивают и у тех, кто ведёт одну еду');
  дано(!(await page.isVisible('#g-gymrow').catch(() => false)), 'вопроса про зал у них нет');
  дано(!(await page.isVisible('#wzform').catch(() => false)), 'и анкеты про зал на странице нет вовсе');
  дано(/Начать/.test(await page.textContent('#wz-one')), 'кнопка не обещает программу: ' + (await page.textContent('#wz-one')).trim());
  await page.click('#wz-one');
  await page.waitForTimeout(1700);
  const вкладки = await page.$$eval('.l1-in button', bs => bs.filter(b => b.offsetParent).map(b => b.textContent.trim()));
  дано(вкладки.join(',') === 'Сегодня,Еда', 'знакомство кончилось, две вкладки: ' + вкладки.join(' · '));
  await page.close();

  /* ── предел темпа упирается не в процент веса, а в пол нормы ── */
  page = await br.newPage({ viewport: { width: 390, height: 1300 } });
  await M.поднять(page, { theme: 'dark', newbie: true, wait: 2500,
    safe: { w: 79, max: 0.39, limit: 'обмен', floor: 57.3, upMax: 0.35 } });
  await page.fill('#wz-age', '19'); await page.fill('#wz-ht', '180'); await page.fill('#wz-bw', '79');
  await page.waitForTimeout(1200);
  const почему = await page.textContent('#g-why');
  дано(/0,39 кг в неделю/.test(почему), 'на экране достижимый темп, а не 1 % веса: ' + почему);
  дано(/ниже основного обмена/.test(почему), 'сказано, что упирается в пол нормы');
  дано(!/1 % веса/.test(почему), 'про 1 % веса не говорим — ограничивает не он');
  await page.close();

  /* ── снижать нечем: поддержка почти равна полу нормы ── */
  page = await br.newPage({ viewport: { width: 390, height: 1300 } });
  await M.поднять(page, { theme: 'dark', newbie: true, wait: 2500,
    safe: { w: 58, max: 0, limit: 'обмен', floor: 57.3, upMax: 0.35 } });
  await page.fill('#wz-age', '29'); await page.fill('#wz-ht', '161'); await page.fill('#wz-bw', '58');
  await page.waitForTimeout(1200);
  дано(!(await page.isVisible('#g-rng').catch(() => false)), 'шкалы нет: снижать нечем');
  дано(/снижать сейчас нечем/.test(await page.textContent('#g-body')),
    'сказано прямо: ' + await page.textContent('#g-body'));
  дано(/ниже основного обмена/.test(await page.textContent('#g-why')), 'и объяснено почему');
  await page.close();

  /* ── анкета едет вместе с запросом границ ──
     Профиль уходит на сервер отдельным запросом, ответа никто не ждёт. Если
     шаг цели спросит границы раньше, чем профиль доедет, сервер ответит «нет
     веса», и человек на обязательном шаге увидит «не получилось». */
  page = await br.newPage({ viewport: { width: 390, height: 1300 } });
  const запросы = [];
  page.on('request', r => { if (/\/goal/.test(r.url())) запросы.push({ м: r.method(), u: r.url(), т: r.postData() }); });
  await M.поднять(page, { theme: 'dark', newbie: true, wait: 2500 });
  await page.fill('#wz-age', '19'); await page.fill('#wz-ht', '180'); await page.fill('#wz-bw', '79');
  await page.waitForSelector('#g-rng', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  const гет = запросы.filter(r => r.м === 'GET').pop();
  дано(!!гет && /bw=79/.test(гет.u), 'вес из анкеты ушёл вместе с запросом границ: ' + (гет ? гет.u.split('?')[1] : 'запроса нет'));
  дано(!!гет && /ht=180/.test(гет.u) && /age=19/.test(гет.u), 'рост и возраст тоже');
  await page.click('#wz-one');
  await page.waitForTimeout(1600);
  const пост = запросы.filter(r => r.м === 'POST').pop();
  дано(!!пост && /"bw":79/.test(пост.т || ''), 'и при записи цели тоже: ' + (пост ? (пост.т||'').slice(0, 90) : 'запроса нет'));

  await page.close();

  /* ── блок тела не переспрашивает вес, который только что назвали ──
     у новичка замеров ещё нет, а вес он уже назвал на первом шаге */
  page = await br.newPage({ viewport: { width: 390, height: 1300 } });
  await M.поднять(page, { theme: 'dark', newbie: true, time: '08:15', meas: null, first: null,
    day: { meals: [], kcal: 0, prot: 0, fat: 0, fib: 0, sug: 0 }, score: null, circle: null, wait: 2500 });
  await page.click('#wz-only button[data-v="food"]');
  await page.fill('#wz-age', '19'); await page.fill('#wz-ht', '180'); await page.fill('#wz-bw', '79');
  await page.waitForTimeout(1200);
  await page.click('#wz-one'); await page.waitForTimeout(1900);
  const тело = await page.evaluate(() => {
    const b = document.querySelector('.htile.hwide');
    return b ? b.textContent.replace(/\s+/g, ' ').trim() : 'плитки нет';
  });
  дано(/79/.test(тело), 'вес с первого шага виден в блоке тела: ' + тело);
  дано(!/впиши вес/.test(тело), 'и его больше не просят вписать заново');
  дано(/весы/.test(тело), 'зовём на весы за трендом, а не за весом: ' + тело);
  await page.close();

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
