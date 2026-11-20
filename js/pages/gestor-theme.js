(function () {
    "use strict";

    var STORAGE_KEY = "volxen-gs-theme";
    var THEME_EFFECT = "circle"; // "circle" o "fade": cambia aquí si el móvil va con tirones
    var root = document.documentElement;
    var button = null;
    var switchTimer = 0;
    var animating = false;
    var pending = null;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function savedTheme() {
        try {
            var value = localStorage.getItem(STORAGE_KEY);
            return value === "dark" || value === "light" ? value : null;
        } catch (error) {
            return null;
        }
    }

    function currentTheme() {
        return root.getAttribute("data-gs-theme") === "dark" ? "dark" : "light";
    }

    function updateButton(theme) {
        if (!button) return;
        var dark = theme === "dark";
        button.setAttribute("aria-checked", dark ? "true" : "false");
        button.setAttribute("aria-label", dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
        button.setAttribute("title", dark ? "Tema oscuro" : "Tema claro");
    }

    function setTheme(theme, persist) {
        if (theme === "dark") root.setAttribute("data-gs-theme", "dark");
        else root.removeAttribute("data-gs-theme");

        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", theme === "dark" ? "#12110F" : "#F8F7F4");
        updateButton(theme);

        if (persist) {
            try {
                localStorage.setItem(STORAGE_KEY, theme);
            } catch (error) {}
        }
    }

    function beginSwitching() {
        root.classList.add("gs-theme-switching");
        window.clearTimeout(switchTimer);
        switchTimer = window.setTimeout(endSwitching, 1000);
    }

    function endSwitching() {
        window.clearTimeout(switchTimer);
        root.classList.remove("gs-theme-switching", "gs-theme-vt", "gs-theme-fallback");
        root.style.removeProperty("--vx-theme-x");
        root.style.removeProperty("--vx-theme-y");
        root.style.removeProperty("--vx-theme-r");
    }

    function setRevealOrigin() {
        var rect = button ? button.getBoundingClientRect() : null;
        var x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        var y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
        var r = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );
        root.style.setProperty("--vx-theme-x", x + "px");
        root.style.setProperty("--vx-theme-y", y + "px");
        root.style.setProperty("--vx-theme-r", r + "px");
    }

    function canReveal() {
        return THEME_EFFECT === "circle" &&
            typeof document.startViewTransition === "function" &&
            typeof CSS !== "undefined" &&
            typeof CSS.supports === "function" &&
            CSS.supports("clip-path", "circle(1px at 50% 50%)");
    }

    function fallbackFade(theme, persist, done) {
        var overlay = document.createElement("div");
        overlay.className = "gs-theme-fade";
        overlay.setAttribute("aria-hidden", "true");
        overlay.style.backgroundColor = theme === "dark" ? "var(--gs-bg-dark)" : "var(--gs-bg-light)";
        document.body.appendChild(overlay);
        root.classList.add("gs-theme-fallback");

        var half = 175;

        window.requestAnimationFrame(function () {
            overlay.style.transition = "opacity " + half + "ms ease";
            overlay.style.opacity = "1";
        });

        window.setTimeout(function () {
            setTheme(theme, persist);
            overlay.style.opacity = "0";
        }, half);

        window.setTimeout(function () {
            overlay.remove();
            done();
        }, half * 2);
    }

    function startTransition(theme, persist) {
        animating = true;
        beginSwitching();

        function done() {
            animating = false;
            endSwitching();

            var queued = pending;
            pending = null;
            if (queued && queued.theme !== currentTheme()) {
                applyTheme(queued.theme, queued.persist, true);
            }
        }

        if (canReveal()) {
            setRevealOrigin();
            root.classList.add("gs-theme-vt");
            try {
                var transition = document.startViewTransition(function () {
                    setTheme(theme, persist);
                });
                if (transition && transition.finished) {
                    transition.finished.then(done, done);
                } else {
                    done();
                }
                return;
            } catch (error) {
                root.classList.remove("gs-theme-vt");
            }
        }

        fallbackFade(theme, persist, done);
    }

    function applyTheme(theme, persist, animate) {
        var next = theme === "dark" ? "dark" : "light";

        if (!animate || reducedMotion.matches) {
            setTheme(next, persist);
            return;
        }

        if (animating) {
            pending = { theme: next, persist: persist };
            return;
        }

        if (next === currentTheme()) {
            if (persist) setTheme(next, true);
            return;
        }

        startTransition(next, persist);
    }

    function initButton() {
        button = document.getElementById("gsThemeToggle");
        if (!button) return;
        updateButton(currentTheme());
        button.addEventListener("click", function () {
            applyTheme(currentTheme() === "dark" ? "light" : "dark", true, true);
        });
    }

    var stored = savedTheme();
    if (stored) applyTheme(stored, false, false);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initButton);
    } else {
        initButton();
    }

    window.addEventListener("storage", function (event) {
        if (event.key !== STORAGE_KEY) return;
        applyTheme(event.newValue === "dark" ? "dark" : "light", false, false);
    });
})();
