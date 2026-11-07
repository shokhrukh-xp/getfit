#!/bin/sh
# 07.11, его выбор «Полный прогон до „на бой“» и «Не гонять дважды»: полный прогон приложения (без ds1/ds5 —
# они после выпуска в фоне) ДО вопроса о выпуске, на закоммиченном коде. Зелёный — отметка «проверено» для
# дерева HEAD; pre-push видит отметку на том же дереве и не гоняет всё заново (выпуск ~6–7 мин вместо 15–20).
#   sh tools/prover.sh            — прогнать и отметить
#   sh tools/prover.sh --status   — что проверено
cd "$(git rev-parse --show-toplevel)" || exit 1
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
MARK="$(git rev-parse --git-dir)/getfit-proveren"
if [ "$1" = "--status" ]; then
  if [ -f "$MARK" ] && [ "$(cat "$MARK")" = "$(git rev-parse HEAD^{tree})" ]; then echo "проверено: HEAD $(git rev-parse --short HEAD)"; else echo "HEAD не проверен полным прогоном"; fi; exit 0; fi
# проверяем ровно то, что уйдёт: без незакоммиченных правок в отслеживаемых файлах
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "prover: есть незакоммиченные правки — сначала commit"; exit 1; }
TREE=$(git rev-parse HEAD^{tree}); rm -f "$MARK"
# 07.11, его выбор «Mac не засыпает»: мак не засыпает, пока идёт прогон
command -v caffeinate >/dev/null && caffeinate -i -w $$ &
LOG="${TMPDIR:-/tmp}/getfit-prover.log"
if sh tg/run.sh --без-долгих > "$LOG" 2>&1 || sh tools/shatkie.sh "$LOG"; then
  echo "$TREE" > "$MARK"
  grep -E "^Метка|^Известные|^За |ВСЕ НАБОРЫ|УПАЛО" "$LOG"
  echo "prover: зелёный — HEAD $(git rev-parse --short HEAD) отмечен, push не будет гонять всё заново"; exit 0
fi
grep -E "✗|ПРОВАЛ|УПАЛО|^За " "$LOG" | head -40
echo "prover: красное. Лог: $LOG"; exit 1
