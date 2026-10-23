const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const notice = $("authNotice");
const requestView = $("requestView");
const codeView = $("codeView");
const updateView = $("updateView");
const requestForm = $("recoverForm");
const codeForm = $("codeForm");
const updateForm = $("updateForm");
const requestButton = $("recoverBtn");
const codeButton = $("codeBtn");
const updateButton = $("updateBtn");
const resendButton = $("resendCode");
const changeEmailButton = $("changeEmail");
const emailInput = $("email");
const codeInput = $("recoverCode");
const emailText = $("recoverEmailText");
const passwordInput = $("newPassword");
const confirmInput = $("newPasswordConfirm");
const requestError = $("recoverError");
const codeError = $("codeError");
const updateError = $("updateError");

let recoveryEmail = "";
let resendTimer = null;

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

function recoveryRedirect() {
    return new URL("recuperar.html", location.href).href;
}

function showRequest(message, type) {
    if (updateView) updateView.hidden = true;
    if (codeView) codeView.hidden = true;
    if (requestView) requestView.hidden = false;
    setError(codeError, "");
    setError(updateError, "");
    setNotice(message || "", type);
}

function showCode(message, type) {
    if (requestView) requestView.hidden = true;
    if (updateView) updateView.hidden = true;
    if (codeView) codeView.hidden = false;
    if (emailText) emailText.textContent = recoveryEmail;
    setError(requestError, "");
    setError(updateError, "");
    setNotice(message || "", type);
    if (codeInput) {
        codeInput.value = "";
        window.setTimeout(function () { codeInput.focus(); }, 80);
    }
}

function showUpdate() {
    if (requestView) requestView.hidden = true;
    if (codeView) codeView.hidden = true;
    if (updateView) updateView.hidden = false;
    setError(requestError, "");
    setError(codeError, "");
    setNotice("Código verificado. Ya puedes crear una nueva contraseña.");
    if (passwordInput) window.setTimeout(function () { passwordInput.focus(); }, 80);
}

function startResendCooldown() {
    if (!resendButton) return;
    let remaining = 60;
    clearInterval(resendTimer);
    resendButton.disabled = true;
    resendButton.textContent = "Reenviar en " + remaining + " s";
    resendTimer = window.setInterval(function () {
        remaining -= 1;
        if (remaining <= 0) {
            clearInterval(resendTimer);
            resendTimer = null;
            resendButton.disabled = false;
            resendButton.textContent = "Reenviar código";
            return;
        }
        resendButton.textContent = "Reenviar en " + remaining + " s";
    }, 1000);
}

async function sendRecoveryCode(message) {
    const email = recoveryEmail;
    await VXAUTH.recover(email, recoveryRedirect());
    showCode(message || "Si el correo está registrado, recibirás un mensaje para restablecer tu contraseña. Si incluye un código de 6 dígitos, introdúcelo aquí.");
    startResendCooldown();
}

async function start() {
    let result = null;
    try {
        result = await VXAUTH.handleAuthRedirect();
    } catch (error) {
        showRequest(error.message, "error");
        return;
    }

    if (result && result.type === "recovery") {
        showUpdate();
        return;
    }

    if (params.get("modo") === "actualizar") {
        const session = await VXAUTH.getSession();
        if (session) {
            showUpdate();
            return;
        }
        showRequest("El enlace anterior ya no es válido. Solicita un código nuevo para continuar.", "error");
    }
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

        recoveryEmail = email;
        setBusy(requestButton, true, "Enviar código", "Enviando…");
        try {
            await sendRecoveryCode("Si el correo está registrado, recibirás un mensaje para restablecer tu contraseña. Si incluye un código de 6 dígitos, introdúcelo aquí.");
        } catch (error) {
            showRequest("No pudimos enviar el código en este momento. Espera un momento e inténtalo de nuevo.", "error");
        } finally {
            setBusy(requestButton, false, "Enviar código", "Enviando…");
        }
    });
}

if (codeForm) {
    codeForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        setError(codeError, "");
        setNotice("");

        const code = codeInput ? codeInput.value.replace(/\D/g, "") : "";
        if (code.length !== 6) {
            markInvalid(codeInput, true);
            setError(codeError, "Introduce el código de 6 dígitos que recibiste.");
            return;
        }
        markInvalid(codeInput, false);

        setBusy(codeButton, true, "Verificar código", "Verificando…");
        try {
            await VXAUTH.verifyRecoveryCode(recoveryEmail, code);
            showUpdate();
        } catch (error) {
            markInvalid(codeInput, true);
            setError(codeError, error.message);
            setBusy(codeButton, false, "Verificar código", "Verificando…");
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

if (resendButton) {
    resendButton.addEventListener("click", async function () {
        if (!recoveryEmail || resendButton.disabled) return;
        setError(codeError, "");
        setNotice("");
        try {
            await VXAUTH.recover(recoveryEmail, recoveryRedirect());
            if (codeInput) codeInput.value = "";
            startResendCooldown();
            setNotice("Enviamos un mensaje nuevo. Usa el código o enlace más reciente.");
        } catch (error) {
            setNotice("No pudimos reenviar el código. Espera un momento e inténtalo de nuevo.", "error");
        }
    });
}

if (changeEmailButton) {
    changeEmailButton.addEventListener("click", function () {
        recoveryEmail = "";
        if (codeInput) codeInput.value = "";
        showRequest("");
        if (emailInput) {
            emailInput.value = "";
            window.setTimeout(function () { emailInput.focus(); }, 80);
        }
    });
}

if (codeInput) {
    codeInput.addEventListener("input", function () {
        const clean = codeInput.value.replace(/\D/g, "").slice(0, 6);
        if (codeInput.value !== clean) codeInput.value = clean;
        markInvalid(codeInput, false);
        if (codeError && codeError.textContent) setError(codeError, "");
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
