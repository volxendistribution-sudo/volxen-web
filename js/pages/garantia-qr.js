(function () {
    "use strict";

    var BRAND = {
        ink: "#1E1D1B",
        bg: "#F8F7F4",
        surface: "#EAE6DE",
        gold: "#C8A165",
        green: "#2E4A3F",
        muted: "#77736C",
        line: "rgba(30,29,27,.12)"
    };

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeFilename(value) {
        return String(value == null ? "" : value)
            .trim()
            .replace(/[^a-zA-Z0-9._-]+/g, "-")
            .replace(/^-+|-+$/g, "") || "pedido";
    }

    function buildUrl(token) {
        return new URL("garantia.html#g=" + encodeURIComponent(String(token || "")), window.location.href).toString();
    }

    function qrMatrix(text) {
        if (typeof window.QRCode !== "function") {
            throw new Error("El generador de QR no está disponible.");
        }
        var qr = new window.QRCode(0, window.QRCode.ErrorCorrectLevel.M);
        qr.addData(String(text));
        qr.make();
        return qr;
    }

    function paintQr(canvas, text, pixelSize, quietModules) {
        var qr = qrMatrix(text);
        var modules = qr.getModuleCount();
        var quiet = typeof quietModules === "number" ? quietModules : 4;
        var total = modules + quiet * 2;
        var scale = Math.max(1, Math.floor(pixelSize / total));
        var size = scale * total;
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = BRAND.ink;
        for (var row = 0; row < modules; row += 1) {
            for (var col = 0; col < modules; col += 1) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
                }
            }
        }
        return canvas;
    }

    function loadImage(src) {
        return new Promise(function (resolve, reject) {
            var image = new Image();
            image.onload = function () { resolve(image); };
            image.onerror = reject;
            image.src = src;
        });
    }

    function qrDataUrl(text, pixelSize) {
        var canvas = document.createElement("canvas");
        paintQr(canvas, text, pixelSize || 420, 4);
        return canvas.toDataURL("image/png");
    }

    function canvasBlob(canvas) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (blob) resolve(blob);
                else reject(new Error("No se pudo generar la imagen."));
            }, "image/png");
        });
    }

    function roundRect(ctx, x, y, width, height, radius) {
        var r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }

    function drawContain(ctx, image, x, y, width, height) {
        if (!image || !image.naturalWidth || !image.naturalHeight) return;
        var scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        var drawWidth = image.naturalWidth * scale;
        var drawHeight = image.naturalHeight * scale;
        ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    }

    function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        var words = String(text || "").split(/\s+/).filter(Boolean);
        var line = "";
        var lines = [];
        for (var i = 0; i < words.length; i += 1) {
            var test = line ? line + " " + words[i] : words[i];
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = words[i];
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        var limit = typeof maxLines === "number" ? maxLines : lines.length;
        lines.slice(0, limit).forEach(function (value, index) {
            ctx.fillText(value, x, y + index * lineHeight);
        });
    }

    async function imageBlob(token, options) {
        var opts = options || {};
        var code = String(opts.code || "Pedido VOLXEN");
        var managerName = String(opts.managerName || "VOLXEN");
        var url = buildUrl(token);
        var qr = qrMatrix(url);
        var modules = qr.getModuleCount();
        var quiet = 4;
        var qrBox = 700;
        var scale = Math.max(1, Math.floor(qrBox / (modules + quiet * 2)));
        var qrSize = scale * (modules + quiet * 2);

        if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch (error) {}
        }

        var canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1450;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = BRAND.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = BRAND.surface;
        ctx.fillRect(0, 0, canvas.width, 190);

        try {
            var logo = await loadImage("logo.svg");
            drawContain(ctx, logo, 64, 48, 92, 92);
        } catch (error) {
            ctx.fillStyle = BRAND.green;
            ctx.font = '700 52px "DM Sans", sans-serif';
            ctx.fillText("V", 86, 112);
        }

        ctx.fillStyle = BRAND.ink;
        ctx.font = '700 34px "DM Sans", sans-serif';
        ctx.fillText("VOLXEN", 176, 94);
        ctx.fillStyle = BRAND.muted;
        ctx.font = '600 17px "Inter Tight", sans-serif';
        ctx.fillText("CERTIFICADO DE GARANTÍA", 176, 122);

        ctx.fillStyle = BRAND.ink;
        ctx.font = '700 62px "DM Sans", sans-serif';
        wrapText(ctx, code, 64, 290, 940, 68, 1);
        ctx.fillStyle = BRAND.muted;
        ctx.font = '400 20px "Inter Tight", sans-serif';
        ctx.fillText("Comercial VOLXEN: " + managerName, 64, 336, 940);

        ctx.fillStyle = "#FFFFFF";
        roundRect(ctx, 160, 390, 760, 760, 28);
        ctx.fill();

        var qrCanvas = document.createElement("canvas");
        paintQr(qrCanvas, url, qrSize, quiet);
        ctx.drawImage(qrCanvas, 160 + (760 - qrSize) / 2, 390 + (760 - qrSize) / 2, qrSize, qrSize);

        ctx.fillStyle = BRAND.ink;
        ctx.font = '700 28px "DM Sans", sans-serif';
        ctx.fillText("Escanee para verificar", 64, 1218);
        ctx.fillStyle = BRAND.muted;
        ctx.font = '400 18px "Inter Tight", sans-serif';
        wrapText(
            ctx,
            "Este certificado solo es válido mientras el pedido figure como Entregado. No contiene datos internos de VOLXEN.",
            64,
            1256,
            940,
            25,
            2
        );

        ctx.strokeStyle = BRAND.line;
        ctx.beginPath();
        ctx.moveTo(64, 1340);
        ctx.lineTo(1016, 1340);
        ctx.stroke();
        ctx.fillStyle = BRAND.muted;
        ctx.font = '600 16px "Inter Tight", sans-serif';
        ctx.fillText("VOLXEN · Garantía oficial", 64, 1382);
        ctx.textAlign = "right";
        ctx.fillText(code, 1016, 1382);
        ctx.textAlign = "left";

        return canvasBlob(canvas);
    }

    function downloadBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }

    async function shareOrDownload(token, options) {
        var opts = options || {};
        var filename = "volxen-garantia-" + safeFilename(opts.code || "pedido") + ".png";
        var blob = await imageBlob(token, opts);
        var file = null;
        try {
            file = new File([blob], filename, { type: "image/png" });
        } catch (error) {}

        if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: "Garantía VOLXEN " + String(opts.code || ""),
                    text: "Certificado de garantía VOLXEN"
                });
                return "shared";
            } catch (error) {
                if (error && (error.name === "AbortError" || error.name === "NotAllowedError")) {
                    return "cancelled";
                }
            }
        }

        downloadBlob(blob, filename);
        return "downloaded";
    }

    async function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (error) {}
        area.remove();
        return ok;
    }

    function renderInline(container, token, options) {
        if (!container || !token) return null;
        var opts = options || {};
        var url = buildUrl(token);
        var showLink = opts.showLink === true;
        var managerName = String(opts.managerName || "VOLXEN");
        var card = document.createElement("div");
        card.className = "vx-guarantee-card";
        card.innerHTML =
            '<div class="vx-guarantee-head">' +
                '<div><p class="vx-guarantee-eyebrow">Certificado de garantía</p>' +
                '<strong class="vx-guarantee-code">' + escapeHtml(opts.code || "Pedido VOLXEN") + "</strong></div>" +
                '<span class="vx-guarantee-badge">QR activo</span>' +
            "</div>" +
            '<div class="vx-guarantee-qr"></div>' +
            '<p class="vx-guarantee-manager">Comercial VOLXEN: ' + escapeHtml(managerName) + "</p>" +
            (showLink
                ? '<label class="vx-guarantee-link"><span>Enlace del certificado</span><input type="text" readonly value="' + escapeHtml(url) + '"></label>' +
                  '<div class="vx-guarantee-actions"><button type="button" data-guarantee-copy>Copiar enlace</button></div>'
                : "") +
            '<div class="vx-guarantee-actions"><button type="button" class="vx-guarantee-primary" data-guarantee-share>Compartir QR</button></div>' +
            '<p class="vx-guarantee-note">Si el pedido deja de estar Entregado, este certificado se desactiva.</p>';

        var qrHost = card.querySelector(".vx-guarantee-qr");
        var canvas = document.createElement("canvas");
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", "Código QR del certificado de garantía " + String(opts.code || ""));
        paintQr(canvas, url, 620, 4);
        qrHost.appendChild(canvas);

        var shareButton = card.querySelector("[data-guarantee-share]");
        if (shareButton) {
            shareButton.addEventListener("click", async function () {
                shareButton.disabled = true;
                var previous = shareButton.textContent;
                shareButton.textContent = "Preparando…";
                try {
                    var result = await shareOrDownload(token, {
                        code: opts.code,
                        managerName: managerName
                    });
                    shareButton.textContent = result === "downloaded" ? "PNG descargado" : previous;
                    if (result === "downloaded") {
                        window.setTimeout(function () { shareButton.textContent = previous; }, 2200);
                    }
                } catch (error) {
                    shareButton.textContent = "No se pudo generar";
                } finally {
                    shareButton.disabled = false;
                }
            });
        }

        var copyButton = card.querySelector("[data-guarantee-copy]");
        if (copyButton) {
            copyButton.addEventListener("click", async function () {
                var previous = copyButton.textContent;
                try {
                    await copyText(url);
                    copyButton.textContent = "Enlace copiado";
                    window.setTimeout(function () { copyButton.textContent = previous; }, 1800);
                } catch (error) {
                    copyButton.textContent = "No se pudo copiar";
                }
            });
        }

        container.replaceChildren(card);
        return card;
    }

    window.VXGarantia = {
        buildUrl: buildUrl,
        imageBlob: imageBlob,
        qrDataUrl: qrDataUrl,
        shareOrDownload: shareOrDownload,
        renderInline: renderInline,
        downloadBlob: downloadBlob,
        brand: BRAND
    };
}());
