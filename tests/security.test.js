const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const FASE0_FILES = [
    "supabase/migrations/20261026090000_fase0_role_foundation.sql",
    "supabase/migrations/20261026091000_fase0_rls_hardening.sql",
    "supabase/migrations/20261026092000_fase0_grants.sql",
    "supabase/migrations/20261026093000_fase0_assertions.sql"
];

const fase0Sql = () => FASE0_FILES.map(read).join("\n");

test("admin exige rol admin desde la base de datos", () => {
    const admin = read("admin.html");

    assert.match(admin, /B \+ "\/rest\/v1\/rpc\/mi_rol"/);
    assert.match(admin, /if\(!rr\.ok \|\| rol !== "admin"\)/);
    assert.match(admin, /Esta cuenta no tiene acceso al panel/);
    assert.doesNotMatch(admin, /app_metadata/);
    assert.doesNotMatch(admin, /user_metadata/);
});

test("admin cierra sesión y maneja tokens expirados", () => {
    const admin = read("admin.html");

    assert.match(admin, /function cerrarSesion\(/);
    assert.match(admin, /\/auth\/v1\/logout/);
    assert.match(admin, /r\.status === 401/);
    assert.match(admin, /La sesión expiró\. Vuelve a entrar\./);
});

test("pedidos no interpolan teléfono ni código en onclick", () => {
    const admin = read("admin.html");

    assert.doesNotMatch(admin, /onclick="waPedido/);
    assert.match(admin, /data-pedido-wa/);
    assert.match(admin, /getAttribute\("data-pedido-wa"\)/);
    assert.doesNotMatch(admin, /o\.telefono\s*\+/);
    assert.doesNotMatch(admin, /o\.codigo\s*\+/);
});

test("Fase 0 crea roles en la base y migra al admin existente", () => {
    const sql = fase0Sql();
    const fn = sql.match(/create or replace function public\.vx_is_admin\(\)[\s\S]*?\$\$;/i)[0];

    assert.match(fn, /security definer/i);
    assert.match(fn, /set search_path = public, pg_temp/i);
    assert.match(fn, /vx_role\(\) = 'admin'/i);
    assert.doesNotMatch(fn, /app_metadata|user_metadata|administradores/i);
    assert.match(sql, /create table public\.user_roles/i);
    assert.match(sql, /select user_id, 'admin', true[\s\S]*?from public\.administradores/i);
    assert.match(sql, /create or replace function public\.mi_rol\(\)/i);
    assert.match(sql, /coalesce\(public\.vx_role\(\), 'cliente'\)/i);
    assert.match(sql, /create or replace function public\.vx_set_role\(p_user_id uuid, p_role text\)/i);
    assert.match(sql, /No puedes cambiar tu propio rol/i);
    assert.match(sql, /No se puede degradar al último administrador/i);
    assert.match(sql, /create policy role_audit_select_admin[\s\S]*?public\.vx_is_admin\(\)/i);
});

test("Fase 0 corrige operadoras y conserva la lectura pública", () => {
    const sql = fase0Sql();

    assert.match(sql, /drop policy if exists operadoras_admin_insertar/i);
    assert.match(sql, /create policy operadoras_admin_insertar[\s\S]*?with check \(public\.vx_is_admin\(\)\)/i);
    assert.match(sql, /create policy operadoras_admin_actualizar[\s\S]*?using \(public\.vx_is_admin\(\)\)[\s\S]*?with check \(public\.vx_is_admin\(\)\)/i);
    assert.match(sql, /create policy operadoras_lectura_publica[\s\S]*?using \(activa = true\)/i);
    assert.doesNotMatch(sql, /with check \(true\)/i);
});

test("Fase 0 revoca privilegios amplios y deja solo los necesarios", () => {
    const sql = fase0Sql();

    assert.match(sql, /revoke all on all tables in schema public from anon, authenticated/i);
    assert.match(sql, /grant select on public\.categorias, public\.productos, public\.ofertas, public\.operadoras[\s\S]*?to anon, authenticated/i);
    assert.match(sql, /grant select, insert, update, delete[\s\S]*?public\.operadoras[\s\S]*?to authenticated/i);
    assert.match(sql, /grant select[\s\S]*?public\.user_roles, public\.role_audit[\s\S]*?to authenticated/i);
    assert.match(sql, /revoke all on all sequences in schema public from anon, authenticated/i);
});

test("Fase 0 verifica roles, RLS y accesos después de aplicar", () => {
    const sql = fase0Sql();

    assert.match(sql, /has_table_privilege\('anon', 'public\.administradores', 'SELECT'\)/i);
    assert.match(sql, /has_function_privilege\('anon', 'public\.vx_set_role\(uuid, text\)', 'EXECUTE'\)/i);
    assert.match(sql, /anon tiene una política de escritura en storage/i);
    assert.match(sql, /RLS no está activo en storage\.objects/i);
    assert.match(sql, /RLS no está activo en storage\.buckets/i);
    assert.match(sql, /Falta un administrador activo en user_roles/i);
    assert.match(sql, /notify pgrst, 'reload schema'/i);
});

test("las páginas de cuenta se incluyen en el build", () => {
    const pkg = JSON.parse(read("package.json"));
    const build = pkg.scripts["build:html"];

    ["login.html", "registro.html", "recuperar.html"].forEach((page) => {
        assert.match(build, new RegExp(page.replace(".", "\\.")));
    });
    assert.match(build, /cp config\.js auth\.js /);
    assert.match(build, /cuenta\.css/);
});

test("pedidos carga la sesión y muestra el historial de la cuenta", () => {
    const html = read("pedidos.html");
    const js = read("js/pages/pedidos.js");

    assert.match(html, /<script src="auth\.js"><\/script>/);
    assert.match(html, /id="accountGuest"/);
    assert.match(html, /id="accountPanel"/);
    assert.match(js, /VXAUTH\.getSession\(\)/);
    assert.match(js, /VXAUTH\.rest\("\/rpc\/mis_pedidos"/);
    assert.match(js, /VXAUTH\.signOut\(\)/);
});

test("mis_pedidos solo expone los pedidos del usuario autenticado", () => {
    const sql = read("supabase/migrations/20261023_user_accounts.sql");
    const fn = sql.match(/create or replace function public\.mis_pedidos\(\)[\s\S]*?\$\$;/i)[0];

    assert.match(fn, /security definer/i);
    assert.match(fn, /set search_path = public, pg_temp/i);
    assert.match(fn, /where p\.user_id = auth\.uid\(\)/i);
    assert.match(sql, /revoke all on function public\.mis_pedidos\(\) from anon/i);
    assert.match(sql, /grant execute on function public\.mis_pedidos\(\) to authenticated/i);
    assert.doesNotMatch(sql, /grant execute on function public\.mis_pedidos\(\) to [^;]*anon/i);
});

test("el cliente de autenticación usa mi_rol y no app_metadata", () => {
    const auth = read("auth.js");

    assert.match(auth, /async function hydrateRole\(session\)/);
    assert.match(auth, /REST_URL \+ "\/rpc\/mi_rol"/);
    assert.match(auth, /session\.role_loaded = true/);
    assert.match(auth, /return session\.user\.role === "admin"/);
    assert.doesNotMatch(auth, /app_metadata\.role/);
    assert.doesNotMatch(auth, /\/rpc\/es_admin/);
});

test("los archivos cliente no contienen claves privadas", () => {
    const files = [
        "admin.html",
        "config.js",
        "pedido.js",
        "volxen-core.js",
        "js/pages/consulta.js",
        "js/pages/pedidos.js",
        "scripts/generate-sitemap.js"
    ];

    files.forEach((file) => {
        assert.doesNotMatch(read(file), /service_role|sb_secret_/i, file);
    });
});

test("config.js no declara secretos de servidor", () => {
    const config = read("config.js");

    assert.match(config, /SUPABASE_URL/);
    assert.match(config, /SUPABASE_KEY/);
    assert.doesNotMatch(config, /SERVICE_ROLE|PRIVATE_KEY|SECRET_KEY/i);
});
