(function () {
    "use strict";

    const cfg = window.VOLXEN_CONFIG || {};
    const base = String(cfg.SUPABASE_URL || "").replace(/\/+$/, "");
    const AUTH_URL = base + "/auth/v1";
    const REST_URL = base + "/rest/v1";
    const API_KEY = cfg.SUPABASE_KEY || "";
    const SESSION_KEY = "vx_sesion";
    const PKCE_KEY = "vx_pkce";
    const clock = () => Math.floor(Date.now() / 1000);

    function readStorage(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            window.localStorage.setItem(key, value);
            return true;
        } catch (e) {
            return false;
        }
    }

    function removeStorage(key) {
        try {
            window.localStorage.removeItem(key);
        } catch (e) {}
    }

    function readSession() {
        const raw = readStorage(SESSION_KEY);
        if (!raw) return null;
        try {
            const session = JSON.parse(raw);
            if (!session || !session.access_token) return null;
            return session;
        } catch (e) {
            return null;
        }
    }

    function saveSession(session) {
        writeStorage(SESSION_KEY, JSON.stringify(session));
        return session;
    }

    function clearSession() {
        removeStorage(SESSION_KEY);
    }

    function normalizeUser(user) {
        const profile = user && user.user_metadata ? user.user_metadata : {};
        return {
            id: user && user.id ? user.id : "",
            email: user && user.email ? user.email : "",
            role: "",
            nombre: profile.nombre || profile.full_name || profile.name || "",
            avatar: profile.avatar_url || profile.picture || profile.avatar || ""
        };
    }

    function normalizeSession(payload, previous) {
        const old = previous || readSession();
        const user = payload && payload.user ? normalizeUser(payload.user) : (old && old.user) || normalizeUser(null);
        return {
            access_token: payload.access_token,
            refresh_token: payload.refresh_token || (old && old.refresh_token) || "",
            expires_at: Number(payload.expires_at) || (clock() + Number(payload.expires_in || 3600)),
            user: user,
            role_loaded: false
        };
    }

    async function hydrateRole(session) {
        if (!session || !session.access_token) return null;

        try {
            const response = await fetch(REST_URL + "/rpc/mi_rol", {
                method: "POST",
                headers: {
                    apikey: API_KEY,
                    Authorization: "Bearer " + session.access_token,
                    "Content-Type": "application/json"
                },
                body: "{}"
            });

            if (!response.ok) throw new Error("No se pudo cargar el rol");

            const role = await response.json();
            session.user = session.user || normalizeUser(null);
            session.user.role = typeof role === "string" ? role : "";
        } catch (e) {
            session.user = session.user || normalizeUser(null);
            session.user.role = "";
        }

        session.role_loaded = true;
        return saveSession(session);
    }

    function messageFor(data, status) {
        const code = String((data && (data.error_code || data.code || data.error)) || "").toLowerCase();
        const raw = String((data && (data.msg || data.message || data.error_description || data.error)) || "");

        if (/invalid login credentials|invalid_grant/.test(code) || /invalid login credentials/i.test(raw)) {
            return "Correo o contraseña incorrectos.";
        }
        if (/email not confirmed/.test(code) || /email not confirmed/i.test(raw)) {
            return "Debes confirmar tu correo electrónico antes de iniciar sesión.";
        }
        if (/user already registered|email_exists/.test(code) || /already registered/i.test(raw)) {
            return "Ya existe una cuenta con este correo electrónico.";
        }
        if (/weak_password|password should be/.test(code) || /password should be/i.test(raw)) {
            return "La contraseña no cumple los requisitos mínimos de seguridad.";
        }
        if (/over_email_send_rate_limit|email rate limit/.test(code) || /email rate limit/i.test(raw)) {
            return "Se alcanzó el límite de envío de correos. Espera una hora antes de volver a intentarlo.";
        }
        if (/rate limit/.test(code) || /rate limit/i.test(raw)) {
            return "Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.";
        }
        if (/signups not allowed|signup_disabled/.test(code) || /signups not allowed/i.test(raw)) {
            return "El registro de nuevas cuentas está desactivado en este momento.";
        }
        if (/provider is not enabled|provider not enabled/.test(code) || /provider is not enabled/i.test(raw)) {
            return "Este método de acceso todavía no está configurado.";
        }
        if (/access_denied/.test(code) || /access_denied/i.test(raw)) {
            return "Has cancelado el acceso. Puedes intentarlo de nuevo cuando quieras.";
        }
        if (/invalid otp|otp.*invalid|invalid.*token/.test(code) || /invalid otp|código.*no.*válido/i.test(raw)) {
            return "El código no es válido o ha expirado. Solicita uno nuevo.";
        }
        if (/invalid or has expired|otp_expired|token has expired/.test(code) || /expired/i.test(raw)) {
            return "El enlace o código no es válido o ha expirado. Solicita uno nuevo.";
        }
        if (status === 429) {
            return "Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.";
        }
        if (status >= 500) {
            return "El servicio de cuentas no está disponible en este momento. Inténtalo de nuevo más tarde.";
        }
        return "No se pudo completar la solicitud. Inténtalo de nuevo.";
    }

    async function authRequest(path, options) {
        const opts = options || {};
        const headers = Object.assign({ apikey: API_KEY }, opts.headers || {});
        if (opts.body !== undefined) headers["Content-Type"] = "application/json";
        if (opts.token) headers.Authorization = "Bearer " + opts.token;

        const response = await fetch(AUTH_URL + path, {
            method: opts.method || "GET",
            headers: headers,
            body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
        });

        const text = await response.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { message: text };
            }
        }

        if (!response.ok) {
            const error = new Error(messageFor(data, response.status));
            error.status = response.status;
            error.code = data && (data.error_code || data.error);
            throw error;
        }

        return data;
    }

    function withRedirect(path, redirectTo) {
        if (!redirectTo) return path;
        return path + (path.indexOf("?") === -1 ? "?" : "&") + "redirect_to=" + encodeURIComponent(redirectTo);
    }

    let refreshing = null;

    async function refreshSession() {
        const current = readSession();
        if (!current || !current.refresh_token) return null;
        if (refreshing) return refreshing;

        refreshing = (async function () {
            try {
                const data = await authRequest("/token?grant_type=refresh_token", {
                    method: "POST",
                    body: { refresh_token: current.refresh_token }
                });
                return saveSession(normalizeSession(data, current));
            } catch (error) {
                if (error.status === 400 || error.status === 401) clearSession();
                return null;
            } finally {
                refreshing = null;
            }
        })();

        return refreshing;
    }

    async function getSession() {
        let session = readSession();
        if (!session) return null;
        if (!session.expires_at || session.expires_at - 60 <= clock()) {
            session = await refreshSession();
        }
        if (session && !session.role_loaded) {
            session = await hydrateRole(session);
        }
        return session;
    }

    async function accessToken() {
        const session = await getSession();
        return session ? session.access_token : null;
    }

    async function signIn(email, password) {
        const data = await authRequest("/token?grant_type=password", {
            method: "POST",
            body: { email: email, password: password }
        });
        return hydrateRole(saveSession(normalizeSession(data)));
    }

    async function signUp(email, password, redirectTo) {
        const data = await authRequest(withRedirect("/signup", redirectTo), {
            method: "POST",
            body: { email: email, password: password }
        });
        if (data && data.access_token) {
            const session = await hydrateRole(saveSession(normalizeSession(data)));
            return { needsConfirmation: false, session: session };
        }
        return { needsConfirmation: true, session: null };
    }

    async function recover(email, redirectTo) {
        await authRequest(withRedirect("/recover", redirectTo), {
            method: "POST",
            body: { email: email }
        });
    }

    async function verifyRecoveryCode(email, token) {
        const data = await authRequest("/verify", {
            method: "POST",
            body: {
                type: "recovery",
                email: email,
                token: String(token || "").trim()
            }
        });
        if (!data || !data.access_token) {
            throw new Error("El código no es válido o ha expirado. Solicita uno nuevo.");
        }
        return hydrateRole(saveSession(normalizeSession(data)));
    }

    async function updatePassword(password) {
        const session = await getSession();
        if (!session) throw new Error("Tu código de recuperación ha expirado. Solicita uno nuevo.");
        await authRequest("/user", {
            method: "PUT",
            token: session.access_token,
            body: { password: password }
        });
    }

    async function signOut() {
        const session = readSession();
        clearSession();
        if (!session || !session.access_token) return;
        try {
            await authRequest("/logout", { method: "POST", token: session.access_token });
        } catch (e) {}
    }

    function base64Url(bytes) {
        let binary = "";
        const list = new Uint8Array(bytes);
        for (let i = 0; i < list.length; i += 1) binary += String.fromCharCode(list[i]);
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    function randomToken(size) {
        const bytes = new Uint8Array(size);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(bytes);
        } else {
            for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
        }
        return base64Url(bytes);
    }

    async function challengeFor(verifier) {
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error("Este navegador no permite completar el acceso seguro. Actualízalo e inténtalo de nuevo.");
        }
        const data = new TextEncoder().encode(verifier);
        const digest = await window.crypto.subtle.digest("SHA-256", data);
        return base64Url(digest);
    }

    function readPending() {
        const raw = readStorage(PKCE_KEY);
        if (!raw) return null;
        try {
            const pending = JSON.parse(raw);
            if (!pending || !pending.verifier) return null;
            if (Date.now() - Number(pending.created || 0) > 15 * 60 * 1000) {
                removeStorage(PKCE_KEY);
                return null;
            }
            return pending;
        } catch (e) {
            return null;
        }
    }

    async function signInWithOAuth(provider, options) {
        const name = String(provider || "").toLowerCase();
        if (name !== "google" && name !== "facebook") {
            throw new Error("Método de acceso no válido.");
        }

        const verifier = randomToken(48);
        const state = randomToken(24);
        const challenge = await challengeFor(verifier);
        const opts = options || {};
        const redirect = new URL("login.html", window.location.href);
        const next = safeNext(opts.next);
        if (next) redirect.searchParams.set("next", next);

        writeStorage(PKCE_KEY, JSON.stringify({
            verifier: verifier,
            state: state,
            provider: name,
            created: Date.now()
        }));

        const authorize = new URL(AUTH_URL + "/authorize");
        authorize.searchParams.set("provider", name);
        authorize.searchParams.set("redirect_to", redirect.href);
        authorize.searchParams.set("code_challenge", challenge);
        authorize.searchParams.set("code_challenge_method", "s256");
        authorize.searchParams.set("flow_type", "pkce");
        authorize.searchParams.set("state", state);
        window.location.assign(authorize.href);
    }

    function cleanUrl() {
        try {
            const url = new URL(window.location.href);
            ["code", "state", "error", "error_code", "error_description", "type", "oauth"].forEach(function (key) {
                url.searchParams.delete(key);
            });
            url.hash = "";
            const clean = url.pathname + (url.search ? url.search : "");
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, document.title, clean);
            }
        } catch (e) {}
    }

    async function handleAuthRedirect() {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const query = url.searchParams;
        const errorText = query.get("error_description") || query.get("error") || hash.get("error_description") || hash.get("error");

        if (errorText) {
            cleanUrl();
            throw new Error(messageFor({ message: errorText }, 400));
        }

        const code = query.get("code");
        if (code) {
            const pending = readPending();
            const state = query.get("state");
            if (!pending || (pending.state && state !== pending.state)) {
                cleanUrl();
                throw new Error("El enlace de acceso no es válido o ha expirado. Inténtalo de nuevo.");
            }
            try {
                const data = await authRequest("/token?grant_type=pkce", {
                    method: "POST",
                    body: { auth_code: code, code_verifier: pending.verifier }
                });
                await hydrateRole(saveSession(normalizeSession(data)));
            } finally {
                removeStorage(PKCE_KEY);
                cleanUrl();
            }
            return { type: "oauth", session: readSession() };
        }

        if (hash.get("access_token")) {
            const token = hash.get("access_token");
            const session = {
                access_token: token,
                refresh_token: hash.get("refresh_token") || "",
                expires_at: Number(hash.get("expires_at")) || (clock() + Number(hash.get("expires_in") || 3600)),
                user: normalizeUser(null)
            };
            try {
                const user = await authRequest("/user", { token: token });
                session.user = normalizeUser(user);
                await hydrateRole(saveSession(session));
            } catch (error) {
                clearSession();
                cleanUrl();
                throw error;
            }
            const type = hash.get("type") || query.get("type") || "";
            cleanUrl();
            return { type: type, session: readSession() };
        }

        return null;
    }

    let providerCache = null;

    async function providers() {
        if (providerCache) return providerCache;
        const response = await fetch(AUTH_URL + "/settings", { headers: { apikey: API_KEY } });
        if (!response.ok) throw new Error("No se pudo comprobar la configuración de acceso.");
        const data = await response.json();
        providerCache = data && data.external ? data.external : {};
        return providerCache;
    }

    async function providerEnabled(provider) {
        try {
            const list = await providers();
            return list[String(provider).toLowerCase()] === true;
        } catch (e) {
            return null;
        }
    }

    function safeNext(value) {
        const next = String(value || "").trim();
        if (!next) return "";
        if (/^[a-z][a-z0-9+.-]*:/i.test(next)) return "";
        if (next.indexOf("//") === 0 || next.indexOf("\\") !== -1) return "";
        return next.charAt(0) === "/" || /^[a-z0-9._~-]+(?:[/?#]|$)/i.test(next) ? next : "";
    }

    async function rest(path, options) {
        const opts = options || {};
        let session = await getSession();
        const headers = Object.assign({ apikey: API_KEY }, opts.headers || {});
        if (opts.body !== undefined) headers["Content-Type"] = "application/json";
        if (session) headers.Authorization = "Bearer " + session.access_token;

        const request = function () {
            return fetch(REST_URL + path, {
                method: opts.method || "GET",
                headers: headers,
                body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
            });
        };

        let response = await request();
        if (response.status === 401 && session) {
            session = await refreshSession();
            if (session) {
                headers.Authorization = "Bearer " + session.access_token;
                response = await request();
            }
        }

        const text = await response.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = text;
            }
        }
        if (!response.ok) {
            const message = data && (data.message || data.error_description || data.error);
            throw new Error(message || "No se pudo completar la solicitud.");
        }
        return data;
    }

    async function isAdmin() {
        const session = await getSession();
        if (!session || !session.user) return false;
        return session.user.role === "admin";
    }

    window.VXAUTH = {
        signIn: signIn,
        signUp: signUp,
        signInWithOAuth: signInWithOAuth,
        recover: recover,
        verifyRecoveryCode: verifyRecoveryCode,
        updatePassword: updatePassword,
        signOut: signOut,
        getSession: getSession,
        getUser: function () {
            const session = readSession();
            return session ? session.user : null;
        },
        accessToken: accessToken,
        handleAuthRedirect: handleAuthRedirect,
        providers: providers,
        providerEnabled: providerEnabled,
        safeNext: safeNext,
        rest: rest,
        isAdmin: isAdmin,
        messageFor: messageFor
    };
})();
