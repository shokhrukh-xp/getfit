'use strict';
/* Реальные функции редактора: пары остаются вместе, подбор не предлагает
   занятое в другом дне, свои без id или глобально отклонённое упражнение. */
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const part=(a,b)=>code.slice(code.indexOf('function '+a+'('),code.indexOf('function '+b+'('));
const items=[
 {i:'old',n:'Разведение (гантели)',m:'shoulders',m2:'rear delts',q:'dumbbell'},
 {i:'rear',n:'Разведение (блок)',m:'shoulders',m2:'rear delts',q:'cable'},
 {i:'front',n:'Подъём перед собой',m:'shoulders',q:'dumbbell'},
 {i:'busy',n:'Занято',m:'shoulders',m2:'rear delts'},
 {i:'named',n:'Своё упражнение',m:'shoulders',m2:'rear delts'},
 {i:'no',n:'Не нравится',m:'shoulders',m2:'rear delts'},
 {i:'bike',n:'Велотренажёр',m:'shoulders',c:'cardio'}
];
const sandbox={CAT:{ex:items},NOPE:{no:1},catById:id=>items.find(x=>x.i===id),catKind:x=>x.c||'strength',noYo:s=>String(s||'').toLowerCase().replace(/ё/g,'е'),мышцаЕго:()=> 'shoulders'};
vm.createContext(sandbox);vm.runInContext(part('aiСдвинуть','aiЧерновикВыбрать')+part('aiТриКандидата','aiТриHtml'),sandbox);
const day={ex:[{n:'A1',ss:'A'},{n:'A2',ss:'A'},{n:'B'},{n:'C1',ss:'C'},{n:'C2',ss:'C'}]};
assert.equal(sandbox.aiСдвинуть(day,0,1),true);assert.deepEqual(Array.from(day.ex,x=>x.n),['B','A1','A2','C1','C2']);
assert.equal(sandbox.aiСдвинуть(day,2,-1),true);assert.deepEqual(Array.from(day.ex,x=>x.n),['A1','A2','B','C1','C2']);
assert.equal(sandbox.aiСдвинуть(day,4,1),false);assert.equal(day.ex[4].ss,'C');
const ctx={day:0,index:0,draft:{days:[{ex:[{id:'old',n:items[0].n,m:'shoulders'}]},{ex:[{id:'busy',n:'Занято'},{n:'СВОЕ УПРАЖНЕНИЕ'}]}]}};
const list=sandbox.aiТриКандидата(ctx).map(x=>x.i);
assert.deepEqual(Array.from(list),['rear','front']);
console.log('PASS: суперсеты перемещаются блоками, границы порядка, подгруппа дельт, исключение занятых/своих/отклонённых/другого типа');
