'use strict';
/* Серверные ограничения представлены в браузере до сохранения, история не теряется. */
const {chromium}=require('playwright'),assert=require('assert/strict'),M=require('./mock');
(async()=>{const br=await chromium.launch();try{
 for(const fat of [5,12]){
 const p=await br.newPage({viewport:{width:390,height:844}});const o={me:{sex:'m',age:34,ht:178,bw:85.8,only:'all'},meas:[{date:M.TODAY,w:85.8,fat:26.3}],goal:null};const errors=await M.поднять(p,o);
 await p.click('#coachnav');await p.click('#goalchatopen');
 const wait=()=>p.waitForFunction(()=>document.getElementById('goalconversation').dataset.state!=='loading'&&document.getElementById('goalconversation').getAttribute('aria-busy')==='false');
 const answer=async value=>{await wait();await p.click('#goalconversation [data-value="'+value+'"]');await wait();};
 /* 28.10: «свои цифры» — своими словами под популярными целями, отдельной кнопки нет */
 const своими=async t=>{await wait();await p.fill('#gtalk-form textarea[name="text"]',t);await p.click('#gtalk-form button[type="submit"]');await wait();};
 await своими('Свои цифры');await answer('clear');await p.fill('#gtalk-form [name="target"]','75');await p.fill('#gtalk-form [name="fat"]',String(fat));await p.selectOption('#gtalk-form [name="muscle"]','develop');await p.click('#gtalk-form [type="submit"]');await answer('scales');await answer('new');await answer('regular');await answer('training');await answer('flexible');
 assert.equal(o.goal,null);const requested=p.locator('[data-gta="select"][data-option="requested"]');assert.equal(await requested.count(),fat===5?0:1);if(fat===5)assert.match(await p.textContent('#goalconversation'),/Экстремальную/);
 else{await requested.click();await wait();assert.equal(o.goal,null);await p.click('[data-gta="confirm"]');await wait();assert.equal(o.goal.body.target,75);assert.equal(o.goal.body.fat,12);assert.equal(o.goal.body.muscle,'develop');assert.equal((o.vizAsked?.render||[]).length,0);}
 assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS конкретные параметры обсуждаются, 5% не предлагается, 75/12 только после подтверждения');
 }finally{await br.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
