#!/bin/sh
# Прогон всех проверок. Долгие запускать через nohup в фоне и смотреть лог.
cd "$(dirname "$0")/.." || exit 1
sh tg/srv.sh || exit 1
bad=0
for t in tg/test-*.js; do
  echo ""; echo "═══ $t ═══"
  node "$t" || bad=$((bad+1))
done
# Обходчик экранов и тыкалка: они смотрят не сценарий, а механику — ошибки JS,
# вылет за край, текст в колонку, цели нажатия, перекрытия, мёртвые нажатия.
# Полный обход всех размеров экрана: sh tg/run.sh --все
for t in tg/audit.js tg/tyk.js; do
  echo ""; echo "═══ $t ═══"
  node "$t" "$@" || bad=$((bad+1))
done
echo ""
[ "$bad" -eq 0 ] && echo "ВСЕ НАБОРЫ ПРОЙДЕНЫ" || echo "УПАЛО НАБОРОВ: $bad"
exit $bad
