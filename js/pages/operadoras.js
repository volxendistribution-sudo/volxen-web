/**
 * Operadoras page logic
 * Renders the active operators loaded by the shared core.
 */

export async function initOperadoras() {
    var grid = VX.$("opsPageGrid");
    if (!grid) return;

    VX.renderOperadoras();

    grid.addEventListener("click", function (e) {
        if (!e.target.closest("[data-ops-retry]")) return;
        VX.loadOperadoras();
    });
}

window.initOperadoras = initOperadoras;
