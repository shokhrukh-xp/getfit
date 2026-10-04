'use strict';
const M=require('./mock');
const scenes=['profile','profile-fields','srez','meal','meal-edit','coach','subscription','catalog-picker','schedule','free','sport','tech','duration','program','reset','circle-settings','onboard','onboard-filled','onboard-program','onboard-question2','onboard-question3','onboard-done','body-one','strength-bodyweight','reaction-failure'];
async function open(p,name,theme){
 const o={theme,hist:M.журнал(),meas:M.замеры()};
 if(name==='body-one'||name==='strength-bodyweight'){
  o.meas=M.замеры().slice(0,name==='body-one'?1:3);o.goal={text:'75 кг',wt:'down',rate:-.6,from:M.Д(29),w0:92};
  o.progress={verdict:{state:'мало',text:'Мало замеров для сравнения.'},sila:{verdict:'растёт',up:1,flat:0,down:0,rows:[{name:'Подтягивания',was:{w:0,r:6,date:M.Д(15)},now:{w:0,r:8,date:M.Д(1)},pct:33}]}};
 }
 if(name==='reaction-failure'){o.page='circle';o.handleRoute=async r=>{if(new URL(r.request().url()).pathname!=='/react')return false;await r.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});return true;};}

 if(name.startsWith('onboard'))o.newbie=true;
 if(name==='srez')o.base=M.БАЗА+'?srez=1';
 if(name==='subscription')o.sub='нет';
 if(['catalog-picker','schedule','sport','tech','duration'].includes(name))o.page='gym';
 if(['meal','meal-edit','free'].includes(name))o.page='food';
 if(name==='circle-settings')o.page='circle';
 await M.поднять(p,o);
 if(['profile','profile-fields','program','reset','subscription'].includes(name))await p.click('#profbtn');
 if(name==='profile-fields'){await p.click('#meedit');await p.click('#zdtoggle');}
 if(name==='program')await p.click('#progedit');
 if(name==='reset')await p.click('#profreset');
 if(name==='subscription')await p.click('#sub-on');
 if(name==='coach'){await p.click('#coachfab');await p.fill('#ctext','Что лучше съесть после тренировки?');}
 if(name==='meal'||name==='meal-edit'){await p.locator('#fmeals [data-mid]').first().click();if(name==='meal-edit')await p.click('#mv-edit');}
 if(name==='catalog-picker')await p.click('#addex');
 if(name==='schedule')await p.click('#schedbtn');
 if(name==='sport')await p.click('#addsport');
 if(name==='free')await p.locator('[data-svob]').first().click();
 if(name==='circle-settings')await p.locator('[data-krug]').first().click();
 if(name==='tech'||name==='duration'){await p.locator('#list .exrow').first().click();await p.waitForTimeout(250);if(name==='tech')await p.locator('.card.exact [data-tech]').click();else{await p.locator('.card.exact .allb').click();await p.click('#finish');}}
 if(name.startsWith('onboard')&&name!=='onboard'){
  await p.fill('#wz-age','34');await p.fill('#wz-ht','176');await p.fill('#wz-bw','88');await p.locator('#g-rng').waitFor();
  if(name!=='onboard-filled'){
   await p.click('#wz-one');await p.locator('.wzq [data-opt="колени"]').waitFor();
   if(name!=='onboard-program'){await p.click('.wzq [data-opt="колени"]');await p.locator('.wzq [data-opt="кардио"]').waitFor();}
   if(name==='onboard-question3'||name==='onboard-done'){await p.click('.wzq [data-opt="кардио"]');await p.locator('.wzq [data-opt="нет"]').waitFor();if(name==='onboard-done'){await p.click('.wzq [data-opt="нет"]');await p.locator('.wzq').waitFor({state:'hidden'});}}
  }
 }
 if(name==='body-one'||name==='strength-bodyweight'){if(name==='strength-bodyweight')await p.locator('.vzsila summary').click();await p.locator('.vzbottom').scrollIntoViewIfNeeded();await p.waitForTimeout(400);return '#p-home';}
 if(name==='reaction-failure'){await p.locator('[data-lbwho]:not(.lbme)').first().click();await p.locator('.plate').first().click();await p.locator('[data-like]').click();await p.locator('.reaction-error').waitFor();await p.locator('.plate.open').scrollIntoViewIfNeeded();await p.waitForTimeout(400);return '#p-circle';}
 const ids={profile:'profm','profile-fields':'profm',srez:'srezm',meal:'mealm','meal-edit':'mealm',coach:'coachm',subscription:'subm','catalog-picker':'catalog',schedule:'schedm',free:'svm',sport:'sportm',tech:'techm',duration:'durm',program:'sborm',reset:'resetm','circle-settings':'krugm'};
 const id=ids[name]||'picker';await p.locator('#'+id+'.show').waitFor();await p.waitForTimeout(250);return '#'+id;
}
module.exports={scenes,open};
