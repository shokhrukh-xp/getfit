#!/usr/bin/env node
// 27.10: по просьбе Шохруха небольшие правки проверяем быстрее.
// 28.10, его вопрос «нужно ли каждый раз прогонять кучу тестов ради точечных
// правок?» — выбрал «адресно, полный после». Теперь и правка логики
// приложения идёт адресно: перед выпуском — наборы, которые касаются
// изменённых функций, строк и селекторов, плюс быстрый общий (ui-clean и
// тыкалка по всем экранам, ~1 мин). Полный прогон хук запускает сразу после
// push в фоне (tools/full-after.sh) — красный будет виден до следующего шага.
// Полный ДО выпуска остаётся для крупного: много строк, общий код прогона,
// неизвестные файлы, или когда под правку попадает больше половины наборов.
const fs=require('fs'), cp=require('child_process'), path=require('path');
const smoke=['ui-clean','tyk'];
const БОЛЬШАЯ=300;          // изменённых строк в index.html — дальше полный
const ДОЛЯ=0.5;             // адресных наборов больше половины — полный
const скрипты=s=>(s.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi)||[]).join('\n');
const ИДЕНТ=/[A-Za-z_$А-Яа-яЁё][\wА-Яа-яЁё$]*/g;
const СЛУЖЕБНЫЕ=new Set('function return var let const if else for while true false null undefined this new typeof try catch break continue switch case default document window length push join split slice map filter forEach indexOf replace parseInt Math Number String Array Object JSON Date innerHTML textContent className style hidden getAttribute setAttribute querySelector querySelectorAll getElementById addEventListener click value data'.split(' '));
// функция, внутри которой стоит строка: ближайшее объявление выше
function обёртки(lines, номера){
  const out=new Set(); let имя=null; const где=new Map();
  lines.forEach((l,i)=>{const m=l.match(/^\s*(?:async\s+)?function\s+([^\s(]+)\s*\(|^\s*(?:var|let|const)\s+([^\s=]+)\s*=\s*(?:async\s+)?(?:function|\()/);if(m)имя=m[1]||m[2];где.set(i,имя);});
  номера.forEach(i=>{const n=где.get(i);if(n)out.add(n);});
  return out;
}
function ключиПравки(before, after){
  const a=before.split('\n'), b=after.split('\n');
  const А=new Set(a), Б=new Set(b);
  const ушли=[], пришли=[];
  const метка=l=>/^var BUILD = /.test(l);
  a.forEach((l,i)=>{if(!Б.has(l)&&!метка(l))ушли.push(i);});
  b.forEach((l,i)=>{if(!А.has(l)&&!метка(l))пришли.push(i);});
  const строки=ушли.map(i=>a[i]).concat(пришли.map(i=>b[i])).filter(l=>!/^var BUILD = /.test(l));
  const ключи=new Set([...обёртки(a,ушли),...обёртки(b,пришли)]);
  for(const l of строки){
    for(const m of l.matchAll(/function\s+([^\s(]+)|(?:var|let|const)\s+([^\s=,;]+)/g))ключи.add(m[1]||m[2]);
    // строка CSS — её селекторы (.class, #id), как было до 28.10
    if(/^\s*[.#@a-z*][^;()]*\{|\{[a-z-]+:/.test(l)&&!/function|=>/.test(l))for(const m of l.matchAll(/[.#]([A-Za-z_][\w-]{2,})/g))ключи.add(m[1]);
    // строки в кавычках: селекторы, data-атрибуты, видимый текст
    for(const m of l.matchAll(/'([^'\\]{4,60})'|"([^"\\]{4,60})"/g)){
      const s=m[1]||m[2];
      for(const t of s.match(/[.#]?[A-Za-z][\w-]{3,}/g)||[])ключи.add(t.replace(/^[.#]/,''));
      if(/[А-Яа-яЁё]{4}/.test(s)&&!/[<>{}]/.test(s))ключи.add(s.trim());
    }
  }
  return {ключи:[...ключи].filter(k=>k&&k.length>=3&&!СЛУЖЕБНЫЕ.has(k)), строк:строки.length};
}
function plan(changes, tests){
  const selected=new Set(smoke); let ui=false; const имена=Object.keys(tests);
  const поКлючам=(ключи)=>{
    // ключ, который есть почти во всех наборах, ничего не выбирает
    const годные=ключи.filter(k=>имена.filter(n=>tests[n].includes(k)).length<=Math.max(3,имена.length*0.3));
    for(const n of имена)if(годные.some(k=>tests[n].includes(k)))selected.add(n);
    return годные;
  };
  const почему=[];
  for(const c of changes){
    if(c.file==='.githooks/pre-push'||c.file==='tools/check-plan.cjs'||c.file==='tools/check-plan.test.cjs'||c.file==='tools/full-after.sh') continue;
    if(/\.md$/.test(c.file)||c.file.startsWith('docs/')) continue;
    if(/^tg\/test-[\w-]+\.js$/.test(c.file)&&c.after!==null){selected.add(c.file.slice(8,-3));ui=true;continue;}
    if((c.file==='catalog.json'||c.file==='tech.json')&&c.after!==null){
      const к=c.file==='catalog.json'?['catalog','CAT.','каталог']:['tech.json','техник'];
      поКлючам(к); ui=true; почему.push(c.file); continue;
    }
    if(c.file!=='index.html'||c.before===null||c.after===null) return {mode:'full',reason:'Общий код, данные, ресурсы или неизвестный файл: '+c.file};
    const normalize=s=>s.replace(/^var BUILD = '[^']*';?$/m,"var BUILD = ''; ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'<style></style>');
    const a=normalize(c.before), b=normalize(c.after);
    if(c.before.replace(/^var BUILD = '[^']*';?$/m,'')===c.after.replace(/^var BUILD = '[^']*';?$/m,''))continue; // одна метка сборки — её сверяет хук
    const structure=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'<script></script>').replace(/>[^<]*</g,'><');
    const логика=скрипты(a)!==скрипты(b), разметка=structure(a)!==structure(b);
    ui=true;
    const {ключи,строк}=ключиПравки(c.before,c.after);
    if((логика||разметка)&&строк>БОЛЬШАЯ)return {mode:'full',reason:'Крупная правка приложения: '+строк+' строк'};
    const годные=поКлючам(ключи);
    if(логика||разметка)почему.push((логика?'логика':'разметка')+' ('+строк+' строк; по ключам: '+годные.slice(0,6).join(', ')+(годные.length>6?'…':'')+')');
  }
  if(!ui)return {mode:'meta',reason:'Документация или настройка проверок'};
  if(selected.size>Math.max(10,имена.length*ДОЛЯ))return {mode:'full',reason:'Правка задевает больше половины наборов ('+selected.size+')'};
  return {mode:'targeted',tests:[...selected].sort(),reason:'Адресно: '+(почему.join('; ')||'оформление, статический текст или адресные тесты')+'. Полный — после push, в фоне'};
}
module.exports={plan,ключиПравки};
if(require.main===module){
  const refs=fs.readFileSync(process.argv[2],'utf8').trim().split('\n').filter(Boolean).map(line=>{const [base,head]=line.split('\t');return {base,head};});const changes=[];
  const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
  try{
    for(const ref of refs){
      const files=git('diff','--name-only','-z',ref.base,ref.head).split('\0').filter(Boolean);
      for(const file of files){const read=rev=>{try{return git('show',rev+':'+file);}catch{return null;}};changes.push({file,before:read(ref.base),after:read(ref.head)});}
    }
    const tests={};for(const f of fs.readdirSync('tg'))if(/^test-.*\.js$/.test(f))tests[f.slice(5,-3)]=fs.readFileSync(path.join('tg',f),'utf8');
    const p=plan(changes,tests);process.stdout.write(JSON.stringify(p));
  }catch(e){process.stdout.write(JSON.stringify({mode:'full',reason:'Не удалось определить изменения: '+e.message}));}
}
