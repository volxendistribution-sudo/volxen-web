/**
 * Main entry point - initializes page-specific modules
 * Loads after volxen-core.js
 */

(function() {
    // Wait for VX to be available
    function waitForVX(callback) {
        if (window.VX) {
            callback();
        } else {
            setTimeout(function() { waitForVX(callback); }, 50);
        }
    }

    waitForVX(function() {
        var page = document.body.dataset.page;

        // Load page-specific module
        var moduleMap = {
            'inicio': 'index',
            'catalogo': 'catalogo',
            'producto': 'producto',
            'carrito': 'carrito',
            'checkout': 'checkout',
            'pedidos': 'pedidos'
        };

        var moduleName = moduleMap[page];
        if (moduleName) {
            var script = document.createElement('script');
            script.type = 'module';
            script.src = 'js/pages/' + moduleName + '.js';
            script.onload = function() {
                if (window['init' + moduleName.charAt(0).toUpperCase() + moduleName.slice(1)]) {
                    window['init' + moduleName.charAt(0).toUpperCase() + moduleName.slice(1)]();
                }
            };
            document.head.appendChild(script);
        }

        // Global initialization (always runs)
        VX.start(function() {
            // Global init logic here if needed
        });
    });
})();