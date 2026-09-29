'use strict';

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

/**
 * Покадровая анимация, отрендеренная из Three.js (airpods_4.glb).
 * В GNOME Shell нет WebGL — крутим готовые PNG из assets/frames.
 *
 * Бэкенд: Clutter.Image + GdkPixbuf. Синхронный и предсказуемый:
 * кадр декодируется в тике (680×474 PNG — единицы мс в C), грузится
 * в GPU-текстуру и ставится контентом виджета. Никакого async-пайпа
 * St.ImageContent — тот молча показывал пустоту при любой проблеме.
 */
export const FrameAnimation = GObject.registerClass({
    GTypeName: 'BbmModern_FrameAnimation',
}, class FrameAnimation extends St.Widget {
    _init(options = {}) {
        super._init({
            style_class: 'bbm-hero-frames',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
        });

        this._dir = options.directory;
        this._count = options.count;
        this._fps = options.fps ?? 30;
        this._loop = options.loop ?? true;
        this._width = options.width ?? 440;
        this._height = options.height ?? 306;

        // Явный минимальный размер — иначе виджет может схлопнуться в ноль
        // и кадры не будет видно, хотя декодирование идёт нормально.
        this.set_width(this._width);
        this.set_height(this._height);

        this._index = 0;
        this._timerId = null;
        this._loadErrorLogged = false;

        // Первый кадр сразу, чтобы hero не был пустым до play().
        this._showFrame(0);
    }

    get isPlaying() {
        return this._timerId !== null;
    }

    _pathFor(i) {
        return `${this._dir}/f_${String(i).padStart(4, '0')}.png`;
    }

    _decode(i) {
        let pix = GdkPixbuf.Pixbuf.new_from_file(this._pathFor(i));
        if (!pix.get_has_alpha())
            pix = pix.add_alpha(false, 0, 0, 0);
        return pix;
    }

    _showFrame(i) {
        try {
            return this._showFrameUnsafe(i);
        } catch (e) {
            // Hero никогда не роняет попап: логируем один раз и живём без кадров.
            if (!this._loadErrorLogged) {
                this._loadErrorLogged = true;
                console.log(`AirpodsBatteryMeter: frame show failed: ${this._pathFor(i)}: ${e}\n${e.stack}`);
            }
            return false;
        }
    }

    _showFrameUnsafe(i) {
        let pix;
        try {
            pix = this._decode(i);
        } catch (e) {
            if (!this._loadErrorLogged) {
                this._loadErrorLogged = true;
                console.log(`AirpodsBatteryMeter: frame decode failed: ${this._pathFor(i)}: ${e}`);
            }
            return false;
        }

        const image = new Clutter.Image();
        const ok = image.set_data(
            pix.get_pixels(),
            Cogl.PixelFormat.RGBA_8888,
            pix.get_width(), pix.get_height(), pix.get_rowstride());
        if (!ok) {
            if (!this._loadErrorLogged) {
                this._loadErrorLogged = true;
                console.log(`AirpodsBatteryMeter: frame upload failed: ${this._pathFor(i)}`);
            }
            return false;
        }
        if (!this._firstFrameLogged) {
            this._firstFrameLogged = true;
            console.log('AirpodsBatteryMeter: first frame decoded ' +
                `${pix.get_width()}x${pix.get_height()} from ${this._pathFor(i)}`);
        }
        this.set_content(image);
        return true;
    }

    _tick() {
        if (!this._timerId)
            return GLib.SOURCE_REMOVE;

        this._showFrame(this._index);

        this._index++;
        if (this._index >= this._count) {
            if (this._loop) {
                this._index = 0;
            } else {
                this._timerId = null;
                return GLib.SOURCE_REMOVE;
            }
        }
        return GLib.SOURCE_CONTINUE;
    }

    play() {
        if (this._index >= this._count)
            this._index = 0;
        if (this._timerId)
            return;
        this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            Math.round(1000 / this._fps), () => this._tick());
    }

    /** Однократное проигрывание с начала — для попапа подключения. */
    playOnce() {
        this._loop = false;
        this._index = 0;
        this.play();
    }

    stop() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }
    }

    destroy() {
        this.stop();
        this.set_content(null);
        super.destroy();
    }
});
