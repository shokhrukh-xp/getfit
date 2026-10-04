'use strict';
// Только подставные данные. GF_PORT — порт локального стенда.
const {chromium}=require('playwright'),M=require('./mock'),fs=require('fs'),path=require('path');
const out=process.argv[2];if(!out)throw Error('Укажите папку снимков');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch();try{for(const theme of ['light','dark'])for(const width of [390,320]){
 const p=await b.newPage({viewport:{width,height:844},deviceScaleFactor:2});
 const shot=async(name,fullPage=true)=>{await p.waitForTimeout(350);await p.screenshot({path:path.join(out,`${name}-${theme}-${width}.png`),fullPage});console.log(name,theme,width)};
 await M.поднять(p,{theme,page:'gym',hist:M.журнал()});await shot('gym-day');
 await p.locator('#list .exrow').first().click();await p.waitForTimeout(600);await p.locator('.card.exact').scrollIntoViewIfNeeded();await shot('gym-active');
 await p.locator('.setrow .ok').first().click();await shot('gym-done-timer',false);
 await p.locator('#tskip').click();await p.locator('.card.exact .allb').click();await p.locator('#finish').click();await M.ответитьДлительность(p,45);await p.locator('#finish.ok').waitFor();await p.locator('#finish').scrollIntoViewIfNeeded();await shot('gym-finish',false);
 await p.close();
 for(const name of ['log','ref']){const q=await b.newPage({viewport:{width,height:844},deviceScaleFactor:2});await M.поднять(q,{theme,page:name,hist:M.журнал()});await q.waitForTimeout(400);await q.screenshot({path:path.join(out,`${name}-${theme}-${width}.png`),fullPage:name==='log'});
 if(name==='log'){await q.locator('.bmfig').last().scrollIntoViewIfNeeded();await q.screenshot({path:path.join(out,`log-map-${theme}-${width}.png`)});}
 if(name==='ref'){await q.locator('.catgrp h4').first().evaluate(e=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY+45));await q.screenshot({path:path.join(out,`ref-scroll-${theme}-${width}.png`)});await q.locator('#pcatsearch').fill('жим');await q.waitForTimeout(500);await q.evaluate(()=>window.scrollTo(0,0));await q.screenshot({path:path.join(out,`ref-search-${theme}-${width}.png`)});}await q.close();}
}}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
