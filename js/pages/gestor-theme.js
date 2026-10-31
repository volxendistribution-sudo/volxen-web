(function () {
    "use strict";

    var STORAGE_KEY = "volxen-gs-theme";
    var root = document.documentElement;
    var button = null;

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
        button.setAttribute("aria-pressed", dark ? "true" : "false");
        button.setAttribute("aria-label", dark ? "Activar fondo claro" : "Activar fondo oscuro");
        button.setAttribute("title", dark ? "Fondo claro" : "Fondo oscuro");
        var icon = button.querySelector("i");
        if (icon) icon.className = dark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }

    function applyTheme(theme, persist) {
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

    function initButton() {
        button = document.getElementById("gsThemeToggle");
        if (!button) return;
        updateButton(currentTheme());
        button.addEventListener("click", function () {
            applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
        });
    }

    var stored = savedTheme();
    if (stored) applyTheme(stored, false);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initButton);
    } else {
        initButton();
    }

    window.addEventListener("storage", function (event) {
        if (event.key !== STORAGE_KEY) return;
        applyTheme(event.newValue === "dark" ? "dark" : "light", false);
    });
})();
