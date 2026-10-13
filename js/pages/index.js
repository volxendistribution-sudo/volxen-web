/**
 * Home page logic
 * Handles ofertas, destacados, and categorías loading
 */

export function initHome() {
    // Cargar ofertas
    var s = VX.$("of");
    var P = VX.getP(), O = VX.getO();
    var l = P.filter(function (p) { return Number(O[p.id]) > 0 && Number(O[p.id]) < Number(p.precio_usd) && !(p.disponibilidad === "agotado"); });
    s.hidden = !l.length;
    var og = VX.$("og");
    if (og) {
        og.innerHTML = l.slice(0, 8).map(function (p) { return VX.pcard(p); }).join("");
        og.querySelectorAll('.skeleton-card').forEach(function(el) { el.remove(); });
    }

    // Cargar destacados (primeros 8 productos activos no agotados)
    var dg = VX.$("dg");
    var destacados = P.filter(function(p) { return !(p.disponibilidad === "agotado"); }).slice(0, 8);
    if (dg) {
        dg.innerHTML = destacados.map(function (p) { return VX.pcard(p); }).join("");
        dg.querySelectorAll('.skeleton-card').forEach(function(el) { el.remove(); });
    }

    // Cargar categorías en grid
    var catGrid = VX.$("catGrid");
    var Cs = VX.getCs();
    if (catGrid && Cs.length) {
        catGrid.innerHTML = Cs.slice(0, 8).map(function(c) {
            return '<a href="catalogo.html?cat=' + encodeURIComponent(c.id) + '" class="bg-s2 border border-bd rounded-2xl p-4 text-center hover:border-g hover:bg-sf transition group"><div class="w-14 h-14 mx-auto mb-3 rounded-full bg-sf border border-bd flex items-center justify-center group-hover:border-g group-hover:bg-bg transition"><i class="fa-solid fa-box text-g text-xl group-hover:text-fg transition" aria-hidden="true"></i></div><p class="text-sm font-medium text-fg line-clamp-1">' + VX.esc(c.nombre) + '</p></a>';
        }).join("");
    }

    VX.obs();
}

window.initHome = initHome;