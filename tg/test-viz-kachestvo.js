'use strict';
/* 26.10: «между до и после почти нет разницы». Настоящая маска, не заглушка;
   слабая генерация не заменяет сохранённое фото и не называется целью. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {chromium}=require('playwright'),M=require('./mock');
const src=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const part=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const limits=part('function vizДопуск(', 'function vizBtn(');
(async()=>{
 const nodes={};const node=id=>nodes[id]||(nodes[id]={disabled:false,textContent:'',hidden:false,src:'saved',classList:{remove(){}}});
 const calls=[],ctx=vm.createContext({console,Date,Math,Promise,Array,Object,Error,isFinite,VIZ:{calc:{w1:75,dl:0,отношение:.87},st:{},busy:false},
   document:{getElementById:node,querySelectorAll:()=>[]},vizSay:(id,t)=>{node(id).textContent=t;},vizЖдать(){},haptic(){},
   vizОбразец:async()=> 'template',vizЗаказ:async(...a)=>{calls.push(a);return {k:'bad'+calls.length,calc:{w1:75,dl:0,отношение:.87},left:5};},
   vizДовести:async()=>null,vizПроверка:async()=>({ok:false,отн:.999,d:.129}),fPost:()=>{throw Error('плохой результат нельзя сохранять');}});
 vm.runInContext(part('function vizБлокировать(', 'function vizУдалить('),ctx);
 ctx.vizGo();while(ctx.VIZ.busy) await new Promise(r=>setTimeout(r,1));
 assert.equal(calls.length,3);assert.equal(node('viznew').src,'saved');assert.match(node('vizmsg').textContent,/не сохранён как цель/);
 assert.ok(calls.every(c=>c[6]===calls[0][6]));
 const old=calls[0][6];ctx.vizGo();while(ctx.VIZ.busy) await new Promise(r=>setTimeout(r,1));assert.notEqual(calls[3][6],old);
 console.log('PASS слабый результат: 3 попытки, прежнее фото остаётся, следующий запуск новый');
 const br=await chromium.launch();
 try{
  const page=await br.newPage({viewport:{width:390,height:844}});await M.поднять(page,{page:'home'});
  const orig='data:image/jpeg;base64,'+fs.readFileSync(path.join(__dirname,'fixtures/viz-0-ishod.jpg')).toString('base64');
  const code=limits+part('var VIZMP=', 'function vizСброс(')+part('function vizПластика(', '/* картинка: проверенный образец');
  await page.evaluate(({code,orig})=>{
   window.quality=new Function('orig', 'var VIZ={st:{photo:1},обр:null};'+code+';vizURL=function(){return Promise.resolve(orig)};return {sample:vizОбразец,correct:function(s,t){return vizКартинка(s).then(function(im){return vizКалибровать(im,t)})},measure:function(s){return vizКартинка(s).then(vizМерить)},ok:vizСовпало};')(orig);
  },{code,orig});
  for(const ratio of (process.env.VIZ_EXTRA ? [.95,.87,+process.env.VIZ_EXTRA] : [.95,.87])){
   const result=await page.evaluate(async({orig,ratio})=>{
    const before=await quality.measure(orig),b64=await quality.sample({отношение:ratio});
    if(!b64)return {failed:true};const after=await quality.measure('data:image/jpeg;base64,'+b64),got=after.талия/before.талия;
    return {got,ok:quality.ok(ratio,got),b64};
   },{orig,ratio});
   assert.ok(!result.failed,'образец должен измеряться');assert.ok(result.ok,JSON.stringify({ratio,got:result.got}));
   console.log('PASS калиброванный образец: цель '+ratio+', измерено '+result.got.toFixed(4));
   if(process.env.VIZ_ARTIFACTS){fs.mkdirSync(process.env.VIZ_ARTIFACTS,{recursive:true});fs.writeFileSync(path.join(process.env.VIZ_ARTIFACTS,'target-'+ratio+'.jpg'),Buffer.from(result.b64,'base64'));}
  }
  for(const file of (process.env.VIZ_GENERATED||'').split(',').filter(Boolean)){
   const image='data:image/jpeg;base64,'+fs.readFileSync(file).toString('base64');
   const result=await page.evaluate(async({orig,image})=>{const a=await quality.measure(orig),b=await quality.measure(image);return {before:a,after:b,ratio:b.талия/a.талия,ok:quality.ok(.871,b.талия/a.талия)};},{orig,image});
   const fixed=await page.evaluate(async({image,ratio})=>{const b64=await quality.correct(image,.871/ratio);if(!b64)return null;return {b64,m:await quality.measure('data:image/jpeg;base64,'+b64)};},{image,ratio:result.ratio});
   assert.ok(fixed,'реальный результат должен корректироваться');
   result.finalRatio=fixed.m.талия/result.before.талия;
   assert.ok(Math.abs(result.finalRatio-.871)<=.02,'итог должен совпасть с целью: '+result.finalRatio);
   if(process.env.VIZ_ARTIFACTS)fs.writeFileSync(path.join(process.env.VIZ_ARTIFACTS,'final-'+path.basename(file)),Buffer.from(fixed.b64,'base64'));
   console.log('REAL GENERATION',JSON.stringify(result));
   if(process.env.VIZ_ARTIFACTS)fs.writeFileSync(path.join(process.env.VIZ_ARTIFACTS,'measurement-'+path.basename(file)+'.json'),JSON.stringify(result));
  }
  await page.close();
 }finally{await br.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
