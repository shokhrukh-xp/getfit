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
  дано(/сила/i.test(await page.textContent('#pcatfbtn')),
    'на кнопке — что выбрано, включая фильтр по умолчанию: ' + (await page.textContent('#pcatfbtn')).trim());
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

  /* 7. снаряд не написан дважды в одной строке */
  await page.click('#pcatreset'); await page.waitForTimeout(400);
  await page.fill('#pcatsearch', 'штанга');
  await page.waitForTimeout(800);
  const строки = await page.$$eval('#pcatbody .catitem', ns => ns.slice(0, 12).map(e => ({
    имя: e.querySelector('.cattx b').textContent,
    подпись: e.querySelector('.cattag').textContent })));
  const двойные = строки.filter(r => /штанга/i.test(r.имя) && /штанга/i.test(r.подпись));
  дано(строки.length > 0, 'нашлись строки со штангой: ' + строки.length);
  дано(двойные.length === 0, 'снаряд не повторяется в подписи' +
    (двойные[0] ? ': ' + двойные[0].имя + ' / ' + двойные[0].подпись : ''));
  const есть = строки.find(r => !/штанга/i.test(r.имя));
  if (есть) дано(есть.подпись.split('·').length >= 2,
    'а где снаряда в имени нет — он остаётся в подписи: ' + есть.имя + ' / ' + есть.подпись);

  /* 8. одинаковых имён в каталоге не осталось */
  /* весь скрипт приложения в IIFE — CAT изнутри page.evaluate не виден,
     поэтому читаем тот же файл, который грузит приложение */
  const имена = await page.evaluate(async () => {
    const d = await (await fetch('catalog.json')).json();
    const c = {}; let п = 0;
    d.ex.forEach(x => { c[x.n] = (c[x.n] || 0) + 1; });
    Object.values(c).forEach(v => { if (v > 1) п++; });
    return { всего: d.ex.length, повторов: п };
  });
  дано(имена.всего === 887, 'в каталоге все 887 упражнений: ' + имена.всего);
  дано(имена.повторов === 0, 'одинаковых имён не осталось: ' + имена.повторов);

  /* 9. экран не молчит о том, что сам фильтрует.
     «сила» стоит по умолчанию — поиск «растяжка» давал 0 при кнопке
     «ничего не выбрано»: фильтровал и не признавался. */
  await page.click('#pcatreset'); await page.waitForTimeout(400);
  дано(/сила/i.test(await page.textContent('#pcatfbtn')),
    'кнопка признаёт фильтр по умолчанию: ' + (await page.textContent('#pcatfbtn')).trim());
  await page.fill('#pcatsearch', 'растяжка');
  await page.waitForTimeout(800);
  const пусто = await page.textContent('#pcatbody');
  дано(/Ничего не нашлось/.test(пусто), 'пустой результат подписан, а не пустой экран');
  дано(/Ищем среди/.test(пусто), 'и сказано, что сузило поиск: ' + пусто.replace(/\s+/g,' ').slice(0,90));
  дано(await page.isVisible('#catwide'), 'есть выход из тупика одной кнопкой');
  await page.click('#catwide');
  await page.waitForTimeout(700);
  const нашлось = await page.$$('#pcatbody .catitem');
  дано(нашлось.length > 10, 'после «искать среди всех» растяжки нашлись: ' + нашлось.length);

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
