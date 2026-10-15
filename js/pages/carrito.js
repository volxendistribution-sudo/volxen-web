/**
 * Carrito page logic
 * Handles cart rendering, quantity updates, and navigation to checkout
 */

export async function initCarrito() {
    VX.cart();

    // Re-render cart when storage changes (e.g., from other tabs)
    window.addEventListener('storage', function(e) {
        if (e.key === 'vx_k') {
            try { K = JSON.parse(localStorage.getItem('vx_k') || '{}') } catch (e) {}
            VX.cart();
        }
    });
}

window.initCarrito = initCarrito;