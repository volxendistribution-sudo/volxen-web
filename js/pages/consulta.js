/**
 * Consulta general e incidencias
 * Sends the message to Supabase and shows a confirmation.
 */

export async function initConsulta() {
    var C = window.VOLXEN_CONFIG;
    var form = VX.$("consultaForm"), card = VX.$("consultaCard"), ok = VX.$("consultaOk"),
        err = VX.$("cerr"), sub = VX.$("csub"), newBtn = VX.$("cnew"),
        name = VX.$("cnombre"), phone = VX.$("ct"), mail = VX.$("ce"), tipo = VX.$("cqt"),
        order = VX.$("cp"), message = VX.$("cm");

    var params = new URLSearchParams(location.search);
    var wanted = params.get("tipo");
    if (tipo && ["consulta", "incidencia", "queja", "opinion"].indexOf(wanted) > -1) tipo.value = wanted;

    if (!form) return;

    function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

    async function rpc(fn, payload) {
        var r = await fetch(C.SUPABASE_URL + "/rest/v1/rpc/" + fn, {
            method: "POST",
            headers: { apikey: C.SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        var j = null;
        try { j = await r.json(); } catch (e) {}
        return { ok: r.ok, status: r.status, body: j };
    }

    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (sub && sub.disabled) return;

        var n = name ? name.value.trim() : "";
        var tel = phone ? phone.value.trim() : "";
        var email = mail ? mail.value.trim() : "";
        var ty = tipo ? tipo.value : "consulta";
        var cod = order ? order.value.trim().toUpperCase() : "";
        var msg = message ? message.value.trim() : "";

        if (n.length < 2) { if (err) err.textContent = "Escriba su nombre completo."; if (name) name.focus(); return; }
        if (tel.replace(/\D/g, "").length < 6) { if (err) err.textContent = "Escriba un número de teléfono válido."; if (phone) phone.focus(); return; }
        if (!validEmail(email)) { if (err) err.textContent = "Escriba un correo electrónico válido."; if (mail) mail.focus(); return; }
        if (msg.length < 5) { if (err) err.textContent = "Escriba su mensaje."; if (message) message.focus(); return; }

        if (err) err.textContent = "";
        if (sub) { sub.disabled = true; sub.textContent = "Enviando…"; }

        var payload = {
            p_tipo: ty,
            p_nombre: n,
            p_contacto: tel + " · " + email,
            p_codigo_pedido: cod,
            p_mensaje: msg
        };
        var sent = false;

        try {
            var r = await rpc("registrar_consulta_v2", payload);
            sent = r.ok;
            if (!sent && (r.status === 404 || (r.body && r.body.code === "PGRST202")) && (ty === "consulta" || ty === "incidencia")) {
                var old = await rpc("registrar_consulta", payload);
                sent = old.ok;
            }
        } catch (x) {
            sent = false;
        }

        if (sub) { sub.disabled = false; sub.textContent = "Enviar"; }

        if (!sent) {
            if (err) err.textContent = "No se pudo enviar su mensaje. Revise su conexión e inténtelo de nuevo.";
            return;
        }

        if (card) card.classList.add("hidden");
        if (ok) ok.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    if (newBtn) newBtn.addEventListener("click", function () {
        if (form) form.reset();
        if (tipo) tipo.value = "consulta";
        if (err) err.textContent = "";
        if (ok) ok.classList.add("hidden");
        if (card) card.classList.remove("hidden");
        if (name) name.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

window.initConsulta = initConsulta;
