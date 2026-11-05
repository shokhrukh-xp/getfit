'use strict';
/* 05.11, картинки блюд из меню по ссылке (выключатель kartinki). Его слова: «а можно сделать так
   чтобы он показывал картинку блюд с меню по ссылке если есть там». Сервер кладёт под реплику
   act {type:'kartinki', venue, items:[{name, price, img}]} — только за выключателем. Заперто:
   (1) с выключателем — карточки под репликой теми же .deliverydish, что подбор доставки: фото,
   название, цена; чужой хост картинки — мимо; (2) без выключателя — ни карточек, ни лишней
   кнопки от act (кнопкиHTML его не рисует), реплика как была; (3) на 320 без прокрутки вбок. */
const { chromium } = require('playwright'), M = require('./mock'), assert = require('node:assert/strict'), path = require('node:path');
(async () => { const b = await chromium.launch(); try {
  const act = [{ type: 'kartinki', d: new Date().toISOString().slice(0, 10), venue: 'Tutun lounge', items: [
    { name: 'Стейк грудка', price: '93 000 сум', img: 'https://cdn.delever.uz/delever/products/grudka.jpg' },
    { name: 'Цезарь "классик"', price: null, img: 'https://cdn.delever.uz/delever/products/cezar.jpg' },
    { name: 'Чужое', price: '1 сум', img: 'https://evil.example/x.jpg' }] }];
  const чат = [{ role: 'user', text: 'Я в Тутун, что взять на ужин?', ts: Date.now() - 60000 }, { role: 'assistant', text: 'Возьми Стейк грудка (350 г, 480 ккал) и Цезарь "классик".', ts: Date.now() - 30000, act }];
  for (const [width, features] of [[390, ['kartinki']], [320, ['kartinki']], [390, []]]) {
    const p = await b.newPage({ viewport: { width, height: 900 } });
    await p.route('https://cdn.delever.uz/**', r => r.fulfill({ path: path.join(__dirname, 'fixtures/a.jpg'), contentType: 'image/jpeg' }));
    const errors = await M.поднять(p, { chat: чат, features });
    await p.click('#coachnav'); await p.waitForSelector('.turn .say', { timeout: 12000 }); await p.waitForTimeout(500);
    const вкл = features.length > 0;
    const карточек = await p.locator('.kartinki .deliverydish').count();
    if (вкл) {
      assert.equal(карточек, 2, 'две карточки: блюда с картинкой с известного хоста, чужой хост — мимо');
      assert.equal(await p.locator('.kartinki .deliverydish').first().locator('b').textContent(), 'Стейк грудка');
      assert.equal(await p.locator('.kartinki .deliverydish').first().locator('p').textContent(), '93 000 сум');
      assert.equal(await p.locator('.kartinki .deliverydish').nth(1).locator('p').count(), 0, 'без цены — без строки цены');
      assert.match(await p.locator('.kartinki .deliverydish img').first().getAttribute('src'), /^https:\/\/cdn\.delever\.uz\//);
      assert.ok(await p.locator('.kartinki .deliverydish img').first().evaluate(i => i.complete && i.naturalWidth > 0), 'картинка загрузилась');
      assert.match(await p.locator('.kartinki > p').first().textContent(), /Tutun lounge/);
      assert(!await p.locator('.kartinki').first().evaluate(e => e.scrollWidth > e.clientWidth + 1), 'на ' + width + ' без горизонтальной прокрутки');
    } else {
      assert.equal(карточек, 0, 'без выключателя карточек нет');
      assert.equal(await p.locator('.kartinki').count(), 0);
    }
    assert.equal(await p.locator('.turn button[data-cact]').count(), 0, 'act kartinki не становится кнопкой');
    assert.match(await p.locator('.turn .say').last().innerText(), /Стейк грудка/, 'реплика на месте');
    assert.deepEqual(errors, []); await p.close();
    console.log('PASS картинки меню ' + width + (вкл ? ' с выключателем: карточки под репликой' : ' без выключателя: ничего нового'));
  }
} finally { await b.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
