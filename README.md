# Airpods Battery Meter

Расширение GNOME Shell: индикатор заряда Bluetooth-наушников в трее
и всплывающий попап подключения в стиле Apple.

Форк [Bluetooth Battery Meter](https://github.com/maniacx/Bluetooth-Battery-Meter)
(maniacx, GPL-3.0): вся логика опроса устройств сохранена, интерфейс
перерисован. Ставится **рядом** с оригиналом (свой uuid, свои настройки).

## Что умеет

- **Попап при открытии кейса / подключении**: тёмная карточка из топ-бара —
  3D-анимация (кейс вылетает, бады поднимаются и парят), кольца заряда
  Left / Right / Case, живые Noise Control и Conversation Awareness.
  Закрытие: крестик / клик мимо / Escape / автоскрытие (пауза при наведении).
- **Меню в трее**: раскрывается само (одно устройство), зацикленная
  3D-анимация, ровный ряд колец (неизвестно — пунктир), те же режимы.
- **Индикаторы**: уровни каждого элемента в топ-баре и quick settings.
- Пороги цвета: `>50%` зелёный, `20–50%` жёлтый, `<20%` красный.

## Требования

- GNOME Shell 46–51 (проверено на 51, Wayland).
- Для AirPods / Beats / Sony / Galaxy Buds / Bose / Xiaomi и др. —
  запущенный [BudsLink](https://github.com/maniacx/BudsLink)
  (flatpak), как и в оригинале начиная с v48:
  `flatpak install flathub io.github.maniacx.BudsLink`
- Некоторым устройствам нужен experimental-режим BlueZ —
  подробности в [документации оригинала](https://maniacx.github.io/Bluetooth-Battery-Meter/).

## Установка

```sh
./install.sh
```

Дальше: выйти/войти в сессию → `gnome-extensions enable Airpods-Battery-Meter@sergii`.
Настройки: приложение «Расширения» → Airpods Battery Meter, либо
`dconf-editor` → `/org/gnome/shell/extensions/Airpods-Battery-Meter/`
(`airpods-popup-enabled`, `airpods-popup-timeout` в миллисекундах,
`0` — висеть до закрытия вручную).

Настройки от оригинала не переносятся (другая схема) — список
устройств и режимы подхватятся сами при первом подключении.

Переустановка начисто (например, перед накатом новой версии):

```sh
./uninstall.sh && ./install.sh
```

`./uninstall.sh --purge` — то же плюс сброс настроек.

## Устройство проекта

```
extension.js / prefs.js        точка входа и настройки
lib/                           логика апстрима (опрос BlueZ/UPower/BudsLink)
lib/modern/                    новый UI: попап, кольца, триггер, hero-плеер
assets/anim/{intro,connect}/   покадровые 3D-анимации + preview.mp4 + README
assets/models/                 исходная 3D-модель (airpods_4.glb)
```

Рендер кадров: `../rust_projects/hello_world/airpods_anim/`
(Three.js → PNG → ffmpeg). В Shell нет WebGL, поэтому крутим
готовые кадры через `St.DrawingArea` + cairo.

## Лицензия

GPL-3.0, как у оригинала. См. `LICENSE`.
