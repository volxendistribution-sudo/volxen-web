(function () {
    "use strict";

    var TOGGLE_ID = "vxPromotorToggle";
    var LAYER_ID = "vxPromotorLayer";
    var started = false;
    var lastFocus = null;
    var closeTimer = null;

    function isPromotor(session) {
        var role = session && session.user && session.user.role;
        return role === "gestor" || role === "promotor";
    }

    function drawerHtml() {
        return '<button type="button" id="' + TOGGLE_ID + '" class="vxp-toggle" aria-label="Abrir panel de promotor" aria-haspopup="dialog" aria-expanded="false" aria-controls="' + LAYER_ID + '">' +
            '<i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>' +
            '<span>Panel</span>' +
            '</button>' +
            '<div id="' + LAYER_ID + '" class="vxp-layer" hidden>' +
            '<button type="button" class="vxp-backdrop" data-vxp-close tabindex="-1" aria-hidden="true"></button>' +
            '<aside class="vxp-drawer" role="dialog" aria-modal="true" aria-labelledby="vxpTitle">' +
            '<header class="vxp-head">' +
            '<div class="vxp-id">' +
            '<img src="logo.svg" alt="" width="32" height="32">' +
            '<div><strong id="vxpTitle">Panel de promotor</strong><span id="vxpName">Tu cuenta</span></div>' +
            '</div>' +
            '<button type="button" class="vxp-close" data-vxp-close aria-label="Cerrar panel">' +
            '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
            '</button>' +
            '</header>' +
            '<nav class="vxp-tabs" role="tablist" aria-label="Secciones del panel de promotor">' +
            '<button type="button" class="vxp-tab is-active" id="vxpTabResumen" role="tab" aria-selected="true" aria-controls="vxpResumen" data-vxp-tab="resumen">Resumen</button>' +
            '<button type="button" class="vxp-tab" id="vxpTabComisiones" role="tab" aria-selected="false" aria-controls="vxpComisiones" tabindex="-1" data-vxp-tab="comisiones">Comisiones</button>' +
            '<button type="button" class="vxp-tab" id="vxpTabPedidos" role="tab" aria-selected="false" aria-controls="vxpPedidos" tabindex="-1" data-vxp-tab="pedidos">Pedidos</button>' +
            '<button type="button" class="vxp-tab" id="vxpTabClientes" role="tab" aria-selected="false" aria-controls="vxpClientes" tabindex="-1" data-vxp-tab="clientes">Clientes</button>' +
            '<button type="button" class="vxp-tab" id="vxpTabPagos" role="tab" aria-selected="false" aria-controls="vxpPagos" tabindex="-1" data-vxp-tab="pagos">Pagos</button>' +
            '<button type="button" class="vxp-tab" id="vxpTabProductos" role="tab" aria-selected="false" aria-controls="vxpProductos" tabindex="-1" data-vxp-tab="productos">Productos</button>' +
            '<button type="button" class="vxp-tab" id="vxpTabEnlace" role="tab" aria-selected="false" aria-controls="vxpEnlace" tabindex="-1" data-vxp-tab="enlace">Enlace</button>' +
            '</nav>' +
            '<div class="vxp-body">' +
            '<section class="vxp-section" id="vxpResumen" role="tabpanel" aria-labelledby="vxpTabResumen" data-vxp-section="resumen">' +
            '<div class="vxp-section-head"><p class="vxp-kicker">Resumen</p><h2>Tu actividad comercial</h2><p>Una vista rápida de lo que administración te atribuya.</p></div>' +
            '<div class="vxp-stats">' +
            '<article class="vxp-stat"><span>Ventas del mes</span><strong>—</strong><small>Se activará con datos reales</small></article>' +
            '<article class="vxp-stat"><span>Comisiones pendientes</span><strong>—</strong><small>Se activará con datos reales</small></article>' +
            '<article class="vxp-stat"><span>Pedidos recientes</span><strong>—</strong><small>Se activará con datos reales</small></article>' +
            '<article class="vxp-stat"><span>Clientes asignados</span><strong>—</strong><small>Se activará con datos reales</small></article>' +
            '</div>' +
            '<div class="vxp-info"><span class="vxp-info-icon" aria-hidden="true"><i class="fa-solid fa-circle-info"></i></span><div><strong>Panel en preparación</strong><p>Esta fase muestra la estructura visual. Las cifras y los pedidos se conectarán en la siguiente fase.</p></div></div>' +
            '</section>' +
            '<section class="vxp-section" id="vxpComisiones" role="tabpanel" aria-labelledby="vxpTabComisiones" data-vxp-section="comisiones" hidden>' +
            '<div class="vxp-section-head"><p class="vxp-kicker">Comisiones</p><h2>Lo que has generado</h2><p>Comisiones fijas o por sobreprecio, según la configuración de cada producto.</p></div>' +
            '<div class="vxp-chips"><span>Pendientes <b>—</b></span><span>Pagadas <b>—</b></span></div>' +
            '<div class="vxp-empty"><i class="fa-solid fa-coins" aria-hidden="true"></i><strong>Sin comisiones todavía</strong><p>Cuando administración cierre un pedido, aquí verás el detalle y su estado.</p></div>' +
            '</section>' +
            '<section class="vxp-section" id="vxpPedidos" role="tabpanel" aria-labelledby="vxpTabPedidos" data-vxp-section="pedidos" hidden>' +
            '<div class="vxp-section-head"><p class="vxp-kicker">Pedidos</p><h2>Tus ventas atribuidas</h2><p>Pedidos pendientes, entregados y cancelados vinculados a tu cuenta.</p></div>' +
            '<div class="vxp-empty"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i><strong>Aún no hay pedidos atribuidos</strong><p>Los pedidos aparecerán aquí cuando se conecte la atribución de ventas.</p></div>' +
            '</section>' +
            '<section class="vxp-section" id="vxpClientes" role="tabpanel" aria-labelledby="vxpTabClientes" data-vxp-section="clientes" hidden>' +
            '<div class="vxp-section-head"><p class="vxp-kicker">Clientes</p><h2>Tu cartera</h2><p>Clientes asignados a tu enlace o código de promotor.</p></div>' +
            '<div class="vxp-empty"><i class="fa-solid fa-user-group" aria-hidden="true"></i><strong>Sin clientes asignados</strong><p>La cartera se activará junto con la atribución segura de ventas.</p></div>' +
            '</section>' +
            '<section class="vxp-section" id="vxpPagos" role="tabpanel" aria-labelledby="vxpTabPagos" data-vxp-section="pagos" hidden>' +
            '<div class="vxp-section-head"><p class="vxp-kicker">Pagos</p><h2>Historial de pagos</h2><p>Registro de las comisiones que administración marque como pagadas.</p></div>' +
            '<div class="vxp-empty"><i class="fa-solid fa-receipt" aria-hidden="true"></i><strong>Sin pagos registrados</strong><p>Aquí se mostrará el historial cuando administración registre un pago.</p></div>' +
            '</section>' +
            '<section class="vxp-section" id="vxpProductos" role="tabpanel" aria-labelledby="vxpTabProductos" data-vxp-section="productos" hidden>' +
            '<div class="vxp-section-head"><p class="vxp-kicker">Productos</p><h2>Productos y comisión</h2><p>Consulta la comisión configurada para cada producto.</p></div>' +
            '<div class="vxp-empty"><i class="fa-solid fa-box-open" aria-hidden="true"></i><strong>Comisiones por producto</strong><p>Cada ficha mostrará si el precio es fijo o flexible y la comisión asignada.</p></div>' +
            '<a class="vxp-link" href="catalogo.html"><span>Ver catálogo</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>' +
            '</section>' +
            '<section class="vxp-section" id="vxpEnlace" role="tabpanel" aria-labelledby="vxpTabEnlace" data-vxp-section="enlace" hidden>' +
            '<div class="vxp-section-head"><p class="vxp-kicker">Enlace y código</p><h2>Tu acceso de promotor</h2><p>Comparte tu enlace para que tus ventas queden identificadas.</p></div>' +
            '<label class="vxp-label" for="vxpLinkInput">Tu enlace de promotor</label>' +
            '<input id="vxpLinkInput" class="vxp-input" type="text" placeholder="Se activará en la siguiente fase" disabled>' +
            '<label class="vxp-label" for="vxpCodeInput">Tu código</label>' +
            '<input id="vxpCodeInput" class="vxp-input" type="text" placeholder="Se activará en la siguiente fase" disabled>' +
            '<p class="vxp-note">El enlace permitirá identificar tus ventas sin exponer datos de tus clientes.</p>' +
            '</section>' +
            '</div>' +
            '<footer class="vxp-foot"><a href="gestor.html"><span>Ver panel completo</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></footer>' +
            '</aside>' +
            '</div>';
    }

    function selectTab(name, focusTab) {
        var layer = document.getElementById(LAYER_ID);
        if (!layer) return;

        var tabs = layer.querySelectorAll("[data-vxp-tab]");
        var sections = layer.querySelectorAll("[data-vxp-section]");

        Array.prototype.forEach.call(tabs, function (tab) {
            var active = tab.getAttribute("data-vxp-tab") === name;
            tab.classList.toggle("is-active", active);
            tab.setAttribute("aria-selected", active ? "true" : "false");
            tab.tabIndex = active ? 0 : -1;
            if (active && focusTab) tab.focus({ preventScroll: true });
        });

        Array.prototype.forEach.call(sections, function (section) {
            section.hidden = section.getAttribute("data-vxp-section") !== name;
        });
    }

    function openDrawer() {
        var layer = document.getElementById(LAYER_ID);
        var toggle = document.getElementById(TOGGLE_ID);
        if (!layer || !toggle) return;

        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }

        lastFocus = document.activeElement || toggle;
        layer.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
        document.body.classList.add("vxp-lock");

        var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 0); };
        raf(function () { layer.classList.add("is-open"); });

        var close = layer.querySelector(".vxp-close");
        if (close) close.focus({ preventScroll: true });
    }

    function closeDrawer() {
        var layer = document.getElementById(LAYER_ID);
        var toggle = document.getElementById(TOGGLE_ID);
        if (!layer || layer.hidden) return;

        layer.classList.remove("is-open");
        document.body.classList.remove("vxp-lock");
        if (toggle) toggle.setAttribute("aria-expanded", "false");

        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(function () {
            layer.hidden = true;
            closeTimer = null;
        }, 240);

        if (lastFocus && typeof lastFocus.focus === "function") {
            lastFocus.focus({ preventScroll: true });
        }
        lastFocus = null;
    }

    function wire(session) {
        var layer = document.getElementById(LAYER_ID);
        var toggle = document.getElementById(TOGGLE_ID);
        if (!layer || !toggle) return;

        var user = session && session.user ? session.user : {};
        var label = document.getElementById("vxpName");
        if (label) {
            label.textContent = String(user.nombre || user.email || "Tu cuenta");
        }

        toggle.addEventListener("click", openDrawer);

        Array.prototype.forEach.call(layer.querySelectorAll("[data-vxp-close]"), function (button) {
            button.addEventListener("click", closeDrawer);
        });

        Array.prototype.forEach.call(layer.querySelectorAll("[data-vxp-tab]"), function (tab) {
            tab.addEventListener("click", function () {
                selectTab(tab.getAttribute("data-vxp-tab"), false);
            });
        });

        var tablist = layer.querySelector(".vxp-tabs");
        if (tablist) {
            tablist.addEventListener("keydown", function (event) {
                var tabs = Array.prototype.slice.call(layer.querySelectorAll("[data-vxp-tab]"));
                var index = tabs.indexOf(event.target);
                if (index === -1) return;

                var next = null;
                if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
                if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
                if (event.key === "Home") next = 0;
                if (event.key === "End") next = tabs.length - 1;
                if (next === null) return;

                event.preventDefault();
                selectTab(tabs[next].getAttribute("data-vxp-tab"), true);
            });
        }

        layer.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                event.preventDefault();
                closeDrawer();
                return;
            }

            if (event.key !== "Tab") return;

            var focusable = layer.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
            if (!focusable.length) return;

            var first = focusable[0];
            var last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    function activate(session) {
        if (document.body.classList.contains("vx-promotor-mode")) return;
        document.body.classList.add("vx-promotor-mode");
        document.body.setAttribute("data-promotor-mode", "1");

        if (!document.getElementById(LAYER_ID)) {
            document.body.insertAdjacentHTML("beforeend", drawerHtml());
        }

        wire(session);
    }

    async function init() {
        if (started) return;
        started = true;
        if (!window.VXAUTH || typeof window.VXAUTH.getSession !== "function") return;

        try {
            var session = await window.VXAUTH.getSession();
            if (!isPromotor(session)) return;
            activate(session);
        } catch (e) {
            return;
        }
    }

    window.VXPromotorTienda = { init: init, isPromotor: isPromotor };
    window.VXGestorTienda = window.VXPromotorTienda;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
