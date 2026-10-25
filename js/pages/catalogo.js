/**
 * Catálogo page logic
 * Handles offers, categories, filtering, sorting and search
 */

export async function initCatalogo() {
    var so = VX.$("sortSelect"), em = VX.$("emptyState"), gr = VX.$("gr"),
        q1 = VX.$("searchInput"), sub = VX.$("catalogSub"),
        offers = VX.$("offersRow"), offersSection = VX.$("offersSection"),
        categoryGrid = VX.$("categoryGrid");

    var params = new URLSearchParams(location.search);
    var c0 = params.get("cat") || "", qv = params.get("q") || "";

    if (so) so.value = params.get("sort") || "featured";
    if (q1) q1.value = qv;
    VX.setCat(c0);

    function url() {
        var p = new URLSearchParams();
        if (qv) p.set("q", qv);
        if (c0) p.set("cat", c0);
        if (so && so.value !== "featured") p.set("sort", so.value);
        var s = p.toString();
        history.replaceState(null, "", location.pathname + (s ? "?" + s : ""));
    }

    function renderOfertas() {
        if (!offers || !offersSection) return;
        var P = VX.getP(), O = VX.getO();
        var list = P.filter(function (p) { return O[p.id] && !VX.ag(p); });
        offersSection.classList.toggle("hidden", !list.length);
        offers.innerHTML = list.map(function (p) {
            var im = VX.ft(p)[0];
            var src = im ? VX.imgUrl(im, { w: 480, h: 360, format: "webp", quality: 80 }) : "";
            return '<a class="offer-card" href="producto.html?id=' + encodeURIComponent(p.id) + '">' +
                '<div class="offer-img">' + (src ? '<img src="' + VX.esc(src) + '" alt="' + VX.esc(p.nombre) + '" loading="lazy">' : '<i class="fa-solid fa-tag" aria-hidden="true"></i>') +
                '<span class="offer-badge">Oferta</span></div>' +
                '<div class="offer-body"><h3>' + VX.esc(p.nombre) + '</h3>' +
                '<div class="offer-price"><b>' + VX.fm(Number(O[p.id])) + '</b><s>' + VX.fm(Number(p.precio_usd)) + '</s></div>' +
                '<span class="pcd-commission" data-gestor-commission><i class="fa-solid fa-coins" aria-hidden="true"></i><span>Tu comisión</span><b data-gestor-commission-value>Pendiente</b></span></div></a>';
        }).join("");
        offers.querySelectorAll("img").forEach(function (img) {
            img.addEventListener("error", function () { img.remove() });
        });
    }

    function renderCategorias() {
        if (!categoryGrid) return;
        var Cs = VX.getCs();
        categoryGrid.innerHTML = Cs.map(function (c) {
            var fallback = VX.categoryImage(c);
            var src = c.imagen ? VX.imgUrl(c.imagen, { w: 600, h: 420, format: "webp", quality: 80 }) : fallback;
            return '<a class="category-card" href="catalogo.html?cat=' + encodeURIComponent(c.id) + '" data-a="cat" data-id="' + VX.esc(c.id) + '">' +
                '<div class="category-img"><img src="' + VX.esc(src) + '" data-fallback="' + VX.esc(fallback) + '" alt="" loading="lazy" decoding="async"></div>' +
                '<div class="category-info"><b>' + VX.esc(c.nombre) + '</b><span>Ver productos</span></div></a>';
        }).join("");
        categoryGrid.querySelectorAll("img").forEach(function (img) {
            img.addEventListener("error", function () {
                if (this.dataset.fallback) {
                    this.src = this.dataset.fallback;
                    this.removeAttribute("data-fallback");
                } else {
                    this.remove();
                }
            });
        });
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
            gr.querySelectorAll('.skeleton-card').forEach(function (el) { el.remove(); });
        }
        if (sub) {
            if (c0) sub.textContent = "Productos de " + VX.cn(c0) + ".";
            else if (qv) sub.textContent = "Resultados para “" + qv + "”.";
            else sub.textContent = "Precios fijos, especificaciones claras y garantía por escrito. La mensajería y el horario de entrega se coordinan con su asesor.";
        }
        VX.obs();
    }

    window.vxOnSearch = function (v) {
        qv = v || "";
        if (q1) q1.value = qv;
        url(); mk();
    };

    window.vxOnCategory = function (id) {
        c0 = id || "";
        url(); mk();
        var target = document.getElementById("productos");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    if (so) so.addEventListener("change", function () { url(); mk(); });

    var reset = document.querySelector('[data-reset="1"]');
    if (reset) reset.addEventListener("click", function () {
        c0 = ""; qv = "";
        if (q1) q1.value = "";
        if (so) so.value = "featured";
        VX.setCat(""); url(); mk();
    });

    renderOfertas();
    renderCategorias();
    mk();
}

window.initCatalogo = initCatalogo;
