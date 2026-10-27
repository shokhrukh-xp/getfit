/* Только локальный стенд: реальное приложение и сервер консультации на SQLite.
   Остальной API — тестовые ответы mock.js. Внешние соединения запрещены CSP.
   Запуск: node tg/preview-goal-dialog.cjs [порт]. Никаких секретов/живых аккаунтов. */
const http=require('http'),fs=require('fs'),path=require('path'),M=require('./mock');
const root=path.resolve(__dirname,'..'),port=Number(process.argv[2]||8898);
const profiles={
 new:{name:'Первый вход · профиль пуст',newbie:true,me:{only:'all'},meas:[],goal:null},
 current:{name:'Профиль заполнен · обсудить 75 кг / 12%',me:{sex:'m',age:34,ht:178,bw:85.8,only:'all',level:'mid'},meas:[{date:M.TODAY,w:85.8,fat:26.3}],goal:{text:'80 кг · мышцы сохранить',wt:'down',gym:'strength',w0:85.8,kg:5.8,rate:-.3,from:M.TODAY,body:{v:1,target:80,fat:null,muscle:'preserve'}}},
 strength:{name:'Опытный · сила',me:{sex:'m',age:29,ht:182,bw:82,only:'all',level:'exp'},meas:[{date:M.TODAY,w:82,fat:19}],goal:null},
 care:{name:'Только питание · лактация',me:{sex:'f',age:31,ht:168,bw:72,only:'food',fem:{st:'lact'}},meas:[{date:M.TODAY,w:72}],goal:null}
};
const sessions={};
async function session(key){
 if(sessions[key])return sessions[key];
 const o=JSON.parse(JSON.stringify(profiles[key])),scripts=[],routes=[];
 Object.assign(o,{theme:'dark',page:'home',viz:{ok:true,allowed:true,adult:true,consent:false,photo:null,goal:o.goal},onVizRender:()=>({ok:false,error:'На локальном стенде платная генерация отключена.'})});
 const fake={async addInitScript(fn,arg){scripts.push('('+fn.toString()+')('+JSON.stringify(arg)+');');},async route(pattern,fn){routes.push({pattern,fn});},on(){},async goto(){},async evaluate(){return true;},async waitForTimeout(){}};
 await M.поднять(fake,o);
 const state={o,scripts,routes};sessions[key]=state;return state;
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const landing=()=>`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Выбор цели · локальная проверка</title><style>body{font:17px/1.6 system-ui;background:#0b191b;color:#e5f0ef;max-width:680px;margin:48px auto;padding:20px}a{display:block;background:#163739;color:#e5f0ef;border-radius:16px;padding:18px;margin:12px 0;text-decoration:none}small{color:#a7c1bf}h1{font-size:28px}</style><h1>Обсуждение и выбор цели</h1><p>Выберите вымышленный профиль и пройдите разговор. Ответы сохраняются в отдельной памяти этого стенда.</p>${Object.entries(profiles).map(([k,p])=>`<a href="/demo?who=${k}">${esc(p.name)} →</a>`).join('')}<small>Локальный рабочий вариант. Продукт не опубликован, реальные аккаунты не используются. Вопросы и сохранение работают через сервер консультации; остальные разделы показывают тестовые данные. Платная генерация отключена.</small></html>`;
(async()=>{
 for(const key of Object.keys(profiles))await session(key);
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1:'+port),key=profiles[url.searchParams.get('who')]?url.searchParams.get('who'):'current';
  res.setHeader('Cache-Control','no-store');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(landing());}
  if(url.pathname==='/demo'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(profiles[key].name)}</title><style>body{margin:0;background:#0b191b;color:#e5f0ef;font:14px system-ui}header{height:58px;box-sizing:border-box;padding:10px 16px;display:flex;align-items:center;gap:12px}a{color:#a8e4dc}iframe{width:100%;height:calc(100dvh - 58px);border:0;display:block}</style><header><a href="/">‹ Профили</a><span>Локальный стенд · ${esc(profiles[key].name)}</span></header><iframe title="Приложение Wellböl" src="/app?who=${key}"></iframe></html>`);}
  if(url.pathname.startsWith('/api/')){
   const state=await session(key),u='https://api.wellbol.com/'+url.pathname.slice(5)+url.search;
   let body='';for await(const chunk of req){body+=chunk;if(body.length>1000000){res.writeHead(413);res.end();return;}}
   const handler=state.routes.find(x=>x.pattern instanceof RegExp&&x.pattern.test(u));
   const route={request:()=>({url:()=>u,method:()=>req.method,postData:()=>body,headers:()=>req.headers}),async fulfill(o){res.writeHead(o.status||200,{'Content-Type':o.contentType||'application/json',...(o.headers||{})});res.end(o.path?fs.readFileSync(o.path):o.body||'');},async abort(){res.writeHead(404);res.end();}};
   if(!handler){res.writeHead(404);return res.end();}await handler.fn(route);return;
  }
  if(url.pathname==='/app'){
   const state=await session(key);
   const boot=state.scripts.join('\n')+`\nconst originalFetch=window.fetch.bind(window);window.fetch=(input,options)=>{let u=typeof input==='string'?input:input.url;if(/^https:\\/\\/(?:api\\.wellbol\\.com|getfit-sync\\.sh-pulatov\\.workers\\.dev)\\//.test(u)){const p=new URL(u);u='/api'+p.pathname+p.search+(p.search?'&':'?')+'who=${key}';return originalFetch(u,options);}return originalFetch(input,options);};`;
   let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[^>]+src="https:\/\/[^\"]+"[^>]*><\/script>/g,'');
   html=html.replace('<head>','<head><script>'+boot.replace(/<\/script/gi,'<\\/script')+'</script>');
   if(key!=='new')html=html.replace('</body>',`<script>window.addEventListener('load',()=>setTimeout(()=>{document.getElementById('coachnav').click();document.getElementById('goalchatopen').click();},1000));</script></body>`);
   res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; frame-src 'self';");return res.end(html);
  }
  let filename=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404);return res.end();}
  const types={'.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.css':'text/css'};res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');fs.createReadStream(filename).pipe(res);
 }catch(e){console.error(e.message);if(!res.headersSent)res.writeHead(500);res.end('Ошибка локального стенда.');}});
 server.listen(port,'127.0.0.1',()=>console.log('Локальная проверка: http://127.0.0.1:'+port));
})().catch(e=>{console.error(e);process.exitCode=1;});
