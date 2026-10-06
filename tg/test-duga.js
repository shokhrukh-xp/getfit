'use strict';
// 06.10, его слова: «На дуге фото и картинки накладываются друг на друга — это
// плохо. Нужно, чтобы их было видно всегда. Если записей будет слишком много —
// может, просто менять размер кружочков? А при нажатии раскрывать кружочек с
// его данными». Скриншот: зал 06:57 и завтрак 08:19 внахлёст под «06:57–08:19».
// Проверяем три дня (его 06.10, плотный, кучка за шесть минут) на всех ширинах:
// ни одного наложения кружков, мелкие только там, где тесно, и раскрытие.
const {chromium}=require('playwright'),M=require('./mock'),bounds=require('./viewport-check'),contrast=require('./contrast-check');
const {день}=require('./shot-duga'),{clock,proportional,geometry}=require('./test-ui-dorabotka');
let bad=0;function ok(c,t){console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++}
const центр=async(p,loc)=>{await p.locator('.hclk').scrollIntoViewIfNeeded();const r=await loc.locator('.hbcut').boundingBox();return [r.x+r.width/2,r.y+r.height/2]};
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const вид of ['06.10','плотный','кучка'])for(const width of [320,340,360,375,390,430]){
  const tag=theme+'/'+вид+'/'+width,p=await b.newPage({viewport:{width,height:844}}),err=await M.поднять(p,день(theme,вид));
  const cl=await clock(p),pr=proportional(cl),g=await geometry(p);
  ok(!pr.length,'кружки не накладываются и стоят у своего времени '+tag+' '+JSON.stringify(pr));
  ok(!g.issues.length,'плашки не закрывают чужие фото, друг друга и число '+tag+' '+JSON.stringify(g.issues));
  ok(g.x.every((v,i)=>!i||v>g.x[i-1]),'хронологический порядок '+tag);
  if(вид==='06.10'){
   const зал=cl.bub.find(x=>/зал/.test(x.lab)),зав=cl.bub.find(x=>/^08:19/.test(x.lab));
   ok(зал&&зав&&Math.hypot(зал.x-зав.x,зал.y-зав.y)>=зал.r+зав.r+3.5,'его 06.10: зал и завтрак видны оба '+tag);
   const план=cl.bub.filter(x=>/^≈/.test(x.lab));ok(план.length===2&&план.every(x=>x.r===20),'одиночные плановые — полного размера '+tag);
  }
  if(вид==='плотный'){
   // десять записей: мельчают все немного, а тесное утро — сильнее; до минимума не падает весь день
   const rs=cl.bub.filter(x=>!/^Вес/.test(x.lab)).map(x=>x.r);
   ok(Math.max(...rs)>=16&&Math.min(...rs)<Math.max(...rs),'размер кружков по тесноте, не всем одинаково '+tag+' '+cl.bub.map(x=>x.r).join(','));
  }
  ok(cl.bub.every(x=>x.r>=11),'не мельче r=11 при обычном дне '+tag+' '+cl.bub.map(x=>x.r).join(','));
  if(width===320||width===390){
   // палец в центр каждого кружка открывает именно его (соседские круги касания не перехватывают)
   const кр=p.locator('.hclk-svg .hb[data-hx]'),n=await кр.count(),не=[];
   for(let i=0;i<n;i++){const lab=await кр.nth(i).getAttribute('aria-label'),[x,y]=await центр(p,кр.nth(i));await p.mouse.click(x,y);
    const t=await p.locator('.hbx .hbx-t').innerText().catch(()=>'');const tm=(lab.match(/^\d\d:\d\d/)||[''])[0];
    if(!t||(tm&&!t.startsWith(tm))||(!tm&&!/Вес|Зал/.test(t)))не.push(lab+' → '+t);
    await p.locator('.hbx-x').click();}
   ok(n>0&&!не.length,'нажатие открывает свой кружок '+tag+' '+JSON.stringify(не));
   // листание ‹ › по всем записям дня, края выключены
   const [x0,y0]=await центр(p,кр.first());await p.mouse.click(x0,y0);
   ok(await p.locator('[data-hbx-step="-1"]').isDisabled(),'у первой записи «раньше» выключено '+tag);
   const виды=[await p.locator('.hbx-t').innerText()];
   for(let i=1;i<n;i++){await p.locator('[data-hbx-step="1"]').click();виды.push(await p.locator('.hbx-t').innerText());}
   ok(виды.length===n&&new Set(виды).size===n&&await p.locator('[data-hbx-step="1"]').isDisabled(),'листание проходит все записи по порядку '+tag+' '+виды.join('|'));
   const bb=await bounds(p),cc=await contrast(p,'.hbx');
   ok(!bb.length&&!cc.failures.length,'раскрытый кружок: границы и контраст '+tag+' '+JSON.stringify({bb,f:cc.failures}));
   ok(await p.locator('.hbx button:visible').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44})),'кнопки раскрытия ≥44 px '+tag);
   // перерисовка главной (пришли данные) не закрывает раскрытый кружок
   // (переключатель графика тела перерисовывает главную целиком — renderHome)
   const вид0=await p.locator('.hbx-t').innerText();
   await p.locator('[data-vzv][aria-selected="false"]').first().click();await p.waitForTimeout(100);
   ok(await p.locator('.hbx').isVisible()&&await p.locator('.hbx-t').innerText()===вид0,'раскрытый кружок переживает перерисовку '+tag);
   // мимо карточки — свернуть
   await p.locator('.hclk').scrollIntoViewIfNeeded();const bx=await p.locator('.hbx').boundingBox();await p.mouse.click(bx.x+3,bx.y+3);
   ok(await p.locator('.hbx').count()===0,'нажатие мимо карточки сворачивает '+tag);
   // «+» по-прежнему ведёт записывать еду
   const плюс=p.locator('.hclk-svg .hb-next');
   if(await плюс.count()){const [x,y]=await центр(p,плюс);await p.mouse.click(x,y);ok(await p.locator('#coachm').isVisible()&&await p.locator('.hbx').count()===0,'«+» открывает чат, а не раскрытие '+tag);await p.locator('#coachclose').click();}
   // «Подробнее»: приём — карточка приёма на «Еде»; зал — «Зал»
   const еда=p.locator('.hclk-svg .hb-meal').first();{const [x,y]=await центр(p,еда);await p.mouse.click(x,y);}
   const заг=(await p.locator('.hbx-t').innerText()).split(' · ')[1];
   await p.locator('.hbx-go').click();
   ok(await p.locator('#p-food').isVisible()&&await p.locator('#mealm.show').isVisible()&&(await p.locator('#mealtitle').innerText()).startsWith(заг),'«Подробнее» открывает этот приём '+tag+' '+заг);
   await p.locator('#mealclose').click();await p.locator('.l1 [data-page="home"]').click();await p.waitForTimeout(150);
   ok(await p.locator('.hbx').count()===0,'после ухода со страницы раскрытие не висит '+tag);
   const зал=p.locator('.hclk-svg .hb-gym');
   if(await зал.count()){const [x,y]=await центр(p,зал);await p.mouse.click(x,y);await p.locator('.hbx-go').click();ok(await p.locator('#p-gym').isVisible(),'зал раскрывается и ведёт в «Зал» '+tag);}
  }
  ok(!err.length,'без ошибок JS '+tag+' '+err.join('|'));
  await p.close();
 }
}finally{await b.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
