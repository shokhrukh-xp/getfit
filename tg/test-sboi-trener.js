'use strict';
/* 18.10, его вопрос «все пользователи получают такое сообщение?» (сырой
   «API 402: Your prepayment credits are depleted…»): когда у тренера кончились
   кредиты Gemini, приложение говорит по-человечески и не обещает, что
   «попробуй ещё раз» поможет; таймаут и «занят» — свои слова. */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let плохо=0;const дано=(ok,t)=>{console.log((ok?'  ok  ':'  ПРОВАЛ  ')+t);if(!ok)плохо++};
const ответ={
 ai_down:{status:503,body:{error:'Тренер сейчас недоступен — уже чиним. Дневник, вес и зал работают как обычно.',code:'ai_down',detail:'API 402: Your prepayment credits are depleted.'}},
 slow:{status:504,body:{error:'Тренер не успел ответить вовремя. Попробуй ещё раз.',code:'slow',detail:'нет ответа за 90 с'}},
 /* старый сервер без кода — сырой текст не показываем */
 raw:{status:500,body:{error:'API 402: Your prepayment credits are depleted. Please go to AI Studio',code:'ai_down'}}
};
(async()=>{const br=await chromium.launch();try{
 for(const [вид,ждём] of [['ai_down',/^Тренер сейчас недоступен — уже чиним/],['slow',/^Тренер не успел ответить вовремя/],['raw',/^Тренер сейчас недоступен/]])
 for(const theme of ['dark','light']){
  const p=await br.newPage({viewport:{width:390,height:844}});
  const o=opts(theme);o.handleRoute=async r=>{if(new URL(r.request().url()).pathname!=='/coach'||r.request().method()!=='POST')return false;
   const a=ответ[вид];await r.fulfill({status:a.status,contentType:'application/json',body:JSON.stringify(a.body)});return true;};
  const err=await M.поднять(p,o);
  await p.click('#coachnav');await p.fill('#ctext','съел плов 300 г');await p.click('#csend');await p.waitForTimeout(900);
  const t=(await p.locator('#chatlog').innerText()).replace(/\s+/g,' ');
  const стр=(t.match(/Тренер (сейчас недоступен|не успел)[^.]*\.[^.]*\./)||[''])[0];
  дано(ждём.test(стр),вид+' '+theme+': понятная фраза — «'+стр+'»');
  дано(!/API|402|prepayment|AI Studio/.test(t),вид+' '+theme+': ни слова от Google');
  дано(!err.length,вид+' '+theme+': без ошибок '+err.join(' | '));
  await p.close();
 }
}finally{await br.close()}
 if(плохо){console.error('ПРОВАЛОВ: '+плохо);process.exitCode=1}else console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
})().catch(e=>{console.error('УПАЛО:',e);process.exitCode=1});
