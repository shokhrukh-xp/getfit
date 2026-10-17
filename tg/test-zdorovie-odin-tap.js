'use strict';
// 17.10: multi здоровья обрабатывалась дважды; один тап — один saveMe.
// Считаем поколения уведомления сохранения: фоновые обновления веса тоже
// пишут /s, но не вызывают saveMe и не должны делать проверку случайной.
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;const ok=(x,t)=>{console.log((x?'ok ':'ПРОВАЛ ')+t);if(!x)bad++};
const ME={sex:'f',age:35,ht:170,bw:75,wt:'down',gym:'muscle',goal:'fat',only:'all',voice:'standard',med:{dia:'t2',at:'2026-10-17',bp:0,preg:0,eyes:0,feet:0,kid:0}};
(async()=>{const br=await chromium.launch();try{for(const theme of ['dark','light']){
 const p=await br.newPage({viewport:{width:320,height:844}});let writes=[];
 await M.поднять(p,{theme,me:ME,preserveReload:true,handleRoute:async r=>{if(new URL(r.request().url()).pathname!=='/s')return false;const b=JSON.parse(r.request().postData()||'{}');if(b.key==='me')writes.push(b.data.me);await r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});return true}});
 await p.click('#profbtn');await p.click('#zdtoggle');
 for(const [group,key]of [['more','bp'],['more','preg'],['osl','kid']]){
  const loc=p.locator('#zd-'+group+' [data-v="'+key+'"]');
  for(const value of [true,false,true]){const n=writes.length;const gen=await loc.evaluate(e=>e.closest('.pf').querySelector('.save-notice')?._gen||0);await loc.click();await p.waitForTimeout(180);ok(await loc.getAttribute('aria-pressed')===String(value),theme+' '+key+' тап → '+value);const nextGen=await loc.evaluate(e=>e.closest('.pf').querySelector('.save-notice')?._gen||0);ok(nextGen===gen+1,theme+' '+key+' saveMe ровно один раз: '+(nextGen-gen));ok(writes.length>=n+1,theme+' '+key+' запись отправлена на сервер');ok(writes.at(-1)?.med[key]===(value?1:0),theme+' '+key+' сервер получил выбор');}
 }
 const met=p.locator('#zd-met [data-v="1"]');const gen=await met.evaluate(e=>e.closest('.pf').querySelector('.save-notice')?._gen||0);await met.click();await p.waitForTimeout(180);ok(await met.getAttribute('aria-pressed')==='true'&&writes.at(-1)?.med.met===1,theme+' метформин переключается и сохраняется');ok(await met.evaluate(e=>(e.closest('.pf').querySelector('.save-notice')?._gen||0))===gen+1,theme+' метформин saveMe один раз');
 await p.reload();await p.waitForTimeout(900);await p.click('#profbtn');await p.click('#zdtoggle');ok(await p.locator('#zd-met [data-v="1"]').getAttribute('aria-pressed')==='true',theme+' метформин сохранён после перезагрузки');for(const [group,key]of [['more','bp'],['more','preg'],['osl','kid']])ok(await p.locator('#zd-'+group+' [data-v="'+key+'"]').getAttribute('aria-pressed')==='true',theme+' '+key+' сохранён после перезагрузки');await p.close();
 }
 const p=await br.newPage({viewport:{width:390,height:844}});await M.поднять(p,{theme:'dark',newbie:true});await M.шаги(p,{до:'health'});
 // click() DOM не фокусирует кнопку: ловим лишнюю перерисовку WebView.
 await p.locator('#wz-dia [data-v="t2"]').click();const met=p.locator('#wz-met [data-v="1"]');await met.evaluate(e=>e.click());ok(await met.getAttribute('aria-pressed')==='true','анкета: метформин отмечается без фокуса');
 const bp=p.locator('#wz-more [data-v="bp"]');await bp.evaluate(e=>e.click());ok(await bp.getAttribute('aria-pressed')==='true','анкета: tap без фокуса сохраняет отметку');await bp.evaluate(e=>e.click());ok(await bp.getAttribute('aria-pressed')==='false','анкета: второй tap снимает отметку');await bp.click();await p.click('#wz-health-go');await p.click('#wz-prev');ok(await p.locator('#wz-more [data-v="bp"]').getAttribute('aria-pressed')==='true','анкета: выбор сохранён при переходе вперёд-назад');await p.close();
}finally{await br.close()}if(bad)process.exitCode=1;else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')})().catch(e=>{console.error(e);process.exitCode=1});
