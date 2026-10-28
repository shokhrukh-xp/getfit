'use strict';
/* 28.10, его снимок 21:07: на дуге подпись «21» ушла за край карточки — видно было «2». Карточка
   обрезает (overflow: hidden), поэтому за край экрана ничего не вылезало и прежние проверки молчали.
   Ищем текст, который рамка с обрезкой режет частично: часть видна, часть — нет. Прокрутка (auto,
   scroll) и нарочное многоточие (text-overflow: ellipsis) — не поломка; текст целиком за рамкой
   (спрятанный слайд) — тоже. Строка — функция для page.evaluate (обходчик, viewport-check). */
module.exports = function () {
  const из = [];
  const текстПрямо = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const рамкаТекста = el => {
    if (el.ownerSVGElement) return el.getBoundingClientRect();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) { if (!q.width) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
    }
    return l === Infinity ? null : { left: l, top: t, right: r, bottom: b };
  };
  const видно = el => { for (let a = el; a && a.nodeType === 1; a = a.parentElement) { const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; } return true; };
  const имя = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  for (const el of document.querySelectorAll('body *')) {
    const svg = !!el.ownerSVGElement, tag = el.tagName.toLowerCase();
    if (svg ? tag !== 'text' : (!текстПрямо(el) || ['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION'].includes(el.tagName))) continue;
    if (el.closest('[data-audit-free]') || !видно(el)) continue;
    const дет = el.closest('details'); if (дет && !дет.open && !el.closest('summary')) continue;
    const r = рамкаТекста(el); if (!r || r.right - r.left < 2) continue;
    if (getComputedStyle(el).textOverflow === 'ellipsis') continue;
    let x = true, y = true;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.textOverflow === 'ellipsis' && a === el.parentElement) { x = false; }
      const резX = ['hidden', 'clip'].includes(s.overflowX), резY = ['hidden', 'clip'].includes(s.overflowY);
      const прокрX = ['auto', 'scroll'].includes(s.overflowX), прокрY = ['auto', 'scroll'].includes(s.overflowY);
      if ((резX && x) || (резY && y)) {
        const b = a.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) break;                 /* sr-only и свёрнутое */
        const внутри = r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom;
        if (!внутри) break;                                      /* целиком за рамкой — спрятано нарочно */
        const вылет = Math.max(резX && x ? Math.max(b.left - r.left, r.right - b.right) : 0, резY && y ? Math.max(b.top - r.top, r.bottom - b.bottom) : 0);
        if (вылет > 1.5) { из.push({ вид: 'обрезано', т: имя(el) + ' «' + el.textContent.trim().slice(0, 24) + '» обрезан ' + имя(a) + ' на ' + Math.round(вылет) + 'px' }); break; }
      }
      if (прокрX) x = false; if (прокрY) y = false;
      if (!x && !y) break;
    }
  }
  return из;
};
