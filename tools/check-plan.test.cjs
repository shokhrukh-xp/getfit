const assert=require('node:assert/strict');const {plan}=require('./check-plan.cjs');
const html='<style>.foo{color:red}</style><p>Привет</p><script>\nfunction save(n){\n  return n+1;\n}\nfunction other(){ return 2; }\n</script>';
const change=(after,file='index.html',before=html)=>({file,before,after});
const T={food:'selector .foo', savetest:'calls save(', othert:'other()', a:'x',b:'y',c:'z',d:'w'};
assert.equal(plan([change(html.replace('red','blue'))],{}).mode,'targeted');
assert.equal(plan([change(html.replace('Привет','Здравствуйте'))],{}).mode,'targeted');
// 28.10: правка логики — адресно, по функции, внутри которой строка
const лог=plan([change(html.replace('return n+1;','return n+2;'))],T);
assert.equal(лог.mode,'targeted'); assert(лог.tests.includes('savetest')); assert(!лог.tests.includes('othert')); assert(лог.tests.includes('tyk'));
assert.equal(plan([change(html.replace('<p>','<p onclick="reset()">'))],T).mode,'targeted');
// крупная правка — полный
const много=html.replace('return n+1;',Array.from({length:320},(_,i)=>'  n+='+i+';').join('\n')+'\n  return n;');
assert.equal(plan([change(много)],T).mode,'full');
// каталог — адресно по наборам, которые его читают
const кат=plan([change('{"ex":[1]}','catalog.json','{"ex":[1,2]}')],{katalog:"fetch('catalog.json')",x:'a',y:'b',z:'c'});
assert.equal(кат.mode,'targeted'); assert(кат.tests.includes('katalog'));
assert.equal(plan([change(null,'tg/test-foo.js','y')],{}).mode,'full');
assert.equal(plan([change('x','docs/a.md','y')],{}).mode,'meta');
assert(plan([change('x','tg/test-food.js','y')],{}).tests.includes('food'));
assert(plan([change(html.replace('red','blue'))],{food:'selector .foo'}).tests.includes('food'));
assert.equal(plan([change(html.replace('red','blue')),change('x','tg/mock.js','y')],{}).mode,'full');
// только метка сборки (выпуск сервера) — наборы приложения не нужны
const сМеткой="var BUILD = '1';\n"+html;
assert.equal(plan([change(сМеткой.replace("'1'","'2'"),'index.html',сМеткой)],T).mode,'meta');
console.log('Выбор проверок: 13 сценариев пройдены');
