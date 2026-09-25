'use strict';
/* Меню на остаток дня во вкладке «Что съесть» → «Сегодня» (25.09; его выбор:
   остаток дня, пересобирать целиком после каждой записи и смены нормы,
   вариант «Б» — docs/reviews/2026-09-25-vybor-13-segodnya.png). Заперто:
   свежее меню показывается без сборки; съеденное — приглушёнными строками;
   рецепт и «В Telegram» — по меню сегодняшнего дня; меню разошлось с днём —
   пересборка сама, один раз на подпись, старое видно, пока собирается;
   после записи еды в разговоре — пересборка в фоне; меню нет — собирается при
   входе; день закрыт — «На сегодня всё»; «меню на сегодня» из разговора. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const T = M.TODAY;
/* день стенда: завтрак 420 и обед 610 записаны, норма 2110, 14:03 — окно «после 11» */
const ПОДП = [T, 2110, 1030, 2, 1].join('|');
const И = (name, g, kcal, prot) => ({ name, g, kcal, prot, fat: 5, carb: 10 });
const СЕГ = (o) => Object.assign({ ok: true, span: 'today', date: T, from: T, at: Date.now(), sig: ПОДП, зал: false,
  норма: { kcal: 2110, prot: 165 }, съел: { kcal: 1030, prot: 67 }, ост: { kcal: 1080, prot: 98 },
  съедено: [{ kind: 'завтрак', text: 'омлет с индейкой', kcal: 420, prot: 26 }, { kind: 'обед', text: 'курица с рисом', kcal: 610, prot: 41 }],
  note: 'Ужин — грудка: добирает белок.', дни: [{ date: T, зал: false, спорт: [], норма: { kcal: 1080, prot: 98 }, kcal: 1075, prot: 96, белокМало: 0, приёмы: [
    { id: 't1', kind: 'перекус', text: 'Творог 5% с ягодами', мин: 3, kcal: 290, prot: 34, items: [И('Творог 5%', 200, 240, 32), И('Ягоды свежие', 80, 50, 1)] },
    { id: 't2', kind: 'ужин', text: 'Куриная грудка с гречкой', мин: 30, kcal: 785, prot: 62, items: [И('Куриная грудка запечённая', 200, 330, 62), И('Гречка варёная', 250, 275, 10)] }] }] }, o || {});
async function открыть(br, o){
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  /* тот же объект: в него мок складывает, что ушло на сервер (o.sent) */
  [['theme', 'dark'], ['wait', 2400], ['page', 'eat']].forEach(([k, v]) => { if (o[k] === undefined) o[k] = v; });
  const ош = await M.поднять(page, o);
  await page.waitForTimeout(400);
  return { page, ош };
}
const текст = async page => (await page.textContent('#eatbody')).replace(/\s+/g, ' ');
(async () => {
  const br = await chromium.launch();
  /* ── 1. свежее меню: без сборки ── */
  const о1 = { menu: { today: СЕГ() }, onMenu: b => { (о1.спаны = о1.спаны || []).push(JSON.parse(b.request().postData() || '{}').span); return { ok: false }; },
    onRecipe: () => ({ ok: true, id: 't2', семья: 1, мин: 30, шаги: ['Запеки грудку.', 'Отвари гречку.', 'Подавай вместе.'], совет: null, состав: [] }) };
  let { page, ош } = await открыть(br, о1);
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  const сег = await page.$$eval('#eatbody .eseg button', bs => bs.map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')));
  дано(сег.join(',') === 'Сегодня*,Завтра,Неделя,Покупки', 'вкладки: ' + сег.join(','));
  let т = await текст(page);
  дано(/Меню на остаток дня/.test(т) && /Съедено 1030 из 2110 ккал · осталось 1080 ккал и 98 г белка/.test(т), 'шапка: съедено и сколько осталось');
  дано(!(о1.спаны || []).length, 'меню свежее — сервер не дёргаем');
  const съ = await page.$$eval('#eatbody .mnrow.mdone .mhd span:first-child', s => s.map(x => x.textContent));
  дано(съ.join(',') === 'завтрак · съедено,обед · съедено', 'съеденное — приглушёнными строками: ' + съ.join(','));
  const впереди = await page.$$eval('#eatbody .mnrow:not(.mdone) .mhd span:first-child', s => s.map(x => x.textContent));
  дано(впереди.join(',') === 'перекус,ужин', 'впереди — перекус и ужин');
  дано(/творог 5% 200 г · ягоды свежие 80 г/.test(т) && /Ужин — грудка/.test(т), 'состав с граммами и слово тренера');
  дано(/Пересоберу сам, когда запишешь еду или изменится норма/.test(т), 'сказано, что пересоберётся само');
  await page.click('#eatbody [data-mrec="today:t2"]'); await page.waitForTimeout(400);
  дано(await page.$$eval('#eatbody .mrec li', l => l.length) === 3, 'рецепт по меню сегодняшнего дня');
  await page.click('#eatbody [data-msend="today:menu"]'); await page.waitForTimeout(300);
  дано((о1.sent || []).some(x => x.span === 'today' && x.what === 'menu'), '«В Telegram» — меню на сегодня');
  дано(!(await page.$('#eatbody #fpod')), 'каталог закрыт');
  await page.click('#eatbody #catopen'); await page.waitForTimeout(300);
  дано(!!(await page.$('#eatbody #fpod')) && (await page.$$eval('#eatbody .eatrow', r => r.length)) > 0, 'по кнопке — подбор и каталог');
  const рамка = await (await page.$('#eatbody #catopen')).boundingBox();
  дано(рамка.height >= 44, 'кнопка каталога не мельче 44 точек');
  await page.close();

  /* ── 2. меню разошлось с днём: пересобирается само, один раз ── */
  const о2 = { menuDelay: 2500, menu: { today: СЕГ({ sig: [T, 2110, 420, 1, 1].join('|'), съел: { kcal: 420, prot: 26 } }) },
    onMenu: b => { (о2.спаны = о2.спаны || []).push(JSON.parse(b.request().postData() || '{}').span); return СЕГ({ note: 'Новое меню под остаток.' }); } };
  о2.wait = 300; ({ page } = await открыть(br, о2));
  т = await текст(page);
  дано(/Пересобираю под новый остаток/.test(т) && /Меню на остаток дня/.test(т), 'пока пересобирается — старое меню видно с пометкой');
  await page.waitForTimeout(3000);
  т = await текст(page);
  дано((о2.спаны || []).join(',') === 'today', 'сервер попросили один раз: ' + (о2.спаны || []).join(','));
  дано(/Новое меню под остаток/.test(т) && !/Пересобираю/.test(т), 'новое меню встало');
  await page.click('#eatbody #catopen'); await page.click('#eatbody #catopen'); await page.waitForTimeout(300);
  дано((о2.спаны || []).length === 1, 'перерисовка не пересобирает свежее меню');
  await page.close();

  /* ── 3. запись еды в разговоре — пересборка в фоне ── */
  const ЕЩЁ = [{ id: 1, t: '08:40', kind: 'завтрак', kcal: 420, prot: 26, text: 'омлет с индейкой' }, { id: 2, t: '13:20', kind: 'обед', kcal: 610, prot: 41, text: 'курица с рисом' },
    { id: 3, t: '14:00', kind: 'перекус', kcal: 150, prot: 5, text: 'яблоко' }];
  const о3 = { page: 'home', menu: { today: СЕГ() },
    onMenu: b => { (о3.спаны = о3.спаны || []).push(JSON.parse(b.request().postData() || '{}').span); return СЕГ(); },
    onCoach: () => ({ ok: true, reply: 'Записал яблоко.', meals: [ЕЩЁ[2]], day: M.день({ meals: ЕЩЁ }) }) };
  ({ page } = await открыть(br, о3));
  await page.click('.l1 button[data-page="food"]').catch(() => {}); await page.waitForTimeout(300);
  for (const b of await page.$$('#fseg-food button')) if ((await b.textContent()).trim() === 'Что съесть') { await b.click(); break; }
  await page.waitForTimeout(800);
  дано(!(о3.спаны || []).length, 'меню свежее — пока ничего не записано, не пересобираем');
  await page.click('#coachfab'); await page.waitForTimeout(500);
  await page.fill('#ctext', 'съел яблоко'); await page.click('#csend'); await page.waitForTimeout(1500);
  дано((о3.спаны || []).includes('today'), 'после записи в разговоре меню пересобралось само: ' + (о3.спаны || []).join(','));
  await page.close();

  /* ── 4. меню нет — собирается при входе; день закрыт — «всё» ── */
  const о4 = { onMenu: b => { (о4.спаны = о4.спаны || []).push(JSON.parse(b.request().postData() || '{}').span);
    return СЕГ({ всё: 1, дни: [], ост: { kcal: 0, prot: 0 }, note: '' }); } };
  ({ page } = await открыть(br, о4));
  await page.waitForTimeout(600);
  т = await текст(page);
  дано((о4.спаны || []).join(',') === 'today', 'меню на сегодня не было — собрано при входе');
  дано(/На сегодня всё/.test(т) && !(await page.$('#eatbody [data-mgen="today"]')), 'день закрыт: «На сегодня всё», без «Другое меню»');
  await page.close();

  /* ── 5. из разговора: «меню на сегодня» ── */
  const о5 = { page: 'home', menu: { today: СЕГ() }, onCoach: () => ({ ok: true, reply: 'Соберу меню на остаток дня.', menu: 'today' }) };
  ({ page } = await открыть(br, о5));
  await page.click('#coachfab'); await page.waitForTimeout(500);
  await page.fill('#ctext', 'Составь меню на сегодня'); await page.click('#csend'); await page.waitForTimeout(1200);
  const кн = await page.$('#chatlog [data-cmenu="today"]');
  дано(!!кн && /Открыть меню на сегодня/.test(await кн.textContent()), 'под ответом — «Открыть меню на сегодня»');
  if (кн) { await кн.click(); await page.waitForTimeout(900); }
  дано(await page.isVisible('#p-eat') && /Меню на остаток дня/.test(await текст(page)), 'кнопка открыла «Сегодня» с меню');
  await page.close();

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
