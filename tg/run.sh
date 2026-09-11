#!/bin/sh
# Прогон всех проверок. Долгие запускать через nohup в фоне и смотреть лог.
cd "$(dirname "$0")/.." || exit 1
sh tg/srv.sh || exit 1
bad=0
for t in tg/test-*.js; do
  echo ""; echo "═══ $t ═══"
  node "$t" || bad=$((bad+1))
done
echo ""
[ "$bad" -eq 0 ] && echo "ВСЕ НАБОРЫ ПРОЙДЕНЫ" || echo "УПАЛО НАБОРОВ: $bad"
exit $bad
