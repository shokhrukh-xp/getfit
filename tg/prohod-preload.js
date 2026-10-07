'use strict';
// Меняем только окружение существующих сценариев, не их утверждения.
const fs=require('fs'),path=require('path'),pw=require('playwright'),M=require('./mock');
const launch=pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch=async(...args)=>{const b=await launch(...args),np=b.newPage.bind(b);b.newPage=async o=>{const p=await np({...o,viewport:{width:+process.env.PROHOD_WIDTH,height:o?.viewport?.height||844}});await p.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'){if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/jpeg',body:fs.readFileSync(path.join(__dirname,'fixtures/a.jpg'))});return r.abort();}let f=u.pathname==='/'?'index.html':u.pathname.slice(1);if(f.startsWith('p/'))f='tg/fixtures/'+f.slice(2);try{await r.fulfill({body:fs.readFileSync(path.resolve(__dirname,'..',f)),contentType:({'.html':'text/html','.json':'application/json','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png'})[path.extname(f)]||'application/octet-stream'})}catch{await r.fulfill({status:404,body:''})}});return p};return b};
const up=M.поднять;M.поднять=(p,o={})=>{o.theme=process.env.PROHOD_THEME;return up(p,o)};
