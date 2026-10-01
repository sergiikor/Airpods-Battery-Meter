#!/usr/bin/env bash
#
# Airpods Battery Meter — установка из исходников.
# Не требует прав root, ставит в ~/.local/share/gnome-shell/extensions.
#
set -e
cd "${0%/*}"

EXT_NAME="Airpods Battery Meter"
EXT_UUID="Airpods-Battery-Meter@sergii"

need() {
    command -v "$1" &> /dev/null || {
        echo "Не найдено: $1. Установи пакет и запусти снова."
        echo "  Fedora: sudo dnf install $2"
        echo "  Ubuntu/Debian: sudo apt install $2"
        exit 1
    }
}

need msgfmt gettext
need gnome-extensions "gnome-shell (пакет gnome-extensions)"

echo "==> Сборка ${EXT_NAME}..."
gnome-extensions pack ./ \
    --extra-source=icons/ \
    --extra-source=lib/ \
    --extra-source=preferences/ \
    --extra-source=ui/ \
    --extra-source=assets/ \
    --podir=po \
    --force

echo "==> Установка..."
gnome-extensions install "${EXT_UUID}.shell-extension.zip" --force
rm -f "${EXT_UUID}.shell-extension.zip"

echo
echo "Готово. Дальше:"
echo "  1. Выйди из сессии и войди заново (на Wayland расширения подхватываются при входе)."
echo "  2. Включи: gnome-extensions enable ${EXT_UUID}"
echo "  3. Для AirPods/Sony/Galaxy Buds и др. нужен запущенный BudsLink (flatpak):"
echo "     flatpak install flathub io.github.maniacx.BudsLink"
