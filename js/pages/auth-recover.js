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

const ATTEMPT_KEY = "vx_recuperacion_intentos";
const MAX_CODE_ATTEMPTS = 5;
const CODE_LOCK_MS = 10 * 60 * 1000;

let recoveryEmail = "";
let resendTimer = null;

function readAttemptState() {
    if (!recoveryEmail) return null;
    try {
        const raw = window.localStorage.getItem(ATTEMPT_KEY);
        const state = raw ? JSON.parse(raw) : null;
        if (!state || state.email !== recoveryEmail) return null;
        return state;
    } catch (error) {
        return null;
    }
}

function saveAttemptState(count, lockedUntil) {
    try {
        window.localStorage.setItem(ATTEMPT_KEY, JSON.stringify({
            email: recoveryEmail,
            count: count,
            lockedUntil: lockedUntil || 0
        }));
    } catch (error) {}
}

function clearAttemptState() {
    try {
        window.localStorage.removeItem(ATTEMPT_KEY);
    } catch (error) {}
}

function lockRemaining() {
    const state = readAttemptState();
    const until = state ? Number(state.lockedUntil) || 0 : 0;
    return until > Date.now() ? until - Date.now() : 0;
}

function registerFailedAttempt() {
    const state = readAttemptState();
    const count = (state ? Number(state.count) || 0 : 0) + 1;
    const lockedUntil = count >= MAX_CODE_ATTEMPTS ? Date.now() + CODE_LOCK_MS : 0;
    saveAttemptState(count, lockedUntil);
    return { count: count, lockedUntil: lockedUntil };
}

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
    clearAttemptState();
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
    clearAttemptState();
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

function recoveryErrorMessage(error) {
    if (error && error.status === 429) {
        return "Se alcanzó el límite de envío de correos. Espera una hora antes de volver a intentarlo.";
    }
    return "No pudimos enviar el código en este momento. Revisa tu conexión e inténtalo de nuevo.";
}

async function requestRecoveryCode() {
    try {
        await VXAUTH.recover(recoveryEmail, recoveryRedirect());
    } catch (error) {
        const status = Number(error && error.status);
        if (status === 400 || status === 422) return;
        throw error;
    }
}

async function sendRecoveryCode(message) {
    await requestRecoveryCode();
    showCode(message || "Si el correo está registrado, recibirás un código de 6 dígitos para restablecer tu contraseña.");
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
        showRequest("La solicitud anterior ya no es válida. Solicita un código nuevo para continuar.", "error");
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
        clearAttemptState();
        setBusy(requestButton, true, "Enviar código", "Enviando…");
        try {
            await sendRecoveryCode("Si el correo está registrado, recibirás un código de 6 dígitos para restablecer tu contraseña.");
        } catch (error) {
            showRequest(recoveryErrorMessage(error), "error");
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

        const locked = lockRemaining();
        if (locked) {
            setError(codeError, "Has agotado los intentos. Solicita un código nuevo o espera " + Math.ceil(locked / 60000) + " minutos.");
            return;
        }

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
            clearAttemptState();
            showUpdate();
        } catch (error) {
            markInvalid(codeInput, true);
            const attempt = registerFailedAttempt();
            if (attempt.lockedUntil) {
                setError(codeError, "Has agotado los 5 intentos. Solicita un código nuevo o espera 10 minutos.");
            } else {
                setError(codeError, error.message);
            }
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
            clearAttemptState();
            location.replace("pedidos.html");
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
        resendButton.disabled = true;
        try {
            await requestRecoveryCode();
            clearAttemptState();
            if (codeInput) codeInput.value = "";
            startResendCooldown();
            setNotice("Enviamos un mensaje nuevo. Usa el código más reciente.");
        } catch (error) {
            resendButton.disabled = false;
            setNotice(recoveryErrorMessage(error), "error");
        }
    });
}

if (changeEmailButton) {
    changeEmailButton.addEventListener("click", function () {
        recoveryEmail = "";
        clearAttemptState();
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
