'use strict';

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {BatteryRing} from './batteryRing.js';

/**
 * Ровный ряд кольцевых индикаторов (как в моке и попапе).
 * Заменяет BatterySetWidget внутри расширенного подменю, повторяя
 * его правила видимости: ячейка видна, если в конфиге
 * batteryXShowOnDisconnect либо уровень известен (level !== 0)
 * и статус не 'disconnected'.
 */
const LABELS_EARBUDS = ['Left', 'Right', 'Case'];

export const BatteryRow = GObject.registerClass({
    GTypeName: 'BbmModern_BatteryRow',
}, class BatteryRow extends St.BoxLayout {
    _init(dataHandler) {
        super._init({
            style_class: 'bbm-modern-battery-row',
            x_expand: true,
        });

        this._dataHandler = dataHandler;
        this._cells = [];
        this._buildCells();

        this._dataHandler.connectObject(
            'configuration-changed', () => this._rebuild(),
            'properties-changed', () => this._update(),
            this
        );
    }

    _configuredSlots() {
        const config = this._dataHandler.getConfig();
        const slots = [];
        if (config.battery1Icon)
            slots.push({levelKey: 'battery1Level', statusKey: 'battery1Status', showKey: 'battery1ShowOnDisconnect'});
        if (config.battery2Icon)
            slots.push({levelKey: 'battery2Level', statusKey: 'battery2Status', showKey: 'battery2ShowOnDisconnect'});
        if (config.battery3Icon)
            slots.push({levelKey: 'battery3Level', statusKey: 'battery3Status', showKey: 'battery3ShowOnDisconnect'});
        return slots;
    }

    _buildCells() {
        const slots = this._configuredSlots();
        const useEarLabels = slots.length === 3;
        slots.forEach((slot, i) => {
            const cell = new St.BoxLayout({
                style_class: 'bbm-modern-battery-cell',
                orientation: Clutter.Orientation.VERTICAL,
                x_expand: true,
            });
            const ring = new BatteryRing({level: -1, size: 56, lineWidth: 6});
            cell.add_child(ring);
            const label = new St.Label({
                style_class: 'bbm-modern-battery-caption',
                text: useEarLabels ? LABELS_EARBUDS[i] : `Batt ${i + 1}`,
                x_align: Clutter.ActorAlign.CENTER,
            });
            cell.add_child(label);
            this.add_child(cell);
            this._cells.push({cell, ring, slot});
        });
        this._update();
    }

    _rebuild() {
        for (const {cell} of this._cells)
            cell.destroy();
        this._cells = [];
        this._buildCells();
    }

    _update() {
        const config = this._dataHandler.getConfig();
        const props = this._dataHandler.getProps() ?? {};
        for (const {cell, ring, slot} of this._cells) {
            const level = props[slot.levelKey];
            const status = props[slot.statusKey];
            const showOnDisconnect = config[slot.showKey];
            const known = typeof level === 'number' && level !== 0
                && status !== 'disconnected';
            cell.visible = !!(showOnDisconnect || known);
            if (!cell.visible)
                continue;
            if (typeof level === 'number' && level > 0)
                ring.setLevel(level, status === 'charging');
            else
                ring.setLevel(-1, false);
        }
    }
});
