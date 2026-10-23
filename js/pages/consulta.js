/**
 * Consulta general e incidencias
 * Sends the message to Supabase, shows the status and keeps the client's history.
 */

export async function initConsulta() {
    var C = window.VOLXEN_CONFIG;
    var form = VX.$("consultaForm"), card = VX.$("consultaCard"), ok = VX.$("consultaOk"),
        err = VX.$("cerr"), sub = VX.$("csub"), newBtn = VX.$("cnew"),
        name = VX.$("cnombre"), phone = VX.$("ct"), mail = VX.$("ce"), tipo = VX.$("cqt"),
        order = VX.$("cp"), message = VX.$("cm");

    var historySection = VX.$("misConsultas"), historyList = VX.$("consultaHistory"),
        accountEmail = VX.$("consultaAccountEmail"), accountAvatar = VX.$("consultaAvatar"),
        verHistory = VX.$("verMisConsultas"), codeBox = VX.$("consultaCodeBox"),
        codeValue = VX.$("consultaCode"), okNote = VX.$("consultaOkNote");

    var lookupSection = VX.$("consultaLookup"), lookupForm = VX.$("lookupForm"),
        lookupCode = VX.$("lc"), lookupContact = VX.$("lk"), lookupError = VX.$("lookupError"),
        lookupButton = VX.$("lookupBtn"), lookupResult = VX.$("lookupResult");

    var params = new URLSearchParams(location.search);
    var wanted = params.get("tipo");
    if (tipo && ["consulta", "incidencia", "queja", "opinion"].indexOf(wanted) > -1) tipo.value = wanted;

    var session = null;
    try {
        session = window.VXAUTH ? await VXAUTH.getSession() : null;
    } catch (e) {}

    function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

    function esc(value) {
        return String(value == null ? "" : value).replace(/[&<>"]/g, function (character) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character];
        });
    }

    async function rpc(fn, payload, token) {
        var headers = { apikey: C.SUPABASE_KEY, "Content-Type": "application/json" };
        if (token) headers.Authorization = "Bearer " + token;
        var r = await fetch(C.SUPABASE_URL + "/rest/v1/rpc/" + fn, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
        });
        var j = null;
        try { j = await r.json(); } catch (e) {}
        return { ok: r.ok, status: r.status, body: j };
    }

    function failureMessage(result) {
        var raw = result && result.body && (result.body.message || result.body.error_description || result.body.error);
        raw = raw ? String(raw) : "";
        if (/consultas_tipo.*check|tipo no válido/i.test(raw)) {
            return "El tipo de mensaje no está habilitado en este momento. Inténtelo de nuevo más tarde.";
        }
        if (/rate limit|too many/i.test(raw)) {
            return "Ha enviado varios mensajes seguidos. Espere unos minutos e inténtelo de nuevo.";
        }
        if (/row-level security|permission denied/i.test(raw)) {
            return "No se pudo registrar el mensaje por un problema de permisos. Escríbanos por WhatsApp.";
        }
        if (raw) {
            return "No se pudo enviar su mensaje: " + raw;
        }
        return "No se pudo enviar su mensaje. Inténtelo de nuevo en unos minutos.";
    }

    function typeLabel(type) {
        return {
            consulta: "Consulta general",
            incidencia: "Incidencia",
            queja: "Queja",
            opinion: "Opinión"
        }[type] || "Consulta";
    }

    function statusInfo(status) {
        return {
            nueva: { label: "Pendiente", className: "is-nueva" },
            en_atencion: { label: "En atención", className: "is-atencion" },
            resuelta: { label: "Atendida", className: "is-resuelta" }
        }[status] || { label: "Pendiente", className: "is-nueva" };
    }

    function statusBadge(status) {
        var info = statusInfo(status);
        return '<span class="consulta-status ' + info.className + '">' + esc(info.label) + "</span>";
    }

    function formatDate(value) {
        var date = value ? new Date(value) : null;
        if (!date || isNaN(date.getTime())) return "";
        return date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
    }

    function renderConsultation(item) {
        var message = String((item && item.mensaje) || "");
        return '<article class="consulta-item">' +
            '<div class="consulta-item-head"><span class="consulta-item-type">' + esc(typeLabel(item.tipo)) + '</span>' + statusBadge(item.estado) + '</div>' +
            '<p class="consulta-item-meta">' + (item.codigo ? 'Código: <strong>' + esc(item.codigo) + '</strong> · ' : '') + esc(formatDate(item.created_at)) +
            (item.codigo_pedido ? ' · Pedido ' + esc(item.codigo_pedido) : '') + '</p>' +
            (message ? '<p class="consulta-item-message">' + esc(message.length > 220 ? message.slice(0, 220) + "…" : message) + '</p>' : '') +
            '</article>';
    }

    async function refreshHistory() {
        if (!historySection || !historyList) return;
        if (!session) {
            historySection.hidden = true;
            if (lookupSection) lookupSection.hidden = false;
            return;
        }

        historySection.hidden = false;
        if (lookupSection) lookupSection.hidden = true;
        if (accountEmail) accountEmail.textContent = (session.user && session.user.email) || "";
        var kicker = historySection.querySelector(".ey");
        if (kicker) {
            var fullName = String((session.user && (session.user.nombre || session.user.name)) || "").trim();
            kicker.textContent = fullName ? "Hola, " + fullName.split(/\s+/)[0] : "Mi cuenta";
        }
        if (accountAvatar && VX.avatarHtml) {
            accountAvatar.outerHTML = VX.avatarHtml(session.user, "account-avatar vx-avatar");
            accountAvatar = VX.$("consultaAvatar");
        }
        historyList.innerHTML = '<p class="account-empty">Cargando tus consultas…</p>';

        try {
            var items = await VXAUTH.rest("/rpc/mis_consultas", { method: "POST", body: {} });
            if (!Array.isArray(items) || !items.length) {
                historyList.innerHTML = '<p class="account-empty">Todavía no tienes consultas registradas. Envía una y aquí podrás ver si fue atendida.</p>';
                return;
            }
            historyList.innerHTML = '<p class="account-orders-title">Historial de consultas</p>' + items.map(renderConsultation).join("");
        } catch (e) {
            historyList.innerHTML = '<p class="account-empty" role="alert">No se pudieron cargar tus consultas en este momento. Inténtalo de nuevo más tarde.</p>';
        }
    }

    if (verHistory) {
        verHistory.hidden = !session;
        verHistory.addEventListener("click", function () {
            if (historySection) {
                historySection.hidden = false;
                historySection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    }

    if (form) {
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

            var token = "";
            try {
                token = (await VXAUTH.accessToken()) || "";
                session = await VXAUTH.getSession();
            } catch (x) {}

            var payload = {
                p_tipo: ty,
                p_nombre: n,
                p_contacto: tel + " · " + email,
                p_codigo_pedido: cod,
                p_mensaje: msg
            };
            var sent = false;
            var failure = "";
            var result = null;

            try {
                result = await rpc("registrar_consulta_v2", payload, token);
                sent = result.ok;
                if (!sent) {
                    failure = failureMessage(result);
                    if ((result.status === 404 || (result.body && result.body.code === "PGRST202")) && (ty === "consulta" || ty === "incidencia")) {
                        var old = await rpc("registrar_consulta", payload, token);
                        sent = old.ok;
                        if (!sent) failure = failureMessage(old);
                    }
                }
            } catch (x) {
                sent = false;
                failure = "No se pudo conectar con el servidor. Revise su conexión e inténtelo de nuevo.";
                if (window.console) console.warn("No se pudo registrar la consulta", x);
            }

            if (sub) { sub.disabled = false; sub.textContent = "Enviar"; }

            if (!sent) {
                if (err) err.textContent = failure || "No se pudo enviar su mensaje. Inténtelo de nuevo en unos minutos.";
                return;
            }

            var code = result && result.body && result.body.codigo ? String(result.body.codigo) : "";
            if (codeBox) codeBox.hidden = !code;
            if (codeValue) codeValue.textContent = code;
            if (okNote) okNote.textContent = session
                ? "La consulta ya aparece en tu historial. Aquí podrás ver si fue atendida."
                : "Guarda el código y consulta el estado con tu correo o teléfono.";
            if (verHistory) verHistory.hidden = !session;

            if (card) card.classList.add("hidden");
            if (ok) ok.classList.remove("hidden");
            await refreshHistory();
            if (ok) ok.scrollIntoView({ behavior: "smooth", block: "start" });
            else window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    if (newBtn) newBtn.addEventListener("click", function () {
        if (form) form.reset();
        if (tipo) tipo.value = "consulta";
        if (err) err.textContent = "";
        if (ok) ok.classList.add("hidden");
        if (card) card.classList.remove("hidden");
        if (codeBox) codeBox.hidden = true;
        if (name) name.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    if (lookupForm) {
        lookupForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            if (lookupButton && lookupButton.disabled) return;

            var code = lookupCode ? lookupCode.value.trim().toUpperCase() : "";
            var contact = lookupContact ? lookupContact.value.trim() : "";
            if (!code || contact.length < 6) {
                if (lookupError) lookupError.textContent = "Escriba el código y el correo o teléfono que usó.";
                return;
            }
            if (lookupError) lookupError.textContent = "";
            if (lookupResult) {
                lookupResult.hidden = true;
                lookupResult.innerHTML = "";
            }
            if (lookupButton) { lookupButton.disabled = true; lookupButton.textContent = "Consultando…"; }

            try {
                var result = await rpc("consultar_consulta", { p_codigo: code, p_contacto: contact });
                if (!result.ok) {
                    throw new Error((result.body && (result.body.message || result.body.error)) || "No se pudo consultar la consulta.");
                }
                if (!result.body) {
                    if (lookupError) lookupError.textContent = "No encontramos una consulta con ese código y contacto. Revisa los datos.";
                    return;
                }
                if (lookupResult) {
                    lookupResult.innerHTML = '<p><strong>' + esc(typeLabel(result.body.tipo)) + '</strong> · ' +
                        statusBadge(result.body.estado) + '</p><p>Código: <strong>' + esc(result.body.codigo) + '</strong>' +
                        (result.body.created_at ? ' · ' + esc(formatDate(result.body.created_at)) : '') + '</p>';
                    lookupResult.hidden = false;
                }
            } catch (error) {
                if (lookupError) lookupError.textContent = error.message || "No se pudo consultar el estado. Inténtelo de nuevo.";
            } finally {
                if (lookupButton) { lookupButton.disabled = false; lookupButton.textContent = "Consultar estado"; }
            }
        });
    }

    await refreshHistory();
}

window.initConsulta = initConsulta;
