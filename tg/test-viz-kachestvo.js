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
 const calls=[],ctx=vm.createContext({console,Date,Math,Promise,Array,Object,Error,isFinite,BODYGOAL:{busy:false,edited:false},VIZ:{calc:{w1:75,dl:0,отношение:.87},st:{},busy:false},
   document:{getElementById:node,querySelectorAll:()=>[]},vizSay:(id,t)=>{node(id).textContent=t;},vizЖдать(){},haptic(){},vizК:String,syncUid:()=> 'svc_viz_retry',
   vizОбразец:async()=> 'template',vizЗаказ:async(...a)=>{calls.push(a);return {k:'bad'+calls.length,calc:{w1:75,dl:0,отношение:.87},left:5};},
   vizДовести:async()=>null,vizПроверка:async()=>({ok:false,отн:.999,d:.129}),fPost:()=>{throw Error('плохой результат нельзя сохранять');}});
 vm.runInContext(part('function vizЛимит(', "document.addEventListener('keydown'"),ctx);
 vm.runInContext(part('function vizБлокировать(', 'function vizУдалить('),ctx);
 ctx.vizGo();while(ctx.VIZ.busy) await new Promise(r=>setTimeout(r,1));
 assert.equal(node('bodygoalsave').disabled,false);assert.equal(calls.length,3);assert.equal(node('viznew').src,'saved');assert.match(node('vizmsg').textContent,/не сохранён как цель/);
 assert.ok(calls.every(c=>c[6]===calls[0][6]));
 const old=calls[0][6];ctx.vizGo();while(ctx.VIZ.busy) await new Promise(r=>setTimeout(r,1));assert.notEqual(calls[3][6],old);
 ctx.vizЗаказ=async(...a)=>{calls.push(a);return {k:'new',calc:{visualVersion:5,w1:75,отношение:.87},left:5};};
 const n0=calls.length;await ctx.vizGo();assert.equal(calls.length,n0+3,'промах силуэта исправляется не более двух раз');
 ctx.VIZ.calc={w1:75,fat1:12,fatTarget:12,dl:2.77,отношение:.842};
 let renders=[],selections=[],messages=[],failures=1,remaining=8,ratioOK=true,providerFail=false,missing=false,selectCode='viz_appearance';
 ctx.vizЗаказ=async(...a)=>{renders.push(a);if(providerFail)throw Object.assign(Error('Нет связи'),{code:'network'});return {k:'retry'+renders.length,calc:{...ctx.VIZ.calc,visualVersion:5},left:--remaining};};
 ctx.vizПроверка=async()=>missing?null:{ok:ratioOK,отн:ratioOK?.91:.999,d:0};
 ctx.vizЖдать=t=>messages.push(t);
 ctx.fPost=async(p,b)=>{assert.equal(p,'/viz/select');selections.push(b);if(failures-->0)throw Object.assign(Error('Вариант не принят'),{code:selectCode});return {ok:true};};
 ctx.vizURL=async k=>'photo:'+k;ctx.vizФотоПодпись=()=>{};ctx.vizCmpSync=()=>{};ctx.gget=()=>true;
 const reset=()=>{renders=[];selections=[];messages=[];remaining=8;ratioOK=true;providerFail=false;missing=false;selectCode='viz_appearance';node('viznew').src='saved';ctx.VIZ.st={};};
 await ctx.vizGo();
 assert.equal(renders.length,2);assert.equal(selections.length,2);assert.equal(node('viznew').src,'photo:retry2');
 assert.equal(ctx.VIZ.st.result.calc.fat1,12);assert.equal(ctx.VIZ.st.result.calc.w1,75);
 assert.ok(renders.every(a=>a[0]===75&&a[1]===2.77&&a[6]===renders[0][6]));assert.equal(renders[1][3],'retry1');assert.equal(renders[1][5],1);
 assert.ok(messages.some(t=>/75 кг \/ 12%.*2 из 3/.test(t)),'человек видит исправление именно выбранной цели');
 reset();failures=9;await ctx.vizGo();assert.equal(renders.length,3);assert.equal(selections.length,3);assert.equal(node('viznew').src,'saved');assert.match(node('vizmsg').textContent,/за 3 попытки/);assert.equal(ctx.VIZ.st.left,5);assert.equal(ctx.VIZ.busy,false);
 reset();failures=9;remaining=1;await ctx.vizGo();assert.equal(renders.length,1);assert.match(node('vizmsg').textContent,/лимит исчерпан/);assert.equal(ctx.VIZ.st.left,0);
 reset();failures=0;await ctx.vizGo();assert.equal(renders.length,1);assert.equal(selections.length,1,'успешный результат не проверяется и не выбирается дважды');
 reset();providerFail=true;await ctx.vizGo();assert.equal(renders.length,1);assert.equal(selections.length,0);assert.match(node('vizmsg').textContent,/Нет связи/);
 reset();missing=true;await ctx.vizGo();assert.equal(renders.length,1);assert.equal(selections.length,0);
 reset();failures=1;selectCode='auth';await ctx.vizGo();assert.equal(renders.length,1,'ошибка доступа не запускает платный повтор');
 console.log('PASS 75 кг / 12%: исправление отказа, неизменная цель, максимум 3 варианта, лимит, без повторов при сетевой ошибке');
 /* Реальный промах 27.10: MediaPipe сдвинул суставы, хотя кадр прежний.
    Нельзя выдавать изменение длины найденного корпуса за изменение талии. */
 let before={талия:.77,талияВКадре:.30},after={талия:.80,талияВКадре:.285};
 const geometryCtx=vm.createContext({Promise,VIZ:{origM:Promise.resolve(before)},vizURL:async()=> 'image',vizКартинка:async()=> 'image',vizМерить:async()=>after,vizПриемлемо:(c,r)=>r<.97&&r>.8});
 vm.runInContext(part('function vizПроверка(', 'function vizБлокировать('),geometryCtx);
 let checked=await geometryCtx.vizПроверка({k:'result',calc:{visualVersion:5,отношение:.842}});
 assert.ok(Math.abs(checked.отн-.95)<1e-9&&checked.ok,'новая мерка сохраняет уменьшение ширины при сдвиге найденного таза');
 after={талия:.70,талияВКадре:.30};checked=await geometryCtx.vizПроверка({k:'result',calc:{visualVersion:5,отношение:.842}});
 assert.equal(checked.отн,1);assert.equal(checked.ok,false,'неизменная ширина не становится стройнее из-за изменённых точек корпуса');
 checked=await geometryCtx.vizПроверка({k:'result',calc:{visualVersion:4,отношение:.842}});assert.ok(Math.abs(checked.отн-.70/.77)<1e-9,'старая калибровка не меняется');
 const noWarp=vm.createContext({Promise});vm.runInContext(part('function vizДовести(', '/* картинка: проверенный образец'),noWarp);assert.equal(await noWarp.vizДовести({calc:{visualVersion:5}},{ok:false}),null,'новый алгоритм не сжимает готовое тело');
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
