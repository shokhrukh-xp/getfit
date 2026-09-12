'use strict';
/* ИМЕНА В КАТАЛОГЕ. Проверки чисто на файле, без браузера: 887 названий
   переименованы руками, и ошибка в одном из них — это чужая техника на
   экране. Ловим то, что уже случалось: дубли, служебное слово из поля
   снаряда, повтор уточнения и мышцу, которая спорит с названием. */
const fs = require('fs'), path = require('path');
const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog.json'), 'utf8')).ex;
let плохо = 0, всего = 0;
const дано = (у, т) => { всего++; console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const норм = w => String(w || '').toLowerCase().replace(/ё/g, 'е');

console.log('\n═══ имена каталога (' + cat.length + ' упражнений) ═══');

const счёт = {};
cat.forEach(x => счёт[x.n] = (счёт[x.n] || 0) + 1);
const дубли = Object.keys(счёт).filter(n => счёт[n] > 1);
дано(!дубли.length, 'одинаковых названий нет' + (дубли.length ? ': ' + дубли.slice(0, 3).join(' · ') : ''));

const служебные = cat.filter(x => /друго|прочее|unknown/i.test(x.n));
дано(!служебные.length, 'служебных слов из полей в названиях нет' +
  (служебные.length ? ': ' + служебные.slice(0, 3).map(x => x.n).join(' · ') : ''));

const повтор = cat.filter(x => {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(x.n); if (!m) return false;
  const b = ' ' + норм(m[1]) + ' ';
  return m[2].split(',').map(s => s.trim()).filter(Boolean)
    .some(p => b.indexOf(' ' + норм(p) + ' ') >= 0);
});
дано(!повтор.length, 'уточнение не повторяет слово из названия' +
  (повтор.length ? ': ' + повтор.slice(0, 3).map(x => x.n).join(' · ') : ''));

/* «сгибание на бицепс» у упражнения на бицепс бедра — это чужая техника */
const мышца = cat.filter(x => (/на бицепс/.test(норм(x.n)) && x.m !== 'biceps' && x.m !== 'forearms') ||
  (/трицепс/.test(норм(x.n)) && x.m !== 'triceps'));
дано(!мышца.length, 'мышца в названии не спорит с полем мышцы' +
  (мышца.length ? ': ' + мышца.slice(0, 3).map(x => x.n + ' [' + x.m + ']').join(' · ') : ''));

const пусто = cat.filter(x => !x.n || !x.i || !x.e || /\(\s*\)/.test(x.n));
дано(!пусто.length, 'у каждого есть id, русское и английское имя, скобки не пустые');

const ids = {}; cat.forEach(x => ids[x.i] = (ids[x.i] || 0) + 1);
const дубид = Object.keys(ids).filter(i => ids[i] > 1);
дано(!дубид.length, 'id уникальны' + (дубид.length ? ': ' + дубид.slice(0, 3).join(' · ') : ''));

console.log(плохо ? ('\nПРОВАЛОВ: ' + плохо + ' из ' + всего) : ('\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ'));
process.exit(плохо ? 1 : 0);
