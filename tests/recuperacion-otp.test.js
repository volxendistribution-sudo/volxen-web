const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("la solicitud de recuperación no revela si el correo existe", () => {
    const js = read("js/pages/auth-recover.js");

    assert.match(js, /function requestRecoveryCode/);
    assert.match(js, /status === 400 \|\| status === 422/);
    assert.match(js, /return "No pudimos enviar el código en este momento\./);
    assert.doesNotMatch(js, /return \(error && error\.message\) \|\| "No pudimos enviar/);
});

test("la recuperación limita los intentos y los reinicia con un código nuevo", () => {
    const js = read("js/pages/auth-recover.js");

    assert.match(js, /const MAX_CODE_ATTEMPTS = 5/);
    assert.match(js, /const CODE_LOCK_MS = 10 \* 60 \* 1000/);
    assert.match(js, /function registerFailedAttempt/);
    assert.match(js, /function clearAttemptState/);
    assert.match(js, /registerFailedAttempt\(\)/);
    assert.match(js, /clearAttemptState\(\)/);
});

test("al cambiar la contraseña se conserva la sesión y se entra a pedidos", () => {
    const js = read("js/pages/auth-recover.js");

    assert.match(js, /await VXAUTH\.updatePassword\(password\)/);
    assert.match(js, /location\.replace\("pedidos\.html"\)/);
    assert.doesNotMatch(js, /await VXAUTH\.signOut\(\)/);
    assert.doesNotMatch(js, /login\.html\?reset=1/);
});

test("la pantalla de recuperación informa la caducidad real del código", () => {
    const page = read("recuperar.html");

    assert.match(page, /El código caduca en 60 minutos/);
    assert.match(page, /id="recoverCode"/);
    assert.match(page, /maxlength="6"/);
});

test("la configuración de Supabase aplica el flujo OTP y la política de contraseña", () => {
    const script = read("scripts/configure-supabase-auth.mjs");

    assert.match(script, /mailer_otp_length: 6/);
    assert.match(script, /mailer_otp_exp: 3600/);
    assert.match(script, /password_min_length: 8/);
    assert.match(script, /smtp_port: Number\(process\.env\.SMTP_PORT \|\| 465\)/);
    assert.match(script, /rate_limit_email_sent: 30/);
});

test("el proyecto de Cloudflare y el deploy apuntan a volxen-tienda", () => {
    const wrangler = read("wrangler.jsonc");
    const pkg = read("package.json");

    assert.match(wrangler, /"name": "volxen-tienda"/);
    assert.match(pkg, /wrangler deploy --name volxen-tienda/);
});
