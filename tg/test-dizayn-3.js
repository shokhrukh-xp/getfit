'use strict';
/* 17.10, пакет 3: только полировка утверждённых экранов. Проверяем геометрию,
   прежние действия, все шаги знакомства и сохранность справки. Подставной API. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean'),bounds=require('./viewport-check'),contrast=require('./contrast-check');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++};
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['dark','light'])for(const width of [320,390]){
  const tag=theme+' '+width+': ',p=await b.newPage({viewport:{width,height:844}}),requests=[];
  p.on('request',r=>{if(r.method()==='POST')requests.push({url:new URL(r.url()).pathname,body:r.postDataJSON()})});
  const errors=await M.поднять(p,{...opts(theme),page:'food',circle:M.круг()});
  await p.route('**/meal/upd',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,day:M.день()})}));
  const clean=async(root)=>{const v=await bounds(p),c=await contrast(p,root);ok(!v.length,tag+root+' внутри экрана '+JSON.stringify(v));ok(c.checked>0&&!c.failures.length,tag+root+' контраст '+JSON.stringify(c.failures))};
  // Четыре разных подписи и длинные значения: одно основание, ни один ввод не обрезан.
  await p.locator('.fmeal .ft').first().click();await p.click('#mv-edit');
  for(const [id,v] of [['ml-kcal','2350'],['ml-prot','137'],['ml-fat','124'],['ml-fib','31']])await p.fill('#'+id,v);
  const nums=await p.locator('#ml-form .mnums input').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {id:e.id,b:r.bottom,h:r.height,w:r.width,scroll:e.scrollWidth,client:e.clientWidth}}));
  ok(nums.length===4&&Math.max(...nums.map(x=>x.b))-Math.min(...nums.map(x=>x.b))<1,tag+'правка приёма: общая нижняя линия '+JSON.stringify(nums));
  ok(nums.every(x=>x.h>=44&&x.w>=44&&x.scroll<=x.client+1),tag+'все четыре ввода целиком, касание ≥44');await clean('#mealm');
  await p.click('#ml-save');await p.waitForFunction(()=>!document.getElementById('mealm').classList.contains('show'));
  const meal=requests.find(x=>x.url==='/meal/upd');ok(meal&&meal.body.kcal===2350&&meal.body.prot===137&&meal.body.fat===124&&meal.body.fib===31,tag+'сохранение всех четырёх значений прежним маршрутом');
  // Сборка: группировка не отрывает контролы от существующих обработчиков.
  await p.click('#profbtn');await p.click('#pq-gym');await p.click('#progedit');
  const groups=await p.locator('#sborm .sbgroup').evaluateAll(es=>es.map(e=>({title:e.querySelector('h4').textContent,ids:[...e.querySelectorAll('.seg,.wdgrid,input')].map(x=>x.id)})));
  ok(groups.length===2&&groups[0].title==='Когда и сколько'&&groups[0].ids.join()==='sb-wd,sb-when,sb-min'&&groups[1].title==='Условия и предпочтения'&&['sb-level','sb-place','sb-eq','sb-focus','sb-plate','sb-lim','sb-dis'].every(id=>groups[1].ids.includes(id)),tag+'два раздела и все прежние условия '+JSON.stringify(groups));
  await p.click('#sb-min [data-v="60"]');
  ok(/24 подхода за занятие/.test(await p.textContent('#sb-minh')),tag+'минуты меняют прежнюю подсказку подходов');
  await p.click('#sb-place [data-v="home"]');ok(await p.isVisible('#sb-eqrow')&&!await p.isVisible('#sb-platerow'),tag+'дома — инвентарь вместо блина');
  await p.click('#sb-place [data-v="gym"]');ok(!await p.isVisible('#sb-eqrow')&&await p.isVisible('#sb-platerow'),tag+'зал — блин вместо домашнего инвентаря');await clean('#sborm');
  await p.click('#sborclose');await p.waitForSelector('#profm.show #progedit');ok(await p.textContent('#proftitle')==='Программа'&&await p.isVisible('#progedit'),tag+'закрытие сборки возвращает в лист программы');
  /* 22.10: «Как пользоваться» убрана (его выбор) — вместо неё подсказки по месту, test-podskazki-po-mestu */
  await p.click('#pqback');ok(!(await p.locator('#profhow').count())&&/body-muscles, Apache-2.0/.test(await p.textContent('#profm')),tag+'справки в профиле нет, лицензия анатомии — внизу');await p.click('#profclose');
  await p.click('.l1 [data-page="food"]');await p.click('[data-zseg="circle"]:visible');await p.locator('.cirgear').click();
  await p.waitForSelector('#krugbody [data-kdel]');
  const actions=await p.locator('#krugbody [data-kdel],#krugbody [data-kboss]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {t:e.textContent,w:r.width,h:r.height,x:r.left,y:r.top,right:r.right,bottom:r.bottom}}));
  ok(actions.length===2&&actions.some(x=>x.t==='Убрать')&&actions.every(x=>x.w>=44&&x.h>=44)&&actions[0].right+8<=actions[1].x,tag+'два отдельных подписанных касания ≥44 '+JSON.stringify(actions));
  ok(await p.locator('#krugbody ul.kmine > li').count()===4,tag+'права, удаление, передача и закрытие — четырьмя пунктами');await clean('#krugm');
  await p.click('[data-kboss]');ok(await p.textContent('[data-kboss]')==='Точно передать?'&&!requests.some(x=>x.url==='/circle/owner'),tag+'передача по-прежнему требует второго нажатия');
  await p.click('[data-kboss]');await p.waitForTimeout(100);ok(requests.some(x=>x.url==='/circle/owner'&&x.body.who==='850965787'),tag+'подтверждение передаёт выбранному участнику');
  await p.locator('.cirgear').click();await p.waitForSelector('[data-kdel]');await p.click('[data-kdel]');await p.waitForTimeout(100);ok(requests.some(x=>x.url==='/circle/del'&&x.body.who==='850965787'),tag+'«Убрать» вызывает прежний маршрут с нужным участником');
  ok(!errors.length,tag+'без ошибок JS '+errors.join(' | '));await p.close();
  // Новичок: полоски следуют реальному счётчику, назад сохраняет ввод.
  const n=await b.newPage({viewport:{width,height:844}});const ne=await M.поднять(n,{theme,newbie:true});
  const step=async(i,total)=>{await n.waitForFunction(t=>document.getElementById('wzstep').textContent===t,'шаг '+i+' из '+total);const count=await n.textContent('#wzstep'),bars=await n.locator('#wzpath span').count(),done=await n.locator('#wzpath .reached').count();ok(await n.isVisible('#wzpath')&&count==='шаг '+i+' из '+total&&bars===total&&done===i,tag+'знакомство '+i+'/'+total+': текст и индикатор согласованы');const v=await bounds(n),c=await contrast(n,'#picker');ok(!v.length&&!c.failures.length,tag+'шаг '+i+': контраст и границы '+JSON.stringify({v,c:c.failures}))};
  await step(1,3);await M.шаги(n,{до:'health'});
  ok(await n.isVisible('#goalconversation')&&!await n.isVisible('#picker'),tag+'адаптивный разговор без ложного счётчика вопросов');
  await M.цельШаги(n,{});ok(await n.isVisible('#wzform'),tag+'после подтверждения цели — программа');
  await n.click('#wz-go');await n.waitForSelector('.aiprev');ok(!await n.isVisible('#wzpath'),tag+'индикатор скрыт после анкеты');ok(!ne.length,tag+'знакомство без ошибок');await n.close();
  const f=await b.newPage({viewport:{width,height:844}});await M.поднять(f,{theme,newbie:true});await f.click('#wz-only [data-only="food"]');ok(await f.textContent('#wzstep')==='шаг 1 из 2'&&await f.locator('#wzpath span').count()===2,tag+'только питание: режим и цель, без этапа зала');await f.close();
  /* 22.10: строка про бесплатный лимит жила в справке; справки нет — лимит виден на «Еде» у «Добавить приём» */
 }
}finally{await b.close()}
if(bad){console.log('ПРОВАЛОВ: '+bad);process.exit(1)}console.log('test-dizayn-3: всё зелёное')})().catch(e=>{console.error(e);process.exit(1)});
