'use strict';
/* Источники под ответом тренера (24.09). Его просьба: «в каждом ответе были
   указаны научные статьи, на основе которых основан ответ»; вид — его выбор
   из трёх снимков: «значками». Заперто: значок на каждую работу с именем и
   типом; нажатие открывает статью через Telegram; ссылка не https — значка
   нет; реплика без источников — без пустой строки; новый ответ тренера
   приходит со значками сразу, без перезапуска. */
const { chromium } = require('playwright');
const M = require('./mock');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const HELMS = { k: 'Helms 2014', t: 'обзор', u: 'https://pubmed.ncbi.nlm.nih.gov/24864135/', p: 'На дефиците белок 2,3–3,1 г на кг сухой массы' };
const MORTON = { k: 'Morton 2018', t: 'мета-анализ 49 РКИ', u: 'https://pubmed.ncbi.nlm.nih.gov/28698222/', p: 'Плато около 1,6 г на кг' };
const ПЛОХАЯ = { k: 'Выдумкин 2023', t: 'обзор', u: 'javascript:alert(1)', p: '' };
const t = Date.now() - 3600e3;
const ЧАТ = [
  { role: 'user', text: 'сколько мне белка?', ts: t },
  { role: 'assistant', text: 'Норма белка — 190 г.', ts: t, src: [HELMS, MORTON, ПЛОХАЯ] },
  { role: 'user', text: 'съел плов', ts: t + 1000 },
  { role: 'assistant', text: 'Записал: плов, 650 ккал.', ts: t + 1000 }
];

(async () => {
  const br = await chromium.launch();
  const page = await br.newPage({ viewport: { width: 390, height: 900 } });
  await page.route('**://cdn.jsdelivr.net/**', r => r.abort().catch(() => {}));
  const ош = await M.поднять(page, { theme: 'dark', wait: 2400, chat: ЧАТ,
    onCoach: () => ({ ok: true, reply: 'Возьми 200 г куриной грудки на ужин.', src: [HELMS] }) });
  дано(ош.length === 0, 'страница поднялась без ошибок ' + (ош[0] || ''));
  await page.click('#coachfab'); await page.waitForTimeout(800);

  const ходы = await page.$$eval('#chatlog .turn', ts => ts.map(t => ({
    say: (t.querySelector('.say') || {}).textContent || '',
    значки: Array.from(t.querySelectorAll('.srcs button')).map(b => b.textContent.replace(/\s+/g, ' ').trim()) })));
  const бел = ходы.find(x => /190 г/.test(x.say)) || { значки: [] };
  дано(бел.значки.length === 2, 'под ответом про белок два значка, выдуманная ссылка отброшена: ' + бел.значки.join(' | '));
  дано(/Helms 2014/.test(бел.значки[0] || '') && /обзор/.test(бел.значки[0] || ''), 'на значке имя работы и её тип: ' + (бел.значки[0] || '—'));
  дано(/Morton 2018 мета-анализ 49 РКИ/.test(бел.значки[1] || ''), 'второй значок — Morton 2018, мета-анализ');
  const плов = ходы.find(x => /плов/.test(x.say)) || { значки: [1] };
  дано(плов.значки.length === 0, 'у записи еды без источников строки значков нет');
  дано(await page.$$eval('#chatlog .srcs', ss => ss.length) === 1, 'пустых строк значков в разговоре нет');
  const подпись = await page.$eval('#chatlog .srcs button', b => b.getAttribute('aria-label'));
  дано(/Helms 2014, обзор: На дефиците/.test(подпись || ''), 'у значка понятная подпись для чтеца экрана: ' + подпись);
  const высота = await page.$eval('#chatlog .srcs button', b => b.getBoundingClientRect().height);
  дано(высота >= 32, 'значок не мельче 32 px: ' + Math.round(высота));

  await page.click('#chatlog .srcs button');
  await page.waitForTimeout(200);
  const ссылки = await page.evaluate(() => window.__ссылки || []);
  дано(ссылки[ссылки.length - 1] === HELMS.u, 'нажал значок — статья открылась через Telegram: ' + (ссылки[ссылки.length - 1] || '—'));

  await page.fill('#ctext', 'Что приготовить на ужин?');
  await page.click('#csend');
  await page.waitForTimeout(1500);
  const последний = await page.$$eval('#chatlog .turn', ts => { const t = ts[ts.length - 1];
    return { say: (t.querySelector('.say') || {}).textContent || '', n: t.querySelectorAll('.srcs button').length }; });
  дано(/куриной грудки/.test(последний.say) && последний.n === 1, 'новый ответ пришёл сразу со значком источника');

  await br.close();
  console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  process.exit(плохо ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
