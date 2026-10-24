'use strict';
/* 24.10, этап 5 «женское здоровье». Его решения: цикл, беременность, кормление,
   менопауза и своё поле («хочу дать возможность вписать самим… тренер должен
   это учитывать»); цикл — одна кнопка «Начались»; профиль + одна карточка.
   Заперто: (1) у женщины на главной карточка «Учитывать женское здоровье?»;
   (2) лист: состояния, у цикла дата начала и длина, своё поле; (3) «Сохранить»
   пишет me.fem и fem_at, карточка уходит; (4) строка в профиле показывает день
   цикла; (5) «Начались сегодня» добавляет отметку; (6) беременность пишет срок и
   med.preg; (7) у мужчины ни карточки, ни строки; (8) «Не сейчас» прячет навсегда. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ОНА = { sex: 'f', age: 32, ht: 165, bw: 70, wt: 'down', goal: 'fat', voice: 'hard' };
const ОН = { sex: 'm', age: 38, ht: 178, bw: 88.1, wt: 'down', goal: 'fat', voice: 'hard' };
const ЦЕЛЬ = { text: '62 кг к весне', wt: 'down', rate: -0.4, from: M.Д(20), w0: 72, by: '2027-03-01', kg: 10 };
const безТренера = p => p.addInitScript(() => { try { localStorage.setItem('shp_v1_trcard_off', '1'); } catch (e) {} });
const meИз = p => p.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));

(async () => {
  const br = await chromium.launch();
  try {
    for (const тема of ['dark', 'light']) {
      const page = await br.newPage({ viewport: { width: 390, height: 844 } });
      await безТренера(page);
      const ош = await M.поднять(page, { page: 'home', time: '19:40', theme: тема, goal: ЦЕЛЬ, me: ОНА });
      await page.waitForTimeout(600);
      const к = page.locator('#femcard');
      дано(await к.isVisible(), тема + ': карточка на главной у женщины');
      if (!(await к.isVisible())) { await page.close(); continue; }
      дано(/Учитывать женское здоровье\?/.test(await к.innerText()), тема + ': текст карточки');
      await page.screenshot({ path: '/tmp/gf-jen-card-' + тема + '.png' });
      await page.click('#femcard [data-fm="open"]'); await page.waitForTimeout(300);
      const лист = page.locator('#femm');
      дано(await лист.isVisible(), тема + ': открылся лист');
      const т = await лист.innerText();
      дано(/Обычный цикл/.test(т) && /Беременность/.test(т) && /Кормлю грудью/.test(т) && /Менопауза/.test(т) && /ЧТО ЕЩЁ УЧЕСТЬ/i.test(т),
        тема + ': четыре состояния и своё поле');
      await page.click('#femm [data-fmst="cycle"]');
      дано(await page.locator('#femm [data-fm="start"]').isVisible(), тема + ': у цикла кнопка «Начались сегодня»');
      await page.fill('#fm-start', M.Д(10)); await page.fill('#fm-len', '30');
      await page.fill('#fm-note', 'анемия, в первые дни слабость');
      await page.screenshot({ path: '/tmp/gf-jen-cycle-' + тема + '.png' });
      await page.click('#femm [data-fm="save"]'); await page.waitForTimeout(300);
      let me = await meИз(page);
      дано(me.fem && me.fem.st === 'cycle' && (me.fem.cyc.starts || []).includes(M.Д(10)) && me.fem.cyc.len === 30 &&
        /анемия/.test(me.fem.note) && !!me.fem_at, тема + ': в профиле ' + JSON.stringify(me.fem));
      дано(!(await лист.isVisible()) && !(await к.isVisible()), тема + ': лист закрыт, карточки нет');
      await page.click('#profbtn'); await page.waitForTimeout(400);
      дано(await page.locator('#pq-fem').isVisible(), тема + ': строка в профиле видна');
      дано(/день 11 из ~30/.test(await page.locator('#pv-fem').innerText()), тема + ': строка — «день 11 из ~30»');
      await page.click('#pq-fem'); await page.waitForTimeout(300);
      дано(/День 11 из ~30/.test(await лист.innerText()), тема + ': в листе день цикла');
      await page.click('#femm [data-fm="start"]'); await page.waitForTimeout(200);
      me = await meИз(page);
      дано((me.fem.cyc.starts || []).includes(M.Д(0)), тема + ': «Начались сегодня» добавила отметку');
      дано(/День 1 из ~30/.test(await лист.innerText()), тема + ': после отметки — день 1');
      await page.click('#femm [data-fm="start"]'); await page.waitForTimeout(200);
      me = await meИз(page);
      дано(me.fem.cyc.starts.filter(x => x === M.Д(0)).length === 1, тема + ': повтор не задваивает');
      await page.click('#femm [data-fmst="preg"]');
      await page.fill('#fm-pw', '20');
      await page.screenshot({ path: '/tmp/gf-jen-preg-' + тема + '.png' });
      await page.click('#femm [data-fm="save"]'); await page.waitForTimeout(300);
      me = await meИз(page);
      дано(me.fem.st === 'preg' && me.fem.preg_w === 20 && me.med && me.med.preg === 1, тема + ': беременность, 20 нед, med.preg');
      дано(/беременность/.test(await page.locator('#pv-fem').innerText()), тема + ': строка — «беременность»');
      await page.click('#pq-fem'); await page.waitForTimeout(300);
      await page.click('#femm [data-fmst="lact"]'); await page.fill('#fm-lm', '3');
      await page.click('#femm [data-fm="save"]'); await page.waitForTimeout(300);
      me = await meИз(page);
      дано(me.fem.st === 'lact' && me.fem.lact_m === 3 && me.med.preg === 0, тема + ': кормление, 3 мес, med.preg снят');
      дано(ош.length === 0, тема + ': без ошибок JS ' + ош.slice(0, 2).join(' | '));
      await page.close();
    }
    /* мужчина — ни карточки, ни строки */
    const p1 = await br.newPage({ viewport: { width: 390, height: 844 } });
    await безТренера(p1);
    await M.поднять(p1, { page: 'home', time: '19:40', goal: ЦЕЛЬ, me: ОН });
    await p1.waitForTimeout(600);
    дано(!(await p1.locator('#femcard').isVisible()), 'у мужчины карточки нет');
    await p1.click('#profbtn'); await p1.waitForTimeout(400);
    дано(!(await p1.locator('#pq-fem').isVisible()), 'у мужчины строки в профиле нет');
    await p1.close();
    /* «Не сейчас» — больше не появляется */
    const p2 = await br.newPage({ viewport: { width: 390, height: 844 } });
    await безТренера(p2);
    await M.поднять(p2, { page: 'home', time: '19:40', goal: ЦЕЛЬ, me: ОНА, одинРаз: true });
    await p2.waitForTimeout(600);
    if (await p2.locator('#femcard').isVisible()) {
      await p2.click('#femcard [data-fm="later"]'); await p2.waitForTimeout(200);
      дано(!(await p2.locator('#femcard').isVisible()), '«Не сейчас» прячет карточку');
      await p2.reload(); await p2.waitForTimeout(1200);
      дано(!(await p2.locator('#femcard').isVisible()), 'после перезапуска карточки нет');
    } else дано(false, 'карточка для «Не сейчас» не показалась');
    await p2.close();
  } finally { await br.close(); }
  console.log(плохо ? 'ПРОГОН: провалов ' + плохо : 'ПРОГОН: всё зелёное');
  process.exit(плохо ? 1 : 0);
})();
