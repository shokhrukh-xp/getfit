'use strict';
/* 18.10, его выбор: «2 из 3 · 1 пропущено». Реальные кнопки: пропустить,
   меню недели, вернуть; план подходов не уменьшается, отметки не дублируются.
   На 320/390 в обеих темах — без выхода за край и с контрастом токенов. */
const {chromium}=require('playwright'),assert=require('assert/strict'),M=require('./mock'),{opts}=require('./shot-clean'),bounds=require('./viewport-check'),contrast=require('./contrast-check'),fs=require('fs'),path=require('path');
const T=M.TODAY,wd=new Date(T+'T12:00:00').getDay(),sched={[wd]:1,[(wd+1)%7]:1,[(wd+2)%7]:1};
const past=M.Д(1),mon=(()=>{const d=new Date(T+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return d.toLocaleDateString('sv-SE')})();
const hist=past>=mon?[0,1].map(i=>({id:past+'_D'+i,date:M.Д(2)>=mon?M.Д(i+1):past,day:'D'+i,fs:1,fin:past+'T09:30:00Z',ex:[{n:'Жим лёжа',id:'Barbell_Bench_Press_-_Medium_Grip',unit:'reps',sets:[{w:50,r:8}]}]})):[];
const record=d=>({date:d,зал:true,спорт:[],kcal:1750,prot:140,норма:{kcal:1750,prot:140},приёмы:[{id:'rice'+d,kind:'обед',text:'Рис с курицей',items:[{name:'рис',g:80}],kcal:600,prot:45}]});
const week={ok:true,span:'week',from:T,дни:Array.from({length:7},(_,i)=>record(M.Д(-i))),покупки:{отделы:[],дома:[]},группы:[]};
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['dark','light'])for(const width of [320,390]){
  const p=await b.newPage({viewport:{width,height:844}});p.setDefaultTimeout(7000);await p.addInitScript(s=>localStorage.setItem('shp_v1_shp_sched',JSON.stringify(s)),sched);
  const o=opts(theme);Object.assign(o,{hist,day:{gymSkip:0,gymSkips:[],gymPlan:true},menu:{week,завтра:M.Д(-1)},onMenu:undefined});
  const errors=await M.поднять(p,o);await p.locator('.zk .zklab').first().waitFor();
  const stats=()=>p.locator('.zk').innerText();
  assert((await stats()).includes('из 3'));const bars=await p.locator('.zkrow s').allTextContents();
  await p.locator('[data-gymskip="skip"]').click();await p.waitForFunction(()=>document.querySelector('.hweek-block').textContent.includes('1 пропущено'));
  assert.match(await stats(),new RegExp('Завершено занятий\\s*'+hist.length+' из 3'));
  assert.deepEqual(await p.locator('.zkrow s').allTextContents(),bars,'план подходов не уменьшается');
  assert.match(await p.locator('.hweek-block').innerText(),/1 пропущено/);
  assert(!/по расписанию — сегодня/.test(await stats()));
  /* 25.10: под нагрузкой хука .zk перерисовывается посреди прокрутки (Element is not attached) — повторяем */
  for(let i=0;;i++){try{await p.locator('.zk').scrollIntoViewIfNeeded();break}catch(e){if(i>=4||!/not attached/.test(e.message))throw e;await p.waitForTimeout(150)}}
  assert.deepEqual(await bounds(p),[]);assert.deepEqual((await contrast(p,'.zk')).failures,[]);
  if(process.env.GF_SHOTS){fs.mkdirSync(process.env.GF_SHOTS,{recursive:true});await p.locator('.zk').screenshot({path:path.join(process.env.GF_SHOTS,'counter-'+theme+'-'+width+'.png')});}
  await p.click('.l1 [data-page="food"]');await p.locator('[data-zseg="eat"]:visible').click();await p.click('[data-eseg="week"]');await p.locator('[data-menu-day="'+T+'"]').click();
  assert.match(await p.locator('#eatbody').innerText(),/зал пропущен · день отдыха/);assert.equal(await p.locator('#eatbody .mzal').count(),0);assert.match(await p.locator('#eatbody').innerText(),/Рис с курицей/);
  assert.deepEqual(await bounds(p),[]);assert.deepEqual((await contrast(p,'#eatbody')).failures,[]);
  if(process.env.GF_SHOTS)await p.locator('#eatbody').screenshot({path:path.join(process.env.GF_SHOTS,'menu-'+theme+'-'+width+'.png')});
  await p.click('.l1 [data-page="home"]');await p.locator('[data-gymskip=""]').click();await p.waitForFunction(()=>!document.querySelector('.hweek-block').textContent.includes('пропущено'));
  assert.match(await stats(),/из 3/);await p.click('.l1 [data-page="food"]');await p.locator('[data-zseg="eat"]:visible').click();await p.click('[data-eseg="week"]');
  assert.equal(await p.locator('#eatbody .mzal').count(),1,'Вернуть возвращает зал и без пересборки меню');assert(!/зал пропущен/.test(await p.locator('#eatbody').innerText()));
  assert.deepEqual(errors,[]);console.log('PASS '+theme+' '+width+': счётчик с пропуском, прежний план, меню и отмена, контраст/viewport');await p.close();
 }
 // При загрузке с другого устройства/после полуночи даты приходят с сервера.
 {const p=await b.newPage({viewport:{width:320,height:844}});await p.addInitScript(s=>localStorage.setItem('shp_v1_shp_sched',JSON.stringify(s)),{0:1,1:1,2:1,3:1,4:1,5:1,6:1});
  const o=opts('dark');Object.assign(o,{hist:[],day:{gymSkip:0,gymSkips:[mon,mon]},menu:{week,завтра:M.Д(-1)}});await M.поднять(p,o);assert.match(await p.locator('.hweek-block').innerText(),/1 пропущено/);await p.reload();await p.locator('.hweek-block').waitFor();await p.waitForFunction(()=>document.querySelector('.hweek-block').textContent.includes('1 пропущено'));assert(!/2 пропущено/.test(await p.locator('.hweek-block').innerText()));await p.close();console.log('PASS серверные даты и перезагрузка: пропуск не теряется и не удваивается');}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
