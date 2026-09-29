'use strict';

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

/**
 * Кольцевой индикатор заряда по моку Screen 1/2.
 * Пороги (Compact Battery Component Spec):
 *  >50%  — #33d17a (Libadwaita Green 3), оптимально
 *  20-50% — #f6d32d (Yellow 3), предупреждение
 *  <20%  — #e01b24 (Red), критично + иконка молнии при зарядке
 * level < 0 — неизвестно (пунктир), level null — disconnected.
 */
export const LEVEL_COLORS = {
    high: '#33d17a',
    mid: '#f6d32d',
    low: '#e01b24',
};

export function levelColor(level) {
    if (level == null || level < 0)
        return 'rgba(255,255,255,0.25)';
    if (level > 50)
        return LEVEL_COLORS.high;
    if (level > 20)
        return LEVEL_COLORS.mid;
    return LEVEL_COLORS.low;
}

export const BatteryRing = GObject.registerClass({
    GTypeName: 'BbmModern_BatteryRing',
}, class BatteryRing extends St.Widget {
    _init(options = {}) {
        super._init({
            style_class: 'bbm-ring',
            layout_manager: new Clutter.BinLayout(),
            x_expand: false,
            y_expand: false,
        });

        this._level = options.level ?? -1;
        this._size = options.size ?? 64;
        this._lineWidth = options.lineWidth ?? 6;
        this._charging = options.charging ?? false;
        this._label = options.label ?? '';

        this.set_size(this._size, this._size + (this._label ? 20 : 0));

        this._area = new St.DrawingArea({
            x_expand: false,
            y_expand: false,
            width: this._size,
            height: this._size,
        });
        this._area.connect('repaint', () => this._draw());
        this.add_child(this._area);

        if (this._label) {
            this._labelActor = new St.Label({
                style_class: 'bbm-ring-caption',
                text: this._label,
                x_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
            });
            // подпись под кольцом: BinLayout — кладем через второй слой-обертку
            const vbox = new St.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                x_expand: false,
            });
            // перестройка: area + подпись вертикально
            this.remove_child(this._area);
            vbox.add_child(this._area);
            vbox.add_child(this._labelActor);
            this.add_child(vbox);
        }

        this._text = new St.Label({
            style_class: 'bbm-ring-value',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });
        this.add_child(this._text);

        this._refreshText();
        this._area.queue_repaint();
    }

    setLevel(level, charging = false) {
        this._level = level;
        this._charging = charging;
        this._refreshText();
        this._area.queue_repaint();
    }

    _refreshText() {
        if (this._level == null) {
            this._text.text = '—';
            return;
        }
        if (this._level < 0) {
            this._text.text = '--';
            return;
        }
        const pct = Math.round(this._level);
        this._text.text = this._charging && pct < 100 ? `${pct}⚡` : `${pct}`;
    }

    _draw() {
        const cr = this._area.get_context();
        const s = this._size;
        const lw = this._lineWidth;
        const cx = s / 2;
        const cy = s / 2;
        const r = (s - lw) / 2 - 1;

        // фон-трека
        cr.setLineWidth(lw);
        cr.setLineCap(1); // round
        cr.setSourceRGBA(1, 1, 1, 0.12);
        cr.arc(cx, cy, r, 0, Math.PI * 2);
        cr.stroke();

        if (this._level != null && this._level >= 0) {
            const pct = Math.max(0, Math.min(100, this._level)) / 100;
            const color = levelColor(this._level);
            // hex -> rgb
            const rr = parseInt(color.slice(1, 3), 16) / 255;
            const gg = parseInt(color.slice(3, 5), 16) / 255;
            const bb = parseInt(color.slice(5, 7), 16) / 255;
            cr.setSourceRGB(rr, gg, bb);
            const start = -Math.PI / 2;
            cr.arc(cx, cy, r, start, start + pct * Math.PI * 2);
            cr.stroke();
        } else {
            // неизвестно/disconnected — пунктир
            cr.setSourceRGBA(1, 1, 1, 0.25);
            cr.setDash([4, 4], 0);
            cr.arc(cx, cy, r, 0, Math.PI * 2);
            cr.stroke();
            cr.setDash([], 0);
        }
        cr.$dispose();
    }
});
