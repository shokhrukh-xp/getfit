'use strict';
/* 07.11, его аккаунт (сухая проверка пересборки): в листе сборки он выбрал 90 минут, сервер собрал на 90,
   а после «Начать по ней» профиль стал 45 минут и без мест по дням — choose() звал wzSaveMe(), и анкета
   (WIZ: умолчание 45 минут, дней нет), которую в этот раз не открывали, переписывала профиль.
   Теперь анкета пишет в профиль, только если её открывали (wizInit). Функция берётся из index.html как есть. */
const fs = require('fs'), path = require('path'), vm = require('vm');
let плохо = 0;
const дано = (у, т) => { console.log((у ? '  ok  ' : '  ПРОВАЛ  ') + т); if (!у) плохо++; };
const исх = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const кусок = (имя) => { const i = исх.indexOf('\nfunction ' + имя + '(') + 1, л = исх.indexOf('\n', i);
  if (/\}\s*$/.test(исх.slice(i, л)) && исх.slice(i, л).split('{').length === исх.slice(i, л).split('}').length) return исх.slice(i, л);   /* однострочная */
  return исх.slice(i, исх.indexOf('\n}\n', i) + 2); };
const прогон = (wiz) => {
  const ctx = { ME: { min: 90, place: 'gym', dpl: { 0: 'gym', 6: 'gym' } }, WIZ: wiz, JSON, DB: null, WEEK: [1, 2, 3, 4, 5, 6, 0] };
  ctx.myData = () => JSON.parse(JSON.stringify(ctx.ME)); ctx.gset = (k, v) => { if (k === 'me') ctx.ME = v; };
  vm.createContext(ctx);
  ctx.местоИзДней = (д, прежнее) => прежнее; ctx.planFromText = () => null;
  vm.runInContext(кусок('wizМеста') + '\n' + кусок('wizDays') + '\n' + кусок('wzSaveMe') + '\nwzSaveMe();', ctx);
  return ctx.ME;
};
const ум = () => ({ place: 'gym', wd: null, min: 45, text: '', dpl: {} });
let me = прогон(ум());
дано(me.min === 90, 'анкету не открывали — минуты остались 90: ' + me.min);
дано(me.dpl && me.dpl[0] === 'gym' && me.dpl[6] === 'gym', 'и места по дням на месте: ' + JSON.stringify(me.dpl));
const откр = Object.assign(ум(), { inited: true, min: 60, wd: { 0: 1, 6: 1 } });
me = прогон(откр);
дано(me.min === 60, 'анкету открыли и выбрали 60 — в профиле 60: ' + me.min);
console.log(плохо ? ('ПРОВАЛОВ: ' + плохо) : 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
process.exit(плохо ? 1 : 0);
