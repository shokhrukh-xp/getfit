#!/usr/bin/env node
// 27.10: по просьбе Шохруха небольшие правки проверяем быстрее.
// Незнакомое изменение или логика приложения всегда требуют полного прогона.
const fs=require('fs'), cp=require('child_process'), path=require('path');
const smoke=['ds1','ds5','ui-clean'];
function plan(changes, tests){
  const selected=new Set(smoke); let ui=false;
  for(const c of changes){
    if(c.file==='.githooks/pre-push'||c.file==='tools/check-plan.cjs'||c.file==='tools/check-plan.test.cjs') continue;
    if(/\.md$/.test(c.file)||c.file.startsWith('docs/')) continue;
    if(/^tg\/test-[\w-]+\.js$/.test(c.file)&&c.after!==null){selected.add(c.file.slice(8,-3));ui=true;continue;}
    if(c.file!=='index.html'||c.before===null||c.after===null) return {mode:'full',reason:'Общий код, данные, ресурсы или неизвестный файл: '+c.file};
    // Только CSS и видимый статический текст. Изменение любого скрипта,
    // атрибута, структуры HTML или числа style/script — полный прогон.
    const normalize=s=>s.replace(/^var BUILD = '[^']*';?$/m,"var BUILD = ''; ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'<style></style>');
    const a=normalize(c.before), b=normalize(c.after);
    const scripts=s=>(s.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi)||[]);
    const buildOnly=s=>s.replace(/^var BUILD = '[^']*';?$/m,"var BUILD = ''; " );
    if(JSON.stringify(scripts(buildOnly(c.before)))!==JSON.stringify(scripts(buildOnly(c.after))))return {mode:'full',reason:'Изменена логика приложения'};
    const structure=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'<script></script>').replace(/>[^<]*</g,'><');
    if(structure(a)!==structure(b))return {mode:'full',reason:'Изменены структура или атрибуты экрана'};
    ui=true;
    // Дополнительные наборы, которые упоминают затронутые CSS-селекторы.
    const oldLines=new Set(c.before.split('\n')), newLines=new Set(c.after.split('\n'));
    const removed=[...oldLines].filter(x=>!newLines.has(x));
    const added=[...newLines].filter(x=>!oldLines.has(x));
    const selectors=new Set((removed.concat(added).join('\n').match(/[.#][A-Za-z_][\w-]*/g)||[]).map(x=>x.slice(1)));
    for(const [name,source] of Object.entries(tests))if([...selectors].some(x=>source.includes(x)))selected.add(name);
  }
  return ui?{mode:'targeted',tests:[...selected].sort(),reason:'Оформление, статический текст или адресные тесты'}:{mode:'meta',reason:'Документация или настройка проверок'};
}
module.exports={plan};
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
