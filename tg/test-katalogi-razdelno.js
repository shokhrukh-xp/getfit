'use strict';
/* 23.10, ревью Codex R1 обхода экранов: «Еда» → «Что съесть» → «Тренировка» →
   «+ Добавить упражнение» давало «Каталог загрузился, но не открылся». Каталог
   блюд и каталог упражнений жили в одной переменной CAT (объявлена дважды):
   открытие «Что съесть» клало туда блюда, и выбор упражнения падал на CAT.ex.
   Проверяем переходы в обе стороны в одном сеансе: варианты упражнений есть,
   каталог блюд после этого тоже на месте, ошибок в консоли нет. */
const {chromium}=require('playwright'),M=require('./mock');
let плохо=0;const дано=(ok,t)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+t);if(!ok)плохо++};
(async()=>{const b=await chromium.launch();try{
 for(const theme of ['light','dark']){
  const p=await b.newPage({viewport:{width:390,height:844}});
  const ош=[];p.on('pageerror',e=>ош.push(e.message));
  await M.поднять(p,{theme,page:'food',time:'19:40'});
  await p.click('[data-zseg="eat"]');await p.waitForTimeout(900);
  const блюд1=await p.locator('#eatbody').innerText();
  дано(/Каталог блюд/.test(блюд1),'«Что съесть» открылся с каталогом блюд '+theme);
  await p.click('.l1 button[data-page="gym"]');await p.waitForTimeout(600);
  await p.click('#addex');
  const есть=await p.locator('#catalog .catpick, #catalog [data-pick]').first().waitFor({timeout:8000}).then(()=>true,()=>false);
  дано(есть,'после «Что съесть» выбор упражнения показывает варианты '+theme);
  дано(!/не открылся/.test(await p.locator('#catalog').innerText().catch(()=>'')),'без «Каталог загрузился, но не открылся» '+theme);
  await p.keyboard.press('Escape').catch(()=>{});await p.evaluate(()=>{const m=document.getElementById('catalog');if(m)m.classList.remove('show');});
  await p.click('.l1 button[data-page="food"]');await p.waitForTimeout(400);
  await p.click('[data-zseg="eat"]');await p.waitForTimeout(700);
  дано(/Каталог блюд/.test(await p.locator('#eatbody').innerText()),'и обратно — каталог блюд на месте '+theme);
  /* ревью Codex: одной надписи мало — раскрываем каталог и ищем настоящее блюдо */
  await p.click('#catopen');await p.waitForTimeout(500);
  дано(/Плов с говядиной/.test(await p.locator('#eatbody').innerText()),'в раскрытом каталоге — настоящие блюда (плов) '+theme);
  дано(!ош.length,'ошибок в консоли нет '+theme+' '+JSON.stringify(ош.slice(0,2)));
  await p.close();}
}finally{await b.close()}
console.log(плохо?'ПРОВАЛОВ: '+плохо:'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');process.exit(плохо?1:0);})();
