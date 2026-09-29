'use strict';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {FrameAnimation} from './frameAnimation.js';
import {BatteryRing} from './batteryRing.js';

/**
 * Попап подключения (Screen 2, primary state).
 *
 * Показывается при открытии кейса / подключении BudsLink-устройства:
 * device-added + первое появление battery1/2/3 в State.
 * Дропдаун из топ-бара справа (как системное меню): тёмная Libadwaita-
 * карточка, hero-анимация (assets/frames/intro, 105 кадров),
 * три кольца L/R/Case, футер "AAC Codec • Spatial Audio Ready"
 * + кнопка Sound Settings. Панель не перекрывает, остальной экран
 * не блокирует; закрытие — крестик / Escape / автоскрытие.
 *
 * Шумодав в попапе не дублируем — он уже есть в quick-settings меню
 * (upstream ToggleButtonsSet); сюда пробрасываем только чтение/показ.
 */
export const AirpodsPopup = GObject.registerClass({
    GTypeName: 'BbmModern_AirPodsPopup',
}, class AirpodsPopup extends GObject.Object {
    _init(extPath, settings) {
        super._init();
        this._extPath = extPath;
        this._settings = settings;
        this._visible = false;
        this._hideId = 0;
        this._snoozeUntil = 0;
        this._heroLogged = false;

        this._build();
    }

    get visible() {
        return this._visible;
    }

    /** Позиция дропдауна: справа под топ-баром, как системное меню. */
    _placeCard() {
        const monitor = Main.layoutManager.primaryMonitor;
        const panelH = Main.panel?.height ?? 34;
        const CARD_W = 500;
        const MARGIN = 12;
        this._card.set_position(
            Math.round(monitor.x + monitor.width - CARD_W - MARGIN),
            Math.round(monitor.y + panelH + 10));
    }

    _build() {
        this._card = new St.Widget({
            style_class: 'bbm-float-card',
            layout_manager: new Clutter.BinLayout(),
            visible: false,
            reactive: true,
        });

        const box = new St.BoxLayout({
            style_class: 'bbm-float-box',
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
        });

        // --- header: alias + Connected + close ---
        const header = new St.BoxLayout({
            style_class: 'bbm-float-header',
            x_expand: true,
        });
        this._title = new St.Label({
            style_class: 'bbm-float-title',
            text: 'AirPods',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        header.add_child(this._title);

        this._badge = new St.Label({
            style_class: 'bbm-float-badge',
            text: '✓ Connected',
            y_align: Clutter.ActorAlign.CENTER,
        });
        header.add_child(this._badge);

        const close = new St.Button({
            style_class: 'bbm-float-close',
            can_focus: true,
        });
        close.set_child(new St.Icon({
            icon_name: 'window-close-symbolic',
            icon_size: 14,
        }));
        close.connect('clicked', () => this.hide(true));
        header.add_child(close);
        box.add_child(header);

        // --- hero ---
        const heroWrap = new St.Widget({
            style_class: 'bbm-float-hero',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
        });
        this._hero = new FrameAnimation({
            directory: `${this._extPath}/assets/frames/intro`,
            count: 105,
            fps: 15,
            loop: false,
            width: 440,
            height: 306,
        });
        heroWrap.add_child(this._hero);
        box.add_child(heroWrap);

        // --- battery row ---
        const row = new St.BoxLayout({
            style_class: 'bbm-float-battery-row',
            x_expand: true,
        });
        this._rings = {};
        for (const [key, label] of [['left', 'Left'], ['right', 'Right'], ['case', 'Case']]) {
            const cell = new St.BoxLayout({
                style_class: 'bbm-float-cell',
                orientation: Clutter.Orientation.VERTICAL,
                x_expand: true,
            });
            const ring = new BatteryRing({level: -1, size: 56, lineWidth: 6});
            cell.add_child(ring);
            cell.add_child(new St.Label({
                style_class: 'bbm-float-cell-label',
                text: label,
                x_align: Clutter.ActorAlign.CENTER,
            }));
            row.add_child(cell);
            this._rings[key] = ring;
        }
        box.add_child(row);

        // --- footer ---
        const footer = new St.BoxLayout({
            style_class: 'bbm-float-footer',
            x_expand: true,
        });
        footer.add_child(new St.Label({
            style_class: 'bbm-float-codec',
            text: '● AAC Codec • Spatial Audio Ready',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        box.add_child(footer);

        this._card.add_child(box);

        this._keyId = global.stage.connect('key-press-event', (_stage, event) => {
            if (this._visible && event.get_key_symbol() === Clutter.KEY_Escape) {
                this.hide(true);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Клик мимо карточки закрывает попап. Хендлер только наблюдает
        // (PROPAGATE) — ничего не блокирует, панель остаётся кликабельной.
        this._clickId = global.stage.connect('button-press-event', (_stage, event) => {
            if (!this._visible || !this._card)
                return Clutter.EVENT_PROPAGATE;
            const [x, y] = event.get_coords();
            const [cx, cy] = this._card.get_transformed_position();
            const cw = this._card.get_width();
            const ch = this._card.get_height();
            const outside = x < cx || x > cx + cw || y < cy || y > cy + ch;
            console.log('AirpodsBatteryMeter: stage click ' +
                `at=${Math.round(x)},${Math.round(y)} card=${Math.round(cx)},${Math.round(cy)} ${cw}x${ch} outside=${outside}`);
            if (outside)
                this.hide(true);
            return Clutter.EVENT_PROPAGATE;
        });

        Main.layoutManager.addChrome(this._card);
    }

    /**
     * Показать попап. levels: {alias, left, right, caseLevel, charging}.
     * Повторные вызовы во время показа только обновляют цифры.
     */
    show(levels = {}) {
        if (!this._settings.get_boolean('airpods-popup-enabled'))
            return;

        if (levels.alias)
            this._title.text = levels.alias;
        this.update(levels);

        // Ручное закрытие ставит snooze: флэппинг State не должен
        // тут же возвращать попап. Автоскрытие snooze не ставит.
        if (Date.now() < this._snoozeUntil)
            return;

        if (!this._heroLogged) {
            this._heroLogged = true;
            const probe = Gio.File.new_for_path(
                `${this._extPath}/assets/frames/intro/f_0000.png`);
            console.log('AirpodsBatteryMeter: popup show ' +
                `alias=${levels.alias} L=${levels.left} R=${levels.right} ` +
                `C=${levels.caseLevel ?? levels.case} ` +
                `frame0exists=${probe.query_exists(null)}`);
        }

        if (this._visible)
            return;
        this._visible = true;
        this._placeCard();
        // Появление мгновенное, как у системного меню: fade поверх
        // покадровой анимации давал мерцание тени вокруг карточки.
        this._card.remove_all_transitions();
        this._card.opacity = 255;
        this._card.visible = true;
        this._hero.playOnce();
        this._armAutoHide();
    }

    update(levels = {}) {
        const pick = v => (typeof v === 'number' && v >= 0 ? v : -1);
        if ('left' in levels)
            this._rings.left.setLevel(pick(levels.left), !!levels.charging);
        if ('right' in levels)
            this._rings.right.setLevel(pick(levels.right), !!levels.charging);
        if ('caseLevel' in levels || 'case' in levels)
            this._rings.case.setLevel(pick(levels.caseLevel ?? levels.case), !!levels.caseCharging);
    }

    hide(manual = false) {
        if (!this._visible)
            return;
        this._visible = false;
        if (manual)
            this._snoozeUntil = Date.now() + 20_000;
        if (this._hideId) {
            GLib.source_remove(this._hideId);
            this._hideId = 0;
        }
        this._hero.stop();
        this._card.remove_all_transitions();
        this._card.ease({
            opacity: 0,
            duration: 260,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                if (!this._visible)
                    this._card.visible = false;
            },
        });
    }

    _armAutoHide() {
        if (this._hideId)
            GLib.source_remove(this._hideId);
        const timeout = this._settings.get_int('airpods-popup-timeout');
        if (timeout <= 0) {
            this._hideId = 0;
            return;
        }
        this._hideId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, () => {
            this._hideId = 0;
            this.hide();
            return GLib.SOURCE_REMOVE;
        });
    }

    destroy() {
        if (this._hideId) {
            GLib.source_remove(this._hideId);
            this._hideId = 0;
        }
        if (this._keyId) {
            global.stage.disconnect(this._keyId);
            this._keyId = null;
        }
        if (this._clickId) {
            global.stage.disconnect(this._clickId);
            this._clickId = null;
        }
        this._hero?.destroy();
        this._card?.destroy();
        this._card = null;
        super.destroy?.();
    }
});
