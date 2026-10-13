/**
 * Catálogo page logic
 * Handles filtering, sorting, search, and category navigation
 */

export function initCatalogo() {
    var so = VX.$("sortSelect"), em = VX.$("emptyState"), gr = VX.$("gr"),
        q1 = VX.$("searchInput"), q2 = VX.$("searchMobileInput"),
        title = VX.$("catalogTitle");

    var params = new URLSearchParams(location.search);
    var c0 = params.get("cat") || "", qv = params.get("q") || "";

    if (so) so.value = params.get("sort") || "featured";
    if (q1) q1.value = qv;
    if (q2) q2.value = qv;
    VX.setCat(c0);

    function url() {
        var p = new URLSearchParams();
        if (qv) p.set("q", qv);
        if (c0) p.set("cat", c0);
        if (so && so.value !== "featured") p.set("sort", so.value);
        var s = p.toString();
        history.replaceState(null, "", location.pathname + (s ? "?" + s : ""));
    }

    function mk() {
        var P = VX.getP();
        var t = qv.trim().toLowerCase(), o = so ? so.value : "featured";
        var v = P.filter(function (p) {
            return (!c0 || p.categoria_id === c0) && (!t || (p.nombre + " " + (p.descripcion || "")).toLowerCase().indexOf(t) > -1);
        }).sort(function (a, b) {
            if (o === "precio-asc") return Number(a.precio_usd || 0) - Number(b.precio_usd || 0);
            if (o === "precio-desc") return Number(b.precio_usd || 0) - Number(a.precio_usd || 0);
            if (o === "nombre") return String(a.nombre || "").localeCompare(String(b.nombre || ""));
            return 0;
        });

        if (em) em.classList.toggle("hidden", v.length > 0);
        if (gr) {
            gr.innerHTML = v.map(function (p) { return VX.pcard(p); }).join("");
            gr.querySelectorAll('.skeleton-card').forEach(function(el) { el.remove(); });
        }
        if (title) title.textContent = c0 ? VX.cn(c0) : "Catálogo de Productos";
        VX.obs();
    }

    window.vxOnSearch = function (v) {
        qv = v || "";
        if (q1) q1.value = qv;
        if (q2) q2.value = qv;
        url(); mk();
    };

    window.vxOnCategory = function (id) {
        c0 = id || "";
        url(); mk();
    };

    if (so) so.addEventListener("change", function () { url(); mk(); });

    var reset = document.querySelector('[data-reset="1"]');
    if (reset) reset.addEventListener("click", function () {
        c0 = ""; qv = "";
        if (q1) q1.value = ""; if (q2) q2.value = "";
        if (so) so.value = "featured";
        VX.setCat(""); url(); mk();
    });

    mk();
}

window.initCatalogo = initCatalogo;