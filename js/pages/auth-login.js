const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const notice = $("authNotice");
const errorBox = $("authError");
const form = $("loginForm");
const submit = $("loginBtn");
const emailInput = $("email");
const passwordInput = $("password");

function setNotice(message, type) {
    if (!notice) return;
    notice.textContent = message || "";
    notice.classList.toggle("is-error", type === "error");
    notice.hidden = !message;
}

function setError(message) {
    if (!errorBox) return;
    errorBox.textContent = message || "";
}

function setBusy(busy) {
    if (!submit) return;
    submit.disabled = busy;
    submit.textContent = busy ? "Iniciando sesión…" : "Iniciar sesión";
    submit.setAttribute("aria-busy", busy ? "true" : "false");
}

function markInvalid(input, invalid) {
    if (!input) return;
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function safeDestination() {
    const raw = VXAUTH.safeNext(params.get("next"));
    if (!raw) return "pedidos.html";
    if (/^(login|registro|recuperar)\.html(?:[?#]|$)/i.test(raw)) return "pedidos.html";
    return raw;
}

const next = safeDestination();

async function redirectIfSignedIn() {
    const session = await VXAUTH.getSession();
    if (!session) return false;
    location.replace(next);
    return true;
}

async function start() {
    try {
        const result = await VXAUTH.handleAuthRedirect();
        if (result && result.type === "recovery") {
            location.replace("recuperar.html?modo=actualizar");
            return;
        }
    } catch (error) {
        setError(error.message);
    }

    if (params.get("reset") === "1") {
        setNotice("Tu contraseña se actualizó correctamente. Inicia sesión con la nueva contraseña.");
    } else if (params.get("registered") === "1") {
        setNotice("Tu correo electrónico está confirmado. Ya puedes iniciar sesión.");
    }

    await redirectIfSignedIn();
}

if (form) {
    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        setError("");

        const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
        const password = passwordInput ? passwordInput.value : "";
        let invalid = false;

        if (!validEmail(email)) {
            markInvalid(emailInput, true);
            setError("Introduce un correo electrónico válido.");
            invalid = true;
        } else {
            markInvalid(emailInput, false);
        }

        if (!password) {
            markInvalid(passwordInput, true);
            setError(invalid ? "Completa el correo electrónico y la contraseña." : "Introduce tu contraseña.");
            invalid = true;
        } else {
            markInvalid(passwordInput, false);
        }

        if (invalid) return;

        setBusy(true);
        try {
            await VXAUTH.signIn(email, password);
            location.replace(next);
        } catch (error) {
            markInvalid(emailInput, true);
            markInvalid(passwordInput, true);
            setError(error.message);
            setBusy(false);
        }
    });
}

[emailInput, passwordInput].forEach(function (input) {
    if (!input) return;
    input.addEventListener("input", function () {
        markInvalid(input, false);
        if (errorBox && errorBox.textContent) setError("");
    });
});

document.querySelectorAll("[data-provider]").forEach(function (button) {
    button.addEventListener("click", async function () {
        setError("");
        const provider = button.dataset.provider;
        const label = provider === "google" ? "Google" : "Facebook";
        const enabled = await VXAUTH.providerEnabled(provider);

        if (enabled === false) {
            setError("El acceso con " + label + " todavía no está configurado.");
            return;
        }

        const original = button.innerHTML;
        button.disabled = true;
        button.textContent = "Redirigiendo…";
        try {
            await VXAUTH.signInWithOAuth(provider, { next: next });
        } catch (error) {
            button.disabled = false;
            button.innerHTML = original;
            setError(error.message);
        }
    });
});

start();
