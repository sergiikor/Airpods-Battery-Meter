'use strict';

import Clutter from 'gi://Clutter';
import Cairo from 'gi://cairo';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

/**
 * Покадровая анимация, отрендеренная из Three.js (airpods_4.glb).
 * В GNOME Shell нет WebGL — крутим готовые PNG из assets/frames.
 *
 * Бэкенд: St.DrawingArea + cairo (тот же путь, которым upstream
 * рисует свои иконки: vfunc_repaint + get_context + queue_repaint).
 * Кадр декодируется синхронно через Cairo.ImageSurface.createFromPNG
 * в тике (680×474 — единицы мс) и рисуется с фитом в аллокацию.
 * Никаких async-пайпов: всё, что может не сработать, падает в журнал
 * с путём кадра, hero при этом просто остаётся пустым.
 */
export const FrameAnimation = GObject.registerClass({
    GTypeName: 'BbmModern_FrameAnimation',
}, class FrameAnimation extends St.DrawingArea {
    _init(options = {}) {
        super._init({
            style_class: 'bbm-hero-frames',
            x_expand: true,
        });

        this._dir = options.directory;
        this._count = options.count;
        this._fps = options.fps ?? 30;
        this._loop = options.loop ?? true;
        this._width = options.width ?? 440;
        this._height = options.height ?? 306;

        this.width = this._width;
        this.height = this._height;

        this._index = 0;
        this._timerId = null;
        this._surface = null;
        this._surfaceIndex = -1;
        this._loadErrorLogged = false;
        this._paintLogged = false;

        // Первый кадр сразу, чтобы hero не был пустым до play().
        this._loadSurface(0);
    }

    get isPlaying() {
        return this._timerId !== null;
    }

    _pathFor(i) {
        return `${this._dir}/f_${String(i).padStart(4, '0')}.png`;
    }

    _loadSurface(i) {
        let surface = null;
        try {
            surface = Cairo.ImageSurface.createFromPNG(this._pathFor(i));
        } catch (e) {
            if (!this._loadErrorLogged) {
                this._loadErrorLogged = true;
                console.log(`AirpodsBatteryMeter: frame png failed: ${this._pathFor(i)}: ${e}`);
            }
            return false;
        }
        if (!surface || surface.getWidth() === 0) {
            if (!this._loadErrorLogged) {
                this._loadErrorLogged = true;
                console.log(`AirpodsBatteryMeter: frame png empty: ${this._pathFor(i)}`);
            }
            return false;
        }
        this._surface = surface;
        this._surfaceIndex = i;
        if (this.has_allocation())
            this.queue_repaint();
        return true;
    }

    vfunc_repaint() {
        if (!this._surface)
            return;
        const [w, h] = this.get_surface_size();
        if (w === 0 || h === 0)
            return;
        const cr = this.get_context();
        try {
            // Чистим буфер: иначе по краям фита остаются ошмётки
            // прошлых кадров — то самое чёрное мерцание вокруг.
            cr.save();
            cr.setOperator(Cairo.Operator.CLEAR);
            cr.paint();
            cr.restore();
            const sw = this._surface.getWidth();
            const sh = this._surface.getHeight();
            const scale = Math.min(w / sw, h / sh);
            const dx = (w - sw * scale) / 2;
            const dy = (h - sh * scale) / 2;
            cr.save();
            cr.translate(dx, dy);
            cr.scale(scale, scale);
            cr.setSourceSurface(this._surface, 0, 0);
            cr.paint();
            cr.restore();
            if (!this._paintLogged) {
                this._paintLogged = true;
                console.log('AirpodsBatteryMeter: hero painted ' +
                    `surface=${sw}x${sh} alloc=${w}x${h} frame=${this._surfaceIndex}`);
            }
        } finally {
            cr.$dispose();
        }
    }

    _tick() {
        if (!this._timerId)
            return GLib.SOURCE_REMOVE;

        try {
            this._loadSurface(this._index);
        } catch (e) {
            // Падение одного кадра не должно убивать весь таймер.
            if (!this._loadErrorLogged) {
                this._loadErrorLogged = true;
                console.log(`AirpodsBatteryMeter: frame tick failed: ${this._pathFor(this._index)}: ${e}`);
            }
        }

        this._index++;
        if (this._index >= this._count) {
            if (this._loop) {
                this._index = 0;
                console.log('AirpodsBatteryMeter: hero looped');
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
        console.log(`AirpodsBatteryMeter: hero playOnce frames=${this._count} fps=${this._fps}`);
        this._loop = false;
        this._index = 0;
        this.play();
    }

    /** Зацикленное проигрывание с начала — для hero в меню. */
    playLoop() {
        console.log('AirpodsBatteryMeter: hero playLoop');
        this._loop = true;
        this._index = 0;
        this.play();
    }

    stop() {
        if (this._timerId) {
            console.log('AirpodsBatteryMeter: hero stop');
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }
    }

    destroy() {
        this.stop();
        this._surface = null;
        super.destroy();
    }
});
