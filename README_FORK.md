# AirPods Indicator — форк Bluetooth Battery Meter

Форк [maniacx/Bluetooth-Battery-Meter](https://github.com/maniacx/Bluetooth-Battery-Meter)
(GNOME46 ветка) с осовремененным интерфейсом в духе Libadwaita dark
и плавающим попапом подключения.

Вся логика опроса устройств (BlueZ / UPower / GATT BAS / BudsLink Flatpak)
сохранена из апстрима. Изменён только UI-слой.

## Что нового

- **Плавающий попап подключения** (мок Screen 2): центрированная тёмная
  карточка с hero-анимацией, кольцами Left / Right / Case, бейджем
  `✓ Connected`, строкой `AAC Codec • Spatial Audio Ready` и кнопкой
  `Sound Settings`. Показывается при открытии кейса / подключении
  BudsLink-устройства (появление battery1/2/3 в State), автоскрытие 4с,
  закрытие по клику вне / Escape. Антиспам: не чаще раза в 30с.
- **Кольцевые индикаторы** (`lib/modern/batteryRing.js`) с порогами из спека:
  `>50%` — `#33d17a`, `20–50%` — `#f6d32d`, `<20%` — `#e01b24`.
- **Покадровая 3D-анимация**: отрендерена из `assets/models/airpods_4.glb`
  (Three.js, см. `../rust_projects/airpods_linux/airpods_anim/`):
  `assets/frames/intro` (105 кадров 680×474, попап),
  `assets/frames/idle` (118 кадров 680×216, зарезервировано под боковую панель).
- **Настройки** (Quick Menu): `Floating connection popup` вкл/выкл,
  `Popup auto-hide timeout` (0 = висеть до закрытия вручную).
  Ключи: `airpods-popup-enabled`, `airpods-popup-timeout`.
- Шумодав в попапе не дублируется — живёт в quick-settings меню апстрима
  (дженерик `ToggleButtonsSet`, работает для всех BudsLink-устройств).

## Файлы форка

```
lib/modern/frameAnimation.js  — плеер PNG-кадров (St.ImageContent, GNOME 49+)
lib/modern/batteryRing.js     — кольцевой индикатор (St.DrawingArea + cairo)
lib/modern/airpodsPopup.js    — плавающая карточка подключения
lib/modern/popupTrigger.js    — триггер: device-added + появление зарядов
assets/frames/{intro,idle}/   — кадры анимации
assets/models/airpods_4.glb   — исходная 3D-модель
assets/*.mp4                  — референсные рендеры (wide/connect)
```

Хук: `BluetoothBatteryMeter._initModernPopup()` в `lib/bluetoothToggle.js`
(только user-сессия, в unlock-dialog попап не создаётся).

## Сборка и установка

```sh
./install.sh   # gnome-extensions pack + install (assets/ уже включён)
```

Требуется запущенный BudsLink Flatpak для AirPods/Sony/Galaxy Buds и т.д.
(как в апстриме v48+).

## Roadmap

- [ ] Боковая панель Screen 1 (шторка справа: hero + кольца + Noise Control
      Off/ANC/Transparency/Adaptive + Conversation Awareness + idle-анимация)
- [ ] Discovery-state попапа (кнопка Connect для неспаренных рядом)
- [ ] Quick Settings flyout в стиле мока Screen 2 / State 3
