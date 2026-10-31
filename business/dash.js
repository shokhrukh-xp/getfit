/* 30.10: дашборд компании и ESG-отчёт (его ответ «Сделать на тестовой копии и снять»;
   отчёт — «участие и вовлечённость, здоровье в цифрах группы, привязка к стандартам,
   PDF в фирменном виде»). Всё — только из /web/co/dash и /web/co/report: цифры по
   группам от 10 человек, округлённо; ни имён, ни uid. Графики — свой SVG, PDF —
   pdf-lib в браузере (vendor/), шрифт Manrope (fonts/). */
var ДАШ = {}, ОТЧ = {};
function дашЗагрузить(co){
  if (ДАШ[co] && ДАШ[co].busy) return;
  ДАШ[co] = { busy: true };
  api('GET', '/web/co/dash?co=' + encodeURIComponent(co)).then(function(r){ ДАШ[co] = r; рисовать(); })
    .catch(function(e){ if (e.code !== 'web_auth') { ДАШ[co] = { err: e.message }; рисовать(); } });
}
function дашЧ(v, шаг){ if (v == null) return '—'; return число(шаг ? +(+v).toFixed(шаг) : v); }
function дашШаги(v){ return v == null ? '—' : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, S.lang === 'en' ? ',' : ' '); }
/* линия по неделям; пропуски (меньше 10 человек) — разрыв */
function дашЛиния(ряд, о){
  о = о || {};
  var W = 560, H = о.h || 180, L = 40, R = 16, T = 18, B = 28, n = ряд.length;
  var вал = ряд.filter(function(x){ return x.v != null; }).map(function(x){ return x.v; });
  if (!вал.length) return '<p class="note">' + т('Цифр пока нет: в группе меньше {0} человек.', 10) + '</p>';
  var mn = о.min != null ? о.min : Math.min.apply(null, вал), mx = о.max != null ? о.max : Math.max.apply(null, вал);
  if (mx - mn < (о.span || 1)) { var c = (mx + mn) / 2; mn = c - (о.span || 1) / 2; mx = c + (о.span || 1) / 2; if (о.min != null && mn < о.min) { mx += о.min - mn; mn = о.min; } }
  var x = function(i){ return L + (W - L - R) * (n > 1 ? i / (n - 1) : 0.5); }, y = function(v){ return T + (H - T - B) * (1 - (v - mn) / (mx - mn)); };
  var f = о.fmt || function(v){ return дашЧ(v); }, id = 'g' + Math.random().toString(36).slice(2, 8);
  var h = '<svg class="dch" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(о.label || '') + '"><defs><linearGradient id="' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>';
  for (var g = 0; g <= 2; g++) { var gv = mn + (mx - mn) * g / 2, gy = y(gv); h += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" class="dgrid"/><text x="' + (L - 6) + '" y="' + (gy + 4) + '" class="dax" text-anchor="end">' + esc(f(gv)) + '</text>'; }
  var куски = [], кус = [];
  ряд.forEach(function(p, i){ if (p.v == null) { if (кус.length) куски.push(кус); кус = []; } else кус.push([x(i), y(p.v), p]); });
  if (кус.length) куски.push(кус);
  куски.forEach(function(k){
    var d = k.map(function(q, j){ return (j ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ');
    if (k.length > 1) h += '<path d="' + d + ' L' + k[k.length - 1][0].toFixed(1) + ' ' + (H - B) + ' L' + k[0][0].toFixed(1) + ' ' + (H - B) + ' Z" fill="url(#' + id + ')"/>';
    h += '<path d="' + d + '" class="dline"/>';
    k.forEach(function(q){ h += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3" class="ddot"><title>' + esc(q[2].l + ': ' + f(q[2].v)) + '</title></circle>'; });
  });
  var посл = null; for (var i = n - 1; i >= 0; i--) if (ряд[i].v != null) { посл = i; break; }
  if (посл != null) h += '<text x="' + Math.min(x(посл), W - R - 2) + '" y="' + (y(ряд[посл].v) - 9) + '" class="dval" text-anchor="end">' + esc(f(ряд[посл].v)) + '</text>';
  [0, Math.floor((n - 1) / 2), n - 1].forEach(function(i){ if (ряд[i]) h += '<text x="' + x(i) + '" y="' + (H - 8) + '" class="dax" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + esc(ряд[i].l) + '</text>'; });
  return h + '</svg>';
}
/* столбцы: всего в компании, новые за неделю — ярче */
function дашСтолбцы(ряд){
  var W = 560, H = 180, L = 40, R = 16, T = 18, B = 28, n = ряд.length, mx = Math.max.apply(null, ряд.map(function(p){ return p.v || 0; }).concat([1]));
  mx = Math.ceil(mx / 5) * 5;
  var bw = (W - L - R) / n * 0.62, x = function(i){ return L + (W - L - R) * (i + 0.5) / n; }, y = function(v){ return T + (H - T - B) * (1 - v / mx); };
  var h = '<svg class="dch" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(т('В компании по неделям')) + '">';
  [0, mx / 2, mx].forEach(function(gv){ var gy = y(gv); h += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" class="dgrid"/><text x="' + (L - 6) + '" y="' + (gy + 4) + '" class="dax" text-anchor="end">' + Math.round(gv) + '</text>'; });
  ряд.forEach(function(p, i){
    var v = p.v || 0, нов = Math.min(v, p.new || 0), x0 = x(i) - bw / 2;
    h += '<rect x="' + x0.toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (y(0) - y(v)).toFixed(1) + '" rx="3" class="dbar"><title>' + esc(p.l + ': ' + v + (нов ? ' · ' + т('новых {0}', нов) : '')) + '</title></rect>';
    if (нов) h += '<rect x="' + x0.toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (y(0) - y(нов)).toFixed(1) + '" rx="3" class="dbar2"/>';
  });
  if (n) h += '<text x="' + (W - R) + '" y="' + (y(ряд[n - 1].v || 0) - 7) + '" class="dval" text-anchor="end">' + (ряд[n - 1].v || 0) + '</text>';
  [0, Math.floor((n - 1) / 2), n - 1].forEach(function(i){ if (ряд[i]) h += '<text x="' + x(i) + '" y="' + (H - 8) + '" class="dax" text-anchor="middle">' + esc(ряд[i].l) + '</text>'; });
  return h + '</svg>';
}
var ДАШ_МЕРЫ = [
  { k: 'active', t: 'Активны 3 дня в неделю и больше', fmt: function(v){ return Math.round(v) + '%'; }, min: 0, max: 100 },
  { k: 'score', t: 'Оценка питания, из 10', fmt: function(v){ return дашЧ(v, 1); }, min: 0, max: 10, span: 2 },
  { k: 'steps', t: 'Шагов в день', fmt: дашШаги, min: 0, span: 2000 },
  { k: 'sleep', t: 'Сон, часов', fmt: function(v){ return дашЧ(v, 2); }, min: 5, max: 9 },
  { k: 'workouts', t: 'Тренировок в неделю на человека', fmt: function(v){ return дашЧ(v, 1); }, min: 0, span: 1 },
  { k: 'foodDays', t: 'Дней с записанной едой', fmt: function(v){ return дашЧ(v, 1); }, min: 0, max: 7 }];
function дашHtml(t, c){
  var д = ДАШ[t.id];
  if (!д) { дашЗагрузить(t.id); д = ДАШ[t.id]; }
  var шапка = '<h2>' + т('Динамика за 12 недель') + '</h2>';
  if (д.err) return '<div class="card">' + шапка + '<p class="err">' + esc(д.err) + '</p></div>';
  if (д.busy) return '<div class="card">' + шапка + '<p class="empty">' + т('Загружаю…') + '</p></div>';
  var w = д.weeks || [], ок = w.filter(function(x){ return x.ok; }), последн = ок[ок.length - 1], раньше = ок.length > 4 ? ок[ок.length - 5] : ок[0];
  var дельта = function(k, f){ if (!последн || !раньше || последн[k] == null || раньше[k] == null || последн === раньше) return ''; var d = последн[k] - раньше[k]; if (Math.abs(d) < 1e-9) return '<small>' + т('как месяц назад') + '</small>'; return '<small class="' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '+' : '−') + f(Math.abs(d)) + ' ' + т('за месяц') + '</small>'; };
  var плитка = function(v, подпись, доп){ return '<div class="tile"><b>' + v + '</b><span>' + подпись + '</span>' + (доп || '') + '</div>'; };
  var плитки = '<div class="tiles dtiles">' +
    плитка(String((w[w.length - 1] || {}).members || c.members || 0), т('в программе')) +
    плитка(последн ? последн.active + '%' : '—', т('активны 3+ дня в неделю'), дельта('active', function(v){ return Math.round(v) + ' ' + т('п.п.'); })) +
    плитка(последн && последн.score != null ? дашЧ(последн.score, 1) : '—', т('оценка питания из 10'), дельта('score', function(v){ return дашЧ(v, 1); })) +
    плитка(последн ? дашШаги(последн.steps) : '—', т('шагов в день'), дельта('steps', дашШаги)) + '</div>';
  var ряд = function(k){ return w.map(function(x){ return { l: дата(x.week), v: x.ok ? x[k] : null }; }); };
  var графики = '<div class="dgridwrap">' +
    '<figure class="dfig"><figcaption>' + т('В программе по неделям') + ' <i class="dkey"></i>' + т('новые') + '</figcaption>' + дашСтолбцы(w.map(function(x){ return { l: дата(x.week), v: x.members || 0, new: x.joined || 0 }; })) + '</figure>' +
    ДАШ_МЕРЫ.map(function(м){ return '<figure class="dfig"><figcaption>' + т(м.t) + '</figcaption>' + дашЛиния(ряд(м.k), { fmt: м.fmt, min: м.min, max: м.max, span: м.span, label: т(м.t) }) + '</figure>'; }).join('') + '</div>';
  var чел = (д.ch || []).length ? '<h3 class="dh3">' + т('Челленджи') + '</h3><div class="dch-list">' + д.ch.map(function(ch){
    var г = ch.group || {};
    return '<div class="dchrow"><div><b>' + esc(ch.title) + '</b><small>' + esc(мера(ch.metric)) + ' · ' + т('цель {0}', дашШаги(ch.target)) + ' · ' + esc(дата(ch.start)) + ' – ' + esc(дата(ch.end)) + '</small></div>' +
      (г.few || г.done == null ? '<span class="note">' + т('меньше {0} участников — не показываем', 10) + '</span>' :
        '<div class="dprog"><span style="width:' + Math.max(2, г.avg) + '%"></span></div><small>' + т('в среднем пройдено {0}%', г.avg) + ' · ' + т('дошли {0}%', г.done) + (г.n ? ' · ' + т('участников {0}', г.n) : '') + '</small>') + '</div>';
  }).join('') + '</div>' : '';
  var таблица = '<details class="dtbl"><summary>' + т('Таблица по неделям') + '</summary><div class="tblwrap"><table class="tbl"><thead><tr><th>' + т('Неделя') + '</th><th class="num">' + т('В программе') + '</th><th class="num">' + т('Новые') + '</th>' +
    ДАШ_МЕРЫ.map(function(м){ return '<th class="num">' + т(м.t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    w.slice().reverse().map(function(x){ return '<tr><th scope="row">' + esc(дата(x.week)) + ' – ' + esc(дата(плюс(x.week, 6))) + '</th><td class="num">' + (x.members || 0) + '</td><td class="num">' + (x.joined || 0) + '</td>' +
      ДАШ_МЕРЫ.map(function(м){ return '<td class="num">' + (x.ok && x[м.k] != null ? м.fmt(x[м.k]) : '—') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></details>';
  return '<div class="card dash">' + шапка + плитки + графики + чел + таблица +
    '<p class="note">' + т('Только по группе от {0} человек и округлённо. Неделя считается один раз после её конца и больше не меняется. Средние — на человека за неделю.', д.min || 10) + ' ' + т('«—» — меньше {0} человек, не показываем.', д.min || 10) + '</p></div>' + отчётHtml(t);
}

/* ── ESG-отчёт ── */
function отчётПериоды(){
  var d = new Date(), г = d.getFullYear(), к = Math.floor(d.getMonth() / 3) + 1, out = [];
  for (var i = 1; i <= к; i++) out.push(г + '-Q' + i);
  out.push(String(г)); if (к <= 2) { out.unshift((г - 1) + '-Q4'); out.push(String(г - 1)); }
  return out;
}
function отчётПериодИмя(p){ var m = String(p).match(/^(\d{4})-Q(\d)$/); return m ? т('{0} квартал {1}', S.lang === 'en' ? m[2] : ['I', 'II', 'III', 'IV'][+m[2] - 1], m[1]) : т('{0} год', p); }
/* «в III квартале 2026 года» — для абзаца отчёта */
function отчётПериодВ(p){ var m = String(p).match(/^(\d{4})-Q(\d)$/), рим = m ? ['I', 'II', 'III', 'IV'][+m[2] - 1] : '';
  if (S.lang === 'en') return m ? 'In Q' + m[2] + ' ' + m[1] : 'In ' + p;
  if (S.lang === 'uz') return m ? m[1] + '-yil ' + рим + ' choragida' : p + '-yilda';
  return m ? 'В ' + рим + ' квартале ' + m[1] + ' года' : 'В ' + p + ' году'; }
function отчётHtml(t){
  var о = ОТЧ[t.id] || (ОТЧ[t.id] = { period: отчётПериоды().filter(function(p){ return /Q/.test(p); }).slice(-2, -1)[0] || отчётПериоды()[0] });
  var кнопки = '<div class="tabs" role="group">' + отчётПериоды().map(function(p){ return '<button type="button" data-a="esgp" data-v="' + esc(p) + '" aria-pressed="' + (p === о.period) + '">' + esc(отчётПериодИмя(p)) + '</button>'; }).join('') + '</div>';
  var тело = '';
  if (о.busy) тело = '<p class="empty">' + т('Собираю отчёт…') + '</p>';
  else if (о.err) тело = '<p class="err">' + esc(о.err) + '</p>';
  else if (о.r && о.r.period.id === о.period) тело = отчётВидHtml(о.r);
  return '<div class="card esg"><h2>' + т('ESG-отчёт: здоровье сотрудников') + '</h2><p class="note">' + т('Готовый раздел для годового отчёта по устойчивому развитию (социальная часть, S): участие, здоровье группы в цифрах, привязка к GRI 403-6 и ЦУР 3. Только обезличенные цифры по группам от 10 человек.') + '</p>' +
    кнопки + '<div class="btns"><button type="button" class="btn" data-a="esgshow">' + т('Показать отчёт') + '</button><button type="button" class="btn prim" data-a="esgpdf"' + (о.pdf ? ' disabled' : '') + '>' + (о.pdf ? т('Готовлю PDF…') : т('Скачать PDF')) + '</button></div>' + тело + '</div>';
}
function отчётЗагрузить(co, потом){
  var о = ОТЧ[co]; о.busy = true; о.err = ''; рисовать();
  return api('GET', '/web/co/report?co=' + encodeURIComponent(co) + '&period=' + encodeURIComponent(о.period)).then(function(r){ о.busy = false; о.r = r; рисовать(); return r; })
    .catch(function(e){ о.busy = false; if (e.code !== 'web_auth') { о.err = e.message; рисовать(); } throw e; });
}
/* тексты отчёта на трёх языках — готовые формулировки; числа подставляются, нет числа — нет предложения */
var ESG_T = {
  ru: { title: 'Укрепление здоровья работников', sub: 'ESG-отчёт · социальная часть (S)', made: 'Сформирован', period: 'Период',
    s1: '1. Участие и вовлечённость', s2: '2. Здоровье в цифрах группы', s3: '3. Привязка к стандартам', s4: '4. Методика и приватность', s5: 'Готовый абзац для годового отчёта',
    members: 'участников в конце периода', joined: 'присоединились за период', active: 'в среднем активны 3+ дня в неделю', weeks: 'недель с цифрами',
    steps: 'шагов в день', sleep: 'часов сна', workouts: 'тренировок в неделю', score: 'оценка питания из 10', food: 'дней с записанной едой в неделю', good: 'дней с оценкой от 7',
    ch: 'Челленджи периода', chline: '{0}: участвовали {1}% сотрудников, дошли до цели {2}%',
    trend: 'Динамика: от первой недели периода к последней', noData: 'За этот период в группе было меньше 10 человек — цифр нет. Это правило приватности.',
    gri: 'GRI 403-6 «Укрепление здоровья работников». Wellböl — добровольная программа укрепления здоровья, направленная на основные риски, не связанные с работой: питание, малоподвижность, сон. Компания облегчает доступ к ней: ссылка и QR-код для сотрудников, приглашения по рабочей почте, без установки — в Telegram. Участие добровольное, выйти можно в любой момент.',
    sdg: 'ЦУР 3 «Хорошее здоровье и благополучие», задача 3.4: к 2030 году на треть сократить преждевременную смертность от неинфекционных заболеваний за счёт профилактики и лечения и поддерживать психическое здоровье и благополучие. Программа работает на профилактику: питание, движение, сон.',
    method: 'Источник цифр — приложение Wellböl. Неделя — с понедельника по воскресенье; считается один раз после её конца и больше не меняется. Цифры показываются только по группе от 10 человек, округлённо: доли — с шагом 5 %, средние — с шагом 0,5, шаги — 500, сон — 15 минут. Оценка питания — оценка дня в приложении (0–10) по нормам калорий, белка, клетчатки и сахара. Компания не видит, кто участвует, и не видит ничьих личных данных: ни еды, ни веса, ни тренировок, ни здоровья.',
    para: '{period} компания {co} предлагала сотрудникам добровольную программу укрепления здоровья Wellböl (питание, физическая активность, сон).{members}{active}{health} Компания получает только обезличенные средние по группам от 10 человек; индивидуальные данные о здоровье работодателю недоступны. Раскрытие соответствует GRI 403-6 и поддерживает ЦУР 3 (задача 3.4).',
    pMembers: ' К концу периода в программе участвовали {0} сотрудников, за период присоединились {1}.', pActive: ' В среднем {0}% участников были активны 3 и более дня в неделю.',
    pHealth: ' Средние по группе: {0}.', page: 'стр.' },
  en: { title: 'Worker health promotion', sub: 'ESG report · social (S)', made: 'Generated', period: 'Period',
    s1: '1. Participation and engagement', s2: '2. Group health in numbers', s3: '3. Alignment with standards', s4: '4. Methodology and privacy', s5: 'Ready-to-use paragraph for the annual report',
    members: 'participants at period end', joined: 'joined during the period', active: 'active 3+ days a week on average', weeks: 'weeks with data',
    steps: 'steps a day', sleep: 'hours of sleep', workouts: 'workouts a week', score: 'nutrition score out of 10', food: 'days with food logged per week', good: 'days scored 7+',
    ch: 'Challenges in the period', chline: '{0}: {1}% of employees took part, {2}% reached the goal',
    trend: 'Trend from the first to the last week of the period', noData: 'The group had fewer than 10 people in this period, so no numbers are shown. This is a privacy rule.',
    gri: 'GRI 403-6 “Promotion of worker health”. Wellböl is a voluntary health promotion program addressing major non-work-related health risks: nutrition, physical inactivity and sleep. The company facilitates access: a link and QR code for employees, invitations by work email, no installation — it runs in Telegram. Participation is voluntary and people can leave at any time.',
    sdg: 'SDG 3 “Good health and well-being”, target 3.4: by 2030, reduce by one third premature mortality from non-communicable diseases through prevention and treatment, and promote mental health and well-being. The program focuses on prevention: nutrition, movement and sleep.',
    method: 'Source: the Wellböl app. A week runs Monday to Sunday; it is calculated once after it ends and never changes. Numbers are shown only for groups of 10 or more people and are rounded: shares to 5%, averages to 0.5, steps to 500, sleep to 15 minutes. The nutrition score is the app’s daily score (0–10) against calorie, protein, fiber and sugar targets. The company does not see who takes part or anyone’s personal data: no food, weight, workouts or health.',
    para: '{period}, {co} offered employees Wellböl, a voluntary health promotion program covering nutrition, physical activity and sleep.{members}{active}{health} The company receives only anonymized averages for groups of 10 or more people; individual health data is not available to the employer. This disclosure follows GRI 403-6 and supports SDG 3 (target 3.4).',
    pMembers: ' By the end of the period, {0} employees were taking part, {1} of them joined during the period.', pActive: ' On average, {0}% of participants were active 3 or more days a week.',
    pHealth: ' Group averages: {0}.', page: 'p.' },
  uz: { title: 'Xodimlar salomatligini mustahkamlash', sub: 'ESG hisoboti · ijtimoiy qism (S)', made: 'Tuzilgan sana', period: 'Davr',
    s1: '1. Ishtirok va faollik', s2: '2. Guruh salomatligi raqamlarda', s3: '3. Standartlarga bogʻliqlik', s4: '4. Uslubiyat va maxfiylik', s5: 'Yillik hisobot uchun tayyor matn',
    members: 'davr oxirida ishtirokchilar', joined: 'davr ichida qoʻshilganlar', active: 'haftasiga 3+ kun faol (oʻrtacha)', weeks: 'raqamli haftalar',
    steps: 'kunlik qadam', sleep: 'soat uyqu', workouts: 'haftalik mashgʻulot', score: 'ovqatlanish bahosi (10 dan)', food: 'haftada ovqat yozilgan kunlar', good: '7 va undan yuqori baholangan kunlar',
    ch: 'Davr challenjlari', chline: '{0}: xodimlarning {1}% ishtirok etdi, {2}% maqsadga yetdi',
    trend: 'Davrning birinchi haftasidan oxirgisigacha oʻzgarish', noData: 'Bu davrda guruhda 10 kishidan kam boʻlgan — raqamlar koʻrsatilmaydi. Bu maxfiylik qoidasi.',
    gri: 'GRI 403-6 «Xodimlar salomatligini mustahkamlash». Wellböl — ish bilan bogʻliq boʻlmagan asosiy xavflarga — ovqatlanish, kam harakatlilik va uyquga qaratilgan ixtiyoriy salomatlik dasturi. Kompaniya unga kirishni osonlashtiradi: xodimlar uchun havola va QR-kod, ish pochtasi orqali taklif, oʻrnatish shart emas — Telegramda ishlaydi. Ishtirok ixtiyoriy, istalgan payt chiqish mumkin.',
    sdg: 'BRM 3 «Sogʻlom turmush va farovonlik», 3.4-vazifa: 2030-yilgacha yuqumli boʻlmagan kasalliklardan erta oʻlimni profilaktika va davolash orqali uchdan birga kamaytirish, ruhiy salomatlik va farovonlikni qoʻllab-quvvatlash. Dastur profilaktikaga qaratilgan: ovqatlanish, harakat, uyqu.',
    method: 'Raqamlar manbai — Wellböl ilovasi. Hafta dushanbadan yakshanbagacha; u tugagach bir marta hisoblanadi va keyin oʻzgarmaydi. Raqamlar faqat 10 va undan ortiq kishilik guruh boʻyicha, yaxlitlab koʻrsatiladi: ulushlar — 5 % qadam bilan, oʻrtachalar — 0,5, qadamlar — 500, uyqu — 15 daqiqa. Ovqatlanish bahosi — ilovadagi kunlik baho (0–10): kaloriya, oqsil, kletchatka va shakar meʼyorlari boʻyicha. Kompaniya kim ishtirok etayotganini va hech kimning shaxsiy maʼlumotlarini koʻrmaydi: ovqat, vazn, mashgʻulot va salomatlik maʼlumotlari yopiq.',
    para: '{period} {co} kompaniyasi xodimlarga Wellböl ixtiyoriy salomatlik dasturini (ovqatlanish, jismoniy faollik, uyqu) taklif qildi.{members}{active}{health} Kompaniya faqat 10 va undan ortiq kishilik guruhlar boʻyicha anonim oʻrtacha koʻrsatkichlarni oladi; shaxsiy salomatlik maʼlumotlari ish beruvchiga ochiq emas. Ushbu maʼlumot GRI 403-6 ga mos va BRM 3 ni (3.4-vazifa) qoʻllab-quvvatlaydi.',
    pMembers: ' Davr oxirida dasturda {0} nafar xodim ishtirok etdi, ulardan {1} nafari davr ichida qoʻshildi.', pActive: ' Ishtirokchilarning oʻrtacha {0}% haftasiga 3 va undan ortiq kun faol boʻldi.',
    pHealth: ' Guruh boʻyicha oʻrtacha: {0}.', page: 'bet' }
};
function еТ(k){ var a = arguments, L = ESG_T[S.lang] || ESG_T.ru; return String(L[k] == null ? ESG_T.ru[k] : L[k]).replace(/\{(\d+)\}/g, function(_, i){ var x = a[+i + 1]; return x == null ? '' : x; }); }
function отчётЦифры(r){
  var h = r.health || {}, ч = [];
  if (h.steps != null) ч.push([дашШаги(h.steps), еТ('steps')]);
  if (h.sleep != null) ч.push([дашЧ(h.sleep, 2), еТ('sleep')]);
  if (h.workouts != null) ч.push([дашЧ(h.workouts, 1), еТ('workouts')]);
  if (h.score != null) ч.push([дашЧ(h.score, 1), еТ('score')]);
  if (h.foodDays != null) ч.push([дашЧ(h.foodDays, 1), еТ('food')]);
  return ч;
}
function отчётАбзац(r){
  var п = r.participation || {}, здор = отчётЦифры(r).slice(0, 4).map(function(x){ return x[0] + ' ' + x[1]; }).join(', ');
  return еТ('para').replace('{period}', отчётПериодВ(r.period.id)).replace('{co}', r.co.name)
    .replace('{members}', п.members != null ? еТ('pMembers', п.members, п.joined || 0) : '').replace('{active}', п.active != null ? еТ('pActive', п.active) : '')
    .replace('{health}', здор ? еТ('pHealth', здор) : '');
}
function отчётВидHtml(r){
  var п = r.participation || {}, ч = отчётЦифры(r);
  if (!r.enough) return '<p class="note">' + esc(еТ('noData')) + '</p>';
  var плитки = function(a){ return '<div class="tiles dtiles">' + a.map(function(x){ return '<div class="tile"><b>' + x[0] + '</b><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>'; };
  return '<div class="esgview"><h3 class="dh3">' + esc(еТ('s1')) + '</h3>' + плитки([[п.members == null ? '—' : п.members, еТ('members')], [п.joined == null ? '—' : п.joined, еТ('joined')], [п.active == null ? '—' : п.active + '%', еТ('active')], [п.weeksShown + '/' + п.weeks, еТ('weeks')]]) +
    ((п.challenges || []).length ? '<p class="note"><b>' + esc(еТ('ch')) + ':</b> ' + п.challenges.map(function(c){ return esc(еТ('chline', c.title, c.share == null ? '—' : c.share, c.done == null ? '—' : c.done)); }).join('; ') + '</p>' : '') +
    '<h3 class="dh3">' + esc(еТ('s2')) + '</h3>' + плитки(ч) +
    '<div class="dgridwrap">' + ['active', 'score', 'steps', 'sleep'].map(function(k){ var м = ДАШ_МЕРЫ.filter(function(x){ return x.k === k; })[0]; return '<figure class="dfig"><figcaption>' + т(м.t) + '</figcaption>' + дашЛиния(r.weeks.map(function(x){ return { l: дата(x.week), v: x.ok ? x[k] : null }; }), { fmt: м.fmt, min: м.min, max: м.max, span: м.span, label: т(м.t) }) + '</figure>'; }).join('') + '</div>' +
    '<h3 class="dh3">' + esc(еТ('s3')) + '</h3><p>' + esc(еТ('gri')) + '</p><p>' + esc(еТ('sdg')) + '</p>' +
    '<h3 class="dh3">' + esc(еТ('s5')) + '</h3><div class="esgpara"><p id="esgpara">' + esc(отчётАбзац(r)) + '</p><button type="button" class="btn small" data-a="copy" data-v="' + esc(отчётАбзац(r)) + '">' + т('Копировать') + '</button></div>' +
    '<h3 class="dh3">' + esc(еТ('s4')) + '</h3><p class="note">' + esc(еТ('method')) + '</p></div>';
}
/* ── PDF: pdf-lib, A4, фирменные цвета и шрифт ── */
var ПДФ_ЛИБ = null;
function скрипт(src){ return new Promise(function(ok, no){ var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function(){ no(new Error('не загрузилось: ' + src)); }; document.head.appendChild(s); }); }
function пдфЛиб(){
  if (!ПДФ_ЛИБ) ПДФ_ЛИБ = скрипт('../vendor/pdf-lib-1.17.1.min.js').then(function(){ return скрипт('../vendor/pdf-lib-fontkit-1.1.1.umd.min.js'); })
    .then(function(){ return Promise.all(['../fonts/Manrope-Regular.ttf', '../fonts/Manrope-Bold.ttf'].map(function(u){ return fetch(u).then(function(r){ if (!r.ok) throw new Error('шрифт'); return r.arrayBuffer(); }); })); });
  ПДФ_ЛИБ.catch(function(){ ПДФ_ЛИБ = null; });
  return ПДФ_ЛИБ;
}
function отчётPdf(co){
  var о = ОТЧ[co]; if (о.pdf) return;
  о.pdf = true; рисовать();
  var готов = о.r && о.r.period.id === о.period ? Promise.resolve(о.r) : отчётЗагрузить(co);
  Promise.all([готов, пдфЛиб()]).then(function(x){ return отчётPdfСобрать(x[0], x[1]); }).then(function(байты){
    var r = о.r, имя = ('Wellbol-ESG-' + r.co.name + '-' + r.period.id).replace(/[^\wА-Яа-яЁё.-]+/g, '-') + '.pdf';
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([байты], { type: 'application/pdf' })); a.download = имя; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    о.pdf = false; всплыть(т('PDF готов: {0}', имя)); рисовать();
  }).catch(function(e){ о.pdf = false; о.err = т('PDF не собрался: {0}', (e && e.message) || ''); рисовать(); });
}
async function отчётPdfСобрать(r, шрифты){
  var P = window.PDFLib, doc = await P.PDFDocument.create(); doc.registerFontkit(window.fontkit);
  doc.setTitle('Wellböl ESG — ' + r.co.name + ' — ' + r.period.id); doc.setAuthor('Wellböl'); doc.setCreator('Wellböl для компаний'); doc.setProducer('Wellböl');
  var Ф = await doc.embedFont(шрифты[0], { subset: true }), Ж = await doc.embedFont(шрифты[1], { subset: true });
  var знаки = new Set(Ф.getCharacterSet());
  var чисто = function(s){ return Array.from(String(s == null ? '' : s).replace(/ʻ/g, '‘').replace(/ʼ/g, '’').replace(/ /g, ' ')).map(function(ch){ return знаки.has(ch.codePointAt(0)) || ch === ' ' ? ch : (ch === '≈' ? '~' : '?'); }).join(''); };
  var цв = function(h){ return P.rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255); };
  var ТЁМН = цв('#0E4F5A'), АКЦ = цв('#176775'), СВЕТ = цв('#3BA3B5'), ФОН = цв('#EAF0F1'), ТЕКСТ = цв('#1F2D30'), СЕР = цв('#5A6B6E'), ЛИН = цв('#DCE5E6'), ЯНТ = цв('#F2B547'), БЕЛ = P.rgb(1, 1, 1);
  var W = 595.28, H = 841.89, М = 48, стр, y, нСтр = 0;
  var новаяСтр = function(){ стр = doc.addPage([W, H]); нСтр++; y = H - М;
    стр.drawText(чисто('Wellböl · ' + еТ('sub') + ' · ' + r.co.name + ' · ' + отчётПериодИмя(r.period.id)), { x: М, y: 24, size: 7.5, font: Ф, color: СЕР });
    стр.drawText(чисто(еТ('page') + ' ' + нСтр), { x: W - М - 30, y: 24, size: 7.5, font: Ф, color: СЕР }); };
  var строки = function(t, f, size, ширина){ var слова = чисто(t).split(' '), out = [], cur = ''; слова.forEach(function(w){ var пр = cur ? cur + ' ' + w : w; if (f.widthOfTextAtSize(пр, size) > ширина && cur) { out.push(cur); cur = w; } else cur = пр; }); if (cur) out.push(cur); return out; };
  var место = function(h){ if (y - h < 50) новаяСтр(); };
  var абзац = function(t, o){ o = o || {}; var size = o.size || 9.5, f = o.bold ? Ж : Ф, lh = size * 1.45, ш = o.w || (W - 2 * М); строки(t, f, size, ш).forEach(function(l){ место(lh); стр.drawText(l, { x: o.x || М, y: y - size, size: size, font: f, color: o.color || ТЕКСТ }); y -= lh; }); y -= o.after == null ? 6 : o.after; };
  var заголовок = function(t){ место(40); y -= 8; стр.drawRectangle({ x: М, y: y - 16, width: 4, height: 16, color: АКЦ }); стр.drawText(чисто(t), { x: М + 12, y: y - 13, size: 13, font: Ж, color: ТЁМН }); y -= 28; };
  var плитки = function(a){ var n = a.length, gap = 10, w = (W - 2 * М - gap * (n - 1)) / n, h = 58; место(h + 10);
    a.forEach(function(x, i){ var x0 = М + i * (w + gap); стр.drawRectangle({ x: x0, y: y - h, width: w, height: h, color: ФОН });
      стр.drawText(чисто(x[0]), { x: x0 + 10, y: y - 26, size: 17, font: Ж, color: АКЦ });
      строки(x[1], Ф, 7.5, w - 20).slice(0, 2).forEach(function(l, j){ стр.drawText(l, { x: x0 + 10, y: y - 39 - j * 9.5, size: 7.5, font: Ф, color: СЕР }); }); });
    y -= h + 14; };
  var график = function(ряд, о){ var w = о.w, h = о.h || 110, x0 = о.x, y0 = о.y, L = 30, B = 16, T = 14;
    стр.drawText(чисто(о.t), { x: x0, y: y0 - 9, size: 8.5, font: Ж, color: ТЕКСТ });
    var вал = ряд.filter(function(p){ return p.v != null; }).map(function(p){ return p.v; }); if (!вал.length) { стр.drawText(чисто('—'), { x: x0, y: y0 - 30, size: 9, font: Ф, color: СЕР }); return; }
    var mn = о.min != null ? о.min : Math.min.apply(null, вал), mx = о.max != null ? о.max : Math.max.apply(null, вал);
    if (mx - mn < (о.span || 1)) { var c = (mx + mn) / 2; mn = c - (о.span || 1) / 2; mx = c + (о.span || 1) / 2; if (о.min != null && mn < о.min) { mx += о.min - mn; mn = о.min; } }
    var top = y0 - T - 6, bot = y0 - h + B, n = ряд.length, X = function(i){ return x0 + L + (w - L - 6) * (n > 1 ? i / (n - 1) : 0.5); }, Y = function(v){ return bot + (top - bot) * (v - mn) / (mx - mn); };
    [mn, (mn + mx) / 2, mx].forEach(function(g){ стр.drawLine({ start: { x: x0 + L, y: Y(g) }, end: { x: x0 + w - 6, y: Y(g) }, thickness: 0.4, color: ЛИН }); стр.drawText(чисто(о.fmt(g)), { x: x0, y: Y(g) - 2.5, size: 6.5, font: Ф, color: СЕР }); });
    if (о.bars) ряд.forEach(function(p, i){ var bw = (w - L - 6) / n * 0.6, v = p.v || 0; стр.drawRectangle({ x: X(i) - bw / 2, y: bot, width: bw, height: Y(v) - bot, color: СВЕТ }); if (p.new) стр.drawRectangle({ x: X(i) - bw / 2, y: Y(v) - (Y(Math.min(v, p.new)) - bot), width: bw, height: Y(Math.min(v, p.new)) - bot, color: ЯНТ }); });
    else { var пред = null; ряд.forEach(function(p, i){ if (p.v == null) { пред = null; return; } var т2 = { x: X(i), y: Y(p.v) }; if (пред) стр.drawLine({ start: пред, end: т2, thickness: 1.8, color: АКЦ }); стр.drawCircle({ x: т2.x, y: т2.y, size: 1.8, color: АКЦ }); пред = т2; }); }
    var посл = null; for (var i = n - 1; i >= 0; i--) if (ряд[i].v != null) { посл = i; break; }
    if (посл != null) { var тx = чисто(о.fmt(ряд[посл].v)); стр.drawText(тx, { x: Math.min(X(посл), x0 + w - 6) - Ж.widthOfTextAtSize(тx, 8), y: Y(ряд[посл].v) + 5, size: 8, font: Ж, color: ТЁМН }); }
    [0, n - 1].forEach(function(i){ if (ряд[i]) стр.drawText(чисто(ряд[i].l), { x: i ? X(i) - Ф.widthOfTextAtSize(чисто(ряд[i].l), 6.5) : X(i), y: y0 - h + 4, size: 6.5, font: Ф, color: СЕР }); }); };
  var сетка = function(графики){ var gap = 18, w = (W - 2 * М - gap) / 2, h = 118; for (var i = 0; i < графики.length; i += 2) { место(h + 8); for (var j = 0; j < 2 && графики[i + j]; j++) график(графики[i + j].ряд, Object.assign({ x: М + j * (w + gap), y: y, w: w, h: h }, графики[i + j])); y -= h + 10; } };

  /* стр. 1: шапка */
  новаяСтр();
  стр.drawRectangle({ x: 0, y: H - 168, width: W, height: 168, color: ТЁМН });
  стр.drawCircle({ x: W - 70, y: H - 60, size: 120, color: АКЦ, opacity: 0.35 });
  стр.drawText('Wellböl', { x: М, y: H - 58, size: 22, font: Ж, color: БЕЛ });
  стр.drawText(чисто(еТ('sub')), { x: М, y: H - 80, size: 10, font: Ф, color: цв('#BFE3EA') });
  стр.drawText(чисто(еТ('title')), { x: М, y: H - 116, size: 20, font: Ж, color: БЕЛ });
  стр.drawText(чисто(r.co.name + ' · ' + отчётПериодИмя(r.period.id) + ' · ' + дата(r.period.from) + ' – ' + дата(r.period.to)), { x: М, y: H - 140, size: 10.5, font: Ф, color: БЕЛ });
  стр.drawText(чисто(еТ('made') + ': ' + дата(r.made)), { x: М, y: H - 156, size: 8, font: Ф, color: цв('#BFE3EA') });
  y = H - 198;
  if (!r.enough) { абзац(еТ('noData'), { size: 11 }); }
  else {
    var п = r.participation, ряд = function(k){ return r.weeks.map(function(x){ return { l: дата(x.week), v: x.ok ? x[k] : null }; }); }, м = function(k){ return ДАШ_МЕРЫ.filter(function(x){ return x.k === k; })[0]; };
    заголовок(еТ('s1'));
    плитки([[п.members == null ? '—' : String(п.members), еТ('members')], [п.joined == null ? '—' : String(п.joined), еТ('joined')], [п.active == null ? '—' : п.active + '%', еТ('active')], [п.weeksShown + '/' + п.weeks, еТ('weeks')]]);
    сетка([{ t: т('В программе по неделям'), ряд: r.weeks.map(function(x){ return { l: дата(x.week), v: x.members || 0, new: x.joined || 0 }; }), bars: true, fmt: function(v){ return String(Math.round(v)); }, min: 0 },
      { t: т(м('active').t), ряд: ряд('active'), fmt: м('active').fmt, min: 0, max: 100 }]);
    (п.challenges || []).forEach(function(c, i){ if (!i) абзац(еТ('ch') + ':', { bold: true, after: 2 }); абзац('• ' + еТ('chline', c.title, c.share == null ? '—' : c.share, c.done == null ? '—' : c.done), { after: 2 }); });
    y -= 6;
    заголовок(еТ('s2'));
    плитки(отчётЦифры(r).slice(0, 4));
    сетка(['score', 'steps', 'sleep', 'workouts'].map(function(k){ var x = м(k); return { t: т(x.t), ряд: ряд(k), fmt: x.fmt, min: x.min, max: x.max, span: x.span }; }));
    заголовок(еТ('s3'));
    абзац(еТ('gri')); абзац(еТ('sdg'));
    заголовок(еТ('s5'));
    var текст = строки(отчётАбзац(r), Ф, 9.5, W - 2 * М - 24), hh = текст.length * 13.8 + 18; место(hh);
    стр.drawRectangle({ x: М, y: y - hh, width: W - 2 * М, height: hh, color: ФОН, borderColor: СВЕТ, borderWidth: 0.8 });
    y -= 12; текст.forEach(function(l){ стр.drawText(l, { x: М + 12, y: y - 9.5, size: 9.5, font: Ф, color: ТЕКСТ }); y -= 13.8; }); y -= 16;
    заголовок(еТ('s4'));
    абзац(еТ('method'), { size: 8.5, color: СЕР });
  }
  return doc.save();
}
document.addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('[data-a^="esg"]'); if (!b || !S.co) return;
  var о = ОТЧ[S.co] || (ОТЧ[S.co] = {});
  if (b.dataset.a === 'esgp') { о.period = b.dataset.v; о.err = ''; return рисовать(); }
  if (b.dataset.a === 'esgshow') return отчётЗагрузить(S.co).catch(function(){});
  if (b.dataset.a === 'esgpdf') return отчётPdf(S.co);
});
