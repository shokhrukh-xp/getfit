'use strict';
/* 27.10: повторная сборка из профиля — те же вкладки и фото, что у знакомства.
   Переключение дня не принимает программу и не перерисовывает скрытую анкету. */
const {chromium}=require('playwright'),M=require('./mock'),assert=require('node:assert/strict');
const PROG=require('./fixtures/prog-3dnya.json');
(async()=>{const br=await chromium.launch();try{
 for(const theme of ['light','dark'])for(const width of [320,390]){
  const p=await br.newPage({viewport:{width,height:844}});let calls=0;
  await p.addInitScript(()=>{const d=JSON.stringify({2:1,4:1,6:1});localStorage.setItem('shp_v1_shp_sched',d);localStorage.setItem('shp_v1_ai_sched',d);localStorage.setItem('shp_v1_sched_any',d);});
  const errors=await M.поднять(p,{theme,page:'gym',me:{sex:'m',age:35,ht:178,bw:85,wt:'down',gym:'muscle',level:'mid',place:'gym',only:'all'},profile:'ai',prog:{...PROG,name:'Прежняя программа'},rbo:{stamp:'new-preview',why:'Цель изменилась'},onAi:()=>{calls++;return {ok:true,prog:PROG};}});
  const build=async()=>{await p.click('#profbtn');await p.click('#pq-gym');await p.click('#recobox [data-rb="go"]');};
  const saved=()=>p.evaluate(()=>localStorage.getItem('shp_v1_ai_prog'));
  await build();
  await p.waitForSelector('#aibox .aiex',{timeout:8000}).catch(async e=>{console.log('STATE',await p.locator('#aistate').textContent(),'BOX',await p.locator('#aibox').innerHTML(),'ERRORS',errors);throw e;});
  const oldProfile=await saved();
  assert.equal(calls,1);assert.equal(await p.locator('#aibox .aitabs button').count(),3);
  assert.match(await p.locator('#aibox .aitabs button').first().innerText(),/День 1\s+вт/);
  assert.equal(await p.locator('#aibox .aiex').count(),7);
  assert.ok(await p.locator('#aibox .aiex').evaluateAll(rs=>rs.every(r=>/img\/t\//.test(r.querySelector('img')?.getAttribute('src')||''))));
  assert.match(await p.locator('#aibox .aiex').first().innerText(),/Жим ногами/);
  const fit=await p.locator('#aibox .aitabs button').evaluateAll(bs=>bs.every(b=>{let r=b.getBoundingClientRect();return r.height>=44&&r.right<=innerWidth}));assert.ok(fit);
  await p.click('#aibox [data-aitab="1"]');
  assert.match(await p.locator('#aibox .aiex').first().innerText(),/Присед/);
  assert.equal(await p.locator('#aibox [data-aitab="1"]').getAttribute('aria-selected'),'true');
  assert.equal(await saved(),oldProfile);
  assert.ok(await p.locator('#aiapply').isVisible());assert.ok(await p.locator('#aidrop').isVisible());
  assert.equal(await p.evaluate(()=>document.activeElement?.dataset.aitab),'1');
  await p.locator('#aibox').screenshot({path:'/tmp/program-preview-'+theme+'-'+width+'.png'});
  await p.click('#aidrop');assert.equal(await p.locator('#aibox').innerText(),'');assert.equal(await saved(),oldProfile);
  await p.reload();await build();await p.waitForSelector('#aibox .aiex');
  assert.equal(await p.locator('#aibox [data-aitab="0"]').getAttribute('aria-selected'),'true');
  await p.click('#aiapply');assert.equal(JSON.parse(await saved()).name,PROG.name);
  assert.deepEqual(errors,[]);console.log('PASS повторная сборка: фото, дни, переключение, отказ, применение — '+theme+' '+width);await p.close();
 }
}finally{await br.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
