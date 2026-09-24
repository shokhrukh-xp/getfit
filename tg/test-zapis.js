'use strict';
/* ── ЗАПИСЬ ЧИТАЕТСЯ ВСЕМИ ─────────────────────────────────────────────
   13.09 два бага подряд оказались одной породы: приложение ПИШЕТ запись
   тренировки в одном виде, а читает её в другом. Карта тела искала мышцу,
   которой в записи не было; экран дня искал отметки подходов, которых в
   облаке нет по устройству. Оба раза проверки этого не поймали, потому что
   каждая смотрела свой кусок.

   Здесь проверяется сам контракт: отмечаем подходы, сохраняем — и смотрим,
   что ровно эту запись понимают ВСЕ, кто её читает: журнал, карта тела,
   «Упражнения», прогрессия весов и экран дня на другом устройстве. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const ЗАПИСЬ = () => {
  const из = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf('tgcs_workouts_') === 0) {
      try { из.push(JSON.parse(localStorage.getItem(k))); } catch (e) {}
    }
  }
  return из;
};

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  /* CDN здесь НЕ глушим: при отказе картинки приложение само убирает блок
     кадра (серый квадрат не объясняет движение), и проверить, что адрес
     собран по id, стало бы нельзя */
  const ош = await M.поднять(page, { theme: 'dark', page: 'gym', wait: 2600 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(700);

  /* отмечаем первое упражнение целиком */
  await page.click('#list .exrow');
  await page.waitForTimeout(500);
  const имяУпр = await page.$eval('.card.exact .exname', e => e.textContent.trim()).catch(() => '');
  await page.click('.card.exact .allb');
  await page.waitForTimeout(900);
  await page.click('#finish');
  /* занятие на стенде длится секунды — приложение спросит минуты (test-minuty) */
  дано(await M.ответитьДлительность(page, 45), 'на слишком короткое занятие спрошены минуты');
  await page.waitForTimeout(2200);

  const записи = await page.evaluate(ЗАПИСЬ);
  дано(записи.length === 1, 'тренировка ушла в хранилище: ' + записи.length);
  const w = записи[0] || {};
  const x = (w.ex || [])[0] || {};

  /* ── контракт записи ── */
  дано(!!w.date && !!w.day, 'у записи есть дата и день: ' + w.date + ' ' + w.day);
  /* ── ВРЕМЯ ЗАНЯТИЯ ЕДЕТ В ЗАПИСЬ ──
     14.09: «время тренировки отличается на телефоне и на маке». Отметка о
     начале живёт в памяти устройства, а в запись её клало только
     «Завершить и сохранить» — и тут же затирало автосохранение. В облаке
     t0 не было ни у одной тренировки: телефон рисовал зал на своей местной
     отметке, мак — на «сейчас», и один день выглядел по-разному. */
  дано(!!w.t0 && !isNaN(new Date(w.t0)), 'в записи есть время начала занятия: ' + w.t0);
  дано(w.dur > 0 && w.dur <= 240, 'и длительность в разумных пределах: ' + w.dur + ' мин');
  дано(new Date(w.t0).toISOString().slice(0, 10) === w.date,
    'и начало относится к тому же дню: ' + w.t0.slice(0, 10));
  дано(!!x.n, 'у упражнения есть имя: ' + x.n);
  дано(!!x.id, 'и id каталога — по нему ищут кадр, мышцу и прошлый раз: ' + x.id);
  /* мышца ИЛИ группа движения: у встроенной программы есть группа, у
     собранной тренером — мышца. Карта тела умеет оба пути и третий, по id */
  дано(x.m !== undefined && x.p !== undefined,
    'и то, по чему ищут мышцу: m=' + x.m + ' p=' + x.p);
  дано(x.unit === 'reps' || x.unit === 'sec', 'и единица измерения: ' + x.unit);
  дано((x.sets || []).length > 0 && x.sets.every(v => v.r != null),
    'в подходах записаны числа, а не пустоты: ' + JSON.stringify(x.sets));
  /* вес пуст законно: профиль не заполнен, стартовый вес приложение не
     выдумывает — «пустая подсказка лучше вранья» */

  /* ── ту же запись понимает карта тела ── */
  for (const b of await page.$$('.zseg button'))
    if ((await b.textContent()).trim() === 'Журнал' && await b.isVisible()) { await b.click(); break; }
  await page.waitForTimeout(1800);
  const журнал = await page.evaluate(() => ({
    мышцы: Array.from(document.querySelectorAll('#logmus .bodymap .num'))
      .map(t => t.getAttribute('data-m') + ':' + t.textContent.trim()),
    упражнения: Array.from(document.querySelectorAll('#logprog .uprow .upn')).map(e => e.textContent.trim()),
    кадр: (document.querySelector('#logprog .uprow .exph img') || {}).src || ''
  }));
  дано(журнал.мышцы.length > 0, 'карта тела увидела эту тренировку: ' + журнал.мышцы.join(' '));
  дано(журнал.упражнения.length > 0, '«Упражнения» увидели её же: ' + журнал.упражнения.join(' · ').slice(0, 60));
  дано(журнал.кадр.indexOf(x.id) >= 0,
    'адрес кадра собран по id записи: ' + журнал.кадр.slice(-46));

  /* ── и экран дня на другом устройстве ── */
  const другое = await br.newPage({ viewport: { width: 390, height: 900 } });
  await M.поднять(другое, { theme: 'dark', page: 'gym', wait: 2600, hist: [w] });
  await другое.waitForTimeout(1200);
  const день = await другое.$$eval('#list .exrow', rs => rs.map(r => ({
    имя: (r.querySelector('.exrn b') || {}).textContent || '',
    справа: ((r.querySelector('.exrv') || {}).textContent || '').replace(/\s+/g, ' '),
    done: r.classList.contains('done')
  })));
  const строка = день.find(r => r.done);
  дано(!!строка, 'на другом устройстве день показан сделанным: ' +
    день.map(r => r.имя.slice(0, 14) + (r.done ? '✓' : '')).join(' · '));
  if (строка) дано(!/^\s*—/.test(строка.справа), 'и с числами, а не прочерком: ' + строка.справа);
  дано(/сделан|сегодня|зал/i.test(имяУпр) || имяУпр.length > 0, 'упражнение опознано: ' + имяУпр);

  /* ── прогрессия весов видит эту же запись ── */
  const совет = await другое.evaluate(() => {
    const r = document.querySelector('#list .exrow');
    return r ? (r.querySelector('.exrv') || {}).textContent || '' : '';
  });
  дано(совет.length > 0, 'строка упражнения показывает результат: ' + совет.replace(/\s+/g, ' '));

  /* ── ОДИН ДЕНЬ ВЫГЛЯДИТ ОДИНАКОВО НА ОБОИХ ЭКРАНАХ ──
     Это и был его симптом: на телефоне зал стоял на 08:12, на маке — около
     18:00, то есть на «сейчас». Метка зала на часах дня обязана стоять в
     одном месте на устройстве, где тренировался, и на том, где только
     смотришь. */
  const залМетка = async p => {
    const b = await p.$('.l1 button[data-page="home"]');
    if (b) { await b.click(); await p.waitForTimeout(1200); }
    return p.evaluate(() => {
      const g = document.querySelector('.hb-gym, .hb-gymon');
      if (!g) return null;
      const m = String(g.getAttribute('transform') || '').match(/translate\(([-\d.]+) ([-\d.]+)\)/);
      const svg = (document.querySelector('.hclk-svg') || {}).textContent || '';
      return m ? { x: +m[1], y: +m[2], подпись: /(\d\d:\d\d)[^а-я]*зал/.exec(svg.replace(/\s+/g, ' ')) } : null;
    });
  };
  const наТелефоне = await залМетка(page);
  const наМаке = await залМетка(другое);
  дано(!!наТелефоне && !!наМаке, 'зал отмечен на часах дня на обоих устройствах');
  if (наТелефоне && наМаке) {
    const dx = Math.abs(наТелефоне.x - наМаке.x), dy = Math.abs(наТелефоне.y - наМаке.y);
    дано(dx < 1.5 && dy < 1.5,
      'и стоит в одном и том же месте: ' + наТелефоне.x.toFixed(1) + ',' + наТелефоне.y.toFixed(1) +
      ' и ' + наМаке.x.toFixed(1) + ',' + наМаке.y.toFixed(1));
  }

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
