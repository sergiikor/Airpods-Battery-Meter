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
 * Плавающий попап подключения (Screen 2, primary state).
 *
 * Показывается при открытии кейса / подключении BudsLink-устройства:
 * device-added + первое появление battery1/2/3 в State.
 * Карточка по центру экрана, тёмная Libadwaita, hero-анимация
 * (assets/frames/intro, 105 кадров), три кольца L/R/Case,
 * футер "AAC Codec • Spatial Audio Ready" + кнопка Sound Settings.
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

    _build() {
        this._overlay = new St.Widget({
            style_class: 'bbm-float-overlay',
            layout_manager: new Clutter.BinLayout(),
            visible: false,
            reactive: true,
            x_expand: true,
            y_expand: true,
        });
        this._overlay.connect('button-press-event', () => {
            this.hide(true);
            return Clutter.EVENT_STOP;
        });

        const card = new St.Widget({
            style_class: 'bbm-float-card',
            layout_manager: new Clutter.BinLayout(),
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
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
            fps: 30,
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
        const soundBtn = new St.Button({
            style_class: 'bbm-float-sound-btn',
            can_focus: true,
            label: '⚙ Sound Settings',
        });
        soundBtn.connect('clicked', () => {
            this.hide();
            Main.panel.statusArea.quickSettings.menu.open();
        });
        footer.add_child(soundBtn);
        box.add_child(footer);

        card.add_child(box);
        this._overlay.add_child(card);

        this._keyId = global.stage.connect('key-press-event', (_stage, event) => {
            if (this._visible && event.get_key_symbol() === Clutter.KEY_Escape) {
                this.hide(true);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        Main.layoutManager.addChrome(this._overlay, {trackFullscreen: true});
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
        this._overlay.visible = true;
        this._overlay.remove_all_transitions();
        this._overlay.opacity = 0;
        this._overlay.ease({
            opacity: 255,
            duration: 220,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
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
        this._overlay.remove_all_transitions();
        this._overlay.ease({
            opacity: 0,
            duration: 260,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                if (!this._visible)
                    this._overlay.visible = false;
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
        this._hero?.destroy();
        this._overlay?.destroy();
        this._overlay = null;
        super.destroy?.();
    }
});
