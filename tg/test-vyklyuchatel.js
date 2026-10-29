'use strict';
/* 29.10, этап 0 ролей (его условие «нужно убедиться, что ничего не сломаем из того,
   что уже работает»): выключатель новых функций. Сервер отдаёт в /sub список
   включённых функций (features), приложение кладёт его в body[data-f] — по нему
   прячется всё новое. Без списка — атрибута нет, приложение как до этапа (это же
   доказывает tg/etalon-ekrany.js: 0 изменённых экранов). Страница на /test/ ходит
   в тестовый сервер api.wellbol.com/test, боевая — никогда. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const M = require('./mock');
(async () => {
  const br = await chromium.launch();
  try {
    /* 1. Функция включена — список в body[data-f] */
    const p1 = await br.newPage({ viewport: { width: 390, height: 844 } });
    const o1 = { features: ['roli', 'karta'] };
    const ош1 = await M.поднять(p1, o1);
    await p1.waitForFunction(() => document.body.getAttribute('data-f') === 'roli karta', null, { timeout: 5000 });
    assert.deepEqual(ош1, [], 'без ошибок страницы');

    /* 2. Ничего не включено — атрибута нет */
    const p2 = await (await br.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    const ош2 = await M.поднять(p2, {});
    await p2.waitForTimeout(400);
    assert.equal(await p2.evaluate(() => document.body.hasAttribute('data-f')), false, 'без features атрибута data-f нет');
    assert.deepEqual(ош2, [], 'без ошибок страницы');

    /* 3. Боевая страница ходит в боевой сервер, страница на /test/ — в тестовый */
    const боевые = [], тестовые = [];
    p2.on('request', r => { if (/api\.wellbol\.com\/test\//.test(r.url())) тестовые.push(r.url()); });
    await p2.reload(); await p2.waitForTimeout(800);
    assert.equal(тестовые.length, 0, 'боевая страница в тестовый сервер не ходит');

    /* p3 — в том же браузерном профиле, что боевая p2: тот же адрес, тот же localStorage */
    const кон = p2.context(); await p2.waitForTimeout(800);
    const боевыеКлючи = await p2.evaluate(() => Object.keys(localStorage).filter(k => /^shp_v1_|^tgcs_/.test(k)).sort());
    await p2.close();   /* боевая больше ничего не пишет — всё новое дальше только от тестовой */
    const p3 = await кон.newPage();
    p3.on('request', r => { const u = r.url(); if (/api\.wellbol\.com\/test\//.test(u)) тестовые.push(u); else if (/api\.wellbol\.com\//.test(u)) боевые.push(u); });
    await p3.route(M.БАЗА + 'test/', async r => r.fulfill({ response: await r.fetch({ url: M.БАЗА }) }));
    await M.поднять(p3, { base: M.БАЗА + 'test/' });
    await p3.waitForTimeout(800);
    assert.ok(тестовые.length > 0, 'страница на /test/ ходит в api.wellbol.com/test');
    assert.equal(боевые.length, 0, 'страница на /test/ в боевой сервер не ходит: ' + боевые.slice(0, 2).join(' '));
    /* 29.10, живая проверка в @WellbolTestBot: тестовая страница брала копию дневника с боя
       (тот же localStorage) — «Сервер вернул устаревшее состояние дневника», профиль не грузился */
    const ключи = await p3.evaluate(() => Object.keys(localStorage));
    assert.ok(ключи.some(k => /^shp_t_/.test(k)), 'у тестовой страницы свои ключи shp_t_: ' + ключи.slice(0, 5).join(' '));
    assert.deepEqual(ключи.filter(k => /^shp_v1_|^tgcs_/.test(k)).sort(), боевыеКлючи, 'боевые ключи тестовая страница не трогает');
    console.log('PASS выключатель: features → body[data-f], без них атрибута нет; /test/ → тестовый сервер, боевая страница — только боевой');
  } finally { await br.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
