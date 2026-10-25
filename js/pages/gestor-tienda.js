(function () {
    "use strict";

    var BAR_ID = "vxGestorBar";
    var started = false;

    function isGestor(session) {
        return !!(session && session.user && session.user.role === "gestor");
    }

    function modeBarHtml() {
        return '<aside id="' + BAR_ID + '" class="vx-gestor-bar" aria-label="Modo gestor">' +
            '<span class="vx-gestor-bar-mark" aria-hidden="true"><i class="fa-solid fa-user-tie"></i></span>' +
            '<div class="vx-gestor-bar-copy">' +
            '<strong>Tienda en modo gestor</strong>' +
            '<p>Navegas la tienda con tu cuenta autorizada. La etiqueta «Tu comisión» está preparada para mostrar el importe que asigne administración.</p>' +
            '</div>' +
            '<a class="vx-gestor-bar-link" href="gestor.html">' +
            '<span>Mi panel comercial</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>' +
            '</a></aside>';
    }

    function activate() {
        if (document.body.classList.contains("vx-gestor-mode")) return;
        document.body.classList.add("vx-gestor-mode");
        document.body.setAttribute("data-gestor-mode", "1");

        var main = document.getElementById("main");
        if (main && !document.getElementById(BAR_ID)) {
            main.insertAdjacentHTML("afterbegin", modeBarHtml());
        }
    }

    async function init() {
        if (started) return;
        started = true;
        if (!window.VXAUTH || typeof window.VXAUTH.getSession !== "function") return;

        try {
            var session = await window.VXAUTH.getSession();
            if (!isGestor(session)) return;
            activate();
        } catch (e) {
            return;
        }
    }

    window.VXGestorTienda = { init: init, isGestor: isGestor };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
