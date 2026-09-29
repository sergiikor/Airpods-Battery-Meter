'use strict';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

/**
 * Покадровая анимация, отрендеренная из Three.js (airpods_4.glb).
 * В GNOME Shell нет WebGL — крутим готовые PNG из assets/frames.
 *
 * Бэкенд: St.ImageContent (каноничная замена удалённому St.Image).
 * Кадры грузятся асинхронно, держим скользящее окно из cacheSize
 * готовых контентов. Виджету задан явный размер — без него Shell
 * может выделить 0px и кадры не будет видно при успешной загрузке.
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
        this._cacheSize = options.cacheSize ?? 20;

        this.set_width(this._width);
        this.set_height(this._height);

        this._contents = new Map();
        this._index = 0;
        this._timerId = null;
        this._skips = 0;
        this._loadErrorLogged = false;
        this._assignedLogged = false;

        this._current = new St.ImageContent({
            preferred_width: this._width,
            preferred_height: this._height,
        });
        this.set_content(this._current);

        this._preload(0);
    }

    get isPlaying() {
        return this._timerId !== null;
    }

    _pathFor(i) {
        return `${this._dir}/f_${String(i).padStart(4, '0')}.png`;
    }

    _ensure(i) {
        if (this._contents.has(i) || i < 0 || i >= this._count)
            return;

        const content = new St.ImageContent({
            preferred_width: this._width,
            preferred_height: this._height,
        });
        const entry = {content, ready: false};
        this._contents.set(i, entry);

        try {
            content.load_async(Gio.File.new_for_path(this._pathFor(i)), null, (obj, res) => {
                try {
                    obj.load_finish(res);
                    entry.ready = true;
                } catch (e) {
                    if (!this._loadErrorLogged) {
                        this._loadErrorLogged = true;
                        console.log(`AirpodsBatteryMeter: frame load failed: ${this._pathFor(i)}: ${e}`);
                    }
                    entry.ready = true;
                }
            });
        } catch (e) {
            if (!this._loadErrorLogged) {
                this._loadErrorLogged = true;
                console.log(`AirpodsBatteryMeter: frame load failed: ${this._pathFor(i)}: ${e}`);
            }
            entry.ready = true;
        }
    }

    _preload(center) {
        for (let i = 0; i < this._cacheSize; i++)
            this._ensure(center + i);
        for (const key of [...this._contents.keys()]) {
            if (key < center || key >= center + this._cacheSize)
                this._contents.delete(key);
        }
    }

    _assign(entry, i) {
        try {
            this._current = entry.content;
            this.set_content(entry.content);
        } catch (e) {
            if (!this._loadErrorLogged) {
                this._loadErrorLogged = true;
                console.log(`AirpodsBatteryMeter: frame assign failed: ${this._pathFor(i)}: ${e}`);
            }
            return;
        }
        if (!this._assignedLogged) {
            this._assignedLogged = true;
            console.log('AirpodsBatteryMeter: first frame assigned ' +
                `${this.get_width()}x${this.get_height()} from ${this._pathFor(i)}`);
        }
    }

    _tick() {
        if (!this._timerId)
            return GLib.SOURCE_REMOVE;

        const entry = this._contents.get(this._index);
        if (entry?.ready) {
            this._assign(entry, this._index);
            this._skips = 0;
        } else {
            this._skips++;
            if (this._skips > 60) {
                this.stop();
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        }

        this._index++;
        if (this._index >= this._count) {
            if (this._loop) {
                this._index = 0;
                this._preload(0);
            } else {
                this._timerId = null;
                return GLib.SOURCE_REMOVE;
            }
        } else {
            this._preload(this._index);
        }
        return GLib.SOURCE_CONTINUE;
    }

    play() {
        if (this._index >= this._count)
            this._index = 0;
        this._preload(this._index);
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
        this._contents.clear();
        this.set_content(null);
        super.destroy();
    }
});
