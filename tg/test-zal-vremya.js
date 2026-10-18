'use strict';
/* 18.10: «Обычно хожу» в «Мои дни» и в сборке программы. Его слова: «нужно
   уточнять время тренировок, когда обычно ходят в зал… и нужно, чтобы это
   учитывалось тренером». Его выбор: время — само по записям, здесь правка. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
(async()=>{const b=await chromium.launch();try{
 for(const [width,theme] of [[320,'dark'],[390,'light']]){
  const где=width+' '+theme+': ';
  const p=await b.newPage({viewport:{width,height:844}});
  const o=opts(theme), записи=[];
  o.handleRoute=async route=>{
    const u=new URL(route.request().url());
    if(u.pathname==='/gym/when'){ await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,when:'auto',auto:{src:'auto',вид:'окно',label:'обычно 7–8',спросить:545}})}); return true; }
    if(u.pathname==='/s'){ const bd=JSON.parse(route.request().postData()||'{}'); if(bd.key==='me') записи.push(bd.data); }
    return false;
  };
  const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await M.поднять(p,o);await p.waitForTimeout(400);
  await p.click('.l1 [data-page="gym"]');await p.click('#schedbtn');await p.waitForTimeout(400);
  const кн=await p.$$eval('#schedwhen button',x=>x.map(b=>b.textContent+':'+b.getAttribute('aria-pressed')));
  ok(кн.join(',')==='По записям:true,Утром:false,Днём:false,Вечером:false,По-разному:false',где+'пять ответов, по умолчанию «По записям»: '+кн);
  ok(/По записям — обычно 7–8/.test(await p.textContent('#schedwhenh')),где+'подсказка показывает время из записей');
  const ширина=await p.$$eval('#schedwhen button',x=>x.every(b=>b.scrollWidth<=b.clientWidth+1));
  ok(ширина,где+'подписи кнопок не обрезаны');
  const гориз=await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth);
  ok(гориз,где+'без горизонтальной прокрутки');
  await p.click('#schedwhen button[data-v="morning"]');
  await p.waitForFunction(()=>document.querySelector('#schedm .save-notice')?.textContent==='Сохранено',null,{timeout:5000}).catch(()=>{});
  ok(записи.length&&записи[записи.length-1].me.when==='morning',где+'выбор ушёл в профиль (state/me): '+JSON.stringify(записи.map(x=>x.me&&x.me.when)));
  ok(/до 11:00 записи нет/.test(await p.textContent('#schedwhenh')),где+'подсказка для «Утром»');
  ok(await p.getAttribute('#schedwhen button[data-v="morning"]','aria-pressed')==='true',где+'«Утром» нажато');
  await p.screenshot({path:'/tmp/getfit-zal-vremya-'+width+'-'+theme+'.png'});
  await p.click('#schedclose');await p.waitForTimeout(200);
  /* сборка программы: тот же вопрос рядом с днями */
  await p.click('#profbtn');await p.click('#pq-gym');await p.click('#progedit');await p.waitForTimeout(400);
  ok(await p.getAttribute('#sb-when button[data-v="morning"]','aria-pressed')==='true',где+'в сборке программы выбор тот же');
  await p.click('#sb-when button[data-v="evening"]');
  ok(await p.getAttribute('#sb-when button[data-v="evening"]','aria-pressed')==='true'&&await p.getAttribute('#sb-when button[data-v="morning"]','aria-pressed')==='false',где+'в сборке — один ответ');
  ok(!errs.length,где+'ошибок страницы нет '+errs.join('; '));
  await p.close();
 }
}finally{await b.close();}
 console.log(bad?'ПРОВАЛОВ: '+bad:'ВСЁ ХОРОШО');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
