'use strict';
/* ── БЫСТРЫЙ ПРОГОН ─────────────────────────────────────────────────────
   24.09, его вопрос: «как ускорить, чтобы не ждать так долго каждый раз?».
   По очереди 57 наборов шли 20+ минут, и почти всё это время процессор
   стоял: каждый набор ждёт страницу, а не считает. Наборы друг от друга не
   зависят (у каждого свой браузер, сервер отдаёт статику), поэтому идут
   параллельно, по нескольку сразу.

   Второе, что здесь сделано: сайт отдаёт сам прогон, из памяти, на
   свободном порту. Папка site/ больше не нужна и не мусорит на Диске, а
   «чужой» сервер на 8899, оставшийся от прошлого раза, не может подсунуть
   проверкам старую копию — 24.09 так и было, с 19.09 висел сервер из site/.

   Запуск:
     node tg/run-fast.js              все наборы + обходчик и тыкалка
     node tg/run-fast.js eda priem    только наборы, в имени которых есть «eda» или «priem»
     node tg/run-fast.js -j 4         четыре потока (по умолчанию — см. «потоков» ниже)
     node tg/run-fast.js --все        лишнее для прогона передаётся обходчику и тыкалке
   Полный вывод каждого набора — в папке, которую прогон называет в конце. */
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TG = __dirname;
const арг = process.argv.slice(2);
/* Потоков больше, чем ядер: набор почти всё время ждёт страницу, а не
   считает. На M2 (8 ядер, 16 ГБ) 14 потоков дают те же времена наборов, что
   и 6, — процессор не упирается. Упирается память: 20 потоков съели
   свободные 3 ГБ целиком, поэтому потолок — гигабайт с запасом на поток:
   на 16 ГБ это 13. Больше можно руками: -j 20. */
let потоков = Math.max(1, Math.min(14, os.cpus().length * 2 - 2, Math.floor(os.totalmem() / 1.3e9)));
const фильтр = [], дальше = [];
for (let i = 0; i < арг.length; i++) {
  const a = арг[i];
  if (a === '-j' || a === '--jobs') { потоков = Math.max(1, +арг[++i] || 1); continue; }
  if (/^-j\d+$/.test(a)) { потоков = Math.max(1, +a.slice(2)); continue; }
  if (a.startsWith('-')) { дальше.push(a); continue; }
  фильтр.push(a.toLowerCase());
}

/* ── сайт: ровно то, что собирал srv.sh, но из памяти ── */
const ИСХОДНИК = fs.existsSync(path.join(ROOT, 'getfit-tg.html')) ? 'getfit-tg.html' : 'index.html';
const ФАЙЛЫ = new Map();
const положить = (url, файл) => { try { ФАЙЛЫ.set(url, fs.readFileSync(файл)); } catch (e) {} };
положить('/index.html', path.join(ROOT, ИСХОДНИК));
положить('/catalog.json', path.join(ROOT, 'catalog.json'));
const из = (папка, rx, куда) => { try { fs.readdirSync(папка).filter(f => rx.test(f)).forEach(f => положить(куда + f, path.join(папка, f))); } catch (e) {} };
из(path.join(ROOT, 'fonts'), /\.woff2$/, '/fonts/');
из(path.join(TG, 'fixtures'), /\.jpg$/, '/p/');
из(path.join(ROOT, 'img'), /\.png$/, '/img/');
const ТИПЫ = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
const сервер = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/' || u === '') u = '/index.html';
  const тело = ФАЙЛЫ.get(u);
  if (!тело) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': ТИПЫ[path.extname(u)] || 'application/octet-stream', 'Content-Length': тело.length });
  res.end(тело);
});

/* ── что гонять ── */
const наборы = fs.readdirSync(TG).filter(f => /^test-.*\.js$/.test(f)).sort();
/* Обходчик и тыкалка — самые долгие (по 1,5–2,5 минуты целиком), и прогон
   ждал бы их одних. Они умеют делиться на части (GF_PART=k/n): обходчик —
   по заданиям (3, с «--все» — 5; см. ЗАДАНИЯ в audit.js), тыкалка — по
   шести экранам приложения. */
const ВСЕ_РАЗМЕРЫ = дальше.includes('--все') || дальше.includes('--all');
const ЧАСТЕЙ = { 'audit.js': ВСЕ_РАЗМЕРЫ ? 5 : 3, 'tyk.js': 6 };
const имя = f => f.replace(/^test-/, '').replace(/\.js$/, '');
let файлы = наборы.concat(Object.keys(ЧАСТЕЙ));
if (фильтр.length) файлы = файлы.filter(f => фильтр.some(ф => имя(f).includes(ф)));
if (!файлы.length) { console.error('Под «' + фильтр.join(' ') + '» ни одного набора.'); process.exit(2); }
const список = [];
файлы.forEach(f => {
  const n = ЧАСТЕЙ[f];
  if (!n || потоков === 1) return список.push({ f, метка: f.replace(/\.js$/, ''), часть: null });
  for (let k = 0; k < n; k++) список.push({ f, метка: f.replace(/\.js$/, '') + ' ' + (k + 1) + '/' + n, часть: k + '/' + n });
});

/* долгие — первыми: иначе самый длинный стартует последним и прогон ждёт его один */
const ВРЕМЕНА = path.join(os.tmpdir(), 'getfit-tg-times.json');
let было = {};
try { было = JSON.parse(fs.readFileSync(ВРЕМЕНА, 'utf8')); } catch (e) {}
const оценка = з => было[з.метка] || (ЧАСТЕЙ[з.f] ? 1e6 : 0);
список.sort((a, b) => оценка(b) - оценка(a));

/* ── метка сборки ──
   BUILD в index.html и APP_BUILD в воркере — одна метка, и меняются они
   вместе (README). 24.09 предыдущий чат поднял только одну из них, и это
   ничто не поймало. Сверяем в каждом прогоне, когда воркер лежит рядом. */
const метка = (файл, rx) => { try { return (fs.readFileSync(файл, 'utf8').match(rx) || [])[1] || null; } catch (e) { return null; } };
const ВОРКЕР = path.join(ROOT, '..', 'getfit-sync', 'src', 'index.js');
const мПрил = метка(path.join(ROOT, ИСХОДНИК), /^var BUILD = '([^']*)'/m);
const мСерв = fs.existsSync(ВОРКЕР) ? метка(ВОРКЕР, /^const APP_BUILD = '([^']*)'/m) : undefined;
const меткаОк = мСерв === undefined || (мПрил && мПрил === мСерв);
/* AGENTS.md одинаковый в обоих репозиториях — разошлись, значит кто-то
   поправил правила только в одном */
const агенты = [path.join(ROOT, 'AGENTS.md'), path.join(ROOT, '..', 'getfit-sync', 'AGENTS.md')];
const агентыРазные = агенты.every(f => fs.existsSync(f)) && fs.readFileSync(агенты[0], 'utf8') !== fs.readFileSync(агенты[1], 'utf8');

/* ── известные красные (tg/krasnye.txt): ждут его решения, push не держат ── */
const КРАСНЫЕ = {};
try { fs.readFileSync(path.join(TG, 'krasnye.txt'), 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([^#\s][^ ]*)\s+—\s+(.+)$/); if (m) КРАСНЫЕ[m[1]] = m[2]; }); } catch (e) {}
const известный = з => КРАСНЫЕ[имя(з.f)];

const ЛОГИ = path.join(os.tmpdir(), 'getfit-tg-logs');
fs.mkdirSync(ЛОГИ, { recursive: true });
const env = Object.assign({}, process.env);
if (!env.NODE_PATH && fs.existsSync(path.join(os.homedir(), 'pw/node_modules'))) env.NODE_PATH = path.join(os.homedir(), 'pw/node_modules');
const ПОТОЛОК = 6 * 60 * 1000;
const сек = мс => (мс / 1000).toFixed(1).padStart(5) + ' с';

сервер.listen(0, '127.0.0.1', () => {
  const порт = сервер.address().port;
  env.GF_PORT = String(порт);
  const старт = Date.now();
  console.log('Прогон: ' + список.length + ' наборов, потоков ' + потоков + ', сайт на ' + порт + ' (' + ИСХОДНИК + ')');
  if (мСерв === undefined) console.log('Метка сборки: ' + мПрил + ' (воркера рядом нет — не сверяю)');
  else console.log(меткаОк ? 'Метка сборки: ' + мПрил + ' — у приложения и воркера одна'
    : '  ✗ МЕТКИ СБОРКИ РАЗНЫЕ: приложение «' + мПрил + '», воркер «' + мСерв + '». Меняются вместе (README).');
  if (агентыРазные) console.log('  ! AGENTS.md в getfit и getfit-sync разошлись — правила меняются в обоих');
  const итоги = [];
  let i = 0, идут = 0;
  const следующий = () => {
    if (i >= список.length) { if (!идут) конец(); return; }
    const з = список[i++], f = з.f; идут++;
    const t0 = Date.now(), вывод = [];
    const env1 = Object.assign({}, env); if (з.часть) env1.GF_PART = з.часть; else delete env1.GF_PART;
    const p = spawn(process.execPath, [path.join(TG, f)].concat(ЧАСТЕЙ[f] ? дальше : []), { cwd: ROOT, env: env1 });
    const таймер = setTimeout(() => { вывод.push(Buffer.from('\nПРОГОН: снят по потолку ' + ПОТОЛОК / 60000 + ' мин\n')); p.kill('SIGKILL'); }, ПОТОЛОК);
    p.stdout.on('data', d => вывод.push(d)); p.stderr.on('data', d => вывод.push(d));
    p.on('close', code => {
      clearTimeout(таймер);
      const мс = Date.now() - t0, текст = Buffer.concat(вывод).toString('utf8');
      fs.writeFileSync(path.join(ЛОГИ, з.метка.replace(/[ \/]/g, '-') + '.log'), текст);
      const ок = code === 0, ждёт = известный(з);
      итоги.push({ метка: з.метка, мс, ок, ждёт });
      console.log((ок ? '  ✓ ' : ждёт ? '  ~ ' : '  ✗ ') + з.метка.padEnd(22) + сек(мс) + (ок && ждёт ? '  — снова зелёный, убери его из tg/krasnye.txt' : ''));
      if (!ок && ждёт) console.log('        известный красный: ' + ждёт);
      else if (!ок) текст.split('\n').filter(l => /ПРОВАЛ|УПАЛО|Error|ПРОГОН:/.test(l)).slice(0, 8)
        .forEach(l => console.log('        ' + l.trim().slice(0, 160)));
      идут--; следующий();
    });
  };
  const конец = () => {
    сервер.close();
    итоги.forEach(r => { было[r.метка] = r.мс; });
    try { fs.writeFileSync(ВРЕМЕНА, JSON.stringify(было)); } catch (e) {}
    const всего = Date.now() - старт, подряд = итоги.reduce((a, r) => a + r.мс, 0);
    const упали = итоги.filter(r => !r.ок && !r.ждёт), ждут = итоги.filter(r => !r.ок && r.ждёт);
    console.log('\nЗа ' + сек(всего).trim() + ' (по очереди было бы ' + сек(подряд).trim() + '). Логи: ' + ЛОГИ);
    if (ждут.length) console.log('Известные красные (ждут решения, см. tg/krasnye.txt): ' + ждут.map(r => r.метка).join(', '));
    if (!меткаОк) упали.push({ метка: 'метка сборки' });
    console.log(упали.length ? 'УПАЛО: ' + упали.length + ' — ' + упали.map(r => r.метка).join(', ') : 'ВСЕ НАБОРЫ ПРОЙДЕНЫ');
    process.exit(Math.min(упали.length, 255));
  };
  for (let k = 0; k < потоков; k++) следующий();
});
