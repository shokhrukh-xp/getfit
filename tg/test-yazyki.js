'use strict';
/* 24.10, этап 7 «языки». Его решения: «Всё целиком», «Авто + переключатель»,
   узбекский — латиница, выпуск без вычитки.
   Заперто: (1) новый человек с Telegram на английском видит приложение
   по-английски; (2) кто уже пользуется (анкета есть, языка нет) — по-русски,
   как было, даже с английским Telegram; (3) в профиле RU / UZ / EN: выбор
   пишется в me.lang и сразу переводит экран, RU возвращает русский;
   (4) на английском и узбекском на главной почти не остаётся кириллицы
   (остатки печатаются — их добирает словарь); (5) сообщения человека в чате
   не переводятся. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const СЛ = {
  en: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'i18n', 'en.json'), 'utf8')),
  uz: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'i18n', 'uz.json'), 'utf8'))
};
const МЕ = { sex: 'm', age: 38, ht: 178, bw: 88.1, wt: 'down', goal: 'fat', voice: 'hard', coach_at: 'x' };
const ЦЕЛЬ = { text: '75 кг к январю', wt: 'down', rate: -0.5, from: M.Д(20), w0: 90, by: '2027-01-30', kg: 15 };
const безКарточек = p => p.addInitScript(() => { try { localStorage.setItem('shp_v1_trcard_off', '1'); } catch (e) {} });
/* видимая кириллица вне сообщений человека */
const кириллица = p => p.evaluate(() => {
  const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const s = n.nodeValue.trim(); if (!s || !/[А-Яа-яЁё]/.test(s)) continue;
    const el = n.parentElement; if (!el || el.closest('[data-noi18n]')) continue;
    const r = el.getBoundingClientRect(), st = getComputedStyle(el);
    if (!r.width || !r.height || st.visibility === 'hidden' || st.display === 'none' || r.bottom < 0 || r.top > innerHeight) continue;
    if (el.closest('[hidden]') || el.closest('.sr')) continue;
    out.push(s.slice(0, 60));
  }
  return out;
});
const навигация = p => p.evaluate(() => document.getElementById('l1').innerText.replace(/\s+/g, ' ').trim());

(async () => {
  const br = await chromium.launch();
  try {
    /* (1) новый человек, Telegram на английском */
    {
      const page = await br.newPage({ viewport: { width: 390, height: 844 } });
      const ош = await M.поднять(page, { page: 'home', time: '19:40', tgLang: 'en', newbie: true, day: null, score: null, meas: [] });
      await page.waitForTimeout(1500);
      дано((await page.evaluate(() => document.documentElement.lang)) === 'en', 'новый с английским Telegram: lang=en');
      const к = await кириллица(page);
      дано(к.length <= 3, 'новый: на экране почти нет кириллицы (' + к.length + ')' + (к.length ? ' — ' + к.slice(0, 6).join(' | ') : ''));
      дано(ош.length === 0, 'новый: без ошибок JS ' + ош.slice(0, 2).join(' | '));
      await page.close();
    }
    /* (2) кто уже пользуется — по-русски, даже с английским Telegram */
    {
      const page = await br.newPage({ viewport: { width: 390, height: 844 } });
      await безКарточек(page);
      await M.поднять(page, { page: 'home', time: '19:40', tgLang: 'en', goal: ЦЕЛЬ, me: МЕ });
      await page.waitForTimeout(800);
      дано((await page.evaluate(() => document.documentElement.lang)) === 'ru', 'с анкетой и без выбора — русский');
      дано(/Сегодня/.test(await навигация(page)), 'навигация по-русски: ' + (await навигация(page)));
      /* (3) профиль → UZ → EN → RU */
      await page.click('#profbtn'); await page.waitForTimeout(400);
      дано(await page.locator('#pq-lang').isVisible(), 'в профиле строка «Язык»');
      дано((await page.getAttribute('#pq-lang [data-lang="ru"]', 'aria-pressed')) === 'true', 'отмечен RU');
      for (const яз of ['uz', 'en']) {
        await page.click('#pq-lang [data-lang="' + яз + '"]'); await page.waitForTimeout(900);
        const me = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}'));
        дано(me.lang === яз, яз + ': me.lang записан');
        дано((await page.getAttribute('#pq-lang [data-lang="' + яз + '"]', 'aria-pressed')) === 'true', яз + ': отмечена кнопка');
        дано(!/[А-Яа-яЁё]/.test(await навигация(page)), яз + ': навигация без кириллицы: ' + (await навигация(page)));
        await page.screenshot({ path: '/tmp/gf-yazyki-prof-' + яз + '.png' });
      }
      await page.click('#pq-lang [data-lang="ru"]'); await page.waitForTimeout(500);
      дано(/Сегодня/.test(await навигация(page)) && (await page.evaluate(() => document.documentElement.lang)) === 'ru', 'RU вернул русский');
      await page.close();
    }
    /* (4) главная и чат на английском и узбекском */
    for (const яз of ['en', 'uz']) {
      for (const тема of ['dark', 'light']) {
        const page = await br.newPage({ viewport: { width: 390, height: 844 } });
        await безКарточек(page);
        const ош = await M.поднять(page, { page: 'home', time: '19:40', theme: тема, goal: ЦЕЛЬ, me: Object.assign({ lang: яз }, МЕ),
          chat: [{ role: 'user', text: 'Привет, запиши плов', ts: Date.now() - 3700e3 }, { role: 'assistant', text: 'Записал завтрак.', ts: Date.now() - 3600e3 }] });
        await page.waitForTimeout(1500);
        const к = await кириллица(page);
        дано(к.length <= 4, яз + '/' + тема + ': главная — кириллицы ' + к.length + (к.length ? ' — ' + к.slice(0, 8).join(' | ') : ''));
        await page.screenshot({ path: '/tmp/gf-yazyki-home-' + яз + '-' + тема + '.png' });
        if (тема === 'dark') {
          await page.click('#coachnav'); await page.waitForTimeout(700);
          дано(/Привет, запиши плов/.test(await page.locator('#chatlog').innerText()), яз + ': сообщение человека не переведено');
          await page.screenshot({ path: '/tmp/gf-yazyki-chat-' + яз + '.png' });
        }
        дано(ош.length === 0, яз + '/' + тема + ': без ошибок JS ' + ош.slice(0, 2).join(' | '));
        await page.close();
      }
    }
  } finally { await br.close(); }
  console.log(плохо ? 'ПРОГОН: провалов ' + плохо : 'ПРОГОН: всё зелёное');
  process.exit(плохо ? 1 : 0);
})();
