'use strict';
/* 07.11: снимки правок — профиль внизу и «Данные и аккаунт», язык списком, зал (вопрос места и «Пересобрать»). Не проверка. */
const { chromium } = require('playwright'), M = require('./mock');
const out = process.argv[2] || '/tmp/wbf'; require('fs').mkdirSync(out, { recursive: true });
(async () => { const b = await chromium.launch(); try {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const д = new Date().getDay(), дни = {}; дни[д] = 1; дни[(д + 3) % 7] = 1;
  await p.addInitScript(s2 => { try { localStorage.setItem('shp_v1_shp_sched', s2); } catch (e) {} }, JSON.stringify(дни));
  await M.поднять(p, { theme: 'dark', page: 'gym', features: ['panel2', 'ui3', 'chat2', 'roli', 'soglasie2', 'udalit', 'edinicy'], wait: 1800 }); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/0711-zal-verh.png' });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/0711-zal-niz.png' });
  await p.click('#profbtn'); await p.waitForTimeout(500);
  await p.evaluate(() => { const m = document.querySelector('#profm .modalbox') || document.querySelector('#profm'); m.scrollTop = 1e6; }); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/0711-profil-niz.png' });
  await p.click('#pq-akk'); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/0711-akk.png' });
  console.log('ok');
} finally { await b.close(); } })().catch(e => { console.error(e); process.exit(1); });
