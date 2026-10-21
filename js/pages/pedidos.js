/**
 * Pedidos page logic
 * Handles the order tracking form and result
 */

export async function initPedidos() {
    var form = VX.$("trackForm"), card = VX.$("trackCard"), result = VX.$("trackResult"),
        code = VX.$("tc"), token = VX.$("tt"), err = VX.$("te"), sub = VX.$("tsub"),
        pv = VX.$("pv");

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

window.initPedidos = initPedidos;
