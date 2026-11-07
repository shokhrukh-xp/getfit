'use strict';
/* 07.11: согласия во всех каналах (выключатель soglasie2) — разбор «как не попасть на штрафы», его «Давай по порядку все».
   Заперто: в Telegram с soglasie2 первым открывается окно «Сведения о здоровье» (фон не закрывает), «Согласен» →
   сервер {kind:'zd', yes:true}, следом окно ИИ; «Не согласен» → {kind:'zd', yes:false} и объяснение, окно остаётся;
   в профиле строка «Сведения о здоровье: согласие дано»; без soglasie2 в Telegram — ни одного окна (как было). */
const {chromium}=require('playwright'),M=require('./mock'),{opts}=require('./shot-clean');
let bad=0;const ok=(c,t)=>{console.log((c?'  ok  ':'  ПРОВАЛ  ')+t);if(!c)bad++;};
async function поднять(b, доп){
  const p=await b.newPage({viewport:{width:390,height:844}});
  const сервер={зап:[], ii:доп.ii||null, zd:доп.zd||null};
  const o=opts('dark');o.bot=false;
  o.handleRoute=async r=>{
    const п=new URL(r.request().url()).pathname;
    const дать=(d,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(d)});
    if(п==='/sub') return дать({ok:true,stars:500,link:null,features:доп.features||[],sub:{ok:true,kind:'grand',until:0}}),true;
    if(п==='/ii-soglasie'){
      const s2=(доп.features||[]).includes('soglasie2');
      if(r.request().method()==='POST'){ const b2=JSON.parse(r.request().postData()||'{}'); сервер.зап.push(b2);
        if(b2.kind==='zd') сервер.zd={yes:b2.yes,v:1}; else сервер.ii={yes:b2.yes,v:1};
        return дать({ok:true,soglasie:b2.kind==='zd'?сервер.zd:сервер.ii,yes:b2.yes}),true; }
      return дать(Object.assign({ok:true,soglasie:сервер.ii,yes:!!(сервер.ii&&сервер.ii.yes),nado:s2,v:1},
        s2?{zd:сервер.zd,zdYes:!!(сервер.zd&&сервер.zd.yes),zv:1,s2:1}:{})),true;
    }
    return false;
  };
  const err=await M.поднять(p,o);await p.waitForTimeout(1000);
  return {p,err,сервер};
}
const окно=(p,id)=>p.evaluate(i=>document.getElementById(i).classList.contains('show'),id);
(async()=>{const b=await chromium.launch();try{
  /* 1. Telegram без soglasie2 — как было: окон нет */
  {const {p,err}=await поднять(b,{features:['soglasie']});
   ok(err.length===0,'без soglasie2: без ошибок '+(err[0]||''));
   ok(!(await окно(p,'zdm'))&&!(await окно(p,'iim')),'без soglasie2 в Telegram окон согласия нет');
   await p.close();}
  /* 2. Telegram с soglasie2: здоровье → ИИ */
  {const {p,err,сервер}=await поднять(b,{features:['soglasie','soglasie2']});
   ok(err.length===0,'soglasie2: без ошибок '+(err[0]||''));
   ok(await окно(p,'zdm'),'первым — окно «Сведения о здоровье»');
   ok(!(await окно(p,'iim')),'окно ИИ — не одновременно');
   const т=await p.textContent('#zdm');
   ok(/вес, замеры, еду и фото еды/.test(т)&&/в Узбекистане/.test(т)&&/не продаём/.test(т),'сказано, что храним, где и что не продаём');
   await p.mouse.click(5,5);await p.waitForTimeout(200);ok(await окно(p,'zdm'),'фон окно не закрывает — нужен явный ответ');
   await p.click('#zdyes');await p.waitForTimeout(700);
   ok(сервер.зап[0]&&сервер.зап[0].kind==='zd'&&сервер.зап[0].yes===true,'«Согласен» → сервер {kind:zd, yes:true}');
   ok(!(await окно(p,'zdm'))&&(await окно(p,'iim')),'следом — окно согласия на ИИ');
   await p.click('#iiyes');await p.waitForTimeout(500);
   ok(сервер.зап[1]&&!сервер.зап[1].kind&&сервер.зап[1].yes===true,'ИИ «Согласен» → {yes:true} без kind');
   await p.click('#profbtn');await p.waitForTimeout(400);
   ok(/Сведения о здоровье\s*согласие дано/.test(await p.textContent('#profzd')),'в профиле «Сведения о здоровье: согласие дано»');
   ok(/ИИ-помощник\s*включён/.test(await p.textContent('#profii')),'и «ИИ-помощник: включён» — теперь и в Telegram');
   await p.close();}
  /* 3. «Не согласен» — объяснение, окно остаётся */
  {const {p,сервер}=await поднять(b,{features:['soglasie','soglasie2']});
   await p.click('#zdno');await p.waitForTimeout(500);
   ok(сервер.зап[0]&&сервер.зап[0].kind==='zd'&&сервер.зап[0].yes===false,'«Не согласен» → {kind:zd, yes:false}');
   ok(await окно(p,'zdm')&&/не может вести дневник/.test(await p.textContent('#zdstate')),'окно остаётся и объясняет, что без согласия дневника нет');
   ok(!(await окно(p,'iim')),'окно ИИ не открывается');
   await p.close();}
  /* 4. уже согласен на оба — окон нет */
  {const {p}=await поднять(b,{features:['soglasie','soglasie2'],zd:{yes:true,v:1},ii:{yes:true,v:1}});
   ok(!(await окно(p,'zdm'))&&!(await окно(p,'iim')),'оба согласия есть — окон нет');
   await p.close();}
}finally{await b.close();}
console.log(bad?'\nПРОВАЛОВ: '+bad:'\nВсё прошло');process.exit(bad?1:0);})();
