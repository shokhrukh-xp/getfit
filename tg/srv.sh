#!/bin/sh
# Поднимает копию сайта на 8899 для проверок.
# Копия собирается в site/ — мусорная папка, она в .gitignore.
# Работает и в контейнере (исходник getfit-tg.html рядом), и из клона
# репозитория (исходник index.html).
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SITE="$ROOT/site"
mkdir -p "$SITE/fonts" "$SITE/p"
if [ -f "$ROOT/getfit-tg.html" ]; then SRC="$ROOT/getfit-tg.html"; else SRC="$ROOT/index.html"; fi
cp "$SRC" "$SITE/index.html" || exit 1
cp "$ROOT"/fonts/*.woff2 "$SITE/fonts/" 2>/dev/null
cp "$ROOT"/catalog.json "$SITE/" 2>/dev/null
cp "$ROOT"/tg/fixtures/*.jpg "$SITE/p/" 2>/dev/null
if ! curl -s -o /dev/null -m 2 http://127.0.0.1:8899/ ; then
  (cd "$SITE" && nohup python3 -m http.server 8899 >/tmp/srv.log 2>&1 &)
  sleep 1
fi
curl -s -o /dev/null -w "site 8899: %{http_code}\n" http://127.0.0.1:8899/
