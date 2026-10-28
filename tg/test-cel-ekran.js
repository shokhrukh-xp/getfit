/* 28.10: экран цели одним экраном. Его слова: «непонятно и не интуитивно работает постановка
   цели», «все параметры должны быть взаимосвязаны и нужна информация о минимально и максимально
   достижимом». Настоящий расчёт сервера (/goal/plan через mock), браузер — приложение. */
const {chromium}=require('playwright'),M=require('./mock'),assert=require('assert/strict');
let плохо=0;const дано=(у,т)=>{console.log((у?'  ok  ':'  ПРОВАЛ  ')+т);if(!у)плохо++;};
(async()=>{const br=await chromium.launch();
 for(const [width,theme] of [[320,'light'],[390,'dark']]){
  const page=await br.newPage({viewport:{width,height:900}});await page.route('**://cdn.jsdelivr.net/**',r=>r.abort());
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  const old={text:'75 кг · 12% жира · мышцы развивать',wt:'down',gym:'muscle',w0:86,kg:11,rate:-.3,from:M.TODAY,body:{v:1,target:75,fat:12,muscle:'develop'}};
  const o={theme,page:'home',me:{sex:'m',age:34,ht:178,bw:86,only:'all',level:'mid'},meas:[{date:M.TODAY,w:86,fat:24}],goal:old};
  await M.поднять(page,o);
  await page.click('#profbtn');await page.locator('#goalcard [data-bodygoal]').click();
  const ждать=async()=>{await page.waitForFunction(()=>{const g=document.getElementById('goalconversation');return g.dataset.state!=='loading'&&g.getAttribute('aria-busy')==='false';});await page.waitForTimeout(150);};
  /* 28.10: самый ранний срок — подпись у края штриховки на полосе времени */
  const ранний=()=>page.evaluate(()=>{const e=document.querySelector('#goalconversation .pth-l.zone');return e?e.textContent.trim():'';});
  const текст=()=>page.evaluate(()=>document.getElementById('goalconversation').innerText.replace(/\s+/g,' '));
  await ждать();let t=await текст();
  дано(await page.evaluate(()=>document.getElementById('coachtitle').textContent)==='Цель','заголовок листа — «Цель»');
  дано(/Похудеть/.test(t)&&/Жир ↓, мышцы ↑/.test(t)&&/Набрать мышцы/.test(t)&&/Питаться правильнее/.test(t),'четыре цели кнопками');
  дано(/можно 70,5–85,5 кг/.test(t)&&/при 75 кг: 10–15%/.test(t)&&/^не раньше \d+ [а-я]{3}$/.test(await ранний()),'под полями — диапазоны и самый ранний срок');
  дано(/1 900/.test(t)&&/155/.test(t)&&/к июню 2027/.test(t),'итог сразу: 1 900 ккал, 155 г, к июню 2027');
  дано(!/Пересмотр|не срок достижения|Наш разговор/.test(t),'без анкеты и «пересмотр — не срок»');
  const срок12=await ранний();
  await page.click('[data-gs="f"][data-v="-1"]');await page.click('[data-gs="f"][data-v="-1"]');await page.waitForTimeout(400);await ждать();t=await текст();
  дано(/к июлю 2027/.test(t)&&(await ранний())!==срок12,'жир 10% меняет срок и самый ранний срок');
  await page.fill('#gs-date','2027-01-31');await page.dispatchEvent('#gs-date','change');await ждать();t=await текст();
  дано(/Не успеть/.test(t)&&/Взять \d+ [а-я]+ \d{4}/.test(t),'ранняя дата: «не успеть» и самая ранняя');
  await page.fill('#gs-date','2028-03-01');await page.dispatchEvent('#gs-date','change');await ждать();t=await текст();
  if(!(!/не успеть/i.test(t)&&/1 марта 2028/.test(t)))console.log('    текст:',t.slice(0,900));
  дано(!/не успеть/i.test(t)&&/1 марта 2028/.test(t),'поздняя дата: приходите к ней, без предупреждения');
  /* 28.10, его снимок: поле срока «30 Mar 2027» вылезало из рамки — дата чипом по-русски и внутри */
  дано(await page.locator('.gs-date').innerText()==='1 марта 2028','своя дата — чипом, по-русски');
  {const bb=await require('./viewport-check')(page);дано(!bb.length,'ничего не вылезает из рамок и за край: '+JSON.stringify(bb).slice(0,300));}
  await page.click('[data-gs="nodate"]');await ждать();
  await page.click('[data-gs="g"][data-v="keep"]');await ждать();t=await текст();
  дано(!/Куда хотите прийти/i.test(t)&&/вес держим/.test(t),'«Питаться правильнее» — без полей, вес держим');
  await page.click('[data-gs="g"][data-v="recomp"]');await ждать();t=await текст();
  дано(/Ограничения по здоровью/.test(t)&&await page.locator('[data-gs="save"]').isDisabled()&&/Ответьте про здоровье/.test(t),'здоровье не спрошено — сохранить нельзя, просим ответить');
  await page.click('[data-gs="health"][data-v="yes"]');await ждать();
  await page.fill('#gs-health-note','Болит колено');await page.dispatchEvent('#gs-health-note','change');await ждать();t=await текст();
  дано(/обсудите с врачом/.test(t)&&/Болит колено/.test(t),'«Есть» и текст — предупреждение с ним');
  await page.click('[data-gs="save"]');await page.waitForFunction(()=>document.getElementById('goalconversation').dataset.state==='done');t=await текст();
  дано(/Цель сохранена/.test(t)&&o.goal&&o.goal.body&&o.goal.body.muscle==='develop','сохранено: цель на сервере');
  const gc=(o.me&&(o.me.me||o.me).goalContext)||{};дано(gc.health==='limited'&&gc.note==='Болит колено','ограничения сохранены в профиле: '+JSON.stringify(gc));
  await page.click('#goalconversation [data-gta="finish"]');await page.waitForTimeout(300);
  дано(await page.evaluate(()=>document.getElementById('coachtitle').textContent)==='Тренер','после «Готово» заголовок снова «Тренер»');
  дано(!errs.length,'ошибок страницы нет '+errs.join('; '));
  const ширина=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);дано(ширина,width+' px без горизонтальной прокрутки');
  await page.close();
 }
 /* границы: вес не уходит за диапазон, жир ниже возможного — сохранить нельзя (раньше — test-tsel, test-goal-realism) */
 {const page=await br.newPage({viewport:{width:390,height:900}});
  const o={theme:'light',page:'home',me:{sex:'m',age:34,ht:178,bw:86,only:'all',level:'mid'},meas:[{date:M.TODAY,w:86,fat:24}],goal:null};
  await M.поднять(page,o);await page.click('#profbtn');await page.locator('#goalcard [data-bodygoal]').click();
  const ждать=async()=>{await page.waitForFunction(()=>{const g=document.getElementById('goalconversation');return g.dataset.state!=='loading'&&g.getAttribute('aria-busy')==='false';});await page.waitForTimeout(150);};
  const текст=()=>page.evaluate(()=>document.getElementById('goalconversation').innerText.replace(/\s+/g,' '));
  await ждать();if(await page.locator('[data-gs="g"][data-v="recomp"][aria-pressed="false"]').count()){await page.click('[data-gs="g"][data-v="recomp"]');await ждать();}
  for(let i=0;i<40;i++)await page.click('[data-gs="w"][data-v="-0.5"]');await page.waitForTimeout(400);await ждать();let t=await текст();
  const мин=(t.match(/можно ([\d,]+)–/)||[])[1];
  дано(мин&&t.includes('− '+мин+' кг +'),'вес не уходит ниже минимума '+мин);
  for(let i=0;i<30;i++)await page.click('[data-gs="f"][data-v="-1"]');await page.waitForTimeout(400);await ждать();t=await текст();
  дано(/Поправьте параметры/.test(t)&&await page.locator('[data-gs="save"]').isDisabled(),'жир ниже возможного — объяснение и сохранить нельзя');
  await page.close();}
 await br.close();
 console.log(плохо?'\nПРОВАЛОВ: '+плохо:'\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(плохо?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
