/**
 * Pedidos page logic
 * Handles the order tracking form and result
 */

export async function initPedidos() {
    var form = VX.$("trackForm"), card = VX.$("trackCard"), result = VX.$("trackResult"),
        code = VX.$("tc"), token = VX.$("tt"), err = VX.$("te"), sub = VX.$("tsub"),
        pv = VX.$("pv");

    var params = new URLSearchParams(location.search);
    var session = await initAccount();
    var wantsTracking = Boolean(params.get("codigo") || params.get("seguimiento"));

    if (session) {
        if (card) card.hidden = !wantsTracking;
        if (wantsTracking) {
            var panel = VX.$("accountPanel");
            if (panel) panel.hidden = true;
        }
    } else if (card) {
        card.hidden = false;
    }

    if (params.get("codigo") && code) code.value = params.get("codigo");
    if (params.get("seguimiento") && token) token.value = params.get("seguimiento");
    if (card && !card.hidden && code && !code.value) code.focus();

    if (!form) return;

    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (sub && sub.disabled) return;
        var c = code ? code.value.trim() : "", t = token ? token.value.trim() : "";
        if (!c || !t) {
            if (err) err.textContent = "Escriba el código del pedido y el código de seguimiento.";
            return;
        }
        if (err) err.textContent = "";
        if (sub) { sub.disabled = true; sub.textContent = "Consultando…"; }
        try {
            await VX.consultarPedido(c, t);
            if (card) card.classList.add("hidden");
            if (result) result.classList.remove("hidden");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (x) {
            if (err) err.textContent = (x && x.message) || "No se pudo consultar el pedido. Inténtelo de nuevo.";
            if (result) result.classList.add("hidden");
            if (card) card.classList.remove("hidden");
        } finally {
            if (sub) { sub.disabled = false; sub.textContent = "Consultar pedido"; }
        }
    });

    if (pv) pv.addEventListener("click", function (e) {
        if (!e.target.closest("#trackNew")) return;
        if (result) result.classList.add("hidden");
        if (card) card.classList.remove("hidden");
        if (form) form.reset();
        if (err) err.textContent = "";
        if (code) code.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

async function initAccount() {
    var panel = VX.$("accountPanel"), guest = VX.$("accountGuest"),
        emailEl = VX.$("accountEmail"), list = VX.$("accountOrders"),
        logout = VX.$("accountLogout"), avatarEl = VX.$("accountAvatar"),
        noticeEl = VX.$("accountNotice");

    if (!panel || !window.VXAUTH) return null;

    var session = null;
    try {
        session = await VXAUTH.getSession();
    } catch (e) {}

    if (!session) {
        if (guest) guest.hidden = false;
        return null;
    }

    panel.hidden = false;
    if (emailEl) emailEl.textContent = session.user && session.user.email ? session.user.email : "";
    if (avatarEl && VX.avatarHtml) {
        avatarEl.outerHTML = VX.avatarHtml(session.user, "account-avatar vx-avatar");
    }

    if (logout) {
        logout.addEventListener("click", async function () {
            logout.disabled = true;
            logout.textContent = "Cerrando sesión…";
            try {
                await VXAUTH.signOut();
            } catch (e) {}
            location.href = "login.html";
        });
    }

    function setNotice(message, isError) {
        if (!noticeEl) return;
        noticeEl.textContent = message || "";
        noticeEl.hidden = !message;
        noticeEl.classList.toggle("is-error", Boolean(isError));
    }

    function loadOrders() {
        if (!list) return Promise.resolve();
        list.innerHTML = '<p class="account-empty">Cargando tus pedidos…</p>';
        return VXAUTH.rest("/rpc/mis_pedidos", { method: "POST", body: {} }).then(function (orders) {
            if (!Array.isArray(orders) || !orders.length) {
                list.innerHTML = '<p class="account-empty">Todavía no tienes pedidos vinculados a tu cuenta. Los pedidos realizados sin iniciar sesión pueden consultarse con su código y código de seguimiento.</p>';
                return;
            }
            list.innerHTML = '<p class="account-orders-title">Historial de pedidos</p>' + orders.map(renderOrder).join("");
        }).catch(function () {
            list.innerHTML = '<p class="account-empty" role="alert">No se pudieron cargar tus pedidos en este momento. Inténtalo de nuevo más tarde.</p>';
        });
    }

    async function cancelOrder(button) {
        var id = button.getAttribute("data-cancel-order");
        var code = button.getAttribute("data-order-code") || "";
        if (!id) return;
        if (!window.confirm("¿Cancelar el pedido " + code + "? Esta acción no se puede deshacer.")) return;

        button.disabled = true;
        button.textContent = "Cancelando…";
        setNotice("");

        try {
            await VXAUTH.rest("/rpc/cancelar_pedido", { method: "POST", body: { p_pedido_id: id } });
            await loadOrders();
            setNotice("El pedido " + code + " fue cancelado correctamente.");
        } catch (error) {
            button.disabled = false;
            button.textContent = "Cancelar pedido";
            setNotice((error && error.message) || "No se pudo cancelar el pedido. Inténtalo de nuevo.", true);
        }
    }

    if (list) {
        list.addEventListener("click", function (event) {
            var button = event.target.closest("[data-cancel-order]");
            if (button) cancelOrder(button);
        });
    }

    window.addEventListener("vx:order-complete", function () {
        loadOrders();
    });

    await loadOrders();
    return session;
}

function stateClass(estado) {
    var value = String(estado || "").toLowerCase();
    if (/cancel|rechaz/.test(value)) return "is-cancelled";
    if (/entreg|complet/.test(value)) return "is-delivered";
    if (/camino|ruta|envi|transp|despach/.test(value)) return "is-shipping";
    if (/prepar|proces|aprob|list/.test(value)) return "is-preparing";
    return "is-pending";
}

function formatShortDate(value) {
    var date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

function renderOrder(order) {
    var items = Array.isArray(order.items) ? order.items : [];
    var history = Array.isArray(order.historial) ? order.historial.slice().sort(function (a, b) {
        return String(a.created_at).localeCompare(String(b.created_at));
    }).slice(-5) : [];
    var units = items.reduce(function (total, item) {
        return total + (Number(item.cantidad) || 0);
    }, 0);
    var fecha = formatShortDate(order.created_at);
    var total = Number(order.total_usd) || 0;
    var estado = VX.estadoLargo(order.estado);
    var cancelable = order.puede_cancelar === true && !/cancel|rechaz|entreg/.test(String(order.estado || "").toLowerCase());
    var whatsapp = whatsappFor(order);

    var itemsHtml = items.map(function (item) {
        var quantity = Number(item.cantidad) || 0;
        return '<li><span>' + esc(item.producto_nombre || "Producto") + '</span><span>×' + quantity + '</span><span>' +
            VX.fm(Number(item.subtotal) || 0) + '</span></li>';
    }).join("");

    var historyHtml = history.map(function (item) {
        return '<li><span>' + esc(VX.estadoLargo(item.estado)) + '</span><span>' + esc(formatShortDate(item.created_at)) + '</span></li>';
    }).join("");

    return '<details class="account-order-card">' +
        '<summary class="account-order-summary">' +
            '<span class="account-order-main">' +
                '<span class="account-order-code">' + esc(order.codigo) + '</span>' +
                '<span class="account-order-meta">' +
                    (fecha ? esc(fecha) + ' · ' : '') +
                    (units ? units + (units === 1 ? ' unidad' : ' unidades') : 'Sin productos') +
                '</span>' +
                '<span class="account-order-state ' + stateClass(order.estado) + '">' + esc(estado) + '</span>' +
            '</span>' +
            '<span class="account-order-total">' + VX.fm(total) + '</span>' +
            '<span class="account-order-chevron" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>' +
        '</summary>' +
        '<div class="account-order-body">' +
            (order.cancelado_por_cliente ? '<p class="account-order-cancel-note">Cancelaste este pedido.</p>' : '') +
            '<p class="account-order-label">Productos</p>' +
            (itemsHtml ? '<ul class="account-order-items">' + itemsHtml + '</ul>' : '<p class="account-order-empty">Sin productos registrados.</p>') +
            '<p class="account-order-label">Historial</p>' +
            (historyHtml ? '<ul class="account-order-history">' + historyHtml + '</ul>' : '<p class="account-order-empty">Sin movimientos registrados.</p>') +
            '<div class="account-order-actions">' +
                (whatsapp ? '<a class="account-order-wa" href="' + whatsapp + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Consultar por WhatsApp</a>' : '') +
                (cancelable ? '<button type="button" class="account-order-cancel" data-cancel-order="' + esc(order.id) + '" data-order-code="' + esc(order.codigo) + '">Cancelar pedido</button>' : '') +
            '</div>' +
        '</div>' +
    '</details>';
}

function whatsappFor(order) {
    var number = String(((window.VOLXEN_CONFIG || {}).WHATSAPP) || "").replace(/\D/g, "");
    if (!number) return "";
    return "https://wa.me/" + number + "?text=" + encodeURIComponent("Hola, necesito ayuda con mi pedido " + (order.codigo || "") + ".");
}

function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, function (character) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character];
    });
}

window.initPedidos = initPedidos;
