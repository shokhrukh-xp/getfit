'use strict';
const {chromium}=require('playwright'),S=require('./ds5-scenes'),path=require('path'),fs=require('fs');
const out=process.argv[2];if(!out)throw Error('Укажите папку снимков');fs.mkdirSync(out,{recursive:true});
(async()=>{let b=await chromium.launch();try{for(let theme of ['light','dark'])for(let width of [390,320])for(let name of S.scenes){const p=await b.newPage({viewport:{width,height:844},deviceScaleFactor:2});try{await S.open(p,name,theme);await p.screenshot({path:path.join(out,`${name}-${theme}-${width}.png`)});console.log('снято',name,theme,width);}catch(e){console.error('ОШИБКА',name,theme,width,e.message);process.exitCode=1;}finally{await p.close()}}for(const theme of ['light','dark'])for(const width of [320,390])for(const height of [844,667]){
 const p=await b.newPage({viewport:{width,height},deviceScaleFactor:2});await S.open(p,'coach',theme);await p.focus('#ctext');
 await p.evaluate(height=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:height-300});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:20});visualViewport.dispatchEvent(new Event('resize'));},height);
 await p.waitForTimeout(300);await p.screenshot({path:path.join(out,`coach-keyboard-simulated-${theme}-${width}-${height}.png`)});await p.close();
 }
}finally{await b.close()}})();
