// 28.10: замер и рабочий вес — обычный чат; повтор сохраняет ID операции.
const {chromium}=require('playwright'),assert=require('assert/strict'),M=require('./mock');
(async()=>{
 const br=await chromium.launch();try{
 const page=await br.newPage({viewport:{width:390,height:844}});const o={page:'home'};const errors=await M.поднять(page,o);const sent=[];let fail=false;
 await page.route('**/coach',async route=>{const b=route.request().postDataJSON();sent.push(b);if(fail)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Временный сбой'})});return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,reply:'Принял: '+b.text,meals:[]})});});
 await page.click('#coachnav');
 for(const text of ['85 кг сегодня утром','80 кг на приседе сделал 8 раз']){
  await page.fill('#ctext',text);await page.click('#csend');await page.waitForFunction(()=>!document.getElementById('csend').disabled);assert.equal(sent.at(-1).text,text);assert.equal(await page.locator('#goalconversation').isVisible(),false);assert(await page.locator('#chatlog').innerText().then(x=>x.includes('Принял: '+text)));
 }
 fail=true;await page.fill('#ctext','Запиши яблоко');await page.click('#csend');await page.waitForFunction(()=>!document.getElementById('csend').disabled);const before=sent.at(-1);assert(before.operation);
 fail=false;await page.click('#chatretry');await page.waitForFunction(()=>!document.getElementById('csend').disabled);assert.equal(sent.at(-1).operation,before.operation);
 await page.fill('#ctext','Хочу изменить цель');await page.click('#csend');await page.locator('#goalconversation').waitFor({state:'visible'});assert.equal(sent.length,4);assert.deepEqual(errors,[]);
 console.log('PASS вес и упражнение идут в чат, цель открывается явно, повтор сохраняет операцию');
 }finally{await br.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
