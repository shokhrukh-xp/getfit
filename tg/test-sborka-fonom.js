'use strict';
/* 28.10, его «Ну почему снова ошибка?… в который раз»: пересборка программы шла 78 с, iPhone рвёт
   запрос без ответа за 60 с. Теперь /ai идёт фоном: POST ?job= → 202, ответ — через /job. Пока
   собирается — крупная «колыбель» (его «отличный момент показать анимированное лого») и этап. */
const {chromium}=require('playwright'),M=require('./mock');
const PROG=require('./fixtures/prog-3dnya.json');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
(async()=>{const br=await chromium.launch();try{
 for(const [theme,width,voice,addr] of [['light',320,'standard','vy'],['dark',390,'hard','ty']]){
  const p=await br.newPage({viewport:{width,height:844}});let calls=0;
  await p.addInitScript(()=>{const d=JSON.stringify({2:1,4:1,6:1});localStorage.setItem('shp_v1_shp_sched',d);localStorage.setItem('shp_v1_ai_sched',d);localStorage.setItem('shp_v1_sched_any',d);});
  const o={theme,page:'gym',me:{sex:'m',age:35,ht:178,bw:85,wt:'down',gym:'muscle',level:'mid',place:'gym',only:'all',voice,addr},profile:'ai',prog:{...PROG,name:'Прежняя программа'},rbo:{stamp:'new-'+theme,why:'Цель изменилась'},aiDelay:13000,onAi:()=>{calls++;return {ok:true,prog:PROG};}};
  const errors=await M.поднять(p,o);
  const req=[];p.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/ai'||u.pathname==='/job')req.push(u.pathname+(u.searchParams.get('job')?'?job':''));});
  await p.click('#profbtn');await p.click('#pq-gym');await p.click('#recobox [data-rb="go"]');
  await p.waitForSelector('#aistate.aiwait .wbm.wb-cradle',{timeout:5000}).catch(()=>{});
  const ждём=await p.evaluate(()=>{const e=document.getElementById('aistate'),m=e.querySelector('.wbm'),r=m&&m.getBoundingClientRect();return {vis:!e.hidden&&getComputedStyle(e).display!=='none',m:!!m,w:r?r.width:0,t:(e.querySelector('.aiwait-t')||{}).textContent||'',anim:m?getComputedStyle(m.querySelector('i')).animationName:''};});
  ok(ждём.vis&&ждём.m&&ждём.w>=50,theme+' '+width+': пока собирается — крупная колыбель ('+Math.round(ждём.w)+' px)');
  ok(/wb-crad/.test(ждём.anim),theme+' '+width+': знак двигается: '+ждём.anim);
  ok(/Собираю программу|Подбираю/.test(ждём.t),theme+' '+width+': под знаком — что происходит: '+ждём.t);
  await p.locator('#aistate').screenshot({path:'/tmp/sborka-fonom-'+theme+'-'+width+'.png'}).catch(()=>{});
  /* 28.10: строка под знаком меняется и шутит в тон тренера */
  const строки=[];for(let i=0;i<10;i++){const t=await p.evaluate(()=>{const s=document.querySelector('#aistate .aiwait-t');return s?s.textContent:'';});if(t&&строки.at(-1)!==t)строки.push(t);await p.waitForTimeout(1000);}
  ok(строки.length>=3,theme+' '+width+': строка меняется: '+строки.join(' → '));
  const ист=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),фр=ист.slice(ист.indexOf('var СБОРКА_ФРАЗЫ=')+'var СБОРКА_ФРАЗЫ='.length,ист.indexOf(';\nfunction сборкаЖдём'));
  const набор=Object.values(eval('('+фр+')')[voice]).flat();
  const свои=строки.slice(1).every(t=>набор.some(x=>x.replace(/\{[^}]*\}/g,'').split(/\s+/).filter(w=>w.length>3).slice(0,2).every(w=>t.includes(w))));
  ok(свои,theme+' '+width+': строки из набора характера «'+voice+'»');
  ok(addr==='ty'?строки.every(t=>!/\b(вас|ваш|вашу|ваши)\b/i.test(t))&&/под тебя/.test(строки[0]):/под вас/.test(строки[0]),theme+' '+width+': обращение на «'+addr+'»');
  {const bb=await require('./viewport-check')(p);ok(!bb.length,theme+' '+width+': ожидание в рамках: '+JSON.stringify(bb).slice(0,200));}
  await p.waitForSelector('#aibox .aiex',{timeout:12000}).catch(()=>{});
  ok(await p.locator('#aibox .aiex').count()>0,theme+' '+width+': программа пришла через /job');
  ok(req[0]==='/ai?job'&&req.filter(x=>x==='/job').length>=2,theme+' '+width+': POST ?job, затем /job: '+req.join(' '));
  ok(calls===1,theme+' '+width+': сборка одна: '+calls);
  ok(await p.locator('#aistate').isHidden(),theme+' '+width+': знак ушёл');
  ok(!errors.length,theme+' '+width+': без ошибок '+errors.join(' | '));
  await p.close();
 }
 /* сервер перезапускался посреди сборки — понятный текст, а не «Не получилось» */
 {const p=await br.newPage({viewport:{width:390,height:844}});
  await p.addInitScript(()=>{const d=JSON.stringify({2:1,4:1,6:1});localStorage.setItem('shp_v1_shp_sched',d);localStorage.setItem('shp_v1_ai_sched',d);localStorage.setItem('shp_v1_sched_any',d);});
  const o={theme:'dark',page:'gym',me:{sex:'m',age:35,ht:178,bw:85,wt:'down',gym:'muscle',level:'mid',place:'gym',only:'all'},profile:'ai',prog:{...PROG,name:'Прежняя программа'},rbo:{stamp:'lost',why:'Цель изменилась'},aiDelay:3000,jobLost:true,onAi:()=>({ok:true,prog:PROG})};
  await M.поднять(p,o);await p.click('#profbtn');await p.click('#pq-gym');await p.click('#recobox [data-rb="go"]');
  await p.waitForFunction(()=>document.getElementById('aistate').classList.contains('bad'),null,{timeout:8000}).catch(()=>{});
  const t=await p.locator('#aistate').innerText();ok(/Сборка прервалась/.test(t),'сервер перезапускался — «Сборка прервалась… Нажмите ещё раз»: '+t);
  await p.close();}
 /* оборванный запрос на iPhone — «Load failed» — словами про связь */
 {const p=await br.newPage({viewport:{width:390,height:844}});await M.поднять(p,{theme:'light'});
  ok(/Load failed\|timed out/.test(require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8')),'«Load failed» — про связь, а не «Не получилось»');await p.close();}
}finally{await br.close();}
console.log(bad?'\nПРОВАЛОВ: '+bad:'\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(bad?1:0);})().catch(e=>{console.error(e);process.exit(1);});
