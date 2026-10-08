/* =========================================================
   VOLXEN — WELCOME EXPERIENCE V4
   Pantalla de bienvenida premium
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     CONFIGURACIÓN
     --------------------------------------------------------- */

  var VERSION = "vx_intro_v4";
  var AUTO_CLOSE = 6500;

  /*
   * La bienvenida aparece una vez por sesión.
   * Al cambiar VERSION volverá a aparecer.
   */
  try {
    if (sessionStorage.getItem(VERSION)) return;
    sessionStorage.setItem(VERSION, "1");
  } catch (e) {}

  /* ---------------------------------------------------------
     EJECUTAR CUANDO EL DOCUMENTO ESTÉ LISTO
     --------------------------------------------------------- */

  function start() {

    if (document.getElementById("vxi")) return;

    var reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var closed = false;

    /* -------------------------------------------------------
       ESTILOS
       ------------------------------------------------------- */

    var style = document.createElement("style");

    style.id = "volxen-intro-v4-style";

    style.textContent = `

      /* =====================================================
         CONTENEDOR
         ===================================================== */

      #vxi {
        position: fixed;
        inset: 0;
        z-index: 2147483647;

        width: 100%;
        height: 100%;

        overflow: hidden;

        background: #0c0c0d;
        color: #f0ebe1;

        font-family:
          Inter,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;

        isolation: isolate;

        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }

      #vxi *,
      #vxi *::before,
      #vxi *::after {
        box-sizing: border-box;
      }


      /* =====================================================
         FONDO
         ===================================================== */

      .vx-bg {
        position: absolute;
        inset: 0;
        z-index: 0;

        background:
          radial-gradient(
            circle at 50% 45%,
            rgba(200,161,101,.11) 0%,
            rgba(200,161,101,.045) 22%,
            rgba(12,12,13,0) 58%
          ),
          #0c0c0d;
      }


      /* =====================================================
         LUZ CENTRAL
         ===================================================== */

      .vx-light {
        position: absolute;

        left: 50%;
        top: 45%;

        width: min(520px, 82vw);
        height: min(520px, 82vw);

        transform:
          translate(-50%, -50%)
          scale(.72);

        border-radius: 50%;

        border: 1px solid rgba(200,161,101,.08);

        box-shadow:
          0 0 100px rgba(200,161,101,.045),
          inset 0 0 80px rgba(200,161,101,.025);

        opacity: 0;

        animation:
          vxLightIn
          1.8s
          .1s
          cubic-bezier(.22,1,.36,1)
          forwards;
      }

      .vx-light::before {
        content: "";

        position: absolute;
        inset: 9%;

        border-radius: 50%;

        border: 1px solid rgba(200,161,101,.055);
      }

      .vx-light::after {
        content: "";

        position: absolute;
        inset: 20%;

        border-radius: 50%;

        border: 1px solid rgba(255,255,255,.025);
      }

      @keyframes vxLightIn {

        from {
          opacity: 0;
          transform:
            translate(-50%, -50%)
            scale(.72);
        }

        to {
          opacity: 1;
          transform:
            translate(-50%, -50%)
            scale(1);
        }

      }


      /* =====================================================
         RUIDO SUTIL
         ===================================================== */

      .vx-noise {
        position: absolute;
        inset: -50%;

        z-index: 1;

        opacity: .025;

        pointer-events: none;

        background-image:
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E");

        animation:
          vxNoise
          8s
          steps(8)
          infinite;
      }

      @keyframes vxNoise {

        0% {
          transform: translate(0,0);
        }

        25% {
          transform: translate(2%,-1%);
        }

        50% {
          transform: translate(-1%,2%);
        }

        75% {
          transform: translate(1%,1%);
        }

        100% {
          transform: translate(0,0);
        }

      }


      /* =====================================================
         CORTINAS
         
         IMPORTANTE:
         ESTÁN DETRÁS DEL CONTENIDO.
         ===================================================== */

      .vx-curtain {
        position: absolute;

        left: 0;
        right: 0;

        height: 50%;

        z-index: 2;

        background: #0c0c0d;

        transition:
          transform
          1.15s
          cubic-bezier(.76,0,.24,1);
      }

      .vx-curtain.top {
        top: 0;

        border-bottom:
          1px solid
          rgba(200,161,101,.07);
      }

      .vx-curtain.bottom {
        bottom: 0;

        border-top:
          1px solid
          rgba(200,161,101,.07);
      }

      #vxi.out .vx-curtain.top {
        transform: translateY(-100%);
      }

      #vxi.out .vx-curtain.bottom {
        transform: translateY(100%);
      }


      /* =====================================================
         CONTENIDO
         ===================================================== */

      .vx-content {
        position: absolute;
        inset: 0;

        z-index: 5;

        display: flex;

        flex-direction: column;

        align-items: center;
        justify-content: center;

        text-align: center;

        padding:
          calc(30px + env(safe-area-inset-top))
          24px
          calc(38px + env(safe-area-inset-bottom));

        opacity: 1;

        transform: scale(1);

        transition:
          opacity .5s ease,
          transform .9s cubic-bezier(.76,0,.24,1);

        pointer-events: none;
      }

      #vxi.out .vx-content {
        opacity: 0;

        transform: scale(1.025);
      }


      /* =====================================================
         TEXTO SUPERIOR
         ===================================================== */

      .vx-top-label {

        position: absolute;

        top:
          calc(
            27px +
            env(safe-area-inset-top)
          );

        left: 0;
        right: 0;

        color: #817b72;

        font-size: 8px;

        font-weight: 500;

        letter-spacing: .42em;

        text-transform: uppercase;

        padding-left: .42em;

        opacity: 0;

        animation:
          vxFadeUp
          .8s
          .65s
          cubic-bezier(.22,1,.36,1)
          forwards;
      }


      /* =====================================================
         MARCA / LOGO
         ===================================================== */

      .vx-logo-area {

        position: relative;

        width: 150px;
        height: 150px;

        display: flex;

        align-items: center;
        justify-content: center;
      }


      /* ANILLO */

      .vx-ring {

        position: absolute;

        inset: 0;

        width: 100%;
        height: 100%;

        transform: rotate(-90deg);
      }

      .vx-ring circle {

        fill: none;

        stroke: #c8a165;

        stroke-width: 1;

        stroke-linecap: round;

        stroke-dasharray: 440;

        stroke-dashoffset: 440;

        animation:
          vxRing
          1.7s
          .1s
          cubic-bezier(.22,1,.36,1)
          forwards;
      }

      @keyframes vxRing {

        to {
          stroke-dashoffset: 0;
        }

      }


      /* SEGUNDO ANILLO */

      .vx-ring-small {

        position: absolute;

        inset: 13px;

        border-radius: 50%;

        border:
          1px solid
          rgba(200,161,101,.08);

        opacity: 0;

        transform: scale(.9);

        animation:
          vxSmallRing
          1.2s
          .55s
          cubic-bezier(.22,1,.36,1)
          forwards;
      }

      @keyframes vxSmallRing {

        to {
          opacity: 1;
          transform: scale(1);
        }

      }


      /* LOGO REAL */

      .vx-logo {

        position: relative;

        width: 88px;
        height: 88px;

        object-fit: contain;

        opacity: 0;

        transform:
          scale(.65)
          rotateY(-35deg);

        filter:
          drop-shadow(
            0 0 16px
            rgba(200,161,101,.12)
          );

        animation:
          vxLogo
          1s
          .25s
          cubic-bezier(.22,1,.36,1)
          forwards;
      }

      @keyframes vxLogo {

        0% {
          opacity: 0;

          transform:
            scale(.65)
            rotateY(-35deg);
        }

        65% {
          opacity: 1;
        }

        100% {
          opacity: 1;

          transform:
            scale(1)
            rotateY(0);
        }

      }


      /* DESTELLO */

      .vx-flare {

        position: absolute;

        width: 1px;
        height: 190px;

        background:
          linear-gradient(
            to bottom,
            transparent,
            rgba(200,161,101,.55),
            transparent
          );

        opacity: 0;

        transform:
          rotate(45deg)
          translateY(-170px);

        animation:
          vxFlare
          1.3s
          1.05s
          ease-out
          forwards;
      }

      @keyframes vxFlare {

        0% {
          opacity: 0;

          transform:
            rotate(45deg)
            translateY(-170px);
        }

        25% {
          opacity: .7;
        }

        100% {
          opacity: 0;

          transform:
            rotate(45deg)
            translateY(170px);
        }

      }


      /* =====================================================
         VOLXEN
         ===================================================== */

      .vx-word {

        margin-top: 32px;

        display: flex;

        padding-left: .28em;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:
          clamp(
            38px,
            10vw,
            68px
          );

        font-weight: 400;

        line-height: 1;

        letter-spacing: .28em;

        color: #f0ebe1;
      }

      .vx-letter {

        display: inline-block;

        opacity: 0;

        transform:
          translateY(16px)
          scale(.96);

        filter: blur(7px);

        animation:
          vxLetter
          .65s
          calc(.75s + var(--i) * .075s)
          cubic-bezier(.22,1,.36,1)
          forwards;
      }

      @keyframes vxLetter {

        to {

          opacity: 1;

          transform:
            translateY(0)
            scale(1);

          filter: blur(0);
        }

      }


      /* =====================================================
         DIVISOR
         ===================================================== */

      .vx-divider {

        width: 0;
        height: 1px;

        margin-top: 22px;

        background: #c8a165;

        opacity: .75;

        animation:
          vxDivider
          .8s
          1.55s
          cubic-bezier(.22,1,.36,1)
          forwards;
      }

      @keyframes vxDivider {

        to {
          width: 125px;
        }

      }


      /* =====================================================
         COMERCIALIZADORA
         ===================================================== */

      .vx-commercial {

        margin-top: 17px;

        display: flex;

        align-items: center;

        gap: 10px;

        color: #c8a165;

        font-size: 9px;

        font-weight: 500;

        letter-spacing: .34em;

        text-transform: uppercase;

        padding-left: .34em;

        opacity: 0;

        animation:
          vxFadeUp
          .7s
          1.75s
          cubic-bezier(.22,1,.36,1)
          forwards;
      }

      .vx-commercial::before,
      .vx-commercial::after {

        content: "";

        width: 21px;
        height: 1px;

        background:
          rgba(200,161,101,.6);
      }


      /* =====================================================
         CALIDAD
         ===================================================== */

      .vx-quality {

        margin:
          24px
          0
          0;

        color: #e8e1d5;

        font-size: 10px;

        font-weight: 500;

        letter-spacing: .35em;

        text-transform: uppercase;

        padding-left: .35em;

        opacity: 0;

        animation:
          vxFadeUp
          .7s
          2s
          cubic-bezier(.22,1,.36,1)
          forwards;
      }


      /* =====================================================
         CIUDAD
         ===================================================== */

      .vx-city {

        margin:
          11px
          0
          0;

        color: #827c74;

        font-size: 9px;

        letter-spacing: .25em;

        text-transform: uppercase;

        padding-left: .25em;

        opacity: 0;

        animation:
          vxFadeUp
          .7s
          2.15s
          cubic-bezier(.22,1,.36,1)
          forwards;
      }


      /* =====================================================
         SLOGAN
         ===================================================== */

      .vx-slogan {

        max-width: 330px;

        margin:
          13px
          0
          0;

        color: #a59f94;

        font-size: 12px;

        font-weight: 300;

        line-height: 1.6;

        letter-spacing: .02em;

        opacity: 0;

        animation:
          vxFadeUp
          .7s
          2.35s
          cubic-bezier(.22,1,.36,1)
          forwards;
      }


      @keyframes vxFadeUp {

        from {

          opacity: 0;

          transform:
            translateY(9px);
        }

        to {

          opacity: 1;

          transform:
            translateY(0);
        }

      }


      /* =====================================================
         INDICADOR
         ===================================================== */

      .vx-enter {

        position: absolute;

        left: 50%;

        bottom:
          calc(
            42px +
            env(safe-area-inset-bottom)
          );

        transform:
          translateX(-50%);

        display: flex;

        flex-direction: column;

        align-items: center;

        gap: 12px;

        color: #77726a;

        font-size: 8px;

        font-weight: 500;

        letter-spacing: .34em;

        text-transform: uppercase;

        padding-left: .34em;

        opacity: 0;

        animation:
          vxEnter
          .8s
          2.75s
          ease
          forwards;

        pointer-events: auto;

        cursor: pointer;
      }

      @keyframes vxEnter {

        to {
          opacity: .8;
        }

      }


      .vx-enter-line {

        position: relative;

        width: 48px;
        height: 1px;

        overflow: hidden;

        background:
          rgba(200,161,101,.15);
      }

      .vx-enter-line::after {

        content: "";

        position: absolute;

        inset: 0;

        background: #c8a165;

        transform:
          translateX(-100%);

        animation:
          vxLine
          2.6s
          2.8s
          cubic-bezier(.76,0,.24,1)
          infinite;
      }

      @keyframes vxLine {

        0% {
          transform: translateX(-100%);
        }

        45% {
          transform: translateX(0);
        }

        70% {
          transform: translateX(100%);
        }

        100% {
          transform: translateX(100%);
        }

      }


      /* =====================================================
         BOTÓN SALTAR
         ===================================================== */

      .vx-skip {

        position: absolute;

        top:
          max(
            8px,
            env(safe-area-inset-top)
          );

        right: 8px;

        z-index: 20;

        min-width: 70px;
        min-height: 44px;

        padding: 0 12px;

        border: 0;

        background: transparent;

        color: #77726b;

        font-family:
          Inter,
          system-ui,
          sans-serif;

        font-size: 8px;

        font-weight: 500;

        letter-spacing: .28em;

        text-transform: uppercase;

        cursor: pointer;

        opacity: 0;

        animation:
          vxSkip
          .8s
          .7s
          ease
          forwards;
      }

      .vx-skip:hover {
        color: #c8a165;
      }

      @keyframes vxSkip {

        to {
          opacity: .8;
        }

      }


      /* =====================================================
         PROGRESO
         ===================================================== */

      .vx-progress {

        position: absolute;

        left: 0;
        bottom: 0;

        width: 100%;
        height: 1px;

        z-index: 25;

        background:
          rgba(200,161,101,.08);
      }

      .vx-progress::after {

        content: "";

        position: absolute;

        inset: 0;

        transform:
          scaleX(0);

        transform-origin:
          left center;

        background: #c8a165;

        animation:
          vxProgress
          ${AUTO_CLOSE}ms
          linear
          forwards;
      }

      @keyframes vxProgress {

        to {
          transform: scaleX(1);
        }

      }


      /* =====================================================
         SALIDA
         ===================================================== */

      #vxi.out .vx-light {
        opacity: 0;
        transition: opacity .55s ease;
      }

      #vxi.out .vx-progress {
        opacity: 0;
        transition: opacity .3s ease;
      }


      /* =====================================================
         MÓVIL
         ===================================================== */

      @media (max-width: 600px) {

        .vx-logo-area {
          width: 132px;
          height: 132px;
        }

        .vx-logo {
          width: 80px;
          height: 80px;
        }

        .vx-word {
          margin-top: 27px;
          font-size: clamp(35px, 11vw, 58px);
          letter-spacing: .25em;
        }

        .vx-quality {
          font-size: 9px;
          letter-spacing: .29em;
          padding-left: .29em;
        }

        .vx-city {
          font-size: 8px;
        }

        .vx-slogan {
          font-size: 11px;
        }

        .vx-light {
          width: 88vw;
          height: 88vw;
        }

      }


      /* =====================================================
         PANTALLAS BAJAS
         ===================================================== */

      @media (max-height: 650px) {

        .vx-logo-area {
          width: 105px;
          height: 105px;
        }

        .vx-logo {
          width: 66px;
          height: 66px;
        }

        .vx-word {
          margin-top: 17px;
          font-size: 32px;
        }

        .vx-divider {
          margin-top: 15px;
        }

        .vx-commercial {
          margin-top: 11px;
        }

        .vx-quality {
          margin-top: 14px;
        }

        .vx-city {
          margin-top: 7px;
        }

        .vx-slogan 
