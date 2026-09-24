'use strict';
/* Оценка съеденного (24.09). Его слова: «только позавтракал — и вижу красным
   „недобрал калории“, звучит негативно и воспринимается про завтрак, а не про
   весь день». Пока день идёт, сервер судит каждый приём своей долей дня и к
   каждому вычету даёт совет. Здесь заперто, как это видно на экране:
   балл и совет у приёма, «съеденное пока» у карточки дня, совет спокойным
   цветом под часами и красный — только за перебор. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const НОРМА = { kcal: 1550, prot: 155, fat: { min: 50, max: 60 }, fib: 20, sug: 40,
  parts: { base: 1550, gym: 0, acts: 0, plan: 0, delta: 0, k: 1 } };
const ЕДА = [
  { id: 11, t: '09:50', kind: 'завтрак', kcal: 602, prot: 37, fat: 20, fib: 4, sug: 6, img: '/p/a.jpg', text: 'сырники со сметаной' },
  { id: 12, t: '13:30', kind: 'обед',    kcal: 520, prot: 55, fat: 16, fib: 8, sug: 5, img: '/p/b.jpg', text: 'курица с овощами' },
  { id: 13, t: '16:10', kind: 'перекус', kcal: 310, prot: 4,  fat: 9,  fib: 1, sug: 30, text: 'пирожное' }
];
/* ровно в том виде, в каком /day/score отдаёт их сервер (scoreEaten) */
const ПРИЁМЫ = [
  { id: 11, kind: 'завтрак', t: '09:50', r: 5.8, why: [
    { k: 'prot', v: 2.4, t: 'мало белка: 37 г из ~60', совет: '+25 г белка' },
    { k: 'fib', v: 0.5, t: 'мало клетчатки: 4 г из ~8', совет: '+4 г клетчатки — овощи' }] },
  { id: 12, kind: 'обед', t: '13:30', r: 10, why: [] },
  { id: 13, kind: 'перекус', t: '16:10', r: 7.3, why: [
    { k: 'sug', v: 1, t: 'много сахара: 30 г при ~8', совет: 'меньше сладкого' }] }
];
const ВМЕСТЕ = { ok: true, closed: false, going: true, r: 7.1, n: 3, counts: true, вместе: true, приёмы: ПРИЁМЫ,
  why: [{ k: 'prot', v: 1.6, t: 'мало белка: 96 г из ~143', совет: '+45 г белка' },
        { k: 'sug', v: 1, t: 'много сахара: 41 г при ~37', совет: 'меньше сладкого' }] };

(async () => {
  const br = await chromium.launch();

  /* 1. «Еда»: балл и совет у каждого приёма, карточка дня — «съеденное пока» */
  let page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  let ош = await M.поднять(page, { theme: 'dark', time: '17:40', page: 'food',
    day: { meals: ЕДА, targets: НОРМА }, score: ВМЕСТЕ, wait: 2200 });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.waitForTimeout(600);
  const строки = await page.$$eval('.fmeal[data-mid]', рр => рр.map(р => {
    const s = р.querySelector('.fms'), b = s && s.querySelector('b');
    return { id: +р.dataset.mid, текст: s ? s.textContent : null, класс: b ? b.className : null };
  }));
  const по = id => строки.find(с => с.id === id) || {};
  дано(строки.length === 3 && строки.every(с => с.текст), 'балл есть у каждого приёма: ' + JSON.stringify(строки.map(с => с.текст)));
  дано(/^5,8 · \+25 г белка$/.test(по(11).текст || ''), 'завтрак: балл и ОДИН совет, главный — ' + по(11).текст);
  дано(по(11).класс === '', 'недобор белка — не красным и не зелёным');
  дано(/^10 · всё в норме$/.test(по(12).текст || '') && по(12).класс === 'fms-ok', 'обед без вычетов — зелёным, «10», а не «10,0»');
  дано(/меньше сладкого/.test(по(13).текст || '') && по(13).класс === 'fms-bad', 'перебор сахара — красным');
  const карта = await page.textContent('.fclose');
  дано(/съеденное пока/.test(карта), 'карточка дня подписана «съеденное пока»: ' + карта.replace(/\s+/g, ' ').trim());
  дано(/в полночь, по всей норме/.test(карта), 'сказано, что итог дня — в полночь');
  дано(!/недобр/.test(await page.textContent('#p-food')), 'слова «недобрал» на «Еде» нет');
  /* строка приёма не распирает экран: балл живёт под названием, внутри
     колонки текста, и занимает не больше двух строк */
  const края = await page.$$eval('.fmeal[data-mid] .fms', сс => сс.map(s => {
    const r = s.getBoundingClientRect(), ft = s.closest('.ft').getBoundingClientRect();
    return { вне: Math.round(r.right - ft.right), выс: Math.round(r.height) }; }));
  дано(края.length === 3 && края.every(к => к.вне <= 0 && к.выс <= 34), 'балл и совет помещаются в колонку текста: ' + JSON.stringify(края));
  await page.close();

  /* 2. прошлый день: полная формула, баллов у приёмов нет */
  page = await br.newPage({ viewport: { width: 390, height: 1400 } });
  ош = await M.поднять(page, { theme: 'dark', time: '17:40', page: 'food',
    day: { meals: ЕДА, targets: НОРМА },
    score: { ok: true, closed: false, r: 7.2, n: 3, why: [{ k: 'prot', v: 1.6, t: 'не добрал белок: 96 из 155 г' }] }, wait: 2200 });
  await page.waitForTimeout(600);
  дано(!(await page.$('.fms')), 'без оценок приёмов с сервера строка приёма прежняя');
  дано(/день идёт/.test(await page.textContent('.fclose')), 'без «вместе» карточка по-старому: «день идёт»');
  await page.close();

  /* 3. главная: под часами совет спокойным цветом, красный — только перебор */
  const подЧасами = async (why) => {
    const p = await br.newPage({ viewport: { width: 390, height: 900 } });
    await M.поднять(p, { theme: 'dark', time: '11:20', day: { meals: ЕДА.slice(0, 1), targets: НОРМА },
      score: { ok: true, closed: false, going: true, r: 5.8, n: 1, вместе: true, приёмы: ПРИЁМЫ.slice(0, 1), why }, wait: 2200 });
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => { const e = document.querySelector('.hctr .hcl em');
      return e ? { т: document.querySelector('.hctr .hcl').textContent, к: e.className } : null; });
    await p.close(); return r || {};
  };
  let л = await подЧасами(ПРИЁМЫ[0].why);
  дано(/день идёт · дальше \+25 г белка/.test(л.т || ''), 'после завтрака — совет, а не «недобрал»: ' + л.т);
  дано(л.к === '', 'совет про белок — спокойным цветом, не красным');
  л = await подЧасами([{ k: 'kcal', v: 2, t: 'перебор нормы дня: 1900 при 1550', совет: 'дальше только если голоден' }]);
  дано(/день идёт · дальше только если голоден/.test(л.т || '') && !/дальше дальше/.test(л.т || ''), '«дальше» не двоится: ' + л.т);
  дано(л.к === 'hbad', 'перебор калорий — красным');
  л = await подЧасами([]);
  дано(/всё в норме/.test(л.т || '') && л.к === 'hgood', 'без вычетов — зелёным «всё в норме»');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error('УПАЛО:', e.stack); process.exit(1); });
