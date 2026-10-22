#!/usr/bin/env python3
"""Миниатюры кадров упражнений для списков (22.10, его слова «картинки фото
грузятся очень долго»). Полные кадры free-exercise-db (Unlicense) — 850 px и
~73 КБ, а показываются кружком 44–128 px. Здесь — 300 px, JPEG q72 (~9 КБ).

Запуск из корня getfit (нужен Pillow):
    python3 tools/miniatury.py            — докачать недостающие и пересобрать
Кладёт img/t/<id>-0.jpg и -1.jpg для каждого упражнения каталога с картинкой
на CDN и img/t/o/<ph>-0/1.jpg для своих кадров из img/ (отдельная папка:
на маке регистр в именах не различается, а «plank» свой и «Plank» каталожный). Приложение берёт
миниатюру, а если её нет — полный кадр (data-full), так что новое упражнение
в каталоге без миниатюры просто грузится дольше, а не ломается.
"""
import io, json, os, sys, urllib.request
from PIL import Image

КОРЕНЬ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ВЫХОД = os.path.join(КОРЕНЬ, 'img', 't')
CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'
RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'   # jsDelivr отдаёт 403 на пару кадров
ШИРИНА, КАЧЕСТВО = 300, 72


def ужать(данные, куда):
    im = Image.open(io.BytesIO(данные)).convert('RGB')
    h = round(im.height * ШИРИНА / im.width)
    im.resize((ШИРИНА, h), Image.LANCZOS).save(куда, 'JPEG', quality=КАЧЕСТВО, optimize=True, progressive=True)


def скачать(путь):
    for база in (CDN, RAW):
        try:
            with urllib.request.urlopen(база + путь, timeout=30) as r:
                return r.read()
        except Exception:
            pass
    return None


def main():
    os.makedirs(ВЫХОД, exist_ok=True)
    кат = json.load(open(os.path.join(КОРЕНЬ, 'catalog.json'), encoding='utf-8'))
    ids = sorted({x['i'] for x in кат['ex'] if x.get('i') and not x.get('own')})
    нет = []
    for i in ids:
        for n in (0, 1):
            куда = os.path.join(ВЫХОД, '%s-%d.jpg' % (i, n))
            if os.path.exists(куда):
                continue
            д = скачать('%s/%d.jpg' % (i, n))
            if д: ужать(д, куда)
            else: нет.append('%s/%d' % (i, n))
    os.makedirs(os.path.join(ВЫХОД, 'o'), exist_ok=True)
    for f in os.listdir(os.path.join(КОРЕНЬ, 'img')):
        if f.endswith(('-0.jpg', '-1.jpg')):
            куда = os.path.join(ВЫХОД, 'o', f)
            if not os.path.exists(куда):
                ужать(open(os.path.join(КОРЕНЬ, 'img', f), 'rb').read(), куда)
    print('готово; без кадра:', ', '.join(нет) or 'нет')
    return 1 if нет else 0


if __name__ == '__main__':
    sys.exit(main())
