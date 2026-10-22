const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const notice = $("authNotice");
const requestView = $("requestView");
const updateView = $("updateView");
const requestForm = $("recoverForm");
const updateForm = $("updateForm");
const requestButton = $("recoverBtn");
const updateButton = $("updateBtn");
const emailInput = $("email");
const passwordInput = $("newPassword");
const confirmInput = $("newPasswordConfirm");
const requestError = $("recoverError");
const updateError = $("updateError");

function setNotice(message, type) {
    if (!notice) return;
    notice.textContent = message || "";
    notice.classList.toggle("is-error", type === "error");
    notice.hidden = !message;
}

function setError(element, message) {
    if (!element) return;
    element.textContent = message || "";
}

function setBusy(button, busy, idle, loading) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? loading : idle;
    button.setAttribute("aria-busy", busy ? "true" : "false");
}

function markInvalid(input, invalid) {
    if (!input) return;
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function showUpdate() {
    if (requestView) requestView.hidden = true;
    if (updateView) updateView.hidden = false;
    setError(requestError, "");
    setNotice("");
}

function showRequest(message, type) {
    if (updateView) updateView.hidden = true;
    if (requestView) requestView.hidden = false;
    setError(updateError, "");
    setNotice(message || "", type);
}

async function start() {
    let result = null;
    try {
        result = await VXAUTH.handleAuthRedirect();
    } catch (error) {
        showRequest(error.message, "error");
        return;
    }

    const wantsUpdate = params.get("modo") === "actualizar" || (result && result.type === "recovery");
    if (!wantsUpdate) return;

    const session = await VXAUTH.getSession();
    if (!session) {
        showRequest("El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.", "error");
        return;
    }

    showUpdate();
}

if (requestForm) {
    requestForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        setError(requestError, "");
        setNotice("");

        const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
        if (!validEmail(email)) {
            markInvalid(emailInput, true);
            setError(requestError, "Introduce un correo electrónico válido.");
            return;
        }
        markInvalid(emailInput, false);

        setBusy(requestButton, true, "Enviar instrucciones", "Enviando…");
        try {
            const redirect = new URL("recuperar.html?modo=actualizar", location.href).href;
            await VXAUTH.recover(email, redirect);
            setNotice("Si el correo está registrado, recibirás las instrucciones de recuperación. Revisa también la carpeta de correo no deseado.");
        } catch (error) {
            setNotice("No pudimos procesar la solicitud en este momento. Inténtalo de nuevo más tarde.", "error");
        } finally {
            setBusy(requestButton, false, "Enviar instrucciones", "Enviando…");
        }
    });
}

if (updateForm) {
    updateForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        setError(updateError, "");

        const password = passwordInput ? passwordInput.value : "";
        const confirmation = confirmInput ? confirmInput.value : "";
        let invalid = false;

        if (password.length < 8) {
            markInvalid(passwordInput, true);
            setError(updateError, "La contraseña debe tener al menos 8 caracteres.");
            invalid = true;
        } else {
            markInvalid(passwordInput, false);
        }

        if (!confirmation || confirmation !== password) {
            markInvalid(confirmInput, true);
            if (!invalid) setError(updateError, "Las contraseñas no coinciden.");
            invalid = true;
        } else {
            markInvalid(confirmInput, false);
        }

        if (invalid) return;

        setBusy(updateButton, true, "Guardar nueva contraseña", "Guardando…");
        try {
            await VXAUTH.updatePassword(password);
            await VXAUTH.signOut();
            location.replace("login.html?reset=1");
        } catch (error) {
            setError(updateError, error.message);
            setBusy(updateButton, false, "Guardar nueva contraseña", "Guardando…");
        }
    });
}

[emailInput, passwordInput, confirmInput].forEach(function (input) {
    if (!input) return;
    input.addEventListener("input", function () {
        markInvalid(input, false);
        if (input === emailInput) setError(requestError, "");
        else setError(updateError, "");
    });
});

start();
