'use strict';
/* Визуализация цели (25.10). Его слова: «пользователь может загрузить своё фото (желательно
   во весь рост), и мы используя ИИ покажем ему его внешний вид при достигнутой цели… менять
   параметры как вес, жир, мышцы». Его выбор — «поэтапно» и «явное согласие». Заперто:
   1) сервер не открыл функцию — кнопки в карточке цели нет;
   2) открыл — кнопка «Как я буду выглядеть»; без согласия — текст про хранение, OpenAI и Claude,
      «примерная», 18+; «Дальше» только после галочки, согласие уходит на сервер;
   3) фото без человека — подсказка снять во весь рост и «Всё равно это фото», ничего не ушло;
      фото во весь рост — уходит JPEG, открывается главный вид с фото «сейчас»;
   4) шаги −5 % / −10 % / цель; «цель» — расчёт по 75 кг: вес, жир, талия с разбросом;
   5) «Показать»: талия сверяется с расчётом; локальная коррекция или до двух
      перерисовок, сохраняется только проверенный результат; польза для здоровья и первая
      поддержка; честная подпись;
   6) «Удалить фото» — со второго нажатия, запрос на сервер, снова вид загрузки фото;
   7) мерка силуэта — своя копия MediaPipe из vendor/, не с чужого сайта. */
const { chromium } = require('playwright');
const path = require('path'), fs=require('fs'), os=require('os');
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'viz-contract-')), TARGET=path.join(TMP,'target.jpg');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
/* фото в fixtures/viz-* — вымышленный человек, нарисован Gemini (пробный прогон 25.10), не реальный */
const ФИКС = n => path.join(__dirname, 'fixtures', n);
const МЕ = { sex: 'm', age: 34, ht: 178, bw: 86.1, wt: 'down', goal: 'fat', voice: 'hard', coach_at: 'x' };
const ЦЕЛЬ = { text: '75 кг к 07.03 · 0,6 кг в неделю', wt: 'down', rate: -0.6, from: '2026-10-01', w0: 86.1, by: '2027-03-07', kg: 11.1 };
const r1 = x => Math.round(x * 10) / 10;
function расчёт(w, dl, fat){
  const W = r1(Math.max(64, Math.min(96, w || 75))), DL = fat ? W*(1-fat/100)-86.1*.76 : r1(Math.max(-2, Math.min(2.5, dl || 0)));
  const lean0 = 86.1 * 0.76, fat1 = W - lean0 - DL, dFat = 86.1 - lean0 - fat1, тД = r1(dFat * 1.15);
  return { ok: true, sex: 'm', w0: 86.1, w1: W, dl: DL, fatTarget:fat||null, dlMin: -2, dlMax: 2.5, пол: 64, fat0: 24, fat1: r1(fat1 / W * 100), жирОценка: true,
    fatKg: r1(dFat), талия0: 100, талияИзмерена: false, талияД: тД, талияОт: r1(тД * 0.7), талияДо: r1(тД * 1.3), талия1: r1(100 - тД),
    отношение: Math.round((100 - тД) / 100 * 1000) / 1000, срез: [] };
}
const ШАГИ = [{ k: '5', t: '−5 %', w: 81.8 }, { k: '10', t: '−10 %', w: 77.5 }, { k: 'g', t: 'цель 75', w: 75 }];
async function открыть(br, viz){
  const page = await br.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { try { localStorage.setItem('shp_v1_trcard_off', '1'); } catch (e) {} });
  const mp = []; page.on('request', r => { if (/pose_landmarker|vision_wasm|vision_bundle/.test(r.url())) mp.push(r.url()); });
  const corrected={};
  const o = { onVizSelect:b=>{if(b.image){const f=path.join(TMP,b.k+'.jpg');fs.writeFileSync(f,Buffer.from(b.image,'base64'));corrected[b.k]=f;}}, page: 'home', time: '10:00', goal: ЦЕЛЬ, me: МЕ, viz,
    onVizCalc: расчёт,
    vizImg: k => corrected[k] || ({ orig: ФИКС('viz-0-ishod.jpg'), r1: ФИКС('viz-3-cel75-myshtsy.jpg'), r2: TARGET, 'fat-r1': TARGET, 'fat-r2': TARGET })[k],
    onVizRender: b => { if(b.target && !b.n)fs.writeFileSync(TARGET,Buffer.from(b.target,'base64'));return ({ ok: true, k: (b.fat?'fat-':'')+(b.n ? 'r2' : 'r1'), calc: Object.assign(расчёт(b.w, b.dl, b.fat),b.fat?{visualVersion:5}:{}), польза: 'Минус 10 % веса — по исследованиям заметно снижает давление, сахар и нагрузку на суставы.', left: b.n ? 6 : 7, model: 'gemini-3-pro-image' });} };
  const ош = await M.поднять(page, o);
  await page.waitForTimeout(700);
  await page.click('#profbtn'); await page.waitForTimeout(900);
  return { page, ош, o, mp };
}
(async () => {
  const br = await chromium.launch();
  try {
    /* 1) не открыта */
    { const { page, ош } = await открыть(br, { ok: true, allowed: false, adult: true });
      дано(ош.length === 0, 'страница без ошибок ' + (ош[0] || ''));
      дано(!(await page.$('#vizopen')), 'функция закрыта — кнопки в карточке цели нет');
      await page.close(); }

    const { page, ош, o, mp } = await открыть(br, { ok: true, allowed: true, adult: true, consent: false, photo: null, left: 8, steps: ШАГИ, calc: расчёт(75, 0) });
    дано(ош.length === 0, 'страница без ошибок ' + (ош[0] || ''));
    дано(await page.isVisible('#vizopen'), 'кнопка «Как я буду выглядеть» в карточке цели');
    await page.$eval('#vizopen', b => b.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200); await page.screenshot({ path: '/tmp/viz-knopka.png' });
    /* 2) согласие */
    await page.click('#vizopen'); await page.waitForTimeout(500);
    дано(await page.isVisible('#viz-consent'), 'сначала согласие');
    const сог = await page.textContent('#viz-consent');
    дано(/на нашем сервере/.test(сог) && /OpenAI/.test(сог) && /Anthropic Claude/.test(сог) && !/Google Gemini/.test(сог) && /примерная/.test(сог) && /18\+/.test(сог), 'в согласии: хранение, OpenAI и резерв Claude, без Gemini, «примерная», 18+');
    дано(await page.isDisabled('#vizok'), '«Дальше» закрыта без галочки');
    await page.screenshot({ path: '/tmp/viz-soglasie.png' });
    await page.check('#vizagree'); await page.click('#vizok'); await page.waitForTimeout(400);
    дано(o.vizAsked.consent === 1, 'согласие ушло на сервер');
    дано(await page.isVisible('#viz-photo'), 'дальше — загрузка фото с подсказками');
    page.on('console', m => { if (/\[viz\]/.test(m.text())) console.log('  ··', m.text()); });
    /* 3) фото без человека, потом во весь рост */
    await page.setInputFiles('#vizfile', ФИКС('a.jpg'));
    await page.waitForFunction(() => !document.getElementById('vizforce').hidden, null, { timeout: 20000 }).catch(() => {});
    дано(/во весь рост/.test(await page.textContent('#vizpmsg')), 'фото без человека — просьба снять во весь рост: ' + await page.textContent('#vizpmsg'));
    дано(await page.isVisible('#vizforce'), 'можно «Всё равно это фото»');
    await page.screenshot({ path: '/tmp/viz-foto.png' });
    дано(o.vizAsked.photo.length === 0, 'ничего не ушло');
    await page.setInputFiles('#vizfile', ФИКС('viz-0-ishod.jpg'));
    await page.waitForSelector('#viz-main:not([hidden])', { timeout: 20000 }).catch(() => {});
    дано(o.vizAsked.photo.length === 1 && o.vizAsked.photo[0].mime === 'image/jpeg' && o.vizAsked.photo[0].len > 10000, 'фото во весь рост ушло JPEG');
    await page.waitForFunction(() => { const i = document.getElementById('vizorig'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 }).catch(() => {});
    дано(await page.evaluate(() => document.getElementById('vizorig').naturalWidth > 0), 'фото «сейчас» на экране');
    дано(mp.length > 0 && mp.every(u => /\/vendor\/mp-1\.0\.1\//.test(u)), 'мерка — своя копия MediaPipe из vendor/');
    /* 4) Регрессия внутреннего расчёта старых фото. Ползунки скрыты: новый путь через общую цель проверяет test-goal-body. */
    дано((await page.$$eval('#vizsteps button', b => b.map(x => x.textContent))).join('|') === '−5 %|−10 %|цель 75', 'шаги −5 % / −10 % / цель');
    await page.locator('#vizsteps button[data-w="81.8"]').evaluate(e=>e.click());
    /* под нагрузкой хука расчёт (пауза 250 мс + запрос) приходит позже — ждём его, а не фиксированные 0,5 с */
    await page.waitForFunction(() => /81,8 кг/.test(document.getElementById('vizwv').textContent) && /81,8 кг/.test(document.getElementById('viznums').textContent), null, { timeout: 8000 }).catch(() => {});
    дано(o.vizAsked.calc.some(c => c.w === 81.8), 'шаг −5 % — расчёт по 81,8 кг');
    дано(/81,8 кг/.test(await page.textContent('#vizwv')), 'ползунок веса — 81,8 кг');
    await page.locator('#vizsteps button[data-w="75"]').evaluate(e=>e.click());
    await page.waitForFunction(() => /→ 75 кг/.test(document.getElementById('viznums').textContent), null, { timeout: 8000 }).catch(() => {});
    const ч = await page.textContent('#viznums');
    дано(/86,1 → 75 кг/.test(ч) && /жир ≈24 → 12,8 %/.test(ч) && /талия −13 см \(9–17\)/.test(ч), 'расчёт: ' + ч);
    дано(/Жир оценён/.test(await page.textContent('#viznote')), 'сказано, что жир оценён');
    await page.screenshot({ path: '/tmp/viz-raschet.png', fullPage: false });
    /* 5) картинка с проверкой силуэта */
    await page.locator('#vizgo').evaluate(e=>e.click());
    await page.waitForFunction(() => !document.getElementById('viznew').hidden, null, { timeout: 30000 }).catch(() => {});
    const зак = o.vizAsked.render;
    дано(зак[0] && зак[0].w === 75 && зак[0].target.length > 10000 && !зак[0].prev, 'с заказом уходит образец-«пластика» (JPEG)');
    дано(зак.length>=1 && зак.length<=3,'до трёх попыток, локальная коррекция не вызывает генератор повторно');
    дано(/\/viz\/img.*k=r2|blob:/.test(await page.getAttribute('#viznew', 'src')) && await page.evaluate(() => document.getElementById('viznew').naturalWidth > 0), 'показана картинка');
    const сообщ = await page.textContent('#vizmsg');
    дано(/Прежний вариант без проверки всего тела/.test(сообщ), 'старый алгоритм не выдаётся за проверку всего тела: ' + сообщ);
    дано(/Прежний вариант — 75 кг/.test(await page.textContent('#viznewcap')), 'подпись прежнего алгоритма с сохранённым весом');
    await page.locator('#vizdetails summary').click();
    дано(await page.isVisible('#vizben') && /давление/.test(await page.textContent('#vizben')), 'польза для здоровья рядом');
    дано(await page.isVisible('#vizcare'), 'первый раз — поддержка');
    дано(/жир у каждого уходит по-своему/.test(await page.textContent('#viz-main')), 'честная подпись');
    await page.screenshot({ path: '/tmp/viz-kartinka.png', fullPage: false });
    /* 25.10, его слова: «в начале показываем обе фото до и после, а при открытии фото, открывается с слайдером» */
    дано(await page.isVisible('#vizorig') && await page.isVisible('#viznew') && !(await page.$('#vizpair .vizline')), 'сначала рядом обе картинки, без шторки');
    await page.$eval('#viznew', e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150);
    await page.click('#viznew'); await page.waitForTimeout(200);
    дано(await page.isVisible('#vizfs') && await page.evaluate(() => document.getElementById('vizfscmp').classList.contains('has') && document.getElementById('vizfsnew').naturalWidth > 0), 'нажатие на фото — весь экран со шторкой до/после');
    const бок = await page.$eval('#vizfscmp', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.move(бок.x + бок.w * 0.5, бок.y + бок.h * 0.5); await page.mouse.down(); await page.mouse.move(бок.x + бок.w * 0.2, бок.y + бок.h * 0.5, { steps: 5 }); await page.mouse.up();
    const икс = await page.$eval('#vizfscmp', e => e.style.getPropertyValue('--x'));
    дано(Math.abs(parseFloat(икс) - 20) < 3, 'линию можно тянуть: ' + икс);
    await page.screenshot({ path: '/tmp/viz-fs.png' });
    await page.click('#vizfsx'); await page.waitForTimeout(150);
    дано(await page.isHidden('#vizfs'), '✕ закрывает весь экран');
    await page.evaluate(() => document.querySelector('#vizm .modalbox').scrollTop = 1e4); await page.waitForTimeout(200);
    await page.screenshot({ path: '/tmp/viz-niz.png', fullPage: false });
    /* 26.10: новая страница — память VIZ пуста, сервер возвращает выбранное «после». */
    await page.waitForFunction(() => !document.getElementById('vizgo').disabled);
    дано(!!o.vizAsked.selected, 'сервер запомнил выбранную лучшую попытку');
    const restored=await открыть(br, JSON.parse(JSON.stringify(o.viz)));
    restored.o.vizImg=k=>o.vizImg(k);
    await restored.page.click('#vizopen');
    await restored.page.waitForFunction(() => { const i=document.getElementById('viznew'); return !i.hidden && i.complete && i.naturalWidth>0; });
    дано(restored.o.vizAsked.render.length===0, 'после нового входа нет запроса генерации');
    дано(await restored.page.inputValue('#vizw')==='75' && /Прежний вариант — 75 кг/.test(await restored.page.textContent('#viznewcap')), 'с фото восстановлен его целевой вес');
    await restored.page.click('#vizclose'); await restored.page.click('#vizopen');
    await restored.page.waitForSelector('#viznew:not([hidden])');
    дано(restored.o.vizAsked.render.length===0, 'повторное открытие тоже без генерации');
    await restored.page.locator('#vizsteps button[data-w="81.8"]').evaluate(e=>e.click());
    await restored.page.waitForFunction(()=>document.getElementById('viznew').hidden&&/Образ текущей цели ещё не создан/.test(document.getElementById('vizph').textContent));
    дано(!/75 кг/.test(await restored.page.textContent('#viznewcap')),'прежняя цель не показывается рядом с новой');
    await restored.page.close();
    /* 6) удалить */
    await page.locator('#vizfat').evaluate(e=>{e.value='15';e.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForFunction(()=>document.getElementById('vizfatv').textContent==='15 %'&&!document.getElementById('vizgo').disabled);
    дано(o.vizAsked.calc.at(-1).fat===15,'явный процент уходит на расчёт');
    дано(/15 %/.test(await page.textContent('#viznums')),'цель показывает выбранный жир');
    await page.locator('#vizgo').evaluate(e=>e.click());
    await page.waitForFunction(()=>!document.getElementById('vizgo').disabled && /15 % жира/.test(document.getElementById('viznewcap').textContent),null,{timeout:60000});
    дано(o.vizAsked.render.at(-1).fat===15,'15 % переданы генератору, а не только нарисованы в подписи');
    const fatRestored=await открыть(br,JSON.parse(JSON.stringify(o.viz)));fatRestored.o.vizImg=k=>o.vizImg(k);
    await fatRestored.page.click('#vizopen');await fatRestored.page.waitForFunction(()=>document.getElementById('vizfatv').textContent==='15 %');
    дано(fatRestored.o.vizAsked.render.length===0,'цель 15 % восстановлена без новой генерации');
    await fatRestored.page.close();
    await page.click('#vizdel'); await page.waitForTimeout(200);
    дано(o.vizAsked.del === 0 && /Точно удалить/.test(await page.textContent('#vizdel')), 'первое нажатие — переспрашивает');
    await page.click('#vizdel'); await page.waitForTimeout(400);
    дано(o.vizAsked.del === 1 && await page.isVisible('#viz-photo') && /удалены/.test(await page.textContent('#vizpmsg')), 'второе — удалено, снова загрузка фото');
    await page.close();
  } finally { await br.close(); fs.rmSync(TMP,{recursive:true,force:true}); }
  console.log(плохо ? 'ПРОВАЛОВ: ' + плохо : 'ВСЁ OK');
  process.exit(плохо ? 1 : 0);
})();
