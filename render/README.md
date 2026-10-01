# Рендер 3D-анимаций

В GNOME Shell нет WebGL — hero-анимации это заранее отрендеренные
PNG-кадры (`../assets/anim/`). Рендерятся здесь: Three.js +
`airpods_4.glb` через headless Chromium (puppeteer + SwiftShader).

## Подготовка (один раз)

```sh
cd render
npm install          # puppeteer (~chrome) + three
ffmpeg -version      # нужен ffmpeg для нарезки
```

`node_modules/` в git не коммитится.

## Быстрая проверка сцены (секунды)

```sh
# T — момент времени сцены, OUT — куда положить кадр
T=6 OUT=/tmp/shot.png node test_final.js            # index.html (intro)
PAGE=index_connect.html T=6 OUT=/tmp/shot.png node test_final.js
```

## connect/ — hero меню (зацикленный ховер)

Сцена `index_connect.html`, движение: вылет → бады вверх → парение
со встречным покачиванием. Цикл бесшовный по построению:

- `DUR=9.0`, sway с периодом ровно 5с → отрезок t=4.0–9.0 (idle 1.0–6.0)
  начинается и заканчивается в одной фазе;
- камера заморожена при t≥4.0 (`Math.min(t,4.0)`);
- 15fps → кадры 60–135 (76 шт).

```sh
node render_connect.js              # 0..9.0с @15fps → frames_connect/ (136 кадров)
# нарезка цикла + кроп в проект:
i=0; for f in frames_connect/f_*.png; do n=$(basename $f | sed 's/f_//;s/.png//'); nn=$((10#$n))
if [ $nn -ge 60 ] && [ $nn -le 135 ]; then b=$(printf "f_%04d.png" $i)
ffmpeg -hide_banner -loglevel error -y -i "$f" \
  -vf "crop=460:585:410:15,scale=400:-2:flags=lanczos" \
  -compression_level 100 -pix_fmt rgba "../assets/anim/connect/frames/$b"; i=$((i+1)); fi; done
# проверка шва (должен быть 0):
python3 -c "from PIL import Image; import numpy as np
a=np.array(Image.open('../assets/anim/connect/frames/f_0000.png').convert('RGBA')).astype(int)
b=np.array(Image.open('../assets/anim/connect/frames/f_0075.png').convert('RGBA')).astype(int)
print('seam:', np.abs(a-b).sum())"
```

Плеер: `lib/modern/frameAnimation.js` (`playLoop`), размер виджета
240×305 под кадры 400×508.

## intro/ — hero попапа (однократно)

Сцена `index.html`, 105 кадров 680×440 @15fps: кейс открывается,
бады вылетают и разъезжаются ровно над кольцами L/R.
Рендерится аналогично полному таймлайну + кроп под финал;
текущий сет в `assets/anim/intro/frames` — эталонный.

## Approval-видео

```sh
node render_approval.js   # PNG в assets/preview_frames + mp4 рядом
```

`assets/preview_frames/` в git не коммитится.
