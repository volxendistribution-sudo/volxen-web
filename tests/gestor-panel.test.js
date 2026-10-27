const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("la migración de promotores crea comisiones y RPCs protegidos", () => {
    const sql = read("supabase/migrations/20261026100000_fase1_promotores_comisiones.sql");

    assert.match(sql, /create table if not exists public\.promotores/i);
    assert.match(sql, /add column if not exists promotor_id uuid references auth\.users/i);
    assert.match(sql, /add column if not exists comision_estado text not null default 'pendiente'/i);
    assert.match(sql, /create policy pedidos_promotor_ver_atribuidos/i);
    assert.match(sql, /promotor_id = auth\.uid\(\)/);
    assert.match(sql, /create or replace function public\.admin_asignar_promotor/i);
    assert.match(sql, /create or replace function public\.admin_marcar_comision_pagada/i);
    assert.match(sql, /create or replace function public\.admin_guardar_promotor/i);
    assert.match(sql, /create or replace function public\.promotor_resumen/i);
    assert.match(sql, /create or replace function public\.promotor_pedidos/i);
    assert.match(sql, /create or replace function public\.promotor_clientes/i);
    assert.match(sql, /revoke all on function public\.promotor_resumen\(\) from public, anon/i);
    assert.match(sql, /grant execute on function public\.promotor_resumen\(\) to authenticated/i);
    assert.match(sql, /security definer/i);
});

test("el panel de gestor carga solo sus RPCs y valida el rol", () => {
    const js = read("js/pages/gestor.js");
    const html = read("gestor.html");

    assert.doesNotThrow(() => new Function(js));
    assert.match(js, /\/rpc\/promotor_resumen/);
    assert.match(js, /\/rpc\/promotor_pedidos/);
    assert.match(js, /\/rpc\/promotor_clientes/);
    assert.match(js, /role !== "gestor" && role !== "promotor"/);
    assert.match(js, /role === "admin"/);
    assert.doesNotMatch(js, /\/rest\/v1\/pedidos/);
    assert.match(html, /js\/pages\/gestor\.js/);
    assert.match(html, /auth\.js/);
    assert.match(html, /gestor\.css/);
    assert.match(html, /noindex/);
});

test("el admin puede asignar promotor, comisión y marcar pago", () => {
    const html = read("admin.html");

    assert.match(html, /onclick="tab\('g'\)"/);
    assert.match(html, /rpc\/admin_listar_usuarios/);
    assert.match(html, /rpc\/admin_guardar_promotor/);
    assert.match(html, /rpc\/admin_asignar_promotor/);
    assert.match(html, /rpc\/admin_marcar_comision_pagada/);
    assert.match(html, /MARCAR COMISIÓN PAGADA/);
    assert.match(html, /PROMOTOR Y COMISIÓN/);
    assert.match(html, /id="pm"/);
    assert.match(html, /id="pcf"/);
    assert.match(html, /syncPriceMode/);
    assert.match(html, /modo_precio:\s*priceMode/);
    assert.match(html, /comision_fija_usd:\s*fixedCommission/);
    assert.match(html, /Máximo de subida permitido/);
    assert.doesNotMatch(html, /promo_c_enabled/);
    assert.doesNotMatch(html, /GESTOR Y COMISIÓN/);
});

test("el menú muestra el panel solo a promotores", () => {
    const core = read("volxen-core.js");

    assert.match(core, /gestor\.html/);
    assert.match(core, /data-promotor-only/);
    assert.match(core, /Panel de promotor/);
    assert.match(core, /user\.role === "gestor" \|\| user\.role === "promotor"/);
    assert.doesNotMatch(core, /data-gestor-only/);
    assert.doesNotMatch(core, /Panel de gestor/);
    assert.doesNotMatch(core, /admin\.html/);
});

test("la portada invita a promotores bajo Cómo trabajamos", () => {
    const home = read("index.html");
    const como = home.indexOf('id="comoTrabajamos"');
    const acceso = home.indexOf('id="gestores"');

    assert.ok(como !== -1, "Falta la sección Cómo trabajamos");
    assert.ok(acceso > como, "El acceso debe ir después de Cómo trabajamos");
    assert.match(home, /Promotores/);
    assert.doesNotMatch(home, /Gestores y promotores/);
    assert.match(home, /href="gestor\.html"/);
    assert.match(home, /Google no asigna este rol/);
});

test("el panel compartido incluye perfil, notificaciones e historial", () => {
    const html = read("gestor.html");
    const js = read("js/pages/gestor.js");

    assert.match(html, /id="gsProfileTitle"/);
    assert.match(html, /id="gsNotificationsTitle"/);
    assert.match(html, /id="gsHistoryTitle"/);
    assert.match(js, /function renderProfile/);
    assert.match(js, /function renderNotifications/);
    assert.match(js, /function renderHistory/);
    assert.doesNotMatch(js, /admin_marcar_comision_pagada/, "El panel del promotor no debe ejecutar pagos");
    assert.doesNotMatch(js, /method:\s*"PATCH"/);
    assert.doesNotMatch(js, /method:\s*"DELETE"/);
});

test("el panel del gestor conserva la estructura visual y accesible del rediseño", () => {
    const html = read("gestor.html");
    const css = read("gestor.css");

    assert.match(html, /class="gs-app"/);
    assert.match(html, /id="gsSidebar"/);
    assert.match(html, /id="gsDashboardScroll"/);
    assert.match(html, /class="gs-kpis"/);
    assert.match(html, /<tbody id="gsOrdersList"><\/tbody>/);
    assert.match(html, /id="gsGreeting"/);
    assert.match(html, /id="gsTopAvatar"/);
    assert.match(html, /data-gs-nav="pedidos"[^>]*aria-label="Pedidos"[^>]*title="Pedidos"/);
    assert.match(html, /id="gsLogout"[^>]*aria-label="Cerrar sesión"[^>]*title="Cerrar sesión"/);
    assert.match(css, /\.gs-app\.is-sidebar-collapsed \.gs-side-label\s*\{\s*display: none;/);
    assert.match(css, /\.gs-cell-commission small\s*\{[^}]*display: block;/s);
    assert.doesNotMatch(html, /<canvas/);
});

test("el admin conserva acceso directo y restaurar sesión no rompe el panel", () => {
    const admin = read("admin.html");

    assert.match(admin, /<script src="auth\.js"><\/script>/);
    assert.match(admin, /VXAUTH\.getSession/);
    assert.match(admin, /VXAUTH\.signIn/);
    assert.match(admin, /comprobarRolAdmin/);
    assert.match(admin, /initAdmin\(\);/);
    assert.match(admin, /Esta cuenta no tiene acceso al panel/);
    assert.match(admin, /rpc\/mi_rol/);
    assert.match(admin, /tab\('m'\)/);
    assert.match(admin, /Historial no se puede alterar|historial no se puede alterar/);
});

test("Google y el resto de accesos no asignan rol de promotor automáticamente", () => {
    const auth = read("auth.js");
    const login = read("js/pages/auth-page.js");

    assert.doesNotMatch(auth, /promotor/i);
    assert.doesNotMatch(login, /promotor/i);
});

test("el panel abre directamente en el dashboard y reutiliza el catálogo", () => {
    const html = read("gestor.html");
    const js = read("js/pages/gestor.js");

    assert.doesNotMatch(html, /id="gsWelcome"|gsWelcomeEnter|Saltar bienvenida/);
    assert.doesNotMatch(js, /showWelcome|enterPanelFromWelcome|refs\.gsWelcome/);
    assert.match(html, /id="gsDashboard"/);
    assert.match(html, /id="gsDashboardScroll"/);
    assert.match(html, /id="gsCatalogView"/);
    assert.match(html, /id="gsProductDialog"/);
    assert.match(html, /<script src="volxen-core\.js"><\/script>/);
    assert.match(js, /function ensureCatalog/);
    assert.match(js, /VX\.pcard|api\.pcard/);
    assert.doesNotMatch(js, /localStorage|sessionStorage|document\.cookie/);
    assert.doesNotMatch(js, /"Gestor"/);
    assert.doesNotMatch(html, /Gestores y promotores/);
});

test("el panel privado queda fuera de los buscadores", () => {
    const robots = read("robots.txt");

    assert.match(robots, /Disallow: \/gestor\.html/);
    assert.match(robots, /Disallow: \/admin\.html/);
});

test("el build copia las páginas y estilos de los paneles", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(pkg.scripts["build:html"], /gestor\.html/);
    assert.match(pkg.scripts["build:html"], /gestor\.css/);
    assert.match(pkg.scripts["build:html"], /admin\.html/);
});
