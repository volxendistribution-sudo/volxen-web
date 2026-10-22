const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("admin exige rol admin desde app_metadata", () => {
    const admin = read("admin.html");

    assert.match(admin, /const rol = j\.user && j\.user\.app_metadata && j\.user\.app_metadata\.role;/);
    assert.match(admin, /if\(rol !== "admin"\)/);
    assert.match(admin, /Esta cuenta no tiene acceso al panel/);
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

test("la migración usa un único criterio admin en app_metadata", () => {
    const sql = read("supabase/migrations/20261022_admin_rls.sql");
    const fn = sql.match(/create or replace function public\.is_admin\(\)[\s\S]*?\$\$;/i)[0];

    assert.match(fn, /security definer/i);
    assert.match(fn, /set search_path = public, pg_temp/i);
    assert.match(fn, /auth\.jwt\(\) -> 'app_metadata' ->> 'role'/i);
    assert.doesNotMatch(fn, /administradores|user_metadata|es_admin/i);
    assert.doesNotMatch(sql, /from public\.administradores a/i);
    assert.match(sql, /using \(public\.is_admin\(\)\)/i);
    assert.doesNotMatch(sql, /using \(true\)/i);
    assert.doesNotMatch(sql, /with check \(true\)/i);
    assert.match(sql, /revoke all on function public\.is_admin\(\) from public/i);
    assert.match(sql, /grant execute on function public\.is_admin\(\) to anon, authenticated/i);
    assert.match(sql, /revoke all on function public\.es_admin\(\) from public/i);
    assert.match(sql, /app_metadata\.role=admin/i);
});

test("la migración aísla pedidos y consultas por user_id", () => {
    const sql = read("supabase/migrations/20261022_admin_rls.sql");

    assert.match(sql, /alter table public\.pedidos[\s\S]*?add column if not exists user_id uuid/i);
    assert.match(sql, /alter table public\.consultas[\s\S]*?add column if not exists user_id uuid/i);
    assert.match(sql, /add column if not exists respuesta text/i);
    assert.match(sql, /create policy pedidos_cliente_ver_propios[\s\S]*?using \(user_id = auth\.uid\(\)\)/i);
    assert.match(sql, /create policy consultas_cliente_ver_propias[\s\S]*?using \(user_id = auth\.uid\(\)\)/i);
    assert.match(sql, /create policy pedido_items_cliente_ver_propios[\s\S]*?p\.user_id = auth\.uid\(\)/i);
    assert.match(sql, /create policy pedido_historial_cliente_ver_propios[\s\S]*?p\.user_id = auth\.uid\(\)/i);
    assert.match(sql, /create trigger vx_set_user_id[\s\S]*?before insert on public\.pedidos/i);
    assert.match(sql, /create trigger vx_set_user_id[\s\S]*?before insert on public\.consultas/i);
    assert.match(sql, /new\.user_id := coalesce\(auth\.uid\(\), new\.user_id\)/i);
});

test("la migración corrige operadoras y conserva la lectura pública", () => {
    const sql = read("supabase/migrations/20261022_admin_rls.sql");

    assert.match(sql, /drop policy if exists operadoras_lectura_publica/i);
    assert.match(sql, /create policy operadoras_lectura_publica/i);
    assert.match(sql, /using \(activa = true\)/i);
    assert.match(sql, /create policy operadoras_admin_insertar/i);
    assert.match(sql, /with check \(public\.is_admin\(\)\)/i);
});

test("la migración revoca escrituras anónimas y privilegios estructurales", () => {
    const sql = read("supabase/migrations/20261022_admin_rls.sql");

    assert.match(sql, /revoke all on all tables in schema public from anon/i);
    assert.match(sql, /grant select on public\.categorias, public\.productos, public\.ofertas, public\.operadoras to anon/i);
    assert.match(sql, /revoke truncate, references, trigger on all tables in schema public from authenticated/i);
    assert.match(sql, /revoke all on public\.administradores from authenticated/i);
    assert.match(sql, /revoke all on public\.pedido_contadores from authenticated/i);
    assert.match(sql, /grant insert, update, delete on public\.operadoras to authenticated/i);
    assert.match(sql, /revoke insert, update, delete on storage\.objects from anon/i);
    assert.match(sql, /revoke insert, update, delete on storage\.buckets from anon, authenticated/i);
    assert.match(sql, /revoke insert, update, delete on storage\.buckets_analytics from anon, authenticated/i);
});

test("la migración exige RPC definer y verifica el resultado", () => {
    const sql = read("supabase/migrations/20261022_admin_rls.sql");

    assert.match(sql, /crear_pedido[\s\S]*?p\.prosecdef/i);
    assert.match(sql, /registrar_consulta_v2[\s\S]*?p\.prosecdef/i);
    assert.match(sql, /consultar_pedido_tracking[\s\S]*?p\.prosecdef/i);
    assert.match(sql, /like '%es_admin%'/i);
    assert.match(sql, /políticas de escritura sin is_admin en tablas protegidas/i);
    assert.match(sql, /políticas de escritura sin is_admin en storage\.objects/i);
    assert.match(sql, /anon conserva privilegios de escritura en public/i);
    assert.match(sql, /anon conserva privilegios de escritura en storage/i);
    assert.match(sql, /Falta la política pedidos_cliente_ver_propios/i);
    assert.match(sql, /Falta la política consultas_cliente_ver_propias/i);
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

test("el cliente de autenticación no usa el RPC antiguo es_admin", () => {
    const auth = read("auth.js");

    assert.match(auth, /app_metadata\.role === "admin"/);
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
