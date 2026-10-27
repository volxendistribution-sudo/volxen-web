(function () {
    "use strict";

    var initPromise = null;

    function isPromotor(session) {
        var role = session && session.user && session.user.role;
        return role === "gestor" || role === "promotor";
    }

    function shouldRedirect() {
        var path = window.location && window.location.pathname ? window.location.pathname : "";
        return !/\/gestor\.html$/.test(path);
    }

    async function runInit() {
        if (!window.VXAUTH || typeof window.VXAUTH.getSession !== "function") return false;

        var session = null;
        try {
            session = await window.VXAUTH.getSession();
        } catch (error) {
            return false;
        }

        if (!isPromotor(session) || !shouldRedirect()) return false;

        if (window.location && typeof window.location.replace === "function") {
            window.location.replace("gestor.html");
            return true;
        }

        return false;
    }

    function init() {
        if (!initPromise) initPromise = runInit().catch(function () { return false; });
        return initPromise;
    }

    window.VXGestorRedirect = {
        init: init,
        isPromotor: isPromotor
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
