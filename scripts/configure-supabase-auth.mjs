import { readFile } from "node:fs/promises";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || "zyszkujnpbievjapsuyy";
const siteUrl = String(process.env.SITE_URL || "https://volxen-tienda.volxen-distribution.workers.dev").replace(/\/+$/, "");
const pagePaths = [
    "",
    "/login.html",
    "/recuperar.html",
    "/registro.html",
    "/pedidos.html",
    "/carrito.html",
    "/checkout.html",
    "/consulta.html",
    "/catalogo.html",
    "/producto.html",
    "/admin.html"
];
const defaultRedirects = [
    ...pagePaths.map((page) => siteUrl + page),
    ...pagePaths.map((page) => "http://localhost:3000" + page)
].join(",");
const extraRedirects = String(process.env.EXTRA_REDIRECTS || defaultRedirects)
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

const basePayload = {
    site_url: siteUrl,
    uri_allow_list: redirects,
    mailer_autoconfirm: false,
    mailer_otp_length: 6,
    mailer_otp_exp: 3600,
    password_min_length: 8
};

const templatePayload = {
    mailer_subjects_recovery: "Tu código de recuperación · VOLXEN",
    mailer_templates_recovery_content: recovery,
    mailer_subjects_confirmation: "Confirma tu cuenta · VOLXEN",
    mailer_templates_confirmation_content: confirmation
};

const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
if (googleId && googleSecret) {
    basePayload.external_google_enabled = true;
    basePayload.external_google_client_id = googleId;
    basePayload.external_google_secret = googleSecret;
} else if (googleId || googleSecret) {
    console.warn("Google se omite: faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET.");
}

const facebookId = process.env.FACEBOOK_CLIENT_ID;
const facebookSecret = process.env.FACEBOOK_CLIENT_SECRET;
if (facebookId && facebookSecret) {
    basePayload.external_facebook_enabled = true;
    basePayload.external_facebook_client_id = facebookId;
    basePayload.external_facebook_secret = facebookSecret;
} else if (facebookId || facebookSecret) {
    console.warn("Facebook se omite: faltan FACEBOOK_CLIENT_ID o FACEBOOK_CLIENT_SECRET.");
}

const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
if (smtpHost && smtpUser && smtpPass) {
    Object.assign(basePayload, {
        smtp_host: smtpHost,
        smtp_port: Number(process.env.SMTP_PORT || 465),
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        smtp_admin_email: process.env.SMTP_ADMIN_EMAIL || smtpUser,
        smtp_sender_name: process.env.SMTP_SENDER_NAME || "VOLXEN",
        rate_limit_email_sent: 30
    });
} else if (smtpHost || smtpUser || smtpPass) {
    console.warn("SMTP se omite: faltan SMTP_HOST, SMTP_USER o SMTP_PASS.");
}

if (process.env.DRY_RUN === "1") {
    console.log(JSON.stringify({
        ...basePayload,
        ...templatePayload,
        mailer_templates_recovery_content: "[plantilla recovery.html]",
        mailer_templates_confirmation_content: "[plantilla confirmation.html]"
    }, null, 2));
    process.exit(0);
}

async function patchAuth(payload, label) {
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
        const error = new Error(text || "Supabase rechazó la configuración.");
        error.status = response.status;
        error.label = label;
        throw error;
    }
}

try {
    await patchAuth(basePayload, "configuración general");
} catch (error) {
    console.error("Supabase rechazó la " + error.label + " (" + error.status + "):");
    console.error(error.message);
    process.exit(1);
}

let templatesApplied = true;
try {
    await patchAuth(templatePayload, "plantillas de correo");
} catch (error) {
    templatesApplied = false;
    console.warn("La configuración general se aplicó, pero Supabase rechazó las plantillas (" + error.status + "):");
    console.warn(error.message);
    console.warn("Configura SMTP propio o un plan que permita editar plantillas y vuelve a ejecutar este script.");
}

console.log("Auth actualizada para el proyecto " + ref + ".");
console.log("Sitio: " + siteUrl);
console.log("Redirecciones: " + redirects);
console.log("Recuperación: " + (templatesApplied ? "plantilla VOLXEN aplicada." : "pendiente de SMTP propio."));
console.log("Confirmación: " + (templatesApplied ? "plantilla VOLXEN aplicada." : "pendiente de SMTP propio."));
console.log("Google: " + (basePayload.external_google_enabled ? "habilitado" : "sin credenciales"));
console.log("Facebook: " + (basePayload.external_facebook_enabled ? "habilitado" : "sin credenciales"));
if (!templatesApplied) process.exitCode = 2;
