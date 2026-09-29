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
        // Точка отсчёта тихого окна: стартовый шторм State от BudsLink
        // (sync уже висящих устройств) идёт в эти секунды.
        this._hookedAt = Date.now();
        this._dbusIds.push(client.connect('device-added',
            (_c, _path, device) => this._watchDevice(device)));
        // Устройства, уже висящие на шине: стартовый шторм State
        // глушим (silent), попап — только на живые переходы после.
        for (const device of mgr._companionMap?.values() ?? [])
            this._watchDevice(device, true);
    }

    _watchDevice(device, silent = false) {
        if (!device?.dataHandler || this._devices.has(device))
            return;
        const id = device.dataHandler.connect('properties-changed',
            () => this._onProps(device));
        this._devices.set(device, {handler: id, lastLevels: {}, lastPopup: 0});
        this._onProps(device, silent);
    }

    _onProps(device, silent = false) {
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

        // Тихое окно после подключения к шине: стартовый шторм
        // (sync висящих устройств + их первые State) только запоминаем.
        // Адаптивное: жёсткий лимит 10с, но обычно отпускает раньше —
        // как только шторм улёгся (возраст >4с и тишина >2.5с).
        // Попап — лишь на живые переходы после него: открытие кейса.
        const nowQ = Date.now();
        const age = nowQ - (this._hookedAt ?? 0);
        const idleFor = nowQ - (entry.lastActivity ?? this._hookedAt ?? 0);
        entry.lastActivity = nowQ;
        if (age < 10_000 && !(age > 4000 && idleFor > 2500)) {
            had.seen = true;
            return;
        }

        if (this._popup.visible) {
            // Мёртвые апдейты хорошие цифры не затирают; живые — только
            // обновляют кольца, таймер автоскрытия не продлеваем,
            // иначе флэппинг State при синхронизации приклеит попап.
            if (fresh)
                this._popup.update(levels);
            had.seen = true;
            return;
        }
        // Устройства, уже висевшие на шине в момент старта расширения
        // (типично: вход в сессию с подключёнными наушниками), молча
        // помечаем виденными — попап только на живые переходы после.
        if (silent) {
            had.seen = true;
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
