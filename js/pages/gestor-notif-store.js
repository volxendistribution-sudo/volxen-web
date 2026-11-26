(function () {
    "use strict";

    const PREFIX = "vx_gestor_notif_ocultas_";

    function key(userId) {
        return PREFIX + String(userId || "anon");
    }

    function read(userId) {
        try {
            const raw = window.localStorage.getItem(key(userId));
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list.map(String) : [];
        } catch (error) {
            return [];
        }
    }

    function write(userId, ids) {
        try {
            const list = (Array.isArray(ids) ? ids : []).map(String);
            window.localStorage.setItem(key(userId), JSON.stringify(list));
            return true;
        } catch (error) {
            return false;
        }
    }

    window.VXGESTOR_NOTIFS = {
        read: read,
        write: write
    };
})();
