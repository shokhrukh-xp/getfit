'use strict';
/* 27.10: вся группа ног (включая дополнительные мышцы), фото-оборудование
   в каталоге и выборе, пересечение фильтров, полный список и сброс. */
const {chromium}=require('playwright'),M=require('./mock'),assert=require('node:assert/strict'),C=require('../catalog.json');
const legs=['quadriceps','hamstrings','glutes','calves','abductors','adductors','tibialis'];
const leg=C.ex.filter(x=>[x.m,x.m2,...(x.sm||[])].some(m=>legs.includes(m)));
(async()=>{const br=await chromium.launch();try{
for(const theme of ['light','dark'])for(const width of [320,390]){
 const p=await br.newPage({viewport:{width,height:844}}),errors=await M.поднять(p,{theme,page:'gym'});
 await p.click('.l1 button[data-page="gym"]');await p.click('#p-gym [data-zseg="ref"]');await p.waitForSelector('#pcatbody .catitem');
 await p.click('#pcatfbtn');await p.click('#pcatfilters [data-pickgroup="legs"]');
 assert.match(await p.locator('#pcatfbtn').innerText(),/Ноги/);
 assert.match(await p.locator('#pcatbody>.catcount').innerText(),new RegExp('^'+leg.length+' '));
 await p.click('#pcatbody [data-catall]');assert.equal(await p.locator('#pcatbody .catitem').count(),leg.length);
 const reverse=C.ex.findIndex(x=>x.i==='Crossover_Reverse_Lunge');assert.equal(await p.locator('#pcatbody .catitem[data-i="'+reverse+'"]').count(),1);
 assert.match(await p.locator('#pcatbody .catitem[data-i="'+reverse+'"]').innerText(),/дополнительные мышцы/);
 // Основные движения идут выше тех, где ноги только помогают.
 assert.ok(await p.locator('#pcatbody .catitem').first().evaluate(e=>!e.textContent.includes('дополнительные мышцы')));
 await p.click('#pcatfilters details.catgear summary');await p.click('#pcatfilters [data-geartab="machines"]');
 const tile=p.locator('#pcatfilters [data-gear="m:legpress"]');assert.ok(await tile.isVisible());assert.ok(await tile.locator('img').count());
 assert.ok(await p.locator('#pcatfilters .catgeartile').evaluateAll(bs=>bs.every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.right<=innerWidth+1})));
 await tile.click();assert.equal(await p.locator('#pcatfilters').isVisible(),false);assert.match(await p.locator('#pcatfbtn').innerText(),/Жим ногами/);
 if(await p.locator('#pcatbody [data-catall]').count())await p.click('#pcatbody [data-catall]');
 const ids=await p.locator('#pcatbody .catitem').evaluateAll(rs=>rs.map(r=>+r.dataset.i));
 assert.ok(ids.length>0);assert.ok(ids.every(i=>C.ex[i].q==='machine'&&/leg.press/i.test(C.ex[i].i+' '+C.ex[i].e)&&!/smith/i.test(C.ex[i].i)));
 await p.click('#pcatreset');assert.ok(await p.locator('#pcatbody .catgrp').count());assert.doesNotMatch(await p.locator('#pcatfbtn').innerText(),/Ноги|Жим ногами/);
 await p.click('#pcatfbtn');await p.click('#pcatfilters details.catgear summary');await p.click('#pcatfilters [data-geartab="machines"]');
 await p.click('#pcatfilters [data-gear="m:bike"]');assert.equal(await p.locator('#pcatbody .catitem').count(),1,'велотренажёр должен оставаться в выдаче');
 await p.click('#p-ref [data-zseg="gym"]');await p.click('#p-gym [data-zseg="ref"]');assert.equal(await p.locator('#pcatbody .catitem').count(),1,'велотренажёр должен оставаться в выдаче');await p.click('#pcatreset');
 // Тот же визуальный фильтр при добавлении упражнения в день.
 await p.click('#p-ref [data-zseg="gym"]');await p.click('#addex');await p.waitForSelector('#catalog .catitem');
 await p.click('#catalog [data-pickgroup="legs"]');await p.click('#catalog [data-catall]');assert.equal(await p.locator('#catalog .catitem').count(),leg.length);
 await p.click('#catalog details.catgear summary');await p.click('#catalog [data-geartab="machines"]');
 await p.locator('#catalog [data-gear="m:legcurl"] img').first().scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>[...document.querySelectorAll('#catalog [data-gear="m:legcurl"] img')].some(im=>im.complete&&im.naturalWidth));
 await p.locator('#catalog .modalbox').evaluate(e=>e.scrollTop=0);
 const colors=await p.locator('#catalog [data-geartab="machines"]').evaluate(b=>{const c=getComputedStyle(b);return [c.color,c.backgroundColor]});
 const lum=c=>{let [r,g,b]=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};const [a,b]=colors.map(lum);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,colors.join(' / '));
 await p.screenshot({path:'/tmp/catalog-equipment-'+theme+'-'+width+'.png'});
 await p.click('#catalog [data-gear="m:legcurl"]');
 const curls=await p.locator('#catalog .catitem').evaluateAll(rs=>rs.map(r=>+r.dataset.i));assert.ok(curls.length>0);assert.ok(curls.every(i=>C.ex[i].q==='machine'&&/leg.curl/i.test(C.ex[i].i)));
 await p.locator('#catalog .catpick').first().click();assert.equal(await p.locator('#catalog').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS ноги '+leg.length+', фото-оборудование, конкретные станки, пересечение, сброс, выбор — '+theme+' '+width);await p.close();
}
}finally{await br.close();}})().catch(e=>{console.error(e);process.exitCode=1});
