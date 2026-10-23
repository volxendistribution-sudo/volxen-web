const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const notice = $("authNotice");
const tabs = $("authTabs");
const loginView = $("loginView");
const registerView = $("registerView");
const successView = $("registerSuccess");
const views = { login: loginView, register: registerView };
const tabButtons = Array.prototype.slice.call(document.querySelectorAll("[data-auth-tab]"));

const loginForm = $("loginForm");
const loginButton = $("loginBtn");
const loginEmail = $("loginEmail");
const loginPassword = $("loginPassword");
const loginError = $("loginError");

const registerForm = $("registerForm");
const registerButton = $("registerBtn");
const registerEmail = $("registerEmail");
const registerPassword = $("registerPassword");
const registerConfirm = $("registerPasswordConfirm");
const registerError = $("registerError");

const reduceMotion = function () {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

let mode = params.get("modo") === "registro" || params.get("registro") === "1" ? "register" : "login";
let switching = false;

function safeDestination() {
    const raw = VXAUTH.safeNext(params.get("next"));
    if (!raw) return "pedidos.html";
    if (/^(login|registro|recuperar)\.html(?:[?#]|$)/i.test(raw)) return "pedidos.html";
    return raw;
}

const next = safeDestination();
const socialEnabled = !(window.VOLXEN_CONFIG && window.VOLXEN_CONFIG.ENABLE_SOCIAL_LOGIN === false);

if (!socialEnabled) {
    document.querySelectorAll(".auth-social, .auth-sep").forEach(function (element) {
        element.hidden = true;
    });
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

function activeError() {
    return mode === "register" ? registerError : loginError;
}

function setActiveTab(target) {
    tabButtons.forEach(function (button) {
        const active = button.getAttribute("data-auth-tab") === target;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
        button.tabIndex = active ? 0 : -1;
    });
}

function updateUrl(target) {
    try {
        const url = new URL(location.href);
        if (target === "register") url.searchParams.set("modo", "registro");
        else {
            url.searchParams.delete("modo");
            url.searchParams.delete("registro");
        }
        url.searchParams.delete("registered");
        url.searchParams.delete("reset");
        history.replaceState(null, document.title, url.pathname + (url.search ? url.search : ""));
    } catch (e) {}
}

function focusFirst(target) {
    const root = views[target];
    if (!root) return;
    const input = root.querySelector("input:not([type=hidden])");
    if (input) window.setTimeout(function () { input.focus(); }, 80);
}

function animate(element, frames) {
    if (!element || !element.animate || reduceMotion()) return Promise.resolve();
    try {
        return element.animate(frames, {
            duration: 220,
            easing: "cubic-bezier(.22,1,.36,1)",
            fill: "both"
        }).finished.catch(function () {});
    } catch (e) {
        return Promise.resolve();
    }
}

async function switchMode(target, options) {
    const opts = options || {};
    target = target === "register" ? "register" : "login";
    if (switching) return;
    if (!opts.force && mode === target && successView && successView.hidden) return;

    const from = successView && !successView.hidden ? successView : views[mode];
    const to = views[target];
    if (!to) return;

    switching = true;
    setError(loginError, "");
    setError(registerError, "");
    if (opts.clearNotice !== false) setNotice("");

    const direction = target === "register" ? 1 : -1;

    if (from && from !== to) {
        await animate(from, [
            { opacity: 1, transform: "translateX(0)" },
            { opacity: 0, transform: "translateX(" + (-18 * direction) + "px)" }
        ]);
        from.hidden = true;
    }

    if (successView && !successView.hidden) successView.hidden = true;
    if (tabs) tabs.hidden = false;
    to.hidden = false;

    if (!reduceMotion()) {
        await animate(to, [
            { opacity: 0, transform: "translateX(" + (18 * direction) + "px)" },
            { opacity: 1, transform: "translateX(0)" }
        ]);
    }

    mode = target;
    setActiveTab(target);
    updateUrl(target);
    switching = false;

    if (opts.focus !== false) focusFirst(target);
}

function showSuccess(message) {
    if (!successView) return;
    if (loginView) loginView.hidden = true;
    if (registerView) registerView.hidden = true;
    if (tabs) tabs.hidden = true;
    successView.hidden = false;
    setBusy(registerButton, false, "Crear cuenta", "Creando cuenta…");
    setError(loginError, "");
    setError(registerError, "");
    setNotice(message || "");
}

async function start() {
    try {
        const result = await VXAUTH.handleAuthRedirect();
        if (result && result.type === "recovery") {
            location.replace("recuperar.html?modo=actualizar");
            return;
        }
    } catch (error) {
        setNotice(error.message, "error");
    }

    if (params.get("reset") === "1") {
        setNotice("Tu contraseña se actualizó correctamente. Inicia sesión con la nueva contraseña.");
    } else if (params.get("registered") === "1") {
        setNotice("Tu correo electrónico está confirmado. Ya puedes iniciar sesión.");
    }

    try {
        const session = await VXAUTH.getSession();
        if (session) {
            location.replace(next);
            return;
        }
    } catch (e) {}

    if (mode === "register") {
        if (loginView) loginView.hidden = true;
        if (registerView) registerView.hidden = false;
    } else {
        if (loginView) loginView.hidden = false;
        if (registerView) registerView.hidden = true;
    }
    if (tabs) tabs.hidden = false;
    setActiveTab(mode);
    updateUrl(mode);
}

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        setError(loginError, "");
        setNotice("");

        const email = loginEmail ? loginEmail.value.trim().toLowerCase() : "";
        const password = loginPassword ? loginPassword.value : "";
        let invalid = false;

        if (!validEmail(email)) {
            markInvalid(loginEmail, true);
            setError(loginError, "Introduce un correo electrónico válido.");
            invalid = true;
        } else {
            markInvalid(loginEmail, false);
        }

        if (!password) {
            markInvalid(loginPassword, true);
            if (!invalid) setError(loginError, "Introduce tu contraseña.");
            invalid = true;
        } else {
            markInvalid(loginPassword, false);
        }

        if (invalid) return;

        setBusy(loginButton, true, "Iniciar sesión", "Iniciando sesión…");
        try {
            await VXAUTH.signIn(email, password);
            location.replace(next);
        } catch (error) {
            markInvalid(loginEmail, true);
            markInvalid(loginPassword, true);
            setError(loginError, error.message);
            setBusy(loginButton, false, "Iniciar sesión", "Iniciando sesión…");
        }
    });
}

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        setError(registerError, "");
        setNotice("");

        const email = registerEmail ? registerEmail.value.trim().toLowerCase() : "";
        const password = registerPassword ? registerPassword.value : "";
        const confirmation = registerConfirm ? registerConfirm.value : "";
        let invalid = false;

        if (!validEmail(email)) {
            markInvalid(registerEmail, true);
            setError(registerError, "Introduce un correo electrónico válido.");
            invalid = true;
        } else {
            markInvalid(registerEmail, false);
        }

        if (password.length < 8) {
            markInvalid(registerPassword, true);
            if (!invalid) setError(registerError, "La contraseña debe tener al menos 8 caracteres.");
            invalid = true;
        } else {
            markInvalid(registerPassword, false);
        }

        if (!confirmation || confirmation !== password) {
            markInvalid(registerConfirm, true);
            if (!invalid) setError(registerError, "Las contraseñas no coinciden.");
            invalid = true;
        } else {
            markInvalid(registerConfirm, false);
        }

        if (invalid) return;

        setBusy(registerButton, true, "Crear cuenta", "Creando cuenta…");
        try {
            const redirect = new URL("login.html", location.href);
            redirect.searchParams.set("registered", "1");
            if (next) redirect.searchParams.set("next", next);
            const result = await VXAUTH.signUp(email, password, redirect.href);
            if (result.needsConfirmation) {
                if (registerPassword) registerPassword.value = "";
                if (registerConfirm) registerConfirm.value = "";
                showSuccess();
            } else {
                location.replace(next);
            }
        } catch (error) {
            markInvalid(registerEmail, true);
            setError(registerError, error.message);
            setBusy(registerButton, false, "Crear cuenta", "Creando cuenta…");
        }
    });
}

[loginEmail, loginPassword, registerEmail, registerPassword, registerConfirm].forEach(function (input) {
    if (!input) return;
    input.addEventListener("input", function () {
        markInvalid(input, false);
        const box = registerForm && registerForm.contains(input) ? registerError : loginError;
        if (box && box.textContent) setError(box, "");
    });
});

document.addEventListener("click", async function (event) {
    const switchButton = event.target.closest("[data-auth-switch]");
    if (switchButton) {
        event.preventDefault();
        await switchMode(switchButton.getAttribute("data-auth-switch"), { force: true });
        return;
    }

    const providerButton = event.target.closest("[data-provider]");
    if (!providerButton) return;

    const provider = providerButton.getAttribute("data-provider");
    const label = provider === "google" ? "Google" : "Facebook";
    const errorBox = activeError();
    setError(errorBox, "");
    setNotice("");

    const enabled = await VXAUTH.providerEnabled(provider);
    if (enabled === false) {
        setError(errorBox, "El acceso con " + label + " todavía no está configurado. Puedes entrar con tu correo y contraseña.");
        return;
    }

    const original = providerButton.innerHTML;
    providerButton.disabled = true;
    providerButton.textContent = "Redirigiendo…";
    try {
        await VXAUTH.signInWithOAuth(provider, { next: next });
    } catch (error) {
        providerButton.disabled = false;
        providerButton.innerHTML = original;
        setError(errorBox, error.message);
    }
});

setActiveTab(mode);
start();
