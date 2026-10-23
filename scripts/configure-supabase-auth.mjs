import { readFile } from "node:fs/promises";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || "zyszkujnpbievjapsuyy";
const siteUrl = String(process.env.SITE_URL || "https://volxen.com").replace(/\/+$/, "");
const extraRedirects = String(process.env.EXTRA_REDIRECTS || "https://volxen-web.pages.dev,http://localhost:3000")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
const redirects = [...new Set([siteUrl, ...extraRedirects])].join(",");

if (!token && process.env.DRY_RUN !== "1") {
    console.error("Falta SUPABASE_ACCESS_TOKEN.");
    console.error("Crea un token en https://supabase.com/dashboard/account/tokens y ejecuta:");
    console.error("SUPABASE_ACCESS_TOKEN=... npm run auth:configure");
    process.exit(1);
}

try {
    new URL(siteUrl);
} catch (error) {
    console.error("SITE_URL no es una URL válida.");
    process.exit(1);
}

const [recovery, confirmation] = await Promise.all([
    readFile(new URL("../supabase/templates/recovery.html", import.meta.url), "utf8"),
    readFile(new URL("../supabase/templates/confirmation.html", import.meta.url), "utf8")
]);

const payload = {
    site_url: siteUrl,
    uri_allow_list: redirects,
    mailer_autoconfirm: false,
    mailer_subjects_recovery: "¿Fuiste tú? Restablece tu contraseña · VOLXEN",
    mailer_templates_recovery_content: recovery,
    mailer_subjects_confirmation: "Confirma tu cuenta · VOLXEN",
    mailer_templates_confirmation_content: confirmation
};

const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
if (googleId && googleSecret) {
    payload.external_google_enabled = true;
    payload.external_google_client_id = googleId;
    payload.external_google_secret = googleSecret;
} else if (googleId || googleSecret) {
    console.warn("Google se omite: faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET.");
}

const facebookId = process.env.FACEBOOK_CLIENT_ID;
const facebookSecret = process.env.FACEBOOK_CLIENT_SECRET;
if (facebookId && facebookSecret) {
    payload.external_facebook_enabled = true;
    payload.external_facebook_client_id = facebookId;
    payload.external_facebook_secret = facebookSecret;
} else if (facebookId || facebookSecret) {
    console.warn("Facebook se omite: faltan FACEBOOK_CLIENT_ID o FACEBOOK_CLIENT_SECRET.");
}

if (process.env.DRY_RUN === "1") {
    console.log(JSON.stringify({
        ...payload,
        mailer_templates_recovery_content: "[plantilla recovery.html]",
        mailer_templates_confirmation_content: "[plantilla confirmation.html]"
    }, null, 2));
    process.exit(0);
}

const response = await fetch("https://api.supabase.com/v1/projects/" + encodeURIComponent(ref) + "/config/auth", {
    method: "PATCH",
    headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
});

const text = await response.text();
if (!response.ok) {
    console.error("Supabase rechazó la configuración (" + response.status + "):");
    console.error(text);
    process.exit(1);
}

console.log("Auth actualizada para el proyecto " + ref + ".");
console.log("Sitio: " + siteUrl);
console.log("Redirecciones: " + redirects);
console.log("Recuperación: plantilla VOLXEN aplicada.");
console.log("Confirmación: plantilla VOLXEN aplicada.");
console.log("Google: " + (payload.external_google_enabled ? "habilitado" : "sin credenciales"));
console.log("Facebook: " + (payload.external_facebook_enabled ? "habilitado" : "sin credenciales"));
