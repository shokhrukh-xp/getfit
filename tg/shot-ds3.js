'use strict';
/* 04.10: аудит UI/UX — снимки всех экранов на подставном сервере, светлая и
   тёмная тема, 390×844 @2x. Неделя — прокрутка к графику, не стрелка
   следующего дня (сегодня она выключена). Ошибка сцены делает прогон красным. Папка — docs/reviews/<дата>-audit/. В git не идут. */
const { chromium } = require('playwright');
const M = require('./mock');
const path = require('path'), fs = require('fs');
const OUT = process.argv[2] || path.join(__dirname, '../../../docs/reviews/2026-10-04-ds3');
fs.mkdirSync(OUT, { recursive: true });
const цель = { text: '75 кг к концу января · старт 1 сентября · мышцы и силу сохраняем', wt: 'down', rate: -0.67, from: M.Д(33), w0: 92.3, by: '2027-02-10', kg: 17.3 };
const progress = { anchor: M.Д(19), anchorW: 88.3, rate: -0.67, gap: 0.7, fact: -4.7, plan: -5.4, onTrack: false, sinceFact: -0.7, sincePlan: -1.4,
  verdict: { state: 'стоит', text: 'Неделя без снижения: −0,0 кг по средним (3 замера). Одна такая бывает от соли, воды и гликогена; вторая подряд — плато.' },
  eta: { pace: -0.43, weeks: 29, date: '2027-04-26' },
  sila: { verdict: 'растёт', up: 2, flat: 1, down: 1, rows: [
    { name: 'Жим лёжа', now: { w: 62.5, r: 8, date: M.Д(2) }, was: { w: 60, r: 8, date: M.Д(12) }, pct: 4.2 },
    { name: 'Присед', now: { w: 77.5, r: 6, date: M.Д(1) }, was: { w: 80, r: 6, date: M.Д(10) }, pct: -3.1 },
    { name: 'Тяга штанги', now: { w: 70, r: 10, date: M.Д(3) }, was: { w: 70, r: 10, date: M.Д(11) }, pct: 0 } ] } };
const день = { meals: [
  { id: 1, t: '08:40', kind: 'завтрак', text: 'Творог обезжиренный 200 г, 2 яйца, банан', kcal: 430, prot: 49, fat: 12, carb: 44, img: '/p/a.jpg' },
  { id: 2, t: '13:55', kind: 'обед', text: 'Паровые котлеты, грудка с рисом и овощами', kcal: 544, prot: 59, fat: 14, carb: 52, img: '/p/b.jpg' },
  { id: 3, t: '16:20', kind: 'перекус', text: 'Груша и хурма 230 г', kcal: 141, prot: 1, fat: 0, carb: 34, img: '/p/c.jpg' } ] };
день.line='За день: 1115 / 2110 ккал · белок 109 / 165 г. До нормы: 995 ккал и 56 г белка.';
const неделя={days:M.неделя().days.map(d=>d.date===M.Д(0)?{...d,kcal:1115,prot:109,n:3}:d)};
const ЗАВТРА = M.Д(-1);
const И = (name, g, kcal, prot) => ({ name, g, kcal, prot, fat: 5, carb: 10 });
const ДЕНЬ = { date: ЗАВТРА, зал: true, спорт: [], норма: { kcal: 1850, prot: 160 }, kcal: 1750, prot: 159, белокМало: 0, приёмы: [
  { id: 'b1', kind: 'завтрак', text: 'Омлет из 3 яиц с творогом', мин: 10, kcal: 430, prot: 42, items: [И('Яйцо куриное', 165, 250, 21), И('Творог 5%', 150, 180, 21)] },
  { id: 'b2', kind: 'обед', text: 'Плов с говядиной и салат', мин: null, kcal: 520, prot: 21, items: [И('Плов с говядиной', 250, 480, 19)] },
  { id: 'b3', kind: 'перекус', text: 'Творог с ягодами', мин: null, kcal: 280, prot: 34, items: [И('Творог 5%', 200, 240, 32)] },
  { id: 'b4', kind: 'ужин', text: 'Куриная грудка с гречкой', мин: 30, kcal: 520, prot: 62, items: [И('Куриная грудка запечённая', 220, 360, 60)] }] };
const МЕНЮ = { ok: true, span: 'day', from: ЗАВТРА, at: Date.now(), note: 'Плов оставил — белок добирает грудка.', дни: [ДЕНЬ],
  покупки: { семья: 2, дней: 1, дома: ['Рис'], отделы: [{ отдел: 'Мясо и птица', список: [{ имя: 'Куриная грудка', сколько: '600 г', g: 594 }] },
    { отдел: 'Молочное и яйца', список: [{ имя: 'Творог 5%', сколько: '700 г', g: 700 }, { имя: 'Яйцо куриное', сколько: '6 шт', g: 330 }] }] } };

// Стендовые меню из test-menu; генерация/отправка никогда не идут в настоящий Worker.
function менюСтенда(route){
 const span=JSON.parse(route.request().postData()||'{}').span;
 if(span==='today')return {...МЕНЮ,span,date:M.TODAY,from:M.TODAY,sig:[M.TODAY,2110,1115,3,2].join('|'),
  норма:{kcal:2110,prot:165},съел:{kcal:1115,prot:109},ост:{kcal:995,prot:56},съедено:день.meals,
  дни:[{...ДЕНЬ,date:M.TODAY,приёмы:[ДЕНЬ.приёмы[3]]}]};
 return {...МЕНЮ,span,дни:span==='week'?Array.from({length:7},(_,i)=>({...ДЕНЬ,date:M.Д(-i-1)})):[ДЕНЬ]};
}

const сцены = [
 {имя:'food',o:{page:'food',time:'19:40',day:день}},
 {имя:'food-past',o:{page:'food',day:{...день,date:M.Д(1),line:'За вчера: 1115 / 2110 ккал · белок 109 / 165 г. Не хватило до нормы: 995 ккал и 56 г белка.'},score:{closed:true}},после:async p=>{await p.locator('#fnav button').first().click()}},
 {имя:'food-closed',o:{page:'food',day:день,score:{closed:true}}},
 {имя:'food-free',o:{page:'food',day:день,free:[M.Д(0)]}},
 {имя:'food-no-profile',o:{page:'food',day:{...день,targets:{},line:'За день: 1115 ккал, белок 109 г.'}}},
 {имя:'food-empty',o:{page:'food',day:{meals:[],kcal:0,prot:0,line:'За день: 0 ккал. До нормы: 2110 ккал и 165 г белка.'},score:{r:null}}},
 {имя:'food-week',o:{page:'food',day:день},fullPage:false,после:async p=>{await p.locator('#fweek').scrollIntoViewIfNeeded()}},
 ...['now','day','week','buy'].map(x=>({имя:'eat-'+x,o:{page:'eat',day:день},после:async p=>{await p.locator('[data-eseg="'+(x==='buy'?'week':x)+'"]').click();if(x!=='now'){await p.locator('[data-mgen="'+(x==='buy'?'week':x)+'"]').click();await p.locator('.mnrow').first().waitFor();if(x==='buy')await p.locator('[data-eseg="buy"]').click()}}})),
 {имя:'circle',o:{page:'circle',day:день}},
 ...['food','eat','circle'].map(x=>({имя:x+'-320',width:320,o:{page:x,time:'19:40',day:день}})),
 {имя:'food-free-320',width:320,o:{page:'food',day:день,free:[M.Д(0)]}}
];

(async () => {
  const br = await chromium.launch();
  for (const тема of ['dark', 'light']) {
    for (const с of сцены) {
      const page = await br.newPage({ viewport: { width: с.width||390, height: 844 }, deviceScaleFactor: 2 });
      try {
        const opts=Object.assign({theme:тема,time:"19:40",week:неделя,menu:{завтра:ЗАВТРА},onMenu:менюСтенда},с.o);
        opts.week={...opts.week,days:opts.week.days.map(d=>({...d,free:(opts.free||[]).includes(d.date)}))};
        const ош = await M.поднять(page, opts);
        await page.waitForTimeout(600);
        if (с.после) { await с.после(page); await page.waitForTimeout(500); }
        await page.screenshot({ path: path.join(OUT, `${с.имя}-${тема}.png`), fullPage: с.fullPage !== false });
        console.log('снято', с.имя, тема, ош.length ? 'ошибки: ' + ош.slice(0, 1).join(' | ').slice(0, 100) : '');
      } catch (e) { console.log('УПАЛО', с.имя, тема, e.message.slice(0, 120)); process.exitCode=1; }
      await page.close();
    }
  }
  await br.close();
})().catch(e => { console.error('УПАЛО:', e.message); process.exit(1); });
