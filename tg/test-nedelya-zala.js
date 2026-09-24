'use strict';
/* Низ главной (24.09). Его слова: «кнопку занятия — на главный экран вниз»;
   «непонятно написано, что я 2-й из 4 22 дня подряд — это же не так»;
   «вместо текста „завтра в зал“ — линия недели с датами, галочки за
   завершённые тренировки, без галочек — ещё не сделанные». Выбрал: кружки
   с датами, рейтинг и серия двумя строками, на неделе — и занятия вне зала.
   Проверка не зависит от дня недели: всё считается от сегодняшнего. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const д = n => M.Д(n);
const сейчас = new Date(), dow = (сейчас.getDay() + 6) % 7;          /* 0 = пн */
const пн = д(dow);
const РАСП = { 1: 1, 3: 1, 5: 1 };                                   /* пн, ср, пт */
/* одна тренировка — в понедельник этой недели (он всегда не позже сегодня) */
const ЖУРНАЛ = [{ id: пн + '_A', date: пн, day: 'A', name: 'День A', week: 1, updated: new Date(пн + 'T19:00:00').toISOString(),
  ex: [{ n: 'Приседания со штангой', id: 'Barbell_Squat', unit: 'reps', sets: [{ w: 70, r: 8 }, { w: 70, r: 8 }] }] }];
const ЗАНЯТИЯ = [{ id: 'a1', date: пн, t: '18:00', kind: 'теннис', min: 60, kcal: 450, intensity: 'mod' }];

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 1600 } });
  await page.addInitScript(([р]) => { try { localStorage.setItem('shp_v1_shp_sched', JSON.stringify(р)); } catch (e) {} }, [РАСП]);
  const ош = await M.поднять(page, { theme: 'dark', time: '13:05', page: 'home', hist: ЖУРНАЛ, acts: ЗАНЯТИЯ,
    me: { sex: 'm', age: 38, ht: 178, bw: 88, only: 'all', plan: [{ k: 'теннис', d: [6], min: 60 }] }, wait: 2600 });
  дано(ош.length === 0, 'главная поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(800);
  const в = await page.evaluate(() => {
    const box = document.getElementById('homebody');
    const строки = Array.from(box.querySelectorAll('.hline')).map(e => e.textContent.replace(/\s+/g, ' ').trim());
    const w = box.querySelector('.hwg');
    return { строки, текст: box.textContent,
      неделя: w ? { шапка: w.querySelector('.hwg-h').textContent.replace(/\s+/g, ' ').trim(),
        дни: Array.from(w.querySelectorAll('.hwg-d')).map(e => ({ d: e.dataset.wgday, on: e.classList.contains('on'),
          c: e.querySelector('.hwg-c').className, n: e.querySelector('.hwg-c').textContent, a: e.querySelector('.hwg-e').className, зн: e.querySelector('.hwg-e').textContent })),
        подпись: (w.querySelector('.hwg-sub') || {}).textContent || '', легенда: (w.querySelector('.hwg-leg') || {}).textContent || '' } : null,
      кнопка: (() => { const b = document.getElementById('addsport3'); return b ? { видна: !!b.offsetParent, после: !!(w && (w.compareDocumentPosition(b) & 4)) } : null; })() };
  });
  /* рейтинг и серия — два факта, две строки */
  дано(!в.строки.some(с => /\d-й из \d.*подряд/.test(с)), 'место и серия больше не в одной строке: ' + в.строки.join(' | '));
  дано(в.строки.some(с => /^Рейтинг\s*\d-й из \d+\s*сегодня$/.test(с)), 'рейтинг подписан «сегодня»');
  дано(в.строки.some(с => /^Серия\s*🔥 6 дней\s*подряд с записью еды$/.test(с)), 'серия подписана, что это за дни: «подряд с записью еды»');
  дано(!/Завтра/.test(в.текст), 'строки «Завтра» больше нет');
  /* неделя */
  const н = в.неделя;
  дано(!!н && н.дни.length === 7, 'неделя из семи дней');
  if (н) {
    дано(н.дни[0].d === пн && н.дни.every((x, i) => i === 0 || x.d > н.дни[i - 1].d), 'с понедельника по воскресенье, с датами: ' + н.дни.map(x => x.n).join(' '));
    дано(н.дни.filter(x => x.on).length === 1 && н.дни[dow].on, 'сегодня выделено');
    дано(/done/.test(н.дни[0].c), 'понедельник с тренировкой — зелёный с галочкой');
    const ещё = н.дни.filter((x, i) => i > dow && [0, 2, 4].includes(i));
    дано(ещё.every(x => /plan/.test(x.c) && !/done/.test(x.c)), 'дни зала впереди — обведены, без галочки: ' + ещё.map(x => x.n).join(', '));
    const мимо = н.дни.filter((x, i) => i < dow && [2, 4].includes(i));
    дано(мимо.every(x => /miss/.test(x.c)), 'прошедший день зала без тренировки — пунктиром' + (мимо.length ? '' : ' (сегодня таких нет)'));
    дано(н.дни.filter((x, i) => ![0, 2, 4].includes(i)).every(x => !/plan|miss|done/.test(x.c)), 'дни отдыха — просто дата');
    дано(/^Зал на неделе\s*1 из 3\s*тренировок$/.test(н.шапка), 'в шапке — сколько сделано из запланированного: ' + н.шапка);
    /* 24.09: точки он не понял («можно путать с занятием в зале») — значок вида */
    дано(н.дни[0].зн === '🎾' && !/ p| none/.test(н.дни[0].a), 'теннис в понедельник — яркий 🎾 под датой');
    дано(dow > 5 || (н.дни[5].зн === '🎾' && / p/.test(н.дни[5].a)), 'теннис по плану в субботу — бледный 🎾' + (dow > 5 ? ' (суббота уже прошла)' : ''));
    дано(н.дни.filter((x, i) => i !== 0 && i !== 5).every(x => / none/.test(x.a)), 'в дни без занятий значка нет');
    дано(/🎾 теннис/.test(н.легенда) && (dow > 5 || /по плану/.test(н.легенда)), 'под неделей — какой значок что значит: ' + н.легенда);
    дано(/^(Сегодня|Следующая — )/.test(н.подпись), 'подпись — следующая тренировка: ' + н.подпись);
  }
  дано(!!в.кнопка && в.кнопка.видна && в.кнопка.после, '«+ Занятие вне зала» — внизу главной, под неделей');
  await page.click('#addsport3'); await page.waitForTimeout(600);
  дано(await page.evaluate(() => !!document.querySelector('#sportm.show')), 'кнопка открывает лист занятия');
  await page.close();

  /* «только еда»: зала нет — неделя только если есть занятия; кнопка — есть */
  const еда = await br.newPage({ viewport: { width: 390, height: 1400 } });
  await M.поднять(еда, { theme: 'dark', time: '13:05', page: 'home', me: { sex: 'f', age: 35, ht: 165, bw: 70, only: 'food' }, wait: 2400 });
  await еда.waitForTimeout(600);
  const е = await еда.evaluate(() => ({ неделя: !!document.querySelector('#homebody .hwg'), кнопка: !!(document.getElementById('addsport3') || {}).offsetParent }));
  дано(!е.неделя, 'у «только еды» без занятий недели зала нет');
  дано(е.кнопка, 'а кнопка занятия на главной есть — это его единственное место кроме чата');
  await еда.close();

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
