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
            'pedidos': 'pedidos',
            'consulta': 'consulta'
        };

        var moduleName = moduleMap[page];
        var initFnName = moduleName ? 'init' + moduleName.charAt(0).toUpperCase() + moduleName.slice(1) : null;

        // Global initialization - loads data first, then initializes page module
        VX.start(function() {
            if (initFnName) {
                // Wait for module to load and define init function
                function waitForInit() {
                    if (window[initFnName]) {
                        window[initFnName]();
                    } else {
                        setTimeout(waitForInit, 50);
                    }
                }
                waitForInit();
            }
        });

        // Preload page module script (but don't execute until VX.start callback)
        if (moduleName) {
            var script = document.createElement('script');
            script.type = 'module';
            script.src = 'js/pages/' + moduleName + '.js';
            document.head.appendChild(script);
        }
    });
})();