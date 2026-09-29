'use strict';

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

/**
 * Триггер попапа "открытие кейса / подключение".
 *
 * BudsLink не присылает отдельное событие "крышка открыта" — кейс
 * виден по появлению battery1/2/3 в State устройства. Поэтому:
 *  - device-added с живыми зарядами → показать сразу;
 *  - properties-changed State: был 0/unknown, стал >0 → показать
 *    (это и есть момент открытия кейса / переподключения);
 *  - последующие обновления уровней → только update() без repopup
 *    (антиспам: не чаще раза в 30 секунд на устройство).
 */
export const PopupTrigger = GObject.registerClass({
    GTypeName: 'BbmModern_PopupTrigger',
}, class PopupTrigger extends GObject.Object {
    _init(popup) {
        super._init();
        this._popup = popup;
        this._devices = new Map(); // bluezPath -> {handler, lastLevels, lastPopup}
        this._dbusIds = [];
        this._pollId = 0;
    }

    attach(toggle) {
        this._toggle = toggle;
        // DBus-клиент создаётся лениво внутри EnhancedDeviceSupportManager,
        // поэтому ждём его появления поллингом раз в 2с.
        this._pollId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._hookIfReady();
            return GLib.SOURCE_CONTINUE;
        });
        this._hookIfReady();
    }

    _hookIfReady() {
        const mgr = this._toggle?.enhancedDeviceManager;
        const client = mgr?._dbusClient;
        if (!client || this._hookedClient === client)
            return;
        this._hookedClient = client;
        this._dbusIds.push(client.connect('device-added',
            (_c, _path, device) => this._watchDevice(device)));
        // устройства, уже висящие на шине
        for (const device of mgr._companionMap?.values() ?? [])
            this._watchDevice(device);
    }

    _watchDevice(device) {
        if (!device?.dataHandler || this._devices.has(device))
            return;
        const id = device.dataHandler.connect('properties-changed',
            () => this._onProps(device));
        this._devices.set(device, {handler: id, lastLevels: {}, lastPopup: 0});
        this._onProps(device);
    }

    _onProps(device) {
        const entry = this._devices.get(device);
        if (!entry)
            return;
        const p = device.dataHandler.getProps() ?? {};
        const levels = {
            alias: device.alias ?? 'AirPods',
            left: p.battery1Level ?? -1,
            right: p.battery2Level ?? -1,
            caseLevel: p.battery3Level ?? -1,
            charging: (p.battery1Status === 'charging') ||
                (p.battery2Status === 'charging'),
            caseCharging: p.battery3Status === 'charging',
        };

        const had = entry.lastLevels;
        const now = Date.now();
        const fresh = [levels.left, levels.right, levels.caseLevel]
            .some(v => typeof v === 'number' && v > 0);
        const wasDead = ![had.left, had.right, had.caseLevel]
            .some(v => typeof v === 'number' && v > 0);
        const cooldownOk = (now - entry.lastPopup) > 30_000;

        entry.lastLevels = levels;

        if (this._popup.visible) {
            this._popup.update(levels);
            return;
        }
        if (fresh && (wasDead || !had.seen) && cooldownOk) {
            entry.lastPopup = now;
            this._popup.show(levels);
        }
        had.seen = true;
    }

    destroy() {
        if (this._pollId) {
            GLib.source_remove(this._pollId);
            this._pollId = 0;
        }
        if (this._hookedClient) {
            for (const id of this._dbusIds)
                this._hookedClient.disconnect(id);
            this._dbusIds = [];
            this._hookedClient = null;
        }
        for (const [device, entry] of this._devices) {
            try {
                device.dataHandler.disconnect(entry.handler);
            } catch (e) {
                // уже отвалился — ок
            }
        }
        this._devices.clear();
        this._toggle = null;
        super.destroy?.();
    }
});
