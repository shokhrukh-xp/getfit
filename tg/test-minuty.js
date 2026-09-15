'use strict';
/* ── МИНУТЫ ЗАЛА — ЭТО ЧИСЛО, А НЕ УКРАШЕНИЕ ──────────────────────────
   15.09, его вопрос: «учитываешь интенсивность, подходы, веса? позанимался
   хорошенько, а норма выросла на 150». Веса не участвуют и не должны —
   подъём железа за всю тренировку меньше 50 ккал. Участвуют минуты и
   плотность: (MET − 1) × вес × часы, где MET берётся из того, сколько минут
   пришлось на подход (компендиум 02054 / 02052 / 02055).
   Значит, минуты стали числом, от которого зависит норма еды. А таймер
   стартует с первого записанного подхода и может опоздать. Здесь проверено
   и то, и другое: приложение переспрашивает время, когда замер не сходится
   с работой, и раскладка нормы объясняет, откуда взялось число зала. */
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
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', page: 'gym', wait: 2600 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* отмечаем два упражнения целиком — это заведомо больше четырёх подходов,
     а таймер на стенде успел насчитать минуту: замер и работа не сходятся */
  for (let i = 0; i < 2; i++) {
    const карточки = await page.$$('#list .exrow');
    if (!карточки[i]) break;
    await карточки[i].click(); await page.waitForTimeout(500);
    const все = await page.$('.card.exact .allb');
    if (все) { await все.click(); await page.waitForTimeout(700); }
    const назад = await page.$('#list .card.exact .exrow');
    if (назад) { await назад.click(); await page.waitForTimeout(400); }
  }
  /* считаем по свёрнутым строкам: раскрыто всегда одно упражнение, и в
     разметке живут подходы только его — ровно та ловушка, из-за которой
     «Завершить» собирало запись из экрана и теряло остальное */
  const подходов = await page.$$eval('#list .exrow .exrv u', ns =>
    ns.reduce((s, n) => s + (parseInt((n.textContent.match(/^(\d+)/) || [])[1], 10) || 0), 0));
  дано(подходов >= 4, 'отмечено подходов в свёрнутых упражнениях: ' + подходов);

  await page.click('#finish');
  await page.waitForTimeout(900);

  const лист = await page.evaluate(() => {
    const m = document.getElementById('durm');
    if (!m || !m.classList.contains('show')) return null;
    return { почему: (document.getElementById('dur-why') || {}).textContent || '',
             кнопки: Array.from(m.querySelectorAll('[data-dm]')).map(b => b.textContent.trim()),
             итог: (document.getElementById('dur-itog') || {}).textContent || '' };
  });
  дано(!!лист, 'приложение переспросило время, а не записало замер молча');
  if (!лист) { await br.close(); process.exit(1); }
  дано(/таймер/i.test(лист.почему), 'и объяснило, почему спрашивает: «' + лист.почему.slice(0, 70) + '…»');
  дано(лист.кнопки.indexOf('своё') >= 0, 'своё число вписать можно: ' + лист.кнопки.join(' · '));
  дано(лист.кнопки.filter(k => /^\d+$/.test(k)).length >= 4, 'и есть из чего выбрать: ' + лист.кнопки.join(' · '));

  /* записи ещё нет: приложение ждёт ответа, а не сохраняет вперёд него */
  дано((await page.evaluate(ЗАПИСЬ)).length === 0, 'до ответа тренировка не сохранена');

  for (const b of await page.$$('#dur-min [data-dm]'))
    if ((await b.textContent()).trim() === '60') { await b.click(); break; }
  await page.waitForTimeout(300);
  const итог2 = await page.$eval('#dur-itog', e => e.textContent.trim());
  дано(/на подход/.test(итог2), 'лист считает плотность вслух: ' + итог2);

  await page.click('#dur-save');
  await page.waitForTimeout(2200);

  const записи = await page.evaluate(ЗАПИСЬ);
  дано(записи.length === 1, 'после ответа тренировка сохранена: ' + записи.length);
  дано((записи[0] || {}).dur === 60, 'и в записи стоит подтверждённое время, а не замер: ' + (записи[0] || {}).dur);
  /* и вся тренировка целиком, а не одно раскрытое упражнение */
  const упр = ((записи[0] || {}).ex || []);
  дано(упр.length >= 2, 'в записи все упражнения дня, а не последнее раскрытое: ' + упр.map(x => x.n).join(' · '));
  дано(упр.reduce((s, x) => s + (x.sets || []).length, 0) === подходов,
    'и подходов в ней столько же, сколько отмечено: ' + упр.reduce((s, x) => s + (x.sets || []).length, 0));
  дано(await page.evaluate(() => !document.getElementById('durm').classList.contains('show')), 'лист закрылся сам');

  /* второй раз про то же не спрашиваем */
  await page.click('#finish');
  await page.waitForTimeout(1200);
  дано(await page.evaluate(() => !document.getElementById('durm').classList.contains('show')),
    'повторное сохранение уже не переспрашивает');
  дано(((await page.evaluate(ЗАПИСЬ))[0] || {}).dur === 60, 'и время осталось прежним');

  /* ── ЗАНЯТИЕ НЕ РАСТЁТ ОТ ТОГО, ЧТО ПРИЛОЖЕНИЕ ОТКРЫТО ──
     15.09: в записи оказалось 240 минут вместо сорока (потолок в четыре
     часа), и зал насчитал 880 ккал вместо двухсот с небольшим. Занятие
     кончилось ночью, а днём он открыл приложение — и автосохранение
     пересчитало длительность до текущей минуты. Конец занятия — это время
     последнего касания подхода, и открывание его не двигает. */
  const page3 = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page3.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page3, { theme: 'dark', page: 'gym', wait: 2600 });
  for (let i = 0; i < 2; i++) {
    const карточки = await page3.$$('#list .exrow');
    if (!карточки[i]) break;
    await карточки[i].click(); await page3.waitForTimeout(500);
    const все = await page3.$('.card.exact .allb');
    if (все) { await все.click(); await page3.waitForTimeout(700); }
    const назад = await page3.$('#list .card.exact .exrow');
    if (назад) { await назад.click(); await page3.waitForTimeout(400); }
  }
  /* занятие было три часа назад и шло по пять минут на подход — обычный
     темп, лишних вопросов не будет; с тех пор приложение просто открыто */
  const подходов3 = await page3.$$eval('#list .exrow .exrv u', ns =>
    ns.reduce((s, n) => s + (parseInt((n.textContent.match(/^(\d+)/) || [])[1], 10) || 0), 0));
  const шло = 5 * подходов3;
  const сдвинул = await page3.evaluate(мин => {
    const t0 = Date.now() - 3 * 3600e3;
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('wt0_') > 0) {
        localStorage.setItem(k, JSON.stringify(t0));
        localStorage.setItem(k.replace('wt0_', 'wtl_'), JSON.stringify(t0 + мин * 60e3));
        n++;
      }
    }
    return n;
  }, шло);
  дано(сдвинул === 1, 'отметка начала занятия найдена и сдвинута на три часа назад: ' + сдвинул);
  await page3.click('#finish');
  await page3.waitForTimeout(2200);
  const зап3 = (await page3.evaluate(ЗАПИСЬ))[0] || {};
  дано(зап3.dur === шло, 'в записи время работы, а не «до сейчас» и не потолок в 240: ' + зап3.dur + ' при ' + шло);
  await page3.close();

  /* ── раскладка нормы на «Еде» объясняет число зала ── */
  const page2 = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page2.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await M.поднять(page2, { theme: 'dark', page: 'food', wait: 2600 });
  const строка = await page2.$eval('.fparts', e => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
  дано(/зал 350/.test(строка), 'в сумме нормы зал стоит отдельным слагаемым: ' + строка);
  дано(/60 минут/.test(строка) && /24 подхода/.test(строка),
    'и рядом сказано, из чего оно: минуты и подходы');
  дано(/темп плотный/.test(строка), 'и каким был темп (по нему берётся MET, а не по весу на штанге)');
  дано(!/килограмм|тоннаж|вес на штанге/i.test(строка), 'про веса не сказано ничего — они в это число не входят');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
