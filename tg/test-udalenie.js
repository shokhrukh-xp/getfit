'use strict';
/* Тренер удаляет приём по просьбе (21.10). Его «Отменяй» про изотоник
   получило «удалить запись можешь только ты сам»; его слова: «он должен сам
   это делать, если пользователь просит», выбор — «Сразу + Вернуть». Заперто:
   после ответа с deleted приём пропадает из дня сразу; внизу та же плашка
   «Удалено · Вернуть», что у удаления руками; «Вернуть» шлёт /meal/restore
   с операцией сервера и возвращает приём в день. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const ИЗО = { id: 'm1', t: '16:04', kind: 'перекус', kcal: 43, prot: 1, text: 'Изотоник Exponenta (половина бутылки)' };
const ПЛОВ = { id: 'm2', t: '13:20', kind: 'обед', kcal: 610, prot: 30, text: 'плов' };

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const вернуть = []; let ходов = 0;
  const ош = await M.поднять(page, { wait: 2400, day: { meals: [ПЛОВ, ИЗО] },
    onCoach: () => ++ходов > 1 ? { ok: true, reply: 'Осталось 600 ккал.' } : ({ ok: true, reply: 'Убрал, не мучайся.\n\n**Убрал: ' + ИЗО.text + '**',
      deleted: [{ id: 'm1', op: 'coach-0123456789abcdef0123', text: ИЗО.text, kcal: 43, date: M.TODAY }],
      day: M.день({ meals: [ПЛОВ] }) }) });
  await page.route('**/meal/restore', r => { вернуть.push(JSON.parse(r.request().postData() || '{}'));
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, day: M.день({ meals: [ПЛОВ, ИЗО] }) }) }); });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  const еда = () => page.$eval('#fmeals', e => e.textContent).catch(() => '');
  дано(/Изотоник/.test(await еда()), 'изотоник в дне до просьбы');
  await page.click('#coachnav'); await page.waitForTimeout(800);
  await page.fill('#ctext', 'Отменяй');
  await page.click('#csend');
  await page.waitForTimeout(1500);
  const после = await еда();
  дано(/плов/.test(после) && !/Изотоник/.test(после), 'после ответа изотоника в дне нет, плов на месте');
  const плашка = await page.$$eval('#undolist .undo-row', rs => rs.map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  дано(плашка.length === 1 && /Удалено/.test(плашка[0]) && /Вернуть/.test(плашка[0]), 'плашка «Удалено · Вернуть»: ' + JSON.stringify(плашка));
  const say = await page.$$eval('#chatlog .turn .say', ss => ss.map(s => s.textContent).join(' | '));
  дано(/Убрал: Изотоник/.test(say), 'в разговоре строка «Убрал: …»');
  await page.click('#undolist .undo-row button');
  await page.waitForTimeout(800);
  дано(вернуть.length === 1 && вернуть[0].id === 'm1' && вернуть[0].operation === 'coach-0123456789abcdef0123',
    '«Вернуть» — /meal/restore с операцией сервера: ' + JSON.stringify(вернуть[0] || null));
  дано(/Изотоник/.test(await еда()), 'изотоник вернулся в день');
  дано(await page.$$eval('#undolist .undo-row', rs => rs.length) === 0, 'плашка ушла после возврата');

  /* ответ без deleted — плашки нет */
  await page.fill('#ctext', 'Сколько осталось?');
  await page.click('#csend');
  await page.waitForTimeout(1200);
  дано(await page.$$eval('#undolist .undo-row', rs => rs.length) === 0, 'обычный ответ — без плашки «Удалено»');
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
