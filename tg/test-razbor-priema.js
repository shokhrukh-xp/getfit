'use strict';
/* Разбор приёма по нажатию (24.09). Его слова: «при нажатии на запись блюда
   показать, почему такая оценка и что было бы лучше, и кнопку „изменить“».
   Выбрано: шторка снизу; «что было бы лучше» пишет тренер под это блюдо;
   разбор — и за прошлые дни. Здесь заперто, что видно по нажатию, что
   «Изменить» ведёт в прежнюю правку, и что приём без вычетов тренера не зовёт. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const НОРМА = { kcal: 1850, prot: 190, fat: { min: 50, max: 90 }, fib: 26, sug: 46, parts: { base: 1850, gym: 0, acts: 0, plan: 0, delta: 0, k: 1 } };
const ЕДА = [
  { id: 11, t: '09:10', kind: 'завтрак', kcal: 602, prot: 37, fat: 38, fib: 4, sug: 5, img: '/p/a.jpg', text: 'Яичница из 4 яиц с отрубным хлебом' },
  { id: 12, t: '12:40', kind: 'перекус', kcal: 151, prot: 1, fat: 0, fib: 7, sug: 28, img: '/p/b.jpg', text: 'Груша и хурма' }];
/* ровно в том виде, в каком /day/score отдаёт их сервер (scoreEaten: why и разбор) */
const ПРИЁМЫ = [
  { id: 11, kind: 'завтрак', t: '09:10', r: 6.5,
    why: [{ k: 'prot', v: 2.3, t: 'мало белка: 37 г из ~62', совет: '+25 г белка', нужно: 25 },
          { k: 'fat', v: 0.7, t: 'много жира: 38 г при ~29', совет: 'меньше масла и соусов', нужно: -9 },
          { k: 'fib', v: 0.5, t: 'мало клетчатки: 4 г из ~8', совет: '+4 г клетчатки — овощи', нужно: 4 }],
    разбор: [{ k: 'kcal', имя: 'Калории', т: '602 при обычных ~560 на завтрак', v: 0, ok: true, нет: false },
             { k: 'prot', имя: 'Белок', т: '37 г из ~62', v: 2.3, ok: false, нет: false },
             { k: 'fat', имя: 'Жир', т: '38 г при ~29', v: 0.7, ok: false, нет: false },
             { k: 'fib', имя: 'Клетчатка', т: '4 г из ~8', v: 0.5, ok: false, нет: false },
             { k: 'sug', имя: 'Сахар', т: '5 г при ~14', v: 0, ok: true, нет: false }] },
  { id: 12, kind: 'перекус', t: '12:40', r: 10, why: [],
    разбор: [{ k: 'kcal', имя: 'Калории', т: '151 · 8 % нормы дня', v: 0, ok: true, нет: false },
             { k: 'prot', имя: 'Белок', т: '1 г · не в счёт: меньше 10 % нормы дня', v: 0, ok: false, нет: true },
             { k: 'fat', имя: 'Жир', т: '0 г при ~7', v: 0, ok: true, нет: false },
             { k: 'fib', имя: 'Клетчатка', т: '7 г · не в счёт: меньше 10 % нормы дня', v: 0, ok: false, нет: true },
             { k: 'sug', имя: 'Сахар', т: '28 г при ~4', v: 0, ok: true, нет: false }] }];
const СЧЁТ = { ok: true, closed: false, going: true, r: 7.2, n: 2, counts: true, вместе: true, приёмы: ПРИЁМЫ, why: ПРИЁМЫ[0].why };
const ЛУЧШЕ = { ok: true, r: 6.5, советы: [
  { k: 'prot', голова: '+25 г белка', как: '2 яйца из 4 замени на 150 г творога', тренер: true },
  { k: 'fat', голова: '−9 г жира', как: 'Жарь на капле масла или в антипригарной', тренер: true },
  { k: 'fib', голова: '+4 г клетчатки', как: 'добавь огурец и помидор, 200 г', тренер: true }] };

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 844 } });
  const спросили = [];
  page.on('request', r => { if (/\/meal\/better/.test(r.url())) спросили.push(r.postData() || ''); });
  const ош = await M.поднять(page, { theme: 'dark', time: '13:05', page: 'food',
    day: { meals: ЕДА, targets: НОРМА }, score: СЧЁТ, better: ЛУЧШЕ, wait: 2200 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(600);

  /* 1. нажатие на запись — разбор, а не сразу правка */
  await page.click('.fmeal[data-mid="11"] .ft');
  await page.waitForTimeout(500);
  const вид = await page.evaluate(() => ({
    открыта: document.getElementById('mealm').classList.contains('show'),
    разбор: !document.getElementById('ml-view').hidden, правка: !document.getElementById('ml-form').hidden,
    заголовок: document.getElementById('mealtitle').textContent,
    шапка: (document.querySelector('#mv-razbor .pz-h') || {}).textContent || '',
    ряды: Array.from(document.querySelectorAll('#mv-razbor .pz-r')).map(r => r.textContent.replace(/\s+/g, ' ').trim()),
    лучше: Array.from(document.querySelectorAll('#mv-better li')).map(l => l.textContent.trim()) }));
  дано(вид.открыта && вид.разбор && !вид.правка, 'по нажатию — шторка с разбором, форма правки скрыта');
  дано(вид.заголовок === 'Завтрак · 09:10', 'заголовок — приём и время: ' + вид.заголовок);
  дано(/Почему 6,5 из 10/i.test(вид.шапка), 'сказано, почему 6,5: ' + вид.шапка);
  дано(вид.ряды.length === 5, 'все пять пунктов, а не только вычеты: ' + вид.ряды.length);
  дано(вид.ряды.some(r => /Белок.*37 г из ~62.*−2,3/.test(r)), 'белок: числа и вычет −2,3');
  дано(вид.ряды.some(r => /Сахар.*✓/.test(r)), 'сахар в порядке — галочка');
  дано(вид.лучше.length === 3 && /^\+25\sг белка: 2 яйца из 4 замени на 150\u00a0г творога$/.test(вид.лучше[0]),
    'что было бы лучше — правка тренера под это блюдо: ' + вид.лучше[0]);
  дано(/\+25\u00a0г/.test(вид.лучше[0] || ''), '«25 г» не рвётся по строкам: число с единицей через неразрывный пробел');
  дано(/^−9\sг жира: жарь/.test(вид.лучше[1] || ''), 'после двоеточия — со строчной, даже если тренер написал с заглавной: ' + вид.лучше[1]);
  дано(спросили.length === 1 && /"id":11/.test(спросили[0]), 'тренера спросили один раз и про этот приём');

  /* 2. «Изменить» — прежняя правка приёма */
  await page.click('#mv-edit');
  await page.waitForTimeout(300);
  const правка = await page.evaluate(() => ({
    разбор: !document.getElementById('ml-view').hidden, правка: !document.getElementById('ml-form').hidden,
    заголовок: document.getElementById('mealtitle').textContent, текст: document.getElementById('ml-text').value,
    ккал: document.getElementById('ml-kcal').value }));
  дано(правка.правка && !правка.разбор, '«Изменить» открывает форму в той же шторке');
  дано(правка.заголовок === 'Правка приёма' && правка.текст === ЕДА[0].text && правка.ккал === '602',
    'форма заполнена этим приёмом: ' + правка.текст + ', ' + правка.ккал);
  await page.click('#mealclose'); await page.waitForTimeout(300);

  /* 3. приём без вычетов — тренер не нужен */
  await page.click('.fmeal[data-mid="12"] .ft');
  await page.waitForTimeout(500);
  const груша = await page.evaluate(() => ({
    разбор: !document.getElementById('ml-view').hidden,
    ряды: Array.from(document.querySelectorAll('#mv-razbor .pz-r')).map(r => r.textContent.replace(/\s+/g, ' ').trim()),
    лучше: (document.getElementById('mv-better') || {}).textContent || '' }));
  дано(груша.разбор && /Ничего — приём в норме/.test(груша.лучше), 'приём в норме: «Ничего — приём в норме»');
  дано(груша.ряды.some(r => /Белок.*не в счёт.*—/.test(r)), 'у мелочи белок «не в счёт» и прочерк, а не минус');
  дано(спросили.length === 1, 'тренера про приём без вычетов не спрашивали');

  /* 4. шторка помещается и не вылезает за экран */
  const края = await page.evaluate(() => { const r = document.querySelector('#mealm .modalbox').getBoundingClientRect();
    return { лево: Math.round(r.left), право: Math.round(r.right), ширина: innerWidth }; });
  дано(края.лево >= 0 && края.право <= края.ширина, 'шторка в пределах экрана: ' + JSON.stringify(края));

  await br.close();
  console.log(плохо ? '\nПРОВАЛОВ: ' + плохо : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
