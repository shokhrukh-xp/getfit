'use strict';
/* 14.10, GF-05: анкета без подписки. Раньше «Собрать программу» упиралось в
   оплату с надписью «тренер недоступен». Его выбор: готовая программа —
   бесплатно, индивидуальная — Pro. */
const {chromium}=require('playwright'),M=require('./mock');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
const т=async(p,s)=>((await p.textContent(s).catch(()=>''))||'').replace(/\s+/g,' ').trim();
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const где=theme+' '+width+': ';
  const p=await b.newPage({viewport:{width,height:900}});const онб=[];
  p.on('request',r=>{if(/\/onboard/.test(r.url()))онб.push(1);});
  const err=await M.поднять(p,{theme,newbie:true,sub:'нет',wait:2500});
  await p.waitForTimeout(400);
  await M.шаги(p,{});   /* 14.10: по шагам — до «где и когда» */
  ok(/Подобрать программу/.test(await т(p,'#wz-go')),где+'кнопка без обещания сборки: '+await т(p,'#wz-go'));
  ok(/готовая программа под твои дни, бесплатно/.test(await т(p,'#pickhi')),где+'подсказка честная: '+await т(p,'#pickhi'));
  await p.click('#wz-go');await p.waitForTimeout(1500);
  ok(онб.length===0,где+'тренера не зовём — сборка по подписке');
  const сп=await p.evaluate(()=>({n:document.querySelectorAll('#picklist button[data-prof]').length,
    note:(document.querySelector('#picklist .wzfree')||{}).textContent||'',ош:document.body.innerText.includes('тренер недоступен')}));
  ok(сп.n>=2&&/бесплатно/.test(сп.note)&&/в Pro/.test(сп.note),где+'готовые программы с пояснением: '+сп.n+' · '+сп.note.slice(0,60));
  ok(!сп.ош,где+'нет «тренер недоступен»');
  await p.locator('#picklist .wzfree').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/gf-anketa-free-'+theme+'-'+width+'.png'});
  if(theme==='dark'&&width===390){
   await p.click('#wz-pro');await p.waitForTimeout(500);
   await p.screenshot({path:'/tmp/gf-anketa-pro.png'});
   ok(await p.$eval('#subm',e=>e.classList.contains('show')),'«Что такое Pro» открывает подписку');
   await p.click('#subclose');await p.waitForTimeout(400);
   await p.click('#picklist button[data-prof]');await p.waitForTimeout(1200);
   ok(!(await p.$eval('#picker',e=>e.classList.contains('show'))),'выбрал готовую — анкета закрылась');
  }
  ok(!err.length,где+'без ошибок'+(err.length?': '+err.join(' | '):''));
  await p.close();
 }
 /* с подпиской — как было */
 {const p=await b.newPage({viewport:{width:390,height:900}});await M.поднять(p,{theme:'dark',newbie:true,wait:2500});await p.waitForTimeout(300);
  await M.шаги(p,{});ok(/Собрать программу/.test(await т(p,'#wz-go')),'с подпиской — «Собрать программу», как было');await p.close();}
}finally{await b.close();}
console.log(bad?'ПРОВАЛОВ: '+bad:'всё ок');process.exit(bad?1:0);})();
