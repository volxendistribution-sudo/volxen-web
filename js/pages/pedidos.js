/**
 * Pedidos page logic
 * Handles the order tracking form and result
 */

export async function initPedidos() {
    var form = VX.$("trackForm"), card = VX.$("trackCard"), result = VX.$("trackResult"),
        code = VX.$("tc"), token = VX.$("tt"), err = VX.$("te"), sub = VX.$("tsub"),
        pv = VX.$("pv");

    await initAccount();

    var params = new URLSearchParams(location.search);
    if (params.get("codigo") && code) code.value = params.get("codigo");
    if (params.get("seguimiento") && token) token.value = params.get("seguimiento");
    if (code && !code.value) code.focus();

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
        logout = VX.$("accountLogout");

    if (!panel || !window.VXAUTH) return;

    var session = null;
    try {
        session = await VXAUTH.getSession();
    } catch (e) {}

    if (!session) {
        if (guest) guest.hidden = false;
        return;
    }

    panel.hidden = false;
    if (emailEl) emailEl.textContent = session.user && session.user.email ? session.user.email : "";

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

    if (!list) return;

    try {
        var orders = await VXAUTH.rest("/rpc/mis_pedidos", { method: "POST", body: {} });
        if (!Array.isArray(orders) || !orders.length) {
            list.innerHTML = '<p class="account-empty">Todavía no tienes pedidos vinculados a tu cuenta. Los pedidos realizados sin iniciar sesión pueden consultarse con su código y código de seguimiento.</p>';
            return;
        }
        list.innerHTML = '<p class="account-orders-title">Historial de pedidos</p>' + orders.map(function (order) {
            var items = Array.isArray(order.items) ? order.items : [];
            var units = items.reduce(function (total, item) {
                return total + (Number(item.cantidad) || 0);
            }, 0);
            var date = order.created_at ? new Date(order.created_at) : null;
            var fecha = date && !isNaN(date.getTime())
                ? date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })
                : "";
            var total = Number(order.total_usd) || 0;
            return '<div class="account-order"><div><p class="account-order-code">' + esc(order.codigo) + '</p><p class="account-order-meta">' +
                (fecha ? esc(fecha) + ' · ' : '') + esc(VX.estadoLargo(order.estado)) +
                (units ? ' · ' + units + (units === 1 ? ' unidad' : ' unidades') : '') +
                '</p></div><span class="account-order-total">' + VX.fm(total) + '</span></div>';
        }).join("");
    } catch (e) {
        list.innerHTML = '<p class="account-empty" role="alert">No se pudieron cargar tus pedidos en este momento. Inténtalo de nuevo más tarde.</p>';
    }
}

function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, function (character) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character];
    });
}

window.initPedidos = initPedidos;
