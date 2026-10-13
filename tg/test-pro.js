'use strict';
/* 13.10: Pro-ссылки владельца. Его слова: «чтобы только я мог делиться и
   Pro-доступом, и обычным со своего профиля». Его выборы: одна ссылка на
   N человек, срок при создании (месяц / 3 месяца / навсегда). */
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const ME={sex:'m',age:34,ht:178,bw:88,goal:'fat',wt:'down',gym:'muscle',level:'mid',place:'gym',only:'all',lim:[],eq:[]};
const ПРО=[{code:'abc123xyz0',uses:2,used:1,days:30,кто:['Фируз'],link:'https://t.me/GetFit_MyBot?start=p_abc123xyz0'},
           {code:'zzz',uses:1,used:1,days:0,кто:['Инна'],link:'x'}];
(async()=>{const b=await chromium.launch();try{
 /* 1. обычный человек блока не видит */
 {const p=await b.newPage({viewport:{width:390,height:900}});
  const err=await M.поднять(p,{me:ME});await p.waitForTimeout(300);
  await p.click('#profbtn');await p.waitForTimeout(400);
  ok(await p.$eval('#probox',e=>e.hidden),'обычный человек: блока Pro нет');
  ok(await p.$eval('#reflink',e=>!!e.offsetParent),'обычная ссылка у него на месте');
  ok(!err.length,'без ошибок'+(err.length?': '+err.join(' | '):''));await p.close();}
 {const p=await b.newPage({viewport:{width:320,height:900}});
  await M.поднять(p,{me:ME,admin:{про:[],промо:[]}});
  await p.click('#profbtn');await p.click('#profboss');await p.waitForTimeout(500);
  ok(await p.locator('.adhistory,.adstop,#adgrant-note').count()===0,'пустой список: нет истории и лишних действий');
  ok(await p.locator('#adm-add').isVisible(),'новый код по-прежнему можно создать');
  await p.close();}
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const где=theme+' '+width+': ',o={me:ME,theme,admin:{про:ПРО,промо:[{code:'FIT2026',uses:1,used:1},{code:'ACTIVE',uses:3,used:1}]}};
  const p=await b.newPage({viewport:{width,height:900}});const ушлоMe=[];
  p.on('request',r=>{try{const u=new URL(r.url());if(u.pathname==='/s'&&JSON.parse(r.postData()||'{}').key==='me')ушлоMe.push(1);}catch(e){}});
  const err=await M.поднять(p,o);await p.waitForTimeout(400);
  await p.click('#profbtn');await p.waitForTimeout(500);
  const н=await p.evaluate(()=>({вид:!document.getElementById('probox').hidden,
    срок:(document.querySelector('#pro-days button[aria-pressed="true"]')||{}).textContent,
    n:(document.querySelector('#pro-n button[aria-pressed="true"]')||{}).textContent,
    вбок:document.documentElement.scrollWidth>innerWidth}));
  ok(н.вид&&н.срок==='навсегда'&&н.n==='1',где+'владелец видит блок, по умолчанию навсегда и 1: '+н.срок+' / '+н.n);
  ok(!н.вбок,где+'страница не ездит вбок');
  const до=ушлоMe.length;
  await p.click('#pro-days button[data-v="30"]');await p.click('#pro-n button[data-v="2"]');await p.waitForTimeout(400);
  ok(ушлоMe.length===до,где+'выбор срока не трогает профиль');
  await p.click('#pro-make');await p.waitForTimeout(500);
  const з=(o.proLinks||[]).slice(-1)[0]||{};
  ok(з.uses===2&&з.days===30,где+'на сервер ушло: 2 человека, 30 дней');
  const в=await p.evaluate(()=>({л:document.getElementById('prolink').value,вид:!document.getElementById('pro-out').hidden,
    с:document.getElementById('pro-sum').textContent}));
  ok(в.вид&&/start=p_abc123xyz0/.test(в.л),где+'ссылка показана: '+в.л);
  ok(/Ссылка на 2 человека, Pro на месяц/.test(в.с),где+'итог: '+в.с);
  await p.locator('#probox').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/gf-pro-'+theme+'-'+width+'.png'});
  await p.click('#profboss');await p.waitForTimeout(500);
  ok(!await p.locator('.adhistory').getAttribute('open'),где+'история свёрнута');
  ok(!await p.getByText('FIT2026',{exact:true}).isVisible(),где+'использованный код скрыт');
  ok(await p.locator('[data-prodrop="zzz"], [data-pdrop="FIT2026"]').count()===0,где+'у использованных нет отключения');
  ok(await p.locator('.adstop').count()===2,где+'две действующие записи можно отключить');
  ok(await p.locator('#adgrant-note').innerText().then(t=>t.includes('Выданный доступ сохранится')),где+'последствия объяснены');
  await p.locator('.adhistory summary').click();
  ok(await p.getByText('FIT2026',{exact:true}).isVisible()&&await p.getByText('1 из 1 · Инна',{exact:true}).isVisible(),где+'история хранит код и получателя ссылки');
  ok(await p.locator('.adstop').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.right<=innerWidth;})),где+'кнопки помещаются и доступны касанию');
  await p.locator('.adhistory').scrollIntoViewIfNeeded();
  await p.screenshot({path:'/tmp/gf-history-'+theme+'-'+width+'.png'});
  ok(!err.length,где+'без ошибок'+(err.length?': '+err.join(' | '):''));
  if(theme==='light'&&width===390){
   await p.waitForTimeout(100);
   const а=await p.evaluate(()=>document.body.innerText);
   ok(/pro-ссылки/.test(а)&&/1 из 2 · Фируз/.test(а)&&/Отключить/.test(а),'в админ-панели видно, кто вошёл');
   const promoRequest=p.waitForRequest(r=>new URL(r.url()).pathname==='/admin/promo');
   await p.click('[data-pdrop="ACTIVE"]');
   const payload=JSON.parse((await promoRequest).postData());
   ok(payload.code==='ACTIVE'&&payload.drop===1,'Отключить код: прежний контракт сервера');
   await p.waitForTimeout(500);
   await p.click('[data-prodrop="abc123xyz0"]');await p.waitForTimeout(500);
   ok((o.proLinks||[]).some(x=>x.drop==='abc123xyz0'),'Отключить отправляет прежний запрос без отзыва доступа');
   await p.screenshot({path:'/tmp/gf-pro-admin.png',fullPage:true});

  }
  await p.close();
 }
}finally{await b.close();}
console.log(bad?'ПРОВАЛОВ: '+bad:'всё ок');process.exit(bad?1:0);})();
