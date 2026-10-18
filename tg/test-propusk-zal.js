'use strict';
/* 18.10: «Пропустил» на «Сегодня» и меню после пропуска — задачи из списка
   после вопроса бота «Зал сегодня был?»: «кнопка „Пропустил“ на экране
   „Сегодня“ в приложении, через те же отметки сервера (gym_day), чтобы пропуск
   отмечался и без бота» и «меню на сегодня, собранное как под день зала, после
   „Пропустил“ пересобирается». Проверяем:
   1. день зала без тренировки — в строке «Сегодня: …» недели кнопка «Пропустил»;
   2. нажал — /gym/day {st:'skip', date: сегодня}, строка «Сегодня отдых — зал
      пропущен», кнопка «Вернуть», кружок сегодня без «по плану»;
   3. «Вернуть» — /gym/day {st:''}, снова «Сегодня» и «Пропустил»;
   4. обрыв (503) — повтор сам один раз; отказ по делу (409) — текст сервера;
   5. тренировка сегодня записана — кнопки нет;
   6. меню на сегодня собрано под зал, а зал пропущен — пересобирается один раз,
      с подписью «Зал сегодня пропущен…»; меню не под зал — не трогаем. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const T = M.TODAY;
const ВСЕ_ДНИ = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };          /* сегодня — всегда день зала */
const ME = { sex: 'm', age: 38, ht: 178, bw: 88, only: 'all' };
async function главная(br, o){
  const page = await br.newPage({ viewport: { width: 390, height: 1600 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  await page.addInitScript(([р]) => { try { localStorage.setItem('shp_v1_shp_sched', JSON.stringify(р)); } catch (e) {} }, [ВСЕ_ДНИ]);
  /* тот же объект: в него мок складывает, что ушло на сервер (o.залОтм) */
  [['theme', 'dark'], ['time', '15:00'], ['page', 'home'], ['me', ME], ['wait', 2400], ['day', { gymPlan: true }]].forEach(([k, v]) => { if (o[k] === undefined) o[k] = v; });
  const ош = await M.поднять(page, o);
  await page.waitForTimeout(500);
  return { page, ош };
}
const строка = page => page.evaluate(() => { const p = document.querySelector('#homebody .hwg-sub'); return p ? p.textContent.replace(/\s+/g, ' ').trim() : ''; });
const кнопка = page => page.$('#homebody [data-gymskip]');
const ждать = async (page, fn, арг) => { for (let i = 0; i < 300; i++) { if (await page.evaluate(fn, арг)) return true; await page.waitForTimeout(20); } return false; };
(async () => {
  const br = await chromium.launch();
  try {
    /* ── 1–3 ── */
    const о = {};
    let { page, ош } = await главная(br, о);
    дано(ош.length === 0, 'главная поднялась без ошибок ' + (ош[0] || ''));
    let с = await строка(page);
    дано(/^Сегодня/.test(с) && /Пропустил$/.test(с), 'день зала без тренировки — «Сегодня: …» и «Пропустил»: ' + с);
    const к = await кнопка(page);
    const размер = к ? await к.evaluate(e => e.getBoundingClientRect().height) : 0;
    дано(размер >= 44, 'кнопка — не меньше 44 px в высоту: ' + размер);
    await page.click('#homebody [data-gymskip="skip"]');
    дано(await ждать(page, () => /Сегодня отдых — зал пропущен/.test((document.querySelector('#homebody .hwg-sub') || {}).textContent || '')), 'после нажатия — «Сегодня отдых — зал пропущен»');
    дано((о.залОтм || []).length === 1 && о.залОтм[0].st === 'skip' && о.залОтм[0].date === T, 'на сервер — отметка skip за сегодня: ' + JSON.stringify(о.залОтм));
    с = await строка(page);
    дано(/Вернуть$/.test(с), 'вместо «Пропустил» — «Вернуть»: ' + с);
    const круг = await page.evaluate(t => { const e = document.querySelector('#homebody [data-hday="' + t + '"] .hwd-gym'); return e ? e.className : ''; }, T);
    дано(!/plan/.test(круг), 'кружок сегодня — без «зал по плану»: ' + круг);
    await page.click('#homebody [data-gymskip=""]');
    дано(await ждать(page, () => /Пропустил$/.test(((document.querySelector('#homebody .hwg-sub') || {}).textContent || '').trim())), '«Вернуть» — снова «Пропустил»');
    дано(о.залОтм.length === 2 && о.залОтм[1].st === '', '«Вернуть» — отметка снята на сервере');
    await page.close();

    /* ── 4. обрыв — повтор сам; отказ по делу — текст ── */
    let n = 0;
    const о4 = { onGymDay: () => (++n === 1 ? { status: 503, body: { error: 'Сервер занят' } } : null) };
    ({ page, ош } = await главная(br, о4));
    await page.click('#homebody [data-gymskip="skip"]');
    дано(await ждать(page, () => /Сегодня отдых/.test((document.querySelector('#homebody .hwg-sub') || {}).textContent || '')), '503 — отметка всё равно встала (повтор сам)');
    дано(о4.залОтм.length === 2, 'запросов два: первый 503, повтор — ok');
    await page.close();
    const о5 = { onGymDay: () => ({ status: 409, body: { ok: false, error: 'Тренировка сегодня уже записана — пропуск не нужен.' } }) };
    ({ page, ош } = await главная(br, о5));
    await page.click('#homebody [data-gymskip="skip"]');
    дано(await ждать(page, () => !!document.querySelector('#homebody .hskiperr')), 'отказ — текст под кнопкой');
    const ош5 = await page.textContent('#homebody .hskiperr');
    дано(/уже записана/.test(ош5) && о5.залОтм.length === 1, 'отказ по делу — без повтора, текст сервера: ' + ош5);
    дано(/Пропустил/.test(await строка(page)), 'после отказа кнопка на месте');
    await page.close();

    /* ── 5. тренировка сегодня уже есть — кнопки нет ── */
    const ЖУРНАЛ = [{ id: T + '_A', date: T, day: 'A', name: 'День A', week: 1, updated: new Date(T + 'T09:00:00').toISOString(),
      ex: [{ n: 'Приседания со штангой', id: 'Barbell_Squat', unit: 'reps', sets: [{ w: 70, r: 8 }] }] }];
    ({ page, ош } = await главная(br, { hist: ЖУРНАЛ }));
    дано(!(await кнопка(page)), 'тренировка сегодня записана — «Пропустил» нет: ' + await строка(page));
    await page.close();

    /* ── 6. меню под зал после пропуска ── */
    const ПОДП = [T, 2110, 1030, 2, 1, 165].join('|');
    const меню = зал => ({ ok: true, span: 'today', date: T, from: T, at: Date.now(), sig: ПОДП, зал,
      норма: { kcal: 2110, prot: 165 }, съел: { kcal: 1030, prot: 67 }, ост: { kcal: 1080, prot: 98 }, съедено: [], note: '',
      дни: [{ date: T, зал, спорт: [], норма: { kcal: 1080, prot: 98 }, kcal: 1075, prot: 96, приёмы: [
        { id: 't2', kind: 'ужин', text: 'Куриная грудка с гречкой', мин: 30, kcal: 785, prot: 62, items: [] }] }] });
    const еда = async (o) => {
      const p = await br.newPage({ viewport: { width: 390, height: 900 } });
      await p.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
      o.onMenu = b => { (o.спаны = o.спаны || []).push(JSON.parse(b.request().postData() || '{}').span); return Object.assign(меню(false), { sig: ПОДП }); };
      o.menuDelay = 4000;   /* сборка дольше загрузки страницы — успеваем увидеть подпись */
      [['theme', 'dark'], ['time', '14:03'], ['page', 'eat'], ['wait', 2400]].forEach(([k, v]) => { if (o[k] === undefined) o[k] = v; });
      const e = await M.поднять(p, o);
      return { p, e };
    };
    const о6 = { menu: { today: меню(true) }, day: { gymSkip: 1, gymPlan: false } };
    let { p, e } = await еда(о6);
    дано(e.length === 0, '«Еда» поднялась без ошибок ' + (e[0] || ''));
    const подпись = await ждать(p, () => /Зал сегодня пропущен — пересобираю меню под день отдыха/.test(document.getElementById('eatbody').textContent));
    дано(подпись, 'меню под зал при пропуске — «Зал сегодня пропущен — пересобираю…»');
    await ждать(p, () => !/пересобираю/.test(document.getElementById('eatbody').textContent));
    дано((о6.спаны || []).filter(x => x === 'today').length === 1, 'пересобрано один раз: ' + JSON.stringify(о6.спаны));
    дано(!/день зала/.test(await p.textContent('#eatbody')), 'новое меню — без «день зала»');
    await p.close();
    const о7 = { menu: { today: меню(true) }, day: { gymSkip: 0, gymPlan: true } };
    ({ p, e } = await еда(о7));
    await p.waitForTimeout(800);
    дано(!(о7.спаны || []).length, 'зал не пропущен — меню под зал не трогаем');
    await p.close();
    const о8 = { menu: { today: меню(false) }, day: { gymSkip: 1, gymPlan: false } };
    ({ p, e } = await еда(о8));
    await p.waitForTimeout(800);
    дано(!(о8.спаны || []).length, 'меню и так не под зал — пересборки нет');
    await p.close();
  } catch (e) { плохо++; console.error('  ПРОВАЛ  ', e.message); }
  finally { await br.close(); }
  console.log(плохо ? 'ПРОВАЛОВ: ' + плохо : 'ВСЁ ЗЕЛЁНОЕ');
  process.exitCode = плохо ? 1 : 0;
})();
