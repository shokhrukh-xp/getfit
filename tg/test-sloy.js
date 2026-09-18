'use strict';
/* ── РУЧНОЙ СЛОЙ И ПЕРЕСБОРКА ДНЯ ─────────────────────────────────────
   18.09, его слова: «снова врёт, говорит что сделал, но не сделал».
   Тренер как раз не врал. В чате стоял правильный день — узкий жим, бицепс,
   трицепс, скручивания, запястья. А на экране в том же дне первым висел
   ПРИСЕД, третьим — жим ногами на икры, и ещё планка с роликом.
   Причина в ключе: замена хранится как «A4:0» — день и НОМЕР СТРОКИ. День
   пересобрали, в строке 0 оказалось другое упражнение, а старая замена
   продолжила его закрашивать. SKIP прятал новые строки, EXTRA дописывал
   старые добавленные. Подходы при этом считались по НАСТОЯЩЕЙ программе —
   отсюда «0 / 14 подходов» при пяти чужих упражнениях на экране.
   Здесь проверяется обе стороны: что пересобранный день показывается ровно
   таким, о каком тренер отчитался, и что НЕ тронутый день свои правки
   сохраняет — иначе лечение было бы хуже болезни. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

const у = (id, n, m, p) => ({ id, n, en: n, m, q: 'barbell', p, sets: 3, reps: '8–12', rest: 90, ss: null, why: 'по каталогу' });
const дн = (s, sub, ex) => ({ s, sub, ex });
const БЫЛО = { name: 'Мышцы · 4 дня', note: 'Четыре дня.', focus: ['quadriceps', 'chest'], days: [
  дн('Низ', 'квадрицепс и ягодицы', [у('Barbell_Full_Squat', 'Присед (штанга, глубокий)', 'quadriceps', 'Приседания'), у('Leg_Press', 'Жим ногами', 'quadriceps', 'Жим'), у('Seated_Leg_Curl', 'Сгибание ног', 'hamstrings', 'Сгибание')]),
  дн('Верх', 'грудь и спина', [у('Barbell_Bench_Press_Medium_Grip', 'Жим лёжа', 'chest', 'Жим'), у('Wide-Grip_Lat_Pulldown', 'Тяга сверху', 'lats', 'Тяга')]),
  дн('Плечи', 'плечи', [у('Standing_Military_Press', 'Жим стоя', 'shoulders', 'Жим'), у('Side_Lateral_Raise', 'Махи', 'shoulders', 'Махи')]),
  дн('Низ 2', 'ноги ещё раз', [у('Barbell_Lunge', 'Выпады', 'quadriceps', 'Выпады'), у('Standing_Calf_Raises', 'Носки', 'calves', 'Носки'), у('Romanian_Deadlift', 'Румынская', 'hamstrings', 'Тяга'), у('Crunches', 'Скручивания', 'abdominals', 'Пресс'), у('Hanging_Leg_Raise', 'Подъём ног в висе', 'abdominals', 'Пресс')]) ] };
/* пересобранный день 4 — ровно то, что тренер перечислит в чате */
const СТАЛО = JSON.parse(JSON.stringify(БЫЛО));
СТАЛО.days[3] = дн('Руки', 'руки, предплечья и пресс', [
  у('Close-Grip_Barbell_Bench_Press', 'Жим лёжа (узкий хват)', 'triceps', 'Жим'),
  у('Barbell_Curl', 'Сгибание на бицепс (штанга)', 'biceps', 'Бицепс'),
  у('Triceps_Pushdown', 'Разгибание на трицепс (блок)', 'triceps', 'Трицепс'),
  у('Cable_Crunch', 'Скручивания (блок)', 'abdominals', 'Пресс'),
  у('Wrist_Curl', 'Сгибание запястий', 'forearms', 'Предплечья') ]);

/* ручной слой, как он был у него: замены в строках 0 и 2, спрятаны 3 и 4,
   дописаны две своих. И одна замена в НЕ трогаемом дне 1 — сторож. */
const СЛОЙ = {
  subs: { 'A4:0': { n: 'Присед (штанга, классический)', e: 'Barbell Squat', i: 'Barbell_Squat' },
          'A4:2': { n: 'Жим ногами (носками, на икры)', e: 'Calf Press', i: 'Calf_Press_On_The_Leg_Press_Machine' },
          'A1:1': { n: 'Гакк-присед', e: 'Hack Squat', i: 'Hack_Squat' } },
  skip: { 'A4:3': 1, 'A4:4': 1 },
  extra: { A4: [{ id: 'e1', n: 'Планка', e: 'Plank', i: 'Plank', sets: 2, reps: '20–40 с' },
                { id: 'e2', n: 'Ролик для пресса', e: 'Ab Roller', i: 'Ab_Roller', sets: 3, reps: '12–15' }] }
};

const ИМЕНА = p => p.$$eval('#list .exrow .exrn b, #list .card.exact .exname',
  ns => ns.map(n => n.textContent.replace(/^[АБ]/, '').trim()));
async function день(page, n) {
  for (const b of await page.$$('.dayseg button, .zseg button')) {
    const t = (await b.textContent()).replace(/\s+/g, ' ');
    if (new RegExp('День ' + n).test(t) && await b.isVisible()) { await b.click(); await page.waitForTimeout(800); return true; }
  }
  return false;
}

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', page: 'gym', wait: 2800, prog: БЫЛО, profile: 'ai', layer: СЛОЙ,
    me: { sex: 'm', age: 38, ht: 178, bw: 88.5, goal: 'muscle', wt: 'keep', gym: 'muscle', level: 'mid', place: 'gym', only: 'all', lim: [], eq: [] },
    onCoach: () => ({ ok: true,
      reply: 'Пересобрал день 4 целиком: Жим лёжа (узкий хват), Сгибание на бицепс (штанга), Разгибание на трицепс (блок), Скручивания (блок), Сгибание запястий.',
      rebuild: { prog: СТАЛО, at: Date.now(), day: 4, vol: ['трицепс 6,5 → 12,5'] } }) });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));

  /* ── до просьбы ручной слой на месте: это его правки, трогать нечего ── */
  дано(await день(page, 4), 'день 4 открыт');
  const до = await ИМЕНА(page);
  дано(до.some(n => /Присед \(штанга, классический\)/.test(n)), 'до пересборки замена видна: ' + до.join(' · ').slice(0, 70));
  /* дописанные — те, которых в самом дне нет: повтор программы сюда не кладём,
     его теперь снимает отдельная проверка (tg/test-povtor.js) */
  дано(до.some(n => /Планка/.test(n)) && до.some(n => /Ролик/.test(n)), 'и дописанные им упражнения тоже');
  дано(до.length === 5, 'а спрятанные строки не показываются: ' + до.length);

  /* ── просим пересобрать день ── */
  await page.click('#coachfab'); await page.waitForTimeout(700);
  await page.fill('#ctext', 'Пересобери программу дня 4 с фокусом на руки, предплечья и пресс');
  await page.click('#csend'); await page.waitForTimeout(1800);
  const окна = (await page.evaluate(() => window.__окна || [])).join(' | ');
  дано(/День 4 пересобран/.test(окна), 'окно подтвердило пересборку: ' + окна.slice(0, 54));
  дано(/правки в этом дне сняты/.test(окна), 'и честно сказало, что старые правки сняты');

  await page.evaluate(() => { const m = document.getElementById('coachm'); if (m) m.classList.remove('show'); });
  await page.click('.l1-in button[data-page="gym"]'); await page.waitForTimeout(900);
  дано(await день(page, 4), 'вернулись в день 4');
  const после = await ИМЕНА(page);
  console.log('    на экране: ' + после.join(' · '));

  /* ── ГЛАВНОЕ: экран показывает ровно то, что тренер назвал в чате ── */
  дано(!после.some(n => /Присед/.test(n)), 'приседа в дне рук больше нет');
  дано(!после.some(n => /Жим ногами|икры/.test(n)), 'и жима ногами на икры тоже');
  дано(!после.some(n => /Планка|Ролик/.test(n)), 'дописанные в прежний день упражнения ушли вместе с ним');
  ['узкий хват', 'бицепс', 'трицепс', 'Скручивания', 'запястий'].forEach(ч =>
    дано(после.some(n => new RegExp(ч, 'i').test(n)), 'на экране есть «' + ч + '»'));
  дано(после.length === 5, 'и ровно пять строк, как в ответе тренера: ' + после.length);

  /* Шапка и строки обязаны сойтись. Именно это у него и разошлось: счётчик
     считал по настоящей программе, а строки показывали чужие упражнения. */
  const шапка = +(await page.$eval('#p-gym', e => (e.textContent.match(/0 \/ (\d+) подход/) || [])[1]).catch(() => 0));
  const построкам = await page.$$eval('#list .exrow .exrv, #list .card.exact .setrow',
    ns => ns.reduce((s, n) => { const m = (n.textContent || '').match(/из\s*(\d+)/); return s + (m ? +m[1] : 0); }, 0));
  дано(шапка > 0 && шапка === построкам, 'шапка и строки сошлись: ' + шапка + ' и ' + построкам);

  /* ── СТОРОЖ: день, который не трогали, свои правки сохранил ── */
  дано(await день(page, 1), 'открыли день 1');
  const д1 = await ИМЕНА(page);
  дано(д1.some(n => /Гакк-присед/.test(n)), 'замена в нетронутом дне цела: ' + д1.join(' · ').slice(0, 60));

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
