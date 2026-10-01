#!/usr/bin/env bash
#
# Airpods Battery Meter — полное удаление.
#   ./uninstall.sh          обычное удаление (настройки сохраняются)
#   ./uninstall.sh --purge  удаление вместе с настройками
#
set -e
cd "${0%/*}"

EXT_UUID="Airpods-Battery-Meter@sergii"
SCHEMA_PATH="/org/gnome/shell/extensions/Airpods-Battery-Meter/"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/${EXT_UUID}"

if [ "$1" = "--purge" ]; then
    echo "==> Сброс настроек..."
    dconf reset -f "${SCHEMA_PATH}" || true
fi

echo "==> Отключение..."
gnome-extensions disable "${EXT_UUID}" 2> /dev/null || true

echo "==> Удаление..."
gnome-extensions uninstall "${EXT_UUID}" 2> /dev/null || true
rm -rf "${EXT_DIR}"

echo
echo "Готово. Для накатывания новой версии:"
echo "  ./uninstall.sh && ./install.sh"
echo "и перезайти в сессию."
