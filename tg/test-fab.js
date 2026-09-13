'use strict';
/* Один вход в разговор — круглая кнопка с логотипом.
   12.09 он попросил убрать с главной поле, камеру и раскрытую ленту: разговор
   с тренером был размазан по двум экранам, и на главной он занимал место,
   которого там нет. Проверяем: на странице нет второго входа; кнопка видна,
   в кадре, не лезет на нижние закреплённые полоски; по нажатию открывается
   разговор, а сама кнопка уходит, чтобы не было двух входов сразу. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const пр = (page, sel) => page.$eval(sel, e => e.getBoundingClientRect().toJSON());

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 844 } });
  const ош = await M.поднять(page, { theme: 'dark' });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* 1. второго входа нет */
  for (const s of ['#hbar', '#htext', '#hphoto', '#hsend', '#hfile'])
    дано(await page.$(s) === null, 'на главной больше нет ' + s);
  дано(await page.$('#homebody .msg') === null, 'ленты разговора в потоке главной нет');

  /* 2. кнопка: размер пальца, в кадре, над вкладками */
  дано(await page.isVisible('#coachfab'), 'кнопка тренера видна');
  const f = await пр(page, '#coachfab');
  дано(Math.round(f.width) >= 44 && Math.round(f.height) >= 44,
    'кнопка не меньше 44 точек: ' + Math.round(f.width) + '×' + Math.round(f.height));
  const прозр = await page.$eval('#coachfab', e => +getComputedStyle(e).opacity);
  /* 12.09, второй заход: вполсилы (0,62) её было почти не видно. Приглушение
     осталось, но такое, чтобы кнопку было видно на любом фоне. */
  дано(прозр >= 0.85 && прозр < 1, 'в покое кнопка чуть приглушена, но видна: ' + прозр);
  дано(f.top >= 0 && f.bottom <= 844 && f.right <= 390, 'кнопка целиком в кадре');
  const tb = await пр(page, '.l1');
  дано(f.bottom <= tb.top, 'кнопка не залезает на нижние вкладки');
  дано(await page.$eval('#coachfab img', i => /logo/.test(i.getAttribute('src') || '')),
    'на кнопке логотип приложения');

  /* 3. нажал — открылся разговор, кнопка ушла */
  await page.click('#coachfab');
  await page.waitForTimeout(400);
  дано(await page.isVisible('#coachm'), 'разговор открылся');
  дано(await page.$eval('#coachfab', e => getComputedStyle(e).pointerEvents === 'none'),
    'пока разговор открыт, кнопки не видно — двух входов сразу не бывает');
  for (const s of ['#chatlog', '#ctext', '#cphoto', '#csend'])
    дано(await page.isVisible(s), 'в разговоре есть ' + s);

  /* 4. фото прикрепляется внутри разговора и это видно */
  await page.setInputFiles('#cfile', 'tg/fixtures/c.jpg');
  await page.waitForTimeout(400);
  дано(await page.isVisible('#cattach'), 'прикреплённое фото видно в самом разговоре');

  /* 5. ответ приходит в ту же ленту */
  await page.route('**/coach', async route => {
    await new Promise(r => setTimeout(r, 300));
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, reply: 'Записал: плов, 650 ккал.', day: M.день({}) }) });
  });
  await page.fill('#ctext', 'плов');
  await page.click('#csend');
  await page.waitForTimeout(900);
  /* 12.09: ответ тренера больше не пузырь — он стоит текстом во всю ширину */
  const пузыри = await page.$$eval('#chatlog .msg, #chatlog .say', es => es.map(e => e.textContent.trim()));
  дано(пузыри.some(t => /Записал/.test(t)), 'ответ пришёл в ту же ленту: ' + (пузыри[пузыри.length - 1] || '—'));

  /* 6. закрыл — кнопка вернулась */
  await page.click('#coachclose');
  await page.waitForTimeout(400);
  дано(await page.$eval('#coachm', e => !e.classList.contains('show')), 'разговор закрылся');
  дано(await page.$eval('#coachfab', e => getComputedStyle(e).pointerEvents !== 'none'), 'кнопка вернулась');

  /* 7. ответ пришёл, пока разговор закрыт: кнопка перестаёт прятаться */
  await page.unroute('**/coach');
  await page.route('**/coach', async route => {
    await new Promise(r => setTimeout(r, 1200));
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, reply: 'Понял, посчитал.', day: M.день({}) }) });
  });
  await page.click('#coachfab'); await page.waitForTimeout(350);
  await page.fill('#ctext', 'а сколько белка осталось');
  await page.click('#csend'); await page.waitForTimeout(150);
  await page.click('#coachclose'); await page.waitForTimeout(1600);
  дано(await page.$eval('#coachfab', e => e.classList.contains('attn')), 'на кнопке отметка: ответ пришёл');
  дано(await page.$eval('#coachfab', e => +getComputedStyle(e).opacity) === 1,
    'с непрочитанным ответом кнопка видна в полную силу');
  await page.click('#coachfab'); await page.waitForTimeout(350);
  await page.click('#coachclose'); await page.waitForTimeout(350);
  дано(!(await page.$eval('#coachfab', e => e.classList.contains('attn'))), 'прочитал — отметка снялась');

  /* 8. страница едет — кнопка бледнеет, встала — вернулась */
  await page.evaluate(() => scrollTo(0, 200));
  await page.waitForTimeout(80);
  дано(await page.$eval('#coachfab', e => e.classList.contains('away')),
    'пока страница едет, кнопка отступает');
  await page.waitForTimeout(700);
  дано(await page.$eval('#coachfab', e => !e.classList.contains('away')),
    'страница встала — кнопка вернулась');

  /* 9. на каждой странице кнопку можно освободить прокруткой донизу */
  for (const p of ['home', 'gym', 'food']) {
    const b = await page.$('.l1 button[data-page="' + p + '"]');
    if (!b) continue;
    await b.click(); await page.waitForTimeout(600);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(700);
    const занято = await page.evaluate(() => {
      const f = document.getElementById('coachfab'), r = f.getBoundingClientRect();
      const был = f.style.pointerEvents; f.style.pointerEvents = 'none';
      const точки = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 9, r.top + 9],
        [r.right - 9, r.top + 9], [r.left + 9, r.bottom - 9], [r.right - 9, r.bottom - 9]];
      let кто = null;
      for (const [x, y] of точки) {
        const el = document.elementFromPoint(Math.round(x), Math.round(y));
        const k = el && el.closest('button,a,input,textarea,select,label,[role="button"]');
        if (k && k.id !== 'coachfab') { кто = (k.textContent || '').trim().slice(0, 18); break; }
      }
      f.style.pointerEvents = был;
      return кто;
    });
    дано(занято === null, 'внизу «' + p + '» под кнопкой нет чужой кнопки' + (занято ? ': ' + занято : ''));
  }

  /* 10. закреплённой внизу полоске уступает: во время отдыха там «+30 с» */
  const gym = await page.$('.l1 button[data-page="gym"]');
  if (gym) {
    await gym.click(); await page.waitForTimeout(700);
    /* 12.09: при входе всё свёрнуто — карточку надо открыть нажатием */
    const стр = await page.$('#list .exrow');
    if (стр) { await стр.click(); await page.waitForTimeout(400); }
    const set = await page.$('.settbl .setrow:not(.done) .ok');
    if (set) {
      await set.click(); await page.waitForTimeout(900);
      const т = await пр(page, '.timer');
      const ф = await пр(page, '#coachfab');
      дано(await page.$eval('.timer', e => getComputedStyle(e).visibility === 'visible'),
        'полоска отдыха на экране');
      дано(ф.bottom <= т.top, 'кнопка поднялась над полоской отдыха: низ ' +
        Math.round(ф.bottom) + ' ≤ верх полоски ' + Math.round(т.top));
    } else дано(false, 'не нашёл кнопку подхода');
  }

  await br.close();

  /* 11. тренер написал сам (вечерний разбор), пока человека не было:
     ленты на главной больше нет — значит про это говорит точка на кнопке */
  const РАЗГОВОР = [
    { role: 'user', text: 'обед: плов' },
    { role: 'assistant', text: 'Записал: 650 ккал.' },
    { role: 'assistant', text: 'Разбор недели: белок добираешь через раз.' }
  ];
  const br3 = await chromium.launch();
  const p3 = await br3.newPage({ viewport: { width: 390, height: 844 } });
  await M.поднять(p3, { theme: 'dark', chat: РАЗГОВОР, seen: 2 });
  await p3.waitForTimeout(1200);
  дано(await p3.$eval('#coachfab', e => e.classList.contains('attn')),
    'новое сообщение от тренера — точка на кнопке');
  await p3.click('#coachfab'); await p3.waitForTimeout(500);
  const лента = await p3.$$eval('#chatlog .msg, #chatlog .say', es => es.map(e => e.textContent.trim()));
  дано(лента.some(t => /Разбор недели/.test(t)), 'само сообщение — в разговоре: ' + (лента[лента.length - 1] || '—'));
  await p3.click('#coachclose'); await p3.waitForTimeout(400);
  дано(!(await p3.$eval('#coachfab', e => e.classList.contains('attn'))), 'прочитал — точка снялась');
  await br3.close();

  /* первый запуск: на сервере уже лежит разговор, но человек его не заводил —
     точкой не пугаем */
  const br4 = await chromium.launch();
  const p4 = await br4.newPage({ viewport: { width: 390, height: 844 } });
  await M.поднять(p4, { theme: 'dark', chat: РАЗГОВОР });
  await p4.waitForTimeout(1200);
  дано(!(await p4.$eval('#coachfab', e => e.classList.contains('attn'))),
    'на первом запуске точки нет — читать нечего');
  await br4.close();

  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
