'use strict';
/* Каталог: поиск главный, фильтры за одной кнопкой, без запроса — подборки
   по мышцам. Раньше четыре ряда чипов занимали больше половины экрана, и до
   первого упражнения надо было листать. */
const fs = require('fs');
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const кадр = fs.readFileSync(__dirname + '/fixtures/a.jpg');

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  /* картинки упражнений живут на jsdelivr — у контейнера туда нет сети.
     Подменяем местным кадром, иначе меряем пустые рамки (уже обжигались). */
  await page.route('**/cdn.jsdelivr.net/**', r =>
    r.fulfill({ status: 200, contentType: 'image/jpeg', body: кадр }));
  const ош = await M.поднять(page, { theme: 'dark', time: '19:40' });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.locator('.l1-in button', { hasText: 'Тренировка' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: 'каталог' }).first().click();
  await page.waitForTimeout(1500);

  /* 1. фильтры свёрнуты, и первое упражнение близко к верху */
  дано(!(await page.isVisible('#pcatfilters').catch(() => false)), 'ряды чипов свёрнуты');
  const верх = await page.$eval('#pcatbody .catitem', e => e.getBoundingClientRect().top);
  дано(верх < 520, 'первое упражнение видно без прокрутки: ' + Math.round(верх) + ' px от верха');

  /* 2. подборки по мышцам, а не простыня */
  const группы = await page.$$eval('#pcatbody .catgrp h4 span',
    ns => ns.map(e => e.textContent.trim()));
  дано(группы.length >= 4, 'групп несколько: ' + группы.slice(0, 4).join(' · '));
  const вГруппе = await page.$$eval('#pcatbody .catgrp:first-child .catitem', n => n.length);
  дано(вГруппе === 4, 'в группе по четыре упражнения: ' + вГруппе);
  дано(/Грудь/.test(группы[0] || ''), 'первая группа — грудь: ' + группы[0]);
  const фото = await page.$$eval('#pcatbody .catgrp .catitem img', ns => ns.length);
  дано(фото >= 8, 'у каждой строки подборки есть фото: ' + фото);

  /* 3. кнопка фильтров говорит, что выбрано */
  дано(/ничего не выбрано/.test(await page.textContent('#pcatfbtn')),
    'на кнопке — состояние, а не список: ' + (await page.textContent('#pcatfbtn')).trim());
  await page.click('#pcatfbtn');
  await page.waitForTimeout(400);
  дано(await page.isVisible('#pcatfilters'), 'по нажатию чипы раскрылись');
  дано(await page.isVisible('#pcatfilters .mchips[data-f="m"]'), 'мышца на месте');
  дано(await page.isVisible('#pcatfilters .mchips[data-f="q"]'), 'снаряд на месте');

  /* 4. выбрал мышцу — подборки уступают место списку */
  await page.click('#pcatfilters .mchips[data-f="m"] .mchip:not([data-v=""])');
  await page.waitForTimeout(600);
  дано((await page.$$('#pcatbody .catgrp')).length === 0, 'подборок больше нет — идёт список');
  дано(/фильтры/.test(await page.textContent('#pcatfbtn')) &&
       !/ничего не выбрано/.test(await page.textContent('#pcatfbtn')),
    'кнопка показывает выбранное: ' + (await page.textContent('#pcatfbtn')).trim());
  дано(await page.isVisible('#pcatreset'), 'появилась кнопка «сбросить»');
  await page.click('#pcatreset');
  await page.waitForTimeout(600);
  дано((await page.$$('#pcatbody .catgrp')).length >= 4, 'сброс вернул подборки');

  /* 5. «все N →» из заголовка группы — это тот же фильтр */
  await page.click('#pcatbody .catgrp:first-child h4 button');
  await page.waitForTimeout(600);
  дано((await page.$$('#pcatbody .catgrp')).length === 0, '«все →» открыло список группы');
  дано(/Грудь/.test(await page.textContent('#pcatfbtn')),
    'и это именно та мышца: ' + (await page.textContent('#pcatfbtn')).trim());

  /* 6. поиск работает поверх всего */
  await page.click('#pcatreset'); await page.waitForTimeout(400);
  await page.fill('#pcatsearch', 'присед');
  await page.waitForTimeout(700);
  дано((await page.$$('#pcatbody .catgrp')).length === 0, 'при запросе подборок нет');
  const первый = await page.textContent('#pcatbody .catitem .cattx b');
  дано(/присед/i.test(первый), 'первое найденное отвечает запросу: ' + первый);

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
