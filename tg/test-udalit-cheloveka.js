'use strict';
/* Удалить человека из админ панели (21.10). Его слова: «как мне удалять
   пользователей… всё безвозвратно, если в будущем захочет — может снова с
   нуля начать», выбор — «Кнопка в списке людей». Заперто: у каждого в
   списке «Удалить», у самого владельца — нет; окно подтверждения называет
   человека и что сотрётся; «Отмена» — запроса нет; «ОК» — /admin/user/del с
   его id, после — список заново. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const список = [
  { uid: '308687648', name: 'Шохрух', by: 'owner', created: Date.now() - 50 * 864e5, kind: 'grand', until: 0, приёмов: 300, последний: '2026-10-21', привёл: 3, был: Date.now() },
  { uid: '8741722652', name: 'Xplorence', by: 'open', created: Date.now() - 9 * 864e5, kind: 'sub', until: Date.now() + 20 * 864e5, приёмов: 3, последний: '2026-10-14', привёл: 0, был: Date.now() - 7 * 864e5 },
  { uid: '14', name: 'X" onfocus="window.__взлом=1" data-x="', by: 'open', created: Date.now() - 864e5, kind: null, until: 0, приёмов: 0, последний: null, привёл: 0, был: Date.now() - 864e5 },
  { uid: '13', name: 'Andrew Nee', by: 'bot', created: Date.now() - 2 * 864e5, kind: null, until: 0, приёмов: 0, последний: null, привёл: 0, был: Date.now() - 12 * 864e5 }
];

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ушло = []; let запросовСписка = 0;
  const ош = await M.поднять(page, { theme: 'dark', wait: 2800, admin: { список },
    handleRoute: async route => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/admin') запросовСписка++;
      if (p !== '/admin/user/del') return false;
      ушло.push(JSON.parse(route.request().postData() || '{}'));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, circles: 0 }) });
      return true;
    } });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.click('#profbtn'); await page.waitForTimeout(700);
  await page.click('#profboss'); await page.waitForTimeout(1300);
  if (await page.$('#admall')) { await page.click('#admall'); await page.waitForTimeout(300); }
  const кнопки = await page.$$eval('[data-admdel]', bs => bs.map(b => ({ uid: b.dataset.admdel, имя: b.getAttribute('aria-label'), h: b.getBoundingClientRect().height })));
  дано(кнопки.length === 3 && !кнопки.some(b => b.uid === '308687648'), '«Удалить» у каждого, кроме самого владельца: ' + JSON.stringify(кнопки.map(b => b.uid)));
  дано(кнопки.every(b => b.h >= 44 && /Удалить /.test(b.имя)), 'кнопка 44 px и называет человека для экранного чтеца');

  /* имя с кавычками — просто текст, а не обработчик (ревью Codex R1) */
  const злое = await page.$('[data-admdel="14"]');
  await злое.focus(); await page.waitForTimeout(100);
  дано(!(await page.evaluate(() => window.__взлом)) && !(await злое.getAttribute('onfocus')), 'имя с кавычками не стало обработчиком');
  дано((await злое.getAttribute('data-name')) === 'X" onfocus="window.__взлом=1" data-x="', 'и в подтверждение уходит целиком');

  /* отмена — ничего не уходит */
  await page.evaluate(() => { window.Telegram.WebApp.showConfirm = (t, cb) => { (window.__окна = window.__окна || []).push(String(t)); cb(false); }; });
  await page.click('[data-admdel="8741722652"]'); await page.waitForTimeout(500);
  const окно = (await page.evaluate(() => window.__окна || [])).pop() || '';
  дано(/Xplorence/.test(окно) && /безвозвратно/.test(окно) && /дневник/.test(окно) && /с нуля/.test(окно), 'окно называет человека и что сотрётся: ' + окно.slice(0, 80));
  дано(ушло.length === 0, '«Отмена» — запроса на удаление нет');

  /* согласие — уходит его id, список перечитывается */
  const былоСписков = запросовСписка;
  await page.evaluate(() => { window.Telegram.WebApp.showConfirm = (t, cb) => cb(true); });
  await page.click('[data-admdel="8741722652"]'); await page.waitForTimeout(1200);
  дано(ушло.length === 1 && ушло[0].who === '8741722652', 'удаление ушло с его id: ' + JSON.stringify(ушло));
  дано(запросовСписка > былоСписков, 'после удаления список перечитан');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
