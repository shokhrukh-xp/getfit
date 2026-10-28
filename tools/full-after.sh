#!/bin/sh
# 28.10: полный прогон ПОСЛЕ выпуска, в фоне. Его выбор — «адресно, полный
# после»: перед push идут только наборы под правку, а этот скрипт сразу
# после push гоняет всё на снимке ровно отправленного коммита (git archive во
# временную папку — правки, начатые после push, на результат не влияют).
#   sh tools/full-after.sh <sha>     — хук запускает сам
#   sh tools/full-after.sh --status  — чем кончился последний прогон
# Итог: ~/Library/Caches/getfit-full-after/status — «идёт …», «ok …» или «red …»;
# на красный — уведомление на маке. Скрипт выпуска (getfit-sync/deploy.sh)
# показывает этот статус перед каждым выпуском.
# Не в /tmp: там лежит чужой node_modules (Codex) с другой версией playwright,
# и снимок подхватывал его вместо ~/pw/node_modules — всё падало за 30 с.
ST="$HOME/Library/Caches/getfit-full-after"; mkdir -p "$ST"
export NODE_PATH="$HOME/pw/node_modules"
if [ "$1" = "--status" ]; then cat "$ST/status" 2>/dev/null || echo "полных прогонов после выпуска ещё не было"; exit 0; fi
cd "$(git rev-parse --show-toplevel)" || exit 1
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
SHA=$(git rev-parse --short "${1:-HEAD}") || exit 1
DIR="$ST/src"; rm -rf "$DIR"; mkdir -p "$DIR"
echo "идёт $SHA с $(date +%H:%M)" > "$ST/status"
git archive "$SHA" | tar -x -C "$DIR" || { echo "red $SHA — не удалось снять снимок" > "$ST/status"; exit 1; }
# сверка метки и AGENTS.md в прогоне смотрит на ../getfit-sync — кладём рядом ссылку
[ -d ../getfit-sync ] && ln -sfn "$(cd ../getfit-sync && pwd)" "$ST/getfit-sync"
# старый снимок убираем ДО mv: иначе mv кладёт новый внутрь старого, и прогон идёт по старому коду
rm -rf "$ST/getfit"; mv "$DIR" "$ST/getfit" || exit 1
cd "$ST/getfit" || exit 1
S=$(date +%s)
# потоков поменьше: прогон фоновый, и следующая правка не должна с ним толкаться
export GETFIT_JOBS="${GETFIT_JOBS:-6}"
if sh tg/run.sh > "$ST/log" 2>&1; then
  echo "ok $SHA — полный прогон зелёный за $(( $(date +%s)-S )) с, $(date +%H:%M)" > "$ST/status"
else
  echo "red $SHA — полный прогон КРАСНЫЙ, $(date +%H:%M). Лог: $ST/log" > "$ST/status"
  grep -E "✗|ПРОВАЛ|УПАЛО" "$ST/log" | head -20 >> "$ST/status"
  osascript -e 'display notification "Полный прогон после выпуска красный — смотрите getfit-full-after" with title "Wellbol"' 2>/dev/null
fi
