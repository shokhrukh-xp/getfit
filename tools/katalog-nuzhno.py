#!/usr/bin/env python3
"""01.11.2026, макет «Каталог: доработка (A + B)», его «Да, как в макете».

У каждого упражнения:
  nd   — что нужно (пусто — ничего): db гантели, kb гиря, band резинка, bar турник,
         dips брусья, bench скамья/тумба, rings петли/кольца, ball фитбол/мяч, roll ролл,
         gym — только зал (штанга, блок, тренажёр, салазки, блины…);
  pl   — где можно: считается из nd (зал — всегда, кроме бега и роликов на улице);
  ns   — короткое имя с главным отличием («Присед со штангой», «Тяга гантелей в наклоне»);
  nsub — остальное серым («классический · хват сверху»).
Ручные поправки — в ПРАВКИ ниже, их видно глазами.

Запуск: python3 tools/katalog-nuzhno.py [--write]
"""
import json, re, sys, collections, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'catalog.json')
C = json.load(open(PATH))

HOME = {'db', 'kb', 'band', 'bar', 'bench', 'rings', 'ball', 'roll'}
STREET = {'bar', 'dips', 'rings', 'band'}

ЗАЛ = re.compile(r'салаз|sled|prowler|покрышк|tire_flip|ярм|yoke|бревн|log_lift|keg|бочк|атлас|atlas|кувалд|sledgehammer|'
                 r'rope_climb|канаты \(лаз|battling|волны канат|с цепями|цепью|chain|блин|plate|car_deadlift|рикша|rickshaw|колокол|circus|'
                 r'axle|трэп|trap_bar|harness|упряж|conan|heavy_bag|балансборд|balance_board|wrist_roller|скрутка на кисти|гиперэкстенз|'
                 r'hyperextension|otis|ab_roller|ролик для пресса|weighted|с весом|sandbag|мешок|farmers|фермер|crucifix|svend|'
                 r'london_bridges|donkey|power_stairs|скамь[яи] скотта|preacher|neck_resistance|head_harness|platform_hamstring', re.I)
ТУРНИК = re.compile(r'pull.?up|chin|inverted_row|mid_row|австралийск|muscle.?up|hanging|dead_hang|one_handed_hang|toes.to.bar|подтягивани[яе](?! ног)|'
                    r'(?<![а-я])вис(?![а-я])|в висе|из виса(?! ниже колен)|выход сил|турник|перекладин', re.I)
БРУСЬЯ = re.compile(r'брус|parallel|^dips|weighted_dips|ring_dips', re.I)
ПЕТЛИ = re.compile(r'кольц|(?<![a-z])ring|петл|trx|suspend|подвес|straps', re.I)
СКАМЬЯ = re.compile(r'скамь|bench|тумб|box|incline|decline|наклон вверх|наклон вниз|на наклонной|ступен|step.?up|platform', re.I)
УЛИЦА = re.compile(r'^bicycling$|skating|cross.country|местност|^running$|jogging', re.I)

def нужно(x):
    q, n = x['q'], x['n'] + ' ' + x['i'] + ' ' + x.get('e', '')
    s = set()
    if q in ('barbell', 'e-z curl bar', 'cable', 'machine'): s.add('gym')
    elif q == 'dumbbell': s.add('db')
    elif q == 'kettlebells': s.add('kb')
    elif q == 'bands': s.add('band')
    elif q in ('exercise ball', 'medicine ball'): s.add('ball')
    elif q == 'foam roll': s.add('roll')
    if 'из виса' in x['n'] and q == 'kettlebells':   # «взятие из виса» — гиря висит в руках, турник не нужен
        pass
    elif ТУРНИК.search(n): s.add('bar')
    if (БРУСЬЯ.search(x['i']) or 'брус' in x['n']) and not re.search(r'bench.dip|скамь|crab|plank', n, re.I): s.add('dips')
    if ПЕТЛИ.search(n) and not re.search(r'band|резин', n, re.I): s.add('rings')
    if СКАМЬЯ.search(n) and not re.search(r'стоя', x['n']):
        # отжимания с опорой, зашагивания, присед на стул — дома хватит стула или дивана, на улице — лавки
        if q in ('body only', 'other') and not re.search(r'jump|запрыг|спрыг|depth|skip|скип|sprint|спринт|shuffle|перешаг|hyperext|гиперэкст|leg_pull|leg_raise|crunch|скручив|подъём ног', n, re.I): pass
        else: s.add('bench')
    if q == 'bands' and re.search(r'pull.?up|подтяг', n, re.I): s.add('bar')
    if q in ('other', 'body only') and re.search(r'резин|(?<!it_)band(?!_and)', n, re.I) and x['i'] != 'IT_Band_and_Glute_Stretch': s.add('band')
    if re.search(r'ролл|smr', n, re.I): s.add('roll')
    if ЗАЛ.search(n): s.add('gym')
    return s

# ручные поправки после вычитки: id → (nd, pl) — nd None значит «как по правилам»
ПРАВКИ = {
    'Bicycling': (set(), 's'),
    'Skating': (set(), 's'),
    'Rope_Jumping': (set(), 'ghs'),
    'Seated_Leg_Tucks': (set(), 'ghs'),
    'Planks_With_Knee_Tuck': (set(), 'ghs'),
    # турник в проёме двери не выдержит выход силой и рычаги — это улица и зал
    'Muscle_Up': ({'bar'}, 'gs'), 'Kipping_Muscle_Up': ({'bar'}, 'gs'), 'R_Ring_Muscle_Up': ({'bar', 'rings'}, 'gs'),
    'R_Front_Lever': ({'bar'}, 'gs'), 'R_Back_Lever': ({'bar'}, 'gs'), 'R_Human_Flag': ({'bar'}, 'gs'),
    'Rocky_Pull-Ups_Pulldowns': ({'bar'}, 'ghs'),
    'R_Straight_Bar_Dips': ({'bar'}, 'gs'), 'IT_Band_and_Glute_Stretch': (set(), 'ghs'),
}
ИМЯ = {   # явные ошибки перевода в каталоге
    'Bicycling': 'Езда на велосипеде',
    'Rope_Jumping': 'Скакалка',
    'IT_Band_and_Glute_Stretch': 'Растяжка бедра сбоку и ягодиц',
    'Band_Good_Morning': 'Наклон вперёд (резинки, обычный)',
    'Band_Good_Morning_Pull_Through': 'Наклон вперёд (резинки, протяжкой)',
}

СНАРЯД = [  # слово в скобках → (предлог «с …», родительный «… гантелей», снять из подписи)
    ('штанга', 'со штангой', 'штанги'), ('гантели', 'с гантелями', 'гантелей'), ('гантель', 'с гантелью', 'гантели'),
    ('гиря', 'с гирей', 'гири'), ('блок', 'на блоке', 'блока'), ('Смит', 'в Смите', None), ('тренажёр', 'в тренажёре', None),
    ('резинки', 'с резинкой', None), ('резина', 'с резинкой', None), ('резинка', 'с резинкой', None), ('с резиной', 'с резинкой', None),
    ('EZ-гриф', 'с EZ-грифом', 'EZ-грифа'), ('набивной мяч', 'с набивным мячом', None), ('фитбол', 'на фитболе', None),
    ('ролл', 'на ролле', None), ('петли TRX', 'в петлях', None), ('гакк', 'в гакк-тренажёре', None),
]
РОДИТ = re.compile(r'^(Тяга|Жим|Жим лёжа|Протяжка)$')
РОД = {'quadriceps': 'квадрицепса', 'hamstrings': 'бицепса бедра', 'biceps': 'бицепса', 'triceps': 'трицепса', 'calves': 'икр',
       'chest': 'груди', 'shoulders': 'плеч', 'lats': 'широчайших', 'middle back': 'спины', 'lower back': 'поясницы',
       'abdominals': 'пресса', 'obliques': 'косых мышц', 'glutes': 'ягодиц', 'forearms': 'предплечий', 'neck': 'шеи',
       'traps': 'трапеций', 'adductors': 'приводящих', 'abductors': 'отводящих', 'tibialis': 'голени', 'rear delts': 'задней дельты'}
ЧАСТЬ = {'пах': 'паха', 'спина': 'спины', 'позвоночник': 'спины', 'грудь': 'груди', 'плечи': 'плеч', 'шея': 'шеи', 'поясница': 'поясницы',
         'икры': 'икр', 'квадрицепс': 'квадрицепса', 'бицепс бедра': 'бицепса бедра', 'трицепс': 'трицепса', 'бицепс': 'бицепса',
         'стопа': 'стопы', 'грушевидная': 'грушевидной мышцы', 'широчайшие': 'широчайших', 'малоберцовые': 'голени'}
ПОЗА = ['в наклоне', 'стоя', 'сидя', 'лёжа', 'над головой', 'одной рукой']

def имена(x):
    n = ИМЯ.get(x['i'], x['n'])
    m = re.match(r'^(.*?)\s*\((.*)\)\s*$', n)
    if not m: return n, ''
    base, quals = m.group(1).strip(), [t.strip() for t in m.group(2).split(',') if t.strip()]
    title, rest, сн = base, [], None
    for t in quals:
        hit = next((s for s in СНАРЯД if s[0] == t), None)
        if hit and not сн: сн = hit
        elif hit and hit[0] == 'тренажёр' and сн and сн[0] in ('Смит', 'гакк'): pass
        elif hit and сн and сн[0] == 'тренажёр' and hit[0] in ('Смит', 'гакк'): сн = hit
        elif t in ('свой вес',): pass
        elif hit and сн and hit[1] == сн[1]: pass          # «резинки, резина» — одно и то же
        else: rest.append(t)
    if base == 'Дорожка': base = 'Беговая дорожка'
    if base == 'Махи гирей' and сн and сн[0] == 'гантели': base, сн = 'Махи гантелью', None
    if сн and сн[0] == 'тренажёр' and x.get('c') == 'cardio': сн = None     # «Степпер», «Лестница» — уже тренажёры
    if сн and re.search(re.escape(сн[0][:3]), base, re.I): сн = None      # «Раскатка на ролле», «Тяга верхнего блока» — снаряд уже в имени
    if сн and сн[0] in ('набивной мяч', 'фитбол') and re.search(r'мяч|фитбол', base, re.I): сн = None
    if re.match(r'^(Растяжка|Раскатка на ролле)$', base):
        имя = next((t for t in rest if t in ('бегуна', 'танцора', 'над головой')), None)
        часть = next((t for t in rest if t in ЧАСТЬ), None)
        if имя: title = base + ' ' + имя; rest.remove(имя)
        elif часть: title = base + ' ' + ЧАСТЬ[часть]; rest.remove(часть)
        elif x.get('m') in РОД:
            title = base + ' ' + РОД[x['m']]
            мыш = C['muscles'].get(x['m'], '').lower()
            rest = [re.sub(r'^' + re.escape(мыш) + r'\s*', '', t, flags=re.I).strip() if мыш and t.lower().startswith(мыш) else t for t in rest]
            rest = [t for t in rest if t]
    if сн:
        if РОДИТ.match(base) and сн[2]:
            parts = base.split(' ', 1)
            title = parts[0] + ' ' + сн[2] + (' ' + parts[1] if len(parts) > 1 else '')
        else:
            title = base + ' ' + сн[1]
    поза = next((p for p in ПОЗА if p in rest), None)
    if поза and РОДИТ.match(base) and сн:
        title += ' ' + поза; rest.remove(поза)
    return title, ' · '.join(rest)

ch, out = [], []
for x in C['ex']:
    nd = нужно(x)
    pl = 'g'
    if not (nd - HOME) and 'gym' not in nd: pl += 'h'
    if not (nd - STREET) and 'gym' not in nd: pl += 's'
    if УЛИЦА.search(x['i']) and x['q'] != 'machine': pl = 's'
    if x['i'] in ПРАВКИ:
        a, b = ПРАВКИ[x['i']]
        if a is not None: nd = a
        pl = b
    nd = sorted(nd - {'gym'}) + (['gym'] if 'gym' in nd else [])
    if pl != x.get('pl', 'g'): ch.append((x.get('pl', 'g'), pl, ','.join(nd), x['n'], x['i']))
    ns, sub = имена(x)
    out.append((x, nd, pl, ns, sub))

if '--report' in sys.argv or '--write' not in sys.argv:
    print('изменится место:', len(ch))
    for a, b, nd, n, i in ch: print(f'  {a:>3} → {b:<3} [{nd}] {n} · {i}')
    dup = collections.Counter(o[3] for o in out)
    print('имён, у которых есть тёзки:', sum(1 for o in out if dup[o[3]] > 1))
    for name, k in dup.most_common(25): print('  ', k, name)
if '--names' in sys.argv:
    for x, nd, pl, ns, sub in out:
        if ns != x['n']: print(f"  {x['n']}  →  {ns}  ·  {sub}")
if '--write' in sys.argv:
    for x, nd, pl, ns, sub in out:
        x['pl'] = pl
        if nd: x['nd'] = nd
        else: x.pop('nd', None)
        if x['i'] in ИМЯ: x['n'] = ИМЯ[x['i']]
        x['ns'] = ns
        if sub: x['nsub'] = sub
        else: x.pop('nsub', None)
    json.dump(C, open(PATH, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('записано', len(out))
