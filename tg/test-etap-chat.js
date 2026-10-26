'use strict';
/* Этап разбора в чате приложения (25.10, его «делай все оставшиеся» — пункт «ответ тренера
   по мере написания» для приложения; в Telegram это черновик «Думаю…»). Заперто: пока
   тренер думает — «Думаю» с точками; как только сервер посчитал еду — вместо него
   «Записываю обед · 540 ккал, белок 32 г — пишу ответ» (без двойного многоточия);
   запрос несёт свой stage-id, им же спрашивается этап; ответ пришёл — этапа нет и
   опрос остановлен. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };

(async () => {
  const br = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const page = await br.newPage({ viewport: { width: 390, height: 900 } });
    await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
    let этапГотов=false, отдать;const coachGate=new Promise(r=>{отдать=r;});
    /* 26.10: проверяем порядок событий, не гонку 3,2 с против загрузки CPU. */
    const o = { theme, wait: 2400, chat: [], coachGate,
      coachStage: () => (этапГотов ? 'Записываю обед · 540 ккал, белок 32 г — пишу ответ…' : null),
      onCoach: () => ({ ok: true, reply: 'Записал обед: плов 300 г.' }) };
    const ош = await M.поднять(page, o);
    дано(ош.length === 0, theme + ': страница поднялась без ошибок ' + (ош[0] || ''));
    await page.click('#coachnav'); await page.waitForTimeout(800);
    await page.fill('#ctext', 'съел плов 300 г');
    await page.click('#csend');
    await page.waitForFunction(()=>document.getElementById('cwait')?.textContent.trim()==='Думаю');
    дано(/^Думаю$/.test(((await page.textContent('#cwait').catch(() => '')) || '').trim()), theme + ': сразу — «Думаю» с точками');
    этапГотов=true;
    await page.waitForFunction(()=>document.getElementById('cwait')?.textContent.trim()==='Записываю обед · 540 ккал, белок 32 г — пишу ответ');
    const этап = ((await page.textContent('#cwait').catch(() => '')) || '').trim();
    дано(/^Записываю обед · 540 ккал, белок 32 г — пишу ответ$/.test(этап), theme + ': потом этап разбора без двойного многоточия: «' + этап + '»');
    дано(await page.$('#cwait + .dots') !== null, theme + ': точки остаются за этапом');
    const тело = (o.coachBodies || [])[0] || {};
    дано(/^[a-z0-9]{8,32}$/.test(тело.stage || '') && (o.stageAsked || []).every(x => x === тело.stage), theme + ': этап спрашивается по stage-id своего запроса');
    await page.screenshot({ path: '/tmp/etap-chat-' + theme + '.png' });
    отдать();
    await page.waitForSelector('#cwait',{state:'detached'});
    дано(!(await page.$('#cwait')), theme + ': ответ пришёл — этапа нет');
    дано(/Записал обед: плов 300 г/.test(await page.textContent('#chatlog')), theme + ': ответ тренера на месте');
    const было = (o.stageAsked || []).length; await page.waitForTimeout(3200);
    дано((o.stageAsked || []).length === было, theme + ': опрос этапа остановлен');
    await page.close();
  }
  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  if (плохо) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
