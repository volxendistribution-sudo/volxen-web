/**
 * Home page logic
 * Handles unified catalog with search and category filter, plus categorías grid
 */

export function initHome() {
    var P = VX.getP(), Cs = VX.getCs();

    var grid = VX.$("homeProductGrid");
    var emptyState = VX.$("homeEmptyState");
    var searchInput = VX.$("homeSearchInput");
    var searchBtn = VX.$("homeSearchBtn");
    var categorySelect = VX.$("homeCategorySelect");
    var resetBtn = VX.$("homeResetBtn");

    // Poblar select de categorías
    if (categorySelect && Cs.length) {
        categorySelect.innerHTML = '<option value="">Todas las categorías</option>' +
            Cs.map(function(c) { return '<option value="' + VX.esc(c.id) + '">' + VX.esc(c.nombre) + '</option>'; }).join("");
    }

    var currentCat = "";
    var currentQuery = "";

    function render() {
        var t = currentQuery.trim().toLowerCase();
        var v = P.filter(function (p) {
            return !(p.disponibilidad === "agotado") &&
                (!currentCat || p.categoria_id === currentCat) &&
                (!t || (p.nombre + " " + (p.descripcion || "")).toLowerCase().indexOf(t) > -1);
        });

        if (emptyState) emptyState.classList.toggle("hidden", v.length > 0);
        if (grid) {
            grid.innerHTML = v.slice(0, 8).map(function (p) { return VX.pcard(p); }).join("");
            grid.querySelectorAll('.skeleton-card').forEach(function(el) { el.remove(); });
        }
        VX.obs();
    }

    function doSearch() {
        currentQuery = (searchInput || {}).value || "";
        render();
    }

    if (searchBtn) searchBtn.addEventListener("click", doSearch);
    if (searchInput) searchInput.addEventListener("keydown", function(e) { if (e.key === "Enter") doSearch(); });

    if (categorySelect) categorySelect.addEventListener("change", function() {
        currentCat = categorySelect.value || "";
        render();
    });

    if (resetBtn) resetBtn.addEventListener("click", function() {
        currentCat = ""; currentQuery = "";
        if (searchInput) searchInput.value = "";
        if (categorySelect) categorySelect.value = "";
        render();
    });

    // Cargar categorías en grid (existente)
    var catGrid = VX.$("catGrid");
    if (catGrid && Cs.length) {
        catGrid.innerHTML = Cs.slice(0, 8).map(function(c) {
            return '<a href="catalogo.html?cat=' + encodeURIComponent(c.id) + '" class="bg-s2 border border-bd rounded-2xl p-4 text-center hover:border-g hover:bg-sf transition group"><div class="w-14 h-14 mx-auto mb-3 rounded-full bg-sf border border-bd flex items-center justify-center group-hover:border-g group-hover:bg-bg transition"><i class="fa-solid fa-box text-gi text-xl group-hover:text-fg transition" aria-hidden="true"></i></div><p class="text-sm font-medium text-fg line-clamp-1">' + VX.esc(c.nombre) + '</p></a>';
        }).join("");
    }

    render();
}

window.initHome = initHome;
window.initIndex = initHome;