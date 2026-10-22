const $ = (id) => document.getElementById(id);
const notice = $("authNotice");
const errorBox = $("authError");
const form = $("registerForm");
const submit = $("registerBtn");
const content = $("registerContent");
const success = $("registerSuccess");
const emailInput = $("email");
const passwordInput = $("password");
const confirmInput = $("passwordConfirm");

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
    submit.textContent = busy ? "Creando cuenta…" : "Crear cuenta";
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

function showSuccess() {
    if (content) content.hidden = true;
    if (success) success.hidden = false;
    setNotice("");
    setError("");
}

async function start() {
    const session = await VXAUTH.getSession();
    if (session) {
        location.replace("pedidos.html");
        return;
    }
    if (new URLSearchParams(location.search).get("confirmado") === "1") {
        setNotice("Tu correo electrónico está confirmado. Ya puedes iniciar sesión.");
    }
}

if (form) {
    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        setError("");

        const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
        const password = passwordInput ? passwordInput.value : "";
        const confirmation = confirmInput ? confirmInput.value : "";
        let invalid = false;

        if (!validEmail(email)) {
            markInvalid(emailInput, true);
            setError("Introduce un correo electrónico válido.");
            invalid = true;
        } else {
            markInvalid(emailInput, false);
        }

        if (password.length < 8) {
            markInvalid(passwordInput, true);
            if (!invalid) setError("La contraseña debe tener al menos 8 caracteres.");
            invalid = true;
        } else {
            markInvalid(passwordInput, false);
        }

        if (!confirmation || confirmation !== password) {
            markInvalid(confirmInput, true);
            if (!invalid) setError("Las contraseñas no coinciden.");
            invalid = true;
        } else {
            markInvalid(confirmInput, false);
        }

        if (invalid) return;

        setBusy(true);
        try {
            const redirect = new URL("login.html?registered=1", location.href).href;
            const result = await VXAUTH.signUp(email, password, redirect);
            if (result.needsConfirmation) {
                showSuccess();
            } else {
                location.replace("pedidos.html");
            }
        } catch (error) {
            setError(error.message);
            setBusy(false);
        }
    });
}

[emailInput, passwordInput, confirmInput].forEach(function (input) {
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
            await VXAUTH.signInWithOAuth(provider, { next: "pedidos.html" });
        } catch (error) {
            button.disabled = false;
            button.innerHTML = original;
            setError(error.message);
        }
    });
});

start();
