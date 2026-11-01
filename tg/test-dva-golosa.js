'use strict';
/* 01.11, его выбор «A: Тренер — два голоса» и «Клиенты» у специалиста.
   Клиент: кнопка «Тренер» с числом, «От …» на «Сегодня», лента с перепиской, «Кому», карточка «Передать».
   Специалист: кнопка «Клиенты» — кабинет; карточка со сводки, без листа поверх листа; «Мой ИИ-тренер». */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
const bounds=require('./viewport-check');
const src=fs.readFileSync(path.join(__dirname,'test-roli-ekrany.js'),'utf8');
const ВЕР='2026-10-29.1';
const ИМЕНА={food:'дневник еды',food_photo:'фото еды',gym:'тренировки',body:'вес и замеры',body_photo:'фото тела',labs:'анализы',health:'здоровье и ограничения',cycle:'цикл'};
const МОЖНО={trainer:['gym','body','body_photo','food','health'],nutri:['food','food_photo','body','body_photo','labs','health','cycle']};
const i=src.indexOf('function сервер('),j=src.indexOf('\n}\n',i)+3;
const сервер=eval('('+src.slice(i,j).replace(/^function сервер/,'function')+')');
(async()=>{const b=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390]){
 const tag=theme+' '+width;
 /* клиент */
 {const s=сервер({my:[{id:'l1',kind:'trainer',name:'Тимур Ахмедов',proStatus:'ok',cats:['gym','body'],unread:2}],
    msgs:[{id:1,me:false,text:'Как прошла тренировка? Колено не беспокоит?',at:Date.now()-3*3600e3,seen:true}]});
  const o=opts(theme);o.features=['roli'];o.roli=s.обработчик;
  const p=await b.newPage({viewport:{width,height:844}});const err=await M.поднять(p,o);
  await p.waitForSelector('#rolhome:not([hidden])',{timeout:6000});
  assert.match(await p.textContent('#rolhome'),/Тимур Ахмедов · тренер.*2 новых сообщения/,'«От …» на «Сегодня» '+tag);
  assert.equal((await p.textContent('#coachnavt')).trim(),'Тренер');assert.equal((await p.textContent('#coachnavn')).trim(),'2','число непрочитанных на кнопке');
  await p.click('#rolhome [data-dg="open"]');await p.waitForSelector('#chatlog .msg.pro',{timeout:6000});
  assert.match(await p.textContent('#coachpro'),/Тимур Ахмедов ведёт тренировки.*ИИ помогает между встречами/);
  assert.equal(await p.getAttribute('#ckomu [data-komu="l1"]','aria-pressed'),'true','открыли от тренера — пишем ему');
  assert.match(await p.textContent('#chatlog .msg.pro'),/Как прошла тренировка/);
  await p.fill('#ctext','Чуть ноет на приседе');await p.click('#csend');await p.waitForTimeout(600);
  assert.deepEqual(s.написано&&{link:s.написано.link,text:s.написано.text},{link:'l1',text:'Чуть ноет на приседе'},'ушло специалисту, а не ИИ');
  assert.ok(await p.locator('#chatlog .msg.me.topro').count()>=1,'своё сообщение специалисту — в ленте');
  await p.click('#ckomu [data-komu=""]');assert.equal(await p.isVisible('#cphoto'),true,'ИИ — снова фото и штрихкод');
  assert.deepEqual(await bounds(p),[],'без вылезания '+tag);
  assert.deepEqual(err,[]);await p.close();}
 /* ИИ: «Передать тренеру» */
 {const s=сервер({my:[{id:'l1',kind:'trainer',name:'Тимур Ахмедов',proStatus:'ok',cats:['gym','body']}]});
  const o=opts(theme);o.features=['roli'];o.roli=s.обработчик;
  o.onCoach=()=>({ok:true,reply:'Программу меняет Тимур — передать ему?',changes:[{what:'pro',kind:'trainer',link:'l1',name:'Тимур Ахмедов',text:'На приседе ноет колено. Можно заменить присед?'}]});
  const p=await b.newPage({viewport:{width,height:844}});const err=await M.поднять(p,o);await p.waitForTimeout(800);
  await p.click('#coachnav');await p.waitForTimeout(500);await p.fill('#ctext','колено ноет');await p.click('#csend');
  await p.waitForSelector('#chatlog .dgpro',{timeout:8000});
  assert.match(await p.textContent('#chatlog .dgpro'),/Передать тренеру \(Тимур\)\?.*На приседе ноет колено/);
  await p.click('#chatlog [data-reco2="prosend"]');await p.waitForTimeout(600);
  assert.equal(s.написано&&s.написано.text,'На приседе ноет колено. Можно заменить присед?','«Передать» — сообщение специалисту');
  assert.match(await p.textContent('#chatlog .dgpro'),/Передано тренеру/);
  assert.deepEqual(err,[]);await p.close();}
 /* специалист */
 {const s=сервер({pro:[{kind:'trainer',name:'Тимур Ахмедов',status:'ok',code:'TSTRNR01',link:'https://t.me/WellbolTestBot?start=s_TSTRNR01'}],
    clients:[{id:'l1',kind:'trainer',client:'777',name:'Карина',cats:['gym','body'],unread:1}]});
  const h=s.обработчик;s.обработчик=async(p,u,т,м)=>p.endsWith('/roli/summary')?{status:200,body:{ok:true,kind:'trainer',open:['gym','body'],gym:{week:2,last:{date:'2026-10-30',name:'Ноги'}},body:{now:79.2,before:80,last:'2026-10-31'},sent:{at:Date.now()-864e5,taken:false,name:'Сила'},unread:1}}:h(p,u,т,м);
  const o=opts(theme);o.features=['roli'];o.roli=s.обработчик;
  const p=await b.newPage({viewport:{width,height:844}});const err=await M.поднять(p,o);await p.waitForTimeout(900);
  assert.equal((await p.textContent('#coachnavt')).trim(),'Клиенты','специалисту кнопка внизу — «Клиенты»');
  await p.click('#coachnav');await p.waitForSelector('#rolpro [data-rol="card"]',{timeout:6000});
  assert.equal(await p.evaluate(()=>document.body.classList.contains('coach')),false,'не ИИ-чат, а кабинет');
  await p.waitForTimeout(400);await p.click('#rolpro [data-rol="card"]');await p.waitForFunction(()=>/Тренировки: 2 за 7 дней/.test(document.getElementById('rolcbody').textContent),null,{timeout:6000});
  const св=await p.textContent('#rolcbody');
  assert.match(св,/−0,8 за 2 недели/);assert.match(св,/ждёт решения клиента/);assert.match(св,/Ждёт ответа: 1/);
  assert.equal(await p.evaluate(()=>document.getElementById('profm').classList.contains('show')),false,'карточка не поверх кабинета');
  await p.click('#rolcbody [data-dgtab="chat"]');await p.waitForSelector('#rolmsgs',{timeout:4000});
  await p.click('#rolcclose');await p.waitForTimeout(500);
  assert.ok(await p.isVisible('#rolpro'),'закрыли карточку — снова кабинет');
  await p.click('[data-dg="myai"]');await p.waitForTimeout(500);
  assert.ok(await p.evaluate(()=>document.body.classList.contains('coach')),'«Мой ИИ-тренер» — свой чат');
  assert.deepEqual(err,[]);await p.close();}
 console.log('PASS два голоса: «Тренер» клиента и «Клиенты» специалиста — '+tag);
}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
