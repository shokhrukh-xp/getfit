'use strict';
/* 17.10: кнопка профиля и профиль группами. Его слова: «кнопка профиля почти
   не заметна особенно когда открываю на телефоне, страница профиля вообще в
   каком-то хаосе, нет организованности и понятной структуры что тут и на что
   влияет». Его выбор из макета: аватар-акцент; «Группы + строки» (в строке —
   название, на что влияет, значение, ›; подробности листом внутри); Pro-ссылки —
   в Админ панель. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean'),bounds=require('./viewport-check'),contrast=require('./contrast-check');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const где=theme+' '+width+': ';
  const p=await b.newPage({viewport:{width,height:844}});
  const o=opts(theme);o.progress=Object.assign({},o.progress,{kg:17});o.admin={про:[],промо:[]};
  o.ref={points:0,people:[{name:'А',paid:0}]};o.me=Object.assign({},o.me,{voice:'hard'});
  const err=await M.поднять(p,o);await p.waitForTimeout(400);
  async function check(name){const bb=await bounds(p),cc=await contrast(p,'#profm');
   ok(!bb.length,где+name+': ничего не вылезает за край '+JSON.stringify(bb).slice(0,160));
   ok(cc.checked>0&&!cc.failures.length,где+name+': контраст '+JSON.stringify(cc.failures).slice(0,160));}

  /* 1. кнопка: крупная, залита акцентом, буква белая */
  const к=await p.$eval('#profbtn',e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
   return {w:r.width,h:r.height,bg:cs.backgroundColor,c:getComputedStyle(e.querySelector('b')||e).color,
    фон:getComputedStyle(document.body).backgroundColor}});
  ok(к.w>=44&&к.h>=44,где+'кнопка профиля не меньше 44 px: '+Math.round(к.w)+'×'+Math.round(к.h));
  ok(к.bg!==к.фон&&!/rgba\(0, 0, 0, 0\)|transparent/.test(к.bg),где+'кнопка залита цветом, а не сливается с фоном: '+к.bg);
  ok(/255, 255, 255/.test(к.c),где+'буква белая: '+к.c);

  /* 2. главный список профиля */
  await p.click('#profbtn');await p.waitForTimeout(500);
  const гр=await p.$$eval('#pqmain .pqlab',ns=>ns.filter(n=>n.offsetParent).map(n=>n.textContent.trim()));
  ok(гр.join('|')==='О тебе|Тренер|Зал|Друзья|Приложение',где+'группы по порядку: '+гр.join(' · '));
  const строки=await p.$$eval('#pqmain .pqrow',ns=>ns.filter(n=>n.offsetParent).map(n=>({id:n.id,h:n.getBoundingClientRect().height,
   t:(n.querySelector('.pqt b')||{}).textContent,s:(n.querySelector('.pqt small')||{}).textContent||'',v:(n.querySelector('.pqv')||{}).textContent||''})));
  ok(строки.every(x=>x.h>=44),где+'все строки не ниже 44 px');
  const пп=строки.filter(x=>['zdtoggle','bttoggle','pq-only','pq-voice','pq-gym','pq-ref'].includes(x.id));
  ok(пп.length===6&&пп.every(x=>x.s.trim().length>5),где+'у каждой строки настроек подпись, на что она влияет: '+пп.map(x=>x.t+' — '+x.s).join(' | ').slice(0,200));
  const зн=Object.fromEntries(строки.map(x=>[x.id,x.v.trim()]));
  ok(зн['pq-only']==='еда и зал'&&зн['pq-voice']==='саркастичный',где+'значения справа — текущий выбор: '+зн['pq-only']+' / '+зн['pq-voice']);
  ok(/балл/.test(зн['pq-ref']||''),где+'у приглашения — баллы: '+зн['pq-ref']);
  ok(await p.$eval('#pqname',e=>e.textContent.trim())==='Ш'&&await p.$eval('#pqava',e=>e.textContent.trim())==='Ш',где+'шапка: имя и буква из Telegram');
  /* полоса цели: старт 92,3, путь 17 кг, пройдено 4,8 → 28% */
  const пол=await p.evaluate(()=>{const g=document.querySelector('#goalcard .pqgbar b');return g?{w:g.style.width,t:document.querySelector('#goalcard .pqgends').textContent}:null});
  ok(пол&&пол.w==='28%'&&/старт 92,3/.test(пол.t)&&/цель 75,3/.test(пол.t),где+'полоса цели верна данным: '+JSON.stringify(пол));
  ok(await p.$$eval('#profm .pqpage',ns=>ns.every(n=>n.hidden)),где+'листы закрыты, пока не нажал');
  await check('список профиля');

  /* 3. каждая строка открывает свой лист, назад — в список */
  for(const [id,т,внутри] of [['zdtoggle','Здоровье','#zdbody'],['bttoggle','Быт и еда','#btbody'],['pq-only','Что веду','#me-only'],
    ['pq-voice','Характер тренера','#me-voice'],['pq-gym','Программа','#progcard'],['pq-ref','Пригласить друга','#reflink']]){
   await p.click('#'+id);await p.waitForTimeout(250);
   const с=await p.evaluate(()=>({т:document.getElementById('proftitle').textContent,назад:!document.getElementById('pqback').hidden,
    список:!document.getElementById('pqmain').hidden,верх:document.querySelector('#profm .modalbox').scrollTop}));
   ok(с.т===т&&с.назад&&!с.список,где+'«'+т+'»: свой лист с заголовком и «‹ Профиль»');
   ok(await p.isVisible(внутри),где+'«'+т+'»: содержимое на виду ('+внутри+')');
   ok(с.верх===0,где+'«'+т+'»: лист открыт с начала');
   if(id==='pq-voice'||id==='zdtoggle') await check('лист «'+т+'»');
   await p.click('#pqback');await p.waitForTimeout(200);
   ok(await p.isVisible('#pqmain')&&await p.$eval('#proftitle',e=>e.textContent)==='Профиль',где+'«‹ Профиль» возвращает в список');
  }
  /* выбор в листе сразу виден в строке */
  await p.click('#pq-only');await p.click('#me-only button[data-v="food"]');await p.waitForTimeout(400);
  await p.click('#pqback');await p.waitForTimeout(200);
  ok(await p.$eval('#pv-only',e=>e.textContent)==='только еда',где+'«только еда» сразу видно в строке');
  ok(!(await p.isVisible('#pq-gym')),где+'и группы «Зал» больше нет');
  await p.click('#pq-only');await p.click('#me-only button[data-v="all"]');await p.waitForTimeout(400);await p.click('#pqback');

  /* закрыл на листе — открылся снова со списка */
  await p.click('#pq-voice');await p.click('#profclose');await p.waitForTimeout(300);
  await p.click('#profbtn');await p.waitForTimeout(400);
  ok(await p.isVisible('#pqmain')&&!(await p.isVisible('#pqback')),где+'профиль всегда открывается со списка');

  /* 4. Pro-ссылки — только в Админ панели */
  ok(await p.evaluate(()=>!document.querySelector('#profm #probox')),где+'в профиле Pro-ссылок нет');
  await p.click('#profboss');await p.waitForTimeout(500);
  ok(await p.isVisible('#probox')&&await p.isVisible('#pro-make'),где+'в Админ панели — блок «подарить pro»');
  ok(!err.length,где+'без ошибок'+(err.length?': '+err.join(' | '):''));
  await p.close();
 }
 /* 5. точка на кнопке и в строке «Программа», когда ждёт совет */
 {const p=await b.newPage({viewport:{width:390,height:844}});
  /* дома, а программа готовая для зала — профиль советует собрать свою */
  await M.поднять(p,{theme:'dark',
   me:{sex:'m',age:38,ht:178,bw:88.5,goal:'fat',wt:'down',gym:'muscle',level:'mid',place:'home',only:'all',lim:[],eq:['db']}});
  await p.waitForTimeout(600);
  const т=await p.$eval('#profbtn',e=>({attn:e.classList.contains('attn'),dot:getComputedStyle(e,'::before').content}));
  ok(т.attn&&т.dot!=='none',где0()+'на кнопке точка, когда в профиле ждёт совет');
  await p.click('#profbtn');await p.waitForTimeout(500);
  ok(await p.$eval('#pq-gym',e=>e.classList.contains('pqdot'))&&/есть совет/.test(await p.textContent('#pv-gym')),'и строка «Программа» говорит, где он');
  await p.close();}
}finally{await b.close();}
 function где0(){return 'dark 390: ';}
 if(bad){console.log('\n  провалов: '+bad);process.exit(1);}console.log('\n  test-profil-gruppy: всё зелёное');})();
