'use strict';
/* ── СУПЕРСЕТЫ В РАМКЕ, ПАРТНЁР С КАРТИНКАМИ, ЗАНЯТИЯ СТРОКОЙ ─────────────
   29.10, его слова: «суперсеты нужно понятнее показать — может, отдельной
   рамкой или цветом», «когда хочу добавить суперсет, обычно соединяю со
   следующим или предыдущим, или с каким-то, который уже есть в этом дне; а
   из каталога — с картинками». И про теннис: «правильное ли это место» и
   «криво показано». По макету выбрал: пара — в цветной рамке с номером
   (1А/1Б, 2А/2Б), выбор партнёра — «Рядом» → «Ещё в этом дне» → «Из
   каталога», на «Еде» занятие — строкой над приёмами. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const СЛОЙ = { extra: { D1: [
  { n: 'Сгибания с гантелями', e: 'Dumbbell Bicep Curl', i: 'Dumbbell_Bicep_Curl', m: 'biceps', p: 'Бицепс', sets: 3, reps: '8–12', rest: 90, id: 'x1' },
  { n: 'Жим лёжа', e: 'Barbell Bench Press', i: 'Barbell_Bench_Press_-_Medium_Grip', m: 'chest', p: 'Грудь', sets: 3, reps: '6–10', rest: 120, id: 'x2' }] } };

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1600 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'light', time: '18:10', page: 'gym', layer: СЛОЙ, wait: 2600 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* 1. две пары программы — две рамки разного цвета с номерами */
  const рамки = await page.$$eval('#list .ssbox', bs => bs.map(b => ({
    т: b.textContent.replace(/\s+/g, ' '), cls: b.className,
    цвет: getComputedStyle(b).borderTopColor, фон: getComputedStyle(b).backgroundColor,
    метки: [...b.querySelectorAll('.sstag')].map(x => x.textContent) })));
  дано(рамки.length === 2, 'в дне 1 две пары — две рамки: ' + рамки.length);
  if (рамки.length === 2) {
    дано(/Суперсет 1/.test(рамки[0].т) && /Суперсет 2/.test(рамки[1].т), 'у рамок номера «Суперсет 1» и «Суперсет 2»');
    дано(/Румынская/.test(рамки[0].т) && /Подъёмы на носки/.test(рамки[0].т), 'в первой — румынская тяга и икры');
    дано(рамки[0].цвет !== рамки[1].цвет, 'соседние пары разного цвета: ' + рамки[0].цвет + ' / ' + рамки[1].цвет);
    дано(рамки[0].фон !== 'rgba(0, 0, 0, 0)', 'у рамки свой фон, пара читается одним блоком');
    дано(рамки[0].метки.join() === '1А,1Б' && рамки[1].метки.join() === '2А,2Б', 'метки 1А/1Б и 2А/2Б: ' + рамки.map(r => r.метки.join('/')).join(' | '));
    дано(/кругов|круга/.test(рамки[0].т) && /после круга/.test(рамки[0].т), 'в заголовке — круги и отдых');
  }
  /* открытая пара: шапка рамки прячется, номер — в шапке карточки */
  await page.click('#list .exrow:has-text("Румынская")'); await page.waitForTimeout(500);
  const откр = await page.evaluate(() => {
    const b = document.querySelector('.ssbox .sscard'); if (!b) return null;
    const box = b.closest('.ssbox');
    return { шапка: getComputedStyle(box.querySelector('.ssboxh')).display, текст: b.querySelector('.sshead').textContent,
      метка: (b.querySelector('.exhead .sstag') || {}).textContent };
  });
  дано(откр && откр.шапка === 'none' && /суперсет 1/.test(откр.текст) && откр.метка === '1А',
    'раскрытая пара — в рамке, номер в шапке карточки: ' + JSON.stringify(откр));

  /* 2. выбор партнёра: Рядом → Ещё в этом дне → каталог, с картинками */
  await page.click('#list .exrow:has-text("Сгибания")'); await page.waitForTimeout(500);
  await page.click('.card.exact .ssmk'); await page.waitForTimeout(900);
  const выбор = await page.evaluate(() => {
    const box = document.querySelector('.card.exact .ssmake');
    const гр = [...box.querySelectorAll('.ssgrp')].map(x => x.textContent);
    const кн = [...box.querySelectorAll('.sspart')].map(b => ({ т: b.textContent.trim(), рядом: b.classList.contains('near'),
      картинка: !!b.querySelector('.exthumb > *'), левее: (() => { const t = b.querySelector('.exthumb > *').getBoundingClientRect(), n = b.querySelector('.ssnm').getBoundingClientRect(); return t.right <= n.left; })(),
      высота: Math.round(b.getBoundingClientRect().height) }));
    return { гр, кн, кат: !!box.querySelector('[data-sscat]') };
  });
  дано(выбор.гр[0] === 'Рядом' && выбор.гр[1] === 'Ещё в этом дне', 'группы по порядку: ' + выбор.гр.join(' → '));
  const жим = выбор.кн.find(x => x.т.indexOf('Жим лёжа') === 0) || {};
  дано(жим.рядом && /↓ после/.test(жим.т), 'следующее упражнение — первым, с пометкой «↓ после»: ' + жим.т);
  дано(выбор.кн.some(x => x.т.indexOf('Приседания') === 0 && !x.рядом), 'остальные в дне — ниже, без пометки');
  дано(!выбор.кн.some(x => /Румынская|Ролик/.test(x.т)), 'упражнения, уже стоящие в паре, не предлагаются');
  дано(выбор.кн.length && выбор.кн.every(x => x.картинка && x.левее), 'у каждого варианта картинка слева');
  дано(выбор.кн.every(x => x.высота >= 56), 'строки выбора — под палец');
  дано(выбор.кат, 'и кнопка «Из каталога»');

  /* 3. из каталога — новое упражнение сразу в пару */
  await page.click('.card.exact [data-sscat]'); await page.waitForTimeout(1200);
  дано(/В пару к «Сгибания с гантелями»/.test(await page.textContent('#cattitle')), 'каталог подписан, к чему ищем пару');
  const имя = await page.evaluate(async () => {
    const кат = (await (await fetch('catalog.json')).json()).ex;
    const есть = [...document.querySelectorAll('#list .exrn b, #list .exname')].map(x => x.textContent);
    const b = [...document.querySelectorAll('#catbody button[data-pick]')].find(x => { const it = кат[+x.dataset.pick]; return it && !есть.some(n => n.indexOf(it.n) >= 0); });
    if (!b) return null; b.setAttribute('data-test', '1'); return кат[+b.dataset.pick].n;
  });
  дано(!!имя, 'в каталоге есть что выбрать: ' + имя);
  if (имя) {
    await page.click('#catbody [data-test="1"]'); await page.waitForTimeout(900);
    дано(!(await page.$eval('#catalog', c => c.classList.contains('show'))), 'каталог закрылся');
    дано((await page.$$('[data-sswhen]')).length === 2, 'сразу спрошено: только сегодня или всегда');
    await page.click('[data-sswhen="day"]'); await page.waitForTimeout(600);
    const пара = await page.$$eval('#list .ssbox', bs => bs.map(b => b.textContent.replace(/\s+/g, ' ')));
    дано(пара.some(t => /Сгибания/.test(t) && t.indexOf(имя) >= 0 && /Суперсет 3|суперсет 3/.test(t)), 'сгибания и «' + имя + '» — третьей рамкой');
  }

  /* 4. к базовому из каталога — только изолирующие */
  await page.click('#list .exrow:has-text("Приседания")').catch(() => {}); await page.waitForTimeout(500);
  await page.click('.card.exact .ssmk'); await page.waitForTimeout(900);
  await page.click('.card.exact [data-sscat]'); await page.waitForTimeout(1200);
  const баз = await page.evaluate(async () => { const кат = (await (await fetch('catalog.json')).json()).ex;
    return { note: (document.querySelector('#catbody .ssnote') || {}).textContent || '',
    базовых: [...document.querySelectorAll('#catbody button[data-pick]')].filter(x => (кат[+x.dataset.pick] || {}).mc === 'c').length,
    всего: document.querySelectorAll('#catbody button[data-pick]').length }; });
  дано(/две базовые/.test(баз.note), 'сказано, почему только изолирующие');
  дано(баз.всего > 0 && баз.базовых === 0, 'базовых в списке нет: ' + JSON.stringify(баз));
  await page.click('#catclose').catch(() => page.keyboard.press('Escape')); await page.waitForTimeout(300);

  /* 5. «Еда»: занятие — строкой над приёмами, а не приёмом */
  const p2 = await br.newPage({ viewport: { width: 320, height: 1200 } });
  await p2.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(p2, { theme: 'dark', time: '20:10', page: 'food', wait: 2400,
    acts: [{ id: 'a1', date: M.TODAY, t: '18:20', kind: 'теннис', min: 90, kcal: 542, intensity: 'mod' }],
    day: { acts: [{ id: 'a1', date: M.TODAY, t: '18:20', kind: 'теннис', min: 90, kcal: 542, intensity: 'mod' }] } });
  const еда = await p2.evaluate(() => {
    const r = document.querySelector('#facts .actrow'), h = document.getElementById('fmealhead');
    if (!r) return null;
    const x = r.querySelector('.actx').getBoundingClientRect(), rr = r.getBoundingClientRect();
    return { над: !!(r.compareDocumentPosition(h) & 4), текст: r.textContent.replace(/\s+/g, ' '),
      вПриёмах: /теннис/i.test(document.getElementById('fmeals').textContent),
      ровно: Math.abs((x.top + x.height / 2) - (rr.top + rr.height / 2)) <= 2, влезает: rr.right <= innerWidth };
  });
  дано(еда && еда.над && !еда.вПриёмах, 'на «Еде» теннис — строкой над «Приёмы», а не приёмом');
  дано(еда && /Теннис/.test(еда.текст) && /90 мин/.test(еда.текст) && /\+542/.test(еда.текст), 'в строке — вид, минуты и сколько добавил: ' + (еда && еда.текст));
  дано(еда && еда.ровно && еда.влезает, 'крестик по центру, на 320 ничего не вылезает');

  /* 6. шторка приёма — со снимком */
  await p2.click('#fmeals .fmeal').catch(() => {}); await p2.waitForTimeout(700);
  const фото = await p2.evaluate(() => { const b = document.getElementById('mv-ph'); return b ? { видно: !b.hidden, img: !!b.querySelector('img') } : null; });
  дано(фото && фото.видно && фото.img, 'в шторке приёма есть фото тарелки: ' + JSON.stringify(фото));

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
