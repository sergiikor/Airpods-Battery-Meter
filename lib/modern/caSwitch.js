'use strict';

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

/**
 * iOS-style переключатель для двухпозиционного toggle2
 * (у AirPods это Conversation Awareness: On/Off).
 * Маппинг как у ToggleButtonsSet: кнопка 1 = вкл, кнопка 2 = выкл.
 */
export const CaSwitch = GObject.registerClass({
    GTypeName: 'BbmModern_CaSwitch',
}, class CaSwitch extends St.BoxLayout {
    _init(dataHandler) {
        super._init({
            style_class: 'bbm-ca-card',
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
        });

        this._dataHandler = dataHandler;
        this._on = false;

        const row = new St.BoxLayout({
            style_class: 'bbm-ca-row',
            x_expand: true,
        });

        this._title = new St.Label({
            style_class: 'bbm-ca-title',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        row.add_child(this._title);

        const knobBox = new St.BoxLayout({
            style_class: 'bbm-ca-knob-box',
            x_expand: true,
            y_expand: true,
        });
        knobBox.add_child(new St.Widget({
            style_class: 'bbm-ca-knob',
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
        }));

        this._switch = new St.Button({
            style_class: 'bbm-ca-switch',
            can_focus: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._switch.set_child(knobBox);
        this._switch.connect('clicked', () => this._toggle());
        row.add_child(this._switch);

        this.add_child(row);

        this._refreshTitle();
        this._refreshState();

        this._dataHandler.connectObject(
            'configuration-changed', () => this._refreshTitle(),
            'properties-changed', () => this._refreshState(),
            this
        );
    }

    _refreshTitle() {
        this._title.text = this._dataHandler.getConfig().toggle2Title ?? '';
    }

    _refreshState() {
        const state = this._dataHandler.getProps().toggle2State;
        // 0 в переходных состояниях игнорируем, держим последнее.
        if (state === 1)
            this._setVisual(true);
        else if (state >= 2)
            this._setVisual(false);
    }

    _setVisual(on) {
        this._on = on;
        if (on)
            this._switch.add_style_class_name('on');
        else
            this._switch.remove_style_class_name('on');
    }

    _toggle() {
        const next = !this._on;
        this._setVisual(next);
        this._dataHandler.emitUIAction('toggle2State', next ? 1 : 2);
    }
});
