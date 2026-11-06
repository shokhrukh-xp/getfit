'use strict';
/* 06.11, его список правок по снимкам (выключатель ui3 — сначала ему и svc_*):
   1 — стекло на панели как в iOS; 2 — меньше пустоты и текста внизу; 3 — вкладки дней по центру и поровну;
   4 — «Сегодня не в зале?» только в день зала; 5 — «Шаги и сон» спрятаны до интеграции с телефоном;
   7 — «Изменено на другом устройстве» без вопроса; 8 — «кг, см» на языке приложения, низ профиля короче;
   9 — у всех еда и зал, выбора «что вести» нет. Без выключателя всё как было. */
const { chromium } = require('playwright'), M = require('./mock');
let bad = 0; const ok = (c, t) => { console.log((c ? '  ok  ' : '  ПРОВАЛ  ') + t); if (!c) bad++; };
(async () => { const b = await chromium.launch(); try {
  for (const ф of [['panel2', 'ui3'], ['panel2']]) {
    const есть = ф.includes('ui3'), т = есть ? 'ui3' : 'без ui3';
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const err = await M.поднять(p, { theme: 'light', page: 'gym', features: ф, wait: 1800 }); await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const g = document.querySelector('.l1-grp'), s = getComputedStyle(g);
      const кн = [...document.querySelectorAll('#dayseg button')].map(x => x.getBoundingClientRect()), ряд = document.getElementById('dayseg').getBoundingClientRect();
      return { блюр: (s.backdropFilter || s.webkitBackdropFilter || ''), фон: s.backgroundColor, низ: parseFloat(getComputedStyle(document.body).paddingBottom),
        ширины: кн.map(x => Math.round(x.width)), слева: кн.length ? Math.round(кн[0].left - ряд.left) : 0, справа: кн.length ? Math.round(ряд.right - кн[кн.length - 1].right) : 0,
        шаги: getComputedStyle(document.querySelector('.wear-surface')).display, спорт: (document.querySelector('.sptoday') || {}).offsetParent !== null };
    });
    if (есть) {
      ok(/blur\(24px\)/.test(r.блюр) && /rgba\(11, 79, 90, 0\.5/.test(r.фон), т + ': панель — стекло: размытие и полупрозрачный фон (' + r.фон + ')');
      ok(r.низ <= 120, т + ': запас снизу только на панель (' + r.низ + ' px, было 164+)');
      ok(r.ширины.length > 1 && Math.max(...r.ширины) - Math.min(...r.ширины) <= 1 && Math.abs(r.слева - r.справа) <= 1, т + ': дни делят ряд поровну и симметрично (' + r.ширины.join('/') + ')');
      ok(r.шаги === 'none', т + ': «Шаги и сон» спрятаны');
      ok(!r.спорт, т + ': подпись «Теннис, бег, прогулка…» убрана');
      ok(await p.evaluate(() => (document.getElementById('dbnote') || {}).textContent === ''), т + ': пустой день без строки «ни один подход не отмечен · сохранено на телефоне»');
    } else {
      ok(!/blur\(24px\)/.test(r.блюр), т + ': панель как была');
      ok(r.спорт, т + ': подпись «Теннис, бег, прогулка…» на месте');
      ok(r.низ >= 150, т + ': запас снизу прежний');
    }
    ok(err.length === 0, т + ': без ошибок ' + err.slice(0, 1).join(''));
    await p.close();
  }

  /* 4: «Сегодня не в зале?» — только в день зала по расписанию */
  for (const сегодня of [false, true]) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }), д = new Date().getDay(), дни = {};
    дни[(д + 1) % 7] = 1; дни[(д + 3) % 7] = 1; if (сегодня) дни[д] = 1;
    await p.addInitScript(s2 => { try { localStorage.setItem('shp_v1_shp_sched', s2); } catch (e) {} }, JSON.stringify(дни));
    await M.поднять(p, { theme: 'light', page: 'gym', features: ['panel2', 'ui3'], wait: 1800 }); await p.waitForTimeout(500);
    const виден = await p.evaluate(() => { const t = document.getElementById('tplace'); return !!t && !t.hidden && /не в зале/.test(t.textContent); });
    ok(сегодня ? виден : !виден, 'ui3: ' + (сегодня ? 'сегодня день зала — вопрос «Сегодня не в зале?» есть' : 'сегодня не день зала — вопроса нет'));
    await p.close();
  }
  /* 9 и 8: «только еда» становится «еда и зал»; «кг, см» по языку */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await M.поднять(p, { theme: 'light', page: 'home', features: ['panel2', 'ui3', 'edinicy'], me: { sex: 'm', age: 34, ht: 178, bw: 88.1, only: 'food' }, wait: 1800 }); await p.waitForTimeout(500);
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem('shp_v1_me') || '{}').only === 'all'), 'ui3: «только еда» → еда и зал');
    await p.click('#profbtn'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('pq-only')).display === 'none'), 'ui3: строки «Что веду» в профиле нет');
    await p.click('#pq-lang [data-lang="en"]'); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => document.querySelector('#pq-units [data-units="metric"]').textContent === 'kg, cm'), 'ui3: английский — «kg, cm»');
    await p.click('#pq-lang [data-lang="ru"]'); await p.waitForTimeout(800);
    ok(await p.evaluate(() => document.querySelector('#pq-units [data-units="metric"]').textContent === 'кг, см'), 'ui3: русский — «кг, см»');
    await p.close(); }
  /* 7: висящий конфликт настроек решается сам — без красной строки и кнопок выбора */
  { const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p.addInitScript(() => { try { localStorage.setItem('shp_v1_settings_queue_308687648', JSON.stringify({ me: [{ id: 'op-test', at: Date.now(), epoch: 0, data: { me: {} },
      changes: [{ path: ['me', 'voice'], before: null, after: { set: true, value: 'fun' } }], conflict: { me: { voice: 'standard' } }, conflictPaths: [['me', 'voice']] }] })); } catch (e) {} });
    await M.поднять(p, { theme: 'light', page: 'home', features: ['panel2', 'ui3'], wait: 1800 }); await p.waitForTimeout(500);
    await p.click('#profbtn'); await p.waitForTimeout(1500);
    const к = await p.evaluate(() => { const n = document.getElementById('settingsstatus'); return { текст: n && !n.hidden ? n.textContent : '', кнопок: n && !n.hidden ? n.querySelectorAll('button').length : 0,
      очередь: ((JSON.parse(localStorage.getItem('shp_v1_settings_queue_308687648') || '{}').me) || []).filter(j => j.conflict).length }; });
    ok(!/Изменено на другом устройстве/.test(к.текст) && !к.кнопок && к.очередь === 0, 'ui3: конфликт настроек решён без вопроса (' + (к.текст || 'строки нет') + ', в очереди ' + к.очередь + ')');
    await p.close(); }
} catch (e) { console.error('УПАЛО:', e.stack); bad++; }
await b.close(); console.log(bad ? '\nПРОВАЛОВ: ' + bad : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ'); process.exit(bad ? 1 : 0); })();
