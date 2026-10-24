(function () {
    "use strict";

    const COMMISSION_LABELS = {
        pendiente: "Pendiente",
        disponible: "Lista para cobrar",
        pagada: "Pagada",
        cancelada: "Cancelada"
    };

    const COMMISSION_CLASSES = {
        pendiente: "gs-badge-pending",
        disponible: "gs-badge-ready",
        pagada: "gs-badge-paid",
        cancelada: "gs-badge-cancelled"
    };

    const state = {
        session: null,
        summary: null,
        orders: [],
        clients: [],
        query: "",
        status: "",
        loading: false,
        hasMore: false
    };

    const refs = {};

    function id(value) {
        return document.getElementById(value);
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function money(value) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return "$0.00";
        return "$" + amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function count(value) {
        const amount = Number(value);
        return Number.isFinite(amount) ? amount.toLocaleString("es-ES") : "0";
    }

    function dateLabel(value) {
        if (!value) return "Sin fecha";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Sin fecha";
        return new Intl.DateTimeFormat("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function normalize(value) {
        return String(value == null ? "" : value)
            .toLocaleLowerCase("es")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function cleanPhone(value) {
        return String(value == null ? "" : value).replace(/[^\d]/g, "");
    }

    function whatsappHref(phone) {
        let digits = cleanPhone(phone);
        if (digits.length === 8) digits = "53" + digits;
        return digits ? "https://wa.me/" + digits : "";
    }

    function roleLabel(role) {
        return role === "promotor" ? "Promotor" : "Gestor";
    }

    function setView(view) {
        ["gsGuest", "gsDenied", "gsLoading", "gsError", "gsDashboard"].forEach(function (name) {
            if (refs[name]) refs[name].hidden = name !== view;
        });
    }

    function setNotice(message, isError) {
        if (!refs.gsNotice) return;
        refs.gsNotice.textContent = message || "";
        refs.gsNotice.classList.toggle("is-error", Boolean(isError));
        refs.gsNotice.hidden = !message;
    }

    function setBusy(value) {
        state.loading = value;
        if (refs.gsRefresh) refs.gsRefresh.disabled = value;
        if (refs.gsMore) refs.gsMore.disabled = value;
    }

    function renderHeader() {
        const user = state.session && state.session.user ? state.session.user : {};
        const name = String(user.nombre || "").trim();
        refs.gsTitle.textContent = name ? "Hola, " + name.split(/\s+/)[0] : "Tu operación";
        refs.gsEmail.textContent = user.email || "";
        refs.gsRoleBadge.textContent = roleLabel(user.role);
    }

    function renderSummary() {
        const summary = state.summary || {};
        refs.gsSales.textContent = money(summary.ventas_total_usd);
        refs.gsOrdersCount.textContent = count(summary.pedidos_total);
        refs.gsClientsCount.textContent = count(summary.clientes_total);
        refs.gsCommissionAvailable.textContent = money(summary.comision_disponible_usd);
        refs.gsCommissionPaid.textContent = money(summary.comision_pagada_usd);
        refs.gsCommissionPending.textContent = money(summary.comision_pendiente_usd);
        refs.gsCommissionReady.textContent = money(summary.comision_disponible_usd);
        refs.gsCommissionDone.textContent = money(summary.comision_pagada_usd);
    }

    function orderMatches(order) {
        if (state.status && order.estado !== state.status) return false;
        if (!state.query) return true;
        const haystack = normalize([
            order.codigo,
            order.nombre_cliente,
            order.telefono,
            order.email,
            order.direccion,
            order.municipio
        ].join(" "));
        return haystack.indexOf(state.query) !== -1;
    }

    function renderItems(items) {
        if (!Array.isArray(items) || !items.length) {
            return '<p class="gs-muted">Sin detalle de productos.</p>';
        }

        return '<ul class="gs-order-products">' + items.map(function (item) {
            const name = item.nombre || item.producto_nombre || item.nombre_producto || "Producto";
            const quantity = item.cantidad || item.qty || 1;
            const price = item.precio_usd || item.precio || item.precio_unitario || 0;
            return "<li><span>" + escapeHtml(name) + " × " + escapeHtml(quantity) + "</span><small>" + escapeHtml(money(price)) + "</small></li>";
        }).join("") + "</ul>";
    }

    function renderOrders() {
        if (!refs.gsOrdersList) return;

        const visible = state.orders.filter(orderMatches);

        if (refs.gsMoreWrap) refs.gsMoreWrap.hidden = !state.hasMore;

        if (!state.orders.length) {
            refs.gsOrdersList.innerHTML = '<p class="gs-empty"><strong>Aún no tienes pedidos asignados.</strong>Cuando el administrador confirme una venta y te la atribuya, aparecerá aquí con su estado y comisión.</p>';
            return;
        }

        if (!visible.length) {
            refs.gsOrdersList.innerHTML = '<p class="gs-empty"><strong>No hay pedidos con ese filtro.</strong><button class="gs-button" type="button" data-clear-filters>Limpiar filtros</button></p>';
            return;
        }

        refs.gsOrdersList.innerHTML = visible.map(function (order, index) {
            const commissionState = order.comision_estado || "pendiente";
            const commissionLabel = COMMISSION_LABELS[commissionState] || "Pendiente";
            const commissionClass = COMMISSION_CLASSES[commissionState] || "gs-badge-pending";
            const phoneHref = order.telefono ? "tel:" + escapeHtml(cleanPhone(order.telefono)) : "";
            const mailHref = order.email ? "mailto:" + encodeURIComponent(order.email) : "";
            const commissionMeta = order.comision_pagada_at
                ? "Pagada el " + escapeHtml(dateLabel(order.comision_pagada_at))
                : order.comision_disponible_at
                    ? "Disponible desde " + escapeHtml(dateLabel(order.comision_disponible_at))
                    : "Se activa al confirmar la entrega";

            return '<article class="gs-order">' +
                '<button class="gs-order-summary" type="button" data-order-toggle="' + index + '" aria-expanded="false" aria-controls="gs-order-body-' + index + '">' +
                    '<span class="gs-order-code">' + escapeHtml(order.codigo || "Sin código") + "</span>" +
                    '<span class="gs-order-client">' + escapeHtml(order.nombre_cliente || "Cliente") + "</span>" +
                    '<span class="gs-order-date">' + escapeHtml(dateLabel(order.created_at)) + "</span>" +
                    '<span class="gs-order-total">' + escapeHtml(money(order.total_usd)) + "</span>" +
                    '<span class="gs-badge gs-badge-state">' + escapeHtml(order.estado || "Sin estado") + "</span>" +
                    '<span class="gs-badge ' + commissionClass + '">' + escapeHtml(commissionLabel) + "</span>" +
                    '<i class="fa-solid fa-chevron-down gs-order-chevron" aria-hidden="true"></i>' +
                "</button>" +
                '<div class="gs-order-body" id="gs-order-body-' + index + '" hidden>' +
                    '<div class="gs-order-grid">' +
                        "<div><h3>Cliente</h3><p>" + escapeHtml(order.nombre_cliente || "Cliente") + "</p>" +
                            (phoneHref ? '<p><a href="' + phoneHref + '">' + escapeHtml(order.telefono) + "</a>" + (mailHref ? ' · <a href="' + mailHref + '">' + escapeHtml(order.email) + "</a>" : "") + "</p>" : (mailHref ? '<p><a href="' + mailHref + '">' + escapeHtml(order.email) + "</a></p>" : "")) +
                        "</div>" +
                        "<div><h3>Entrega</h3><address>" + escapeHtml(order.direccion || "Sin dirección") + "<br>" + escapeHtml(order.municipio || "Sin municipio") + "</address></div>" +
                        "<div><h3>Productos</h3>" + renderItems(order.items) + "</div>" +
                        "<div><h3>Comisión</h3>" +
                            '<p class="gs-commission-line"><strong class="gs-commission-amount">' + escapeHtml(money(order.comision_monto_usd)) + "</strong>" +
                            '<span class="gs-badge ' + commissionClass + '">' + escapeHtml(commissionLabel) + "</span></p>" +
                            '<p class="gs-muted">' + escapeHtml(Number(order.comision_porcentaje || 0)) + "% · " + commissionMeta + "</p>" +
                        "</div>" +
                    "</div>" +
                "</div>" +
            "</article>";
        }).join("");
    }

    function renderClients() {
        if (!refs.gsClientsList) return;

        if (!state.clients.length) {
            refs.gsClientsList.innerHTML = '<p class="gs-empty"><strong>Todavía no hay clientes.</strong>Los clientes aparecen cuando tienes pedidos atribuidos.</p>';
            return;
        }

        refs.gsClientsList.innerHTML = state.clients.map(function (client) {
            const phone = client.telefono || "";
            const email = client.email || "";
            const wa = whatsappHref(phone);
            const contact = [];
            if (phone) contact.push('<a href="tel:' + escapeHtml(cleanPhone(phone)) + '">' + escapeHtml(phone) + "</a>");
            if (email) contact.push('<a href="mailto:' + encodeURIComponent(email) + '">' + escapeHtml(email) + "</a>");

            return '<article class="gs-client">' +
                '<div class="gs-client-head"><strong>' + escapeHtml(client.nombre || "Cliente") + "</strong><span>" + escapeHtml(count(client.pedidos)) + " pedido" + (Number(client.pedidos) === 1 ? "" : "s") + "</span></div>" +
                (contact.length ? '<p class="gs-client-contact">' + contact.join(" · ") + "</p>" : "") +
                '<p class="gs-client-address">' + escapeHtml(client.direccion || "Sin dirección") + (client.municipio ? " · " + escapeHtml(client.municipio) : "") + "</p>" +
                '<p class="gs-client-meta">' + escapeHtml(money(client.total_usd)) + " · último pedido " + escapeHtml(dateLabel(client.ultimo_pedido)) + "</p>" +
                '<div class="gs-client-actions">' +
                    (wa ? '<a href="' + wa + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp</a>' : "") +
                    (phone ? '<a href="tel:' + escapeHtml(cleanPhone(phone)) + '">Llamar</a>' : "") +
                "</div>" +
            "</article>";
        }).join("");
    }

    function renderAll() {
        renderHeader();
        renderSummary();
        renderOrders();
        renderClients();
        refs.gsUpdated.textContent = "Actualizado " + new Intl.DateTimeFormat("es-ES", {
            hour: "2-digit",
            minute: "2-digit"
        }).format(new Date());
    }

    async function load(options) {
        const opts = options || {};
        if (state.loading) return;

        setBusy(true);
        setNotice("");
        if (!opts.silent) setView("gsLoading");

        try {
            const results = await Promise.all([
                VXAUTH.rest("/rpc/promotor_resumen", { method: "POST", body: {} }),
                VXAUTH.rest("/rpc/promotor_pedidos", { method: "POST", body: { p_limit: 100, p_offset: 0 } }),
                VXAUTH.rest("/rpc/promotor_clientes", { method: "POST", body: {} })
            ]);

            state.summary = results[0] && typeof results[0] === "object" ? results[0] : {};
            state.orders = Array.isArray(results[1]) ? results[1] : [];
            state.clients = Array.isArray(results[2]) ? results[2] : [];
            state.hasMore = state.orders.length >= 100;

            setView("gsDashboard");
            renderAll();
            if (opts.notice) setNotice(opts.notice);
        } catch (error) {
            if (state.summary || state.orders.length || state.clients.length) {
                setView("gsDashboard");
                setNotice("No se pudo actualizar el panel. " + (error && error.message ? error.message : "Inténtalo de nuevo."), true);
            } else {
                refs.gsErrorText.textContent = error && error.message
                    ? error.message
                    : "Revisa tu conexión e inténtalo de nuevo.";
                setView("gsError");
            }
        } finally {
            setBusy(false);
        }
    }

    async function loadMore() {
        if (state.loading || !state.hasMore) return;

        setBusy(true);
        setNotice("");

        try {
            const more = await VXAUTH.rest("/rpc/promotor_pedidos", {
                method: "POST",
                body: { p_limit: 100, p_offset: state.orders.length }
            });
            const rows = Array.isArray(more) ? more : [];
            const known = new Set(state.orders.map(function (order) { return order.id; }));

            rows.forEach(function (order) {
                if (!known.has(order.id)) state.orders.push(order);
            });

            state.hasMore = rows.length >= 100;
            renderOrders();
        } catch (error) {
            setNotice("No se pudieron cargar más pedidos. " + (error && error.message ? error.message : "Inténtalo de nuevo."), true);
        } finally {
            setBusy(false);
        }
    }

    function bindEvents() {
        refs.gsLogout.addEventListener("click", async function () {
            refs.gsLogout.disabled = true;
            refs.gsLogout.textContent = "Saliendo…";
            try {
                await VXAUTH.signOut();
            } catch (error) {}
            window.location.href = "login.html?next=gestor.html";
        });

        refs.gsRetry.addEventListener("click", function () {
            load();
        });

        refs.gsRefresh.addEventListener("click", function () {
            load({ silent: true, notice: "Panel actualizado." });
        });

        refs.gsMore.addEventListener("click", function () {
            loadMore();
        });

        refs.gsSearch.addEventListener("input", function (event) {
            state.query = normalize(event.target.value.trim());
            renderOrders();
        });

        refs.gsStatusFilter.addEventListener("change", function (event) {
            state.status = event.target.value;
            renderOrders();
        });

        refs.gsOrdersList.addEventListener("click", function (event) {
            const clear = event.target.closest("[data-clear-filters]");
            if (clear) {
                state.query = "";
                state.status = "";
                refs.gsSearch.value = "";
                refs.gsStatusFilter.value = "";
                renderOrders();
                refs.gsSearch.focus();
                return;
            }

            const toggle = event.target.closest("[data-order-toggle]");
            if (!toggle) return;
            const body = document.getElementById(toggle.getAttribute("aria-controls"));
            if (!body) return;
            const expanded = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
            body.hidden = expanded;
        });
    }

    function cacheElements() {
        [
            "gsGuest", "gsDenied", "gsLoading", "gsError", "gsDashboard",
            "gsTitle", "gsEmail", "gsRoleBadge", "gsUpdated", "gsNotice",
            "gsSales", "gsOrdersCount", "gsClientsCount", "gsCommissionAvailable",
            "gsCommissionPaid", "gsCommissionPending", "gsCommissionReady", "gsCommissionDone",
            "gsOrdersList", "gsClientsList", "gsSearch", "gsStatusFilter", "gsMoreWrap", "gsMore",
            "gsLogout", "gsRetry", "gsRefresh", "gsErrorText"
        ].forEach(function (key) {
            refs[key] = id(key);
        });
    }

    async function init() {
        cacheElements();

        if (!window.VXAUTH) {
            refs.gsErrorText.textContent = "No se pudo cargar el sistema de cuentas.";
            setView("gsError");
            return;
        }

        bindEvents();

        let session = null;
        try {
            session = await VXAUTH.getSession();
        } catch (error) {
            refs.gsErrorText.textContent = "No se pudo comprobar tu sesión. Inténtalo de nuevo.";
            setView("gsError");
            return;
        }

        if (!session) {
            setView("gsGuest");
            return;
        }

        state.session = session;
        const role = session.user && session.user.role;

        if (role === "admin") {
            window.location.replace("admin.html");
            return;
        }

        if (role !== "gestor" && role !== "promotor") {
            setView("gsDenied");
            return;
        }

        setView("gsDashboard");
        renderHeader();
        await load();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
