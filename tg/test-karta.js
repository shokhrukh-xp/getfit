'use strict';
/* Карта тела и сделанный день на втором устройстве (13.09).

   «Почему в карте тела счёт не соответствует фактически выполненным
   упражнениям? я сегодня качал ноги». Карта доставала мышцу двумя путями —
   из группы движения по своей таблице и из поля m записи. У программы,
   собранной тренером, группа движения — свободный текст, в таблице её нет, а
   m в запись журнала не попадало вовсе: всё сделанное по собранной программе
   для карты не существовало. Третий путь — мышца каталога по id записи.

   «Почему в телеграме на маке тренировка пуста, тогда как с телефона я
   сохранил тренировку». Отметки подходов живут в памяти устройства, в облако
   уезжает результат. Если за сегодня в журнале уже есть этот день, показываем
   сделанное на любом экране. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

/* его сегодняшний день ног ровно в том виде, в каком приложение положило его
   в базу: имя, id каталога, подходы — ни группы движения, ни мышцы */
const ДЕНЬНОГ = {
  id: M.TODAY + '_D1', date: M.TODAY, day: 'D1', name: 'День 1', week: 1,
  updated: new Date().toISOString(),
  ex: [
    { n: 'Жим ногами (тренажёр)', id: 'Leg_Press', unit: 'reps',
      sets: [{ w: 40, r: 10 }, { w: 40, r: 10 }, { w: 40, r: 10 }] },
    { n: 'Сгибание ног (тренажёр, лёжа)', id: 'Lying_Leg_Curls', unit: 'reps',
      sets: [{ w: 50, r: 10 }, { w: 50, r: 10 }, { w: 50, r: 10 }] },
    { n: 'Жим ногами (тренажёр, носками, на икры)', id: 'Calf_Press_On_The_Leg_Press_Machine',
      unit: 'reps', sets: [{ w: 40, r: 20 }, { w: 40, r: 20 }, { w: 40, r: 20 }] }
  ]
};

async function журнал(page) {
  const g = await page.$('.l1 button[data-page="gym"]');
  if (g) { await g.click(); await page.waitForTimeout(500); }
  for (const b of await page.$$('.zseg button'))
    if ((await b.textContent()).trim() === 'Журнал' && await b.isVisible()) { await b.click(); break; }
  await page.waitForTimeout(1400);
}
const карта = page => page.evaluate(() => {
  const o = {};
  document.querySelectorAll('#logmus .bodymap .num').forEach(t => {
    o[t.getAttribute('data-m')] = parseFloat((t.textContent || '0').replace(',', '.'));
  });
  return { числа: o, сводка: (document.getElementById('musdet') || {}).textContent || '' };
});

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  const ош = await M.поднять(page, { theme: 'dark', hist: [ДЕНЬНОГ] });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* ── 1. КАРТА ВИДИТ ЗАПИСЬ БЕЗ ГРУППЫ ДВИЖЕНИЯ И БЕЗ МЫШЦЫ ── */
  await журнал(page);
  const к = await карта(page);
  дано(Object.keys(к.числа).length > 0,
    'карта тела не пустая на записи без p и без m: ' + JSON.stringify(к.числа));
  дано(к.числа.quad >= 3, 'квадрицепс считается по жиму ногами: ' + к.числа.quad);
  дано(к.числа.ham >= 3, 'бицепс бедра — по сгибанию ног: ' + к.числа.ham);
  дано(к.числа.calf >= 3, 'икры — по жиму носками: ' + к.числа.calf);
  /* вспомогательные мышцы за половину подхода — как считает сервер при сборке */
  дано(к.числа.glute > 0 && к.числа.glute < 3,
    'вспомогательные идут за половину: ягодицы ' + к.числа.glute);
  дано(!к.числа.chest && !к.числа.delt,
    'мышцы, которых сегодня не было, в карту не попали');

  /* ── 2. СДЕЛАННЫЙ ДЕНЬ ВИДЕН НА ВТОРОМ УСТРОЙСТВЕ ──
     Этот браузер — чистый: отметок подходов в его памяти нет вовсе, есть
     только журнал, как на маке после синхронизации Telegram. */
  const g = await page.$('.l1 button[data-page="gym"]');
  if (g) { await g.click(); await page.waitForTimeout(400); }
  for (const b of await page.$$('.zseg button'))
    if ((await b.textContent()).trim() === 'Тренировка' && await b.isVisible()) { await b.click(); break; }
  await page.waitForTimeout(900);

  const день = await page.evaluate(() => ({
    строки: Array.from(document.querySelectorAll('#list .exrow')).map(r => ({
      имя: (r.querySelector('.exrn b') || {}).textContent || '',
      справа: ((r.querySelector('.exrv') || {}).textContent || '').replace(/\s+/g, ' '),
      done: r.classList.contains('done')
    })),
    шапка: ((document.querySelector('.dayhd') || {}).textContent || '').replace(/\s+/g, ' ')
  }));
  /* в программе это упражнение называется иначе — совпадение идёт по id
     каталога, и это важнее имени: имена в каталоге уже переименовывались */
  const жим = день.строки.find(r => /Жим ногами/.test(r.имя));
  дано(!!жим, 'запись нашла своё упражнение в дне: ' + день.строки.map(r => r.имя.slice(0, 18)).join(' · '));
  if (жим) {
    дано(жим.done, 'упражнение из журнала помечено сделанным: ' + жим.справа);
    дано(/40×10/.test(жим.справа.replace(/\s/g, '')),
      'и показывает те же числа, что уехали в журнал: ' + жим.справа);
    дано(/3 из 3/.test(жим.справа), 'все три подхода закрыты: ' + жим.справа);
  }
  дано(!/0 \/ \d+ подходов/.test(день.шапка),
    'дорожка дня не говорит «ни одного подхода»: ' + день.шапка.slice(0, 70));

  /* ── 3. ЧУЖОЙ ДЕНЬ НЕ ПОДТЯГИВАЕТСЯ ──
     Журнал за прошлые дни не должен красить сегодняшний экран сделанным. */
  await br.close();
  const br2 = await chromium.launch();
  const p2 = await br2.newPage({ viewport: { width: 390, height: 900 } });
  await M.поднять(p2, { theme: 'dark', page: 'gym', wait: 2400, hist: M.журнал() });
  await p2.waitForTimeout(700);
  const вчера = await p2.$$eval('#list .exrow', rs => rs.map(r => r.classList.contains('done')));
  дано(вчера.length > 0 && вчера.every(d => !d),
    'сегодня с нуля, если сегодняшней записи в журнале нет: ' + JSON.stringify(вчера));
  await br2.close();

  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
