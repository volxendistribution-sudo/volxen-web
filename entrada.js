/* VOLXEN — Pantalla de bienvenida V3
   Experiencia de entrada premium
*/
(function () {
  "use strict";

  var KEY = "vx_intro_v3";
  var force = /[?&]intro\b/.test(location.search);

  /*
   * La bienvenida aparece una vez por sesión.
   * ?intro=1 permite volver a probarla.
   *
   * IMPORTANTE:
   * No bloqueamos la bienvenida por location.hash.
   * Si alguien entra directamente a #faq, la experiencia
   * puede seguir funcionando correctamente.
   */
  try {
    if (!force && sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, "1");
  } catch (e) {}

  function run() {
    if (document.getElementById("vxi")) return;

    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var root = document.documentElement;
    var done = false;

    /* =========================================================
       PRE-CARGA DEL LOGO
       ========================================================= */

    var logo = new Image();
    logo.src = "logo.svg";

    /* =========================================================
       ESTILOS
       ========================================================= */

    var css = `
      #vxi{
        position:fixed;
        inset:0;
        z-index:2147483000;
        overflow:hidden;
        background:#0c0c0d;
        color:#ede7da;
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        isolation:isolate;
        -webkit-tap-highlight-color:transparent;
      }

      #vxi *,
      #vxi *::before,
      #vxi *::after{
        box-sizing:border-box;
      }

      /* ---------------------------------------------------------
         CAPAS PRINCIPALES
         --------------------------------------------------------- */

      .vx-bg{
        position:absolute;
        inset:0;
        background:
          radial-gradient(
            55% 42% at 50% 43%,
            rgba(169,130,74,.13),
            rgba(169,130,74,.035) 38%,
            transparent 72%
          ),
          #0c0c0d;
      }

      .vx-noise{
        position:absolute;
        inset:-50%;
        opacity:.035;
        pointer-events:none;
        background-image:
          url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E");
        animation:vxNoise 9s steps(8) infinite;
      }

      @keyframes vxNoise{
        0%{transform:translate3d(0,0,0)}
        25%{transform:translate3d(2%,-1%,0)}
        50%{transform:translate3d(-1%,2%,0)}
        75%{transform:translate3d(1%,1%,0)}
        100%{transform:translate3d(0,0,0)}
      }

      .vx-orb{
        position:absolute;
        width:42vw;
        height:42vw;
        min-width:280px;
        min-height:280px;
        max-width:650px;
        max-height:650px;
        left:50%;
        top:44%;
        transform:translate(-50%,-50%);
        border-radius:50%;
        border:1px solid rgba(169,130,74,.09);
        box-shadow:
          0 0 90px rgba(169,130,74,.055),
          inset 0 0 80px rgba(169,130,74,.025);
        opacity:0;
        animation:vxOrb 2s .15s cubic-bezier(.22,1,.36,1) forwards;
      }

      .vx-orb::before,
      .vx-orb::after{
        content:"";
        position:absolute;
        inset:8%;
        border-radius:50%;
        border:1px solid rgba(169,130,74,.055);
      }

      .vx-orb::after{
        inset:18%;
        border-color:rgba(255,255,255,.025);
      }

      @keyframes vxOrb{
        from{
          opacity:0;
          transform:translate(-50%,-50%) scale(.72);
        }
        to{
          opacity:1;
          transform:translate(-50%,-50%) scale(1);
        }
      }

      /* ---------------------------------------------------------
         LÍNEAS DE APERTURA
         --------------------------------------------------------- */

      .vx-top,
      .vx-bottom{
        position:absolute;
        left:0;
        right:0;
        height:50%;
        background:#0c0c0d;
        z-index:8;
        transition:
          transform .95s cubic-bezier(.76,0,.24,1),
          opacity .95s ease;
      }

      .vx-top{
        top:0;
        border-bottom:1px solid rgba(169,130,74,.07);
      }

      .vx-bottom{
        bottom:0;
        border-top:1px solid rgba(169,130,74,.07);
      }

      #vxi.out .vx-top{
        transform:translateY(-100%);
      }

      #vxi.out .vx-bottom{
        transform:translateY(100%);
      }

      /* ---------------------------------------------------------
         CONTENIDO
         --------------------------------------------------------- */

      .vx-content{
        position:absolute;
        inset:0;
        z-index:5;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        text-align:center;
        padding:
          calc(24px + env(safe-area-inset-top))
          24px
          calc(34px + env(safe-area-inset-bottom));
        transition:
          opacity .55s ease,
          transform .95s cubic-bezier(.76,0,.24,1);
      }

      #vxi.out .vx-content{
        opacity:0;
        transform:scale(1.025);
      }

      /* ---------------------------------------------------------
         MARCA SUPERIOR
         --------------------------------------------------------- */

      .vx-label{
        position:absolute;
        top:calc(25px + env(safe-area-inset-top));
        left:0;
        right:0;
        font-size:9px;
        line-height:1;
        letter-spacing:.42em;
        text-transform:uppercase;
        color:#8f887c;
        padding-left:.42em;
        opacity:0;
        animation:vxFadeUp .8s 1.05s cubic-bezier(.22,1,.36,1) forwards;
      }

      /* ---------------------------------------------------------
         LOGO
         --------------------------------------------------------- */

      .vx-mark{
        position:relative;
        width:148px;
        height:148px;
        display:grid;
        place-items:center;
        perspective:900px;
      }

      .vx-ring{
        position:absolute;
        inset:0;
        border-radius:50%;
        transform:rotate(-90deg);
      }

      .vx-ring circle{
        fill:none;
        stroke:#c8a165;
        stroke-width:1;
        stroke-linecap:round;
        stroke-dasharray:440;
        stroke-dashoffset:440;
        animation:
          vxRing 1.65s .15s cubic-bezier(.22,1,.36,1) forwards;
      }

      @keyframes vxRing{
        to{
          stroke-dashoffset:0;
        }
      }

      .vx-ring-2{
        position:absolute;
        inset:10px;
        border:1px solid rgba(200,161,101,.08);
        border-radius:50%;
        opacity:0;
        animation:
          vxRing2 1.2s .55s ease forwards;
      }

      @keyframes vxRing2{
        to{opacity:1}
      }

      .vx-logo{
        width:88px;
        height:88px;
        object-fit:contain;
        opacity:0;
        filter:
          drop-shadow(0 0 14px rgba(200,161,101,.12));
        animation:
          vxLogo .95s .25s cubic-bezier(.22,1,.36,1) forwards;
      }

      @keyframes vxLogo{
        0%{
          opacity:0;
          transform:scale(.65) rotateY(-55deg);
        }
        65%{
          opacity:1;
        }
        100%{
          opacity:1;
          transform:scale(1) rotateY(0);
        }
      }

      .vx-flare{
        position:absolute;
        width:1px;
        height:180px;
        background:
          linear-gradient(
            to bottom,
            transparent,
            rgba(200,161,101,.55),
            transparent
          );
        transform:rotate(45deg) translateY(-180px);
        opacity:0;
        animation:vxFlare 1.3s 1.05s ease-out forwards;
        pointer-events:none;
      }

      @keyframes vxFlare{
        0%{
          opacity:0;
          transform:rotate(45deg) translateY(-180px);
        }
        20%{opacity:.7}
        100%{
          opacity:0;
          transform:rotate(45deg) translateY(180px);
        }
      }

      /* ---------------------------------------------------------
         NOMBRE VOLXEN
         --------------------------------------------------------- */

      .vx-word{
        display:flex;
        margin-top:2.35rem;
        padding-left:.32em;
        font-family:
          Fraunces,
          Georgia,
          "Times New Roman",
          serif;
        font-size:clamp(2.35rem,10vw,4.25rem);
        font-weight:400;
        line-height:1;
        letter-spacing:.32em;
        color:#f0ebe1;
      }

      .vx-letter{
        display:inline-block;
        opacity:0;
        transform:
          translateY(.45em)
          scale(.94);
        filter:blur(9px);
        animation:
          vxLetter .72s
          calc(.75s + var(--i) * .075s)
          cubic-bezier(.22,1,.36,1)
          forwards;
      }

      @keyframes vxLetter{
        to{
          opacity:1;
          transform:translateY(0) scale(1);
          filter:blur(0);
        }
      }

      /* ---------------------------------------------------------
         COMERCIALIZADORA
         --------------------------------------------------------- */

      .vx-divider{
        width:0;
        height:1px;
        margin-top:1.45rem;
        background:#c8a165;
        opacity:.75;
        animation:
          vxDivider .85s 1.65s cubic-bezier(.22,1,.36,1)
          forwards;
      }

      @keyframes vxDivider{
        to{width:128px}
      }

      .vx-commercial{
        margin-top:1.15rem;
        display:flex;
        align-items:center;
        gap:10px;
        color:#c8a165;
        font-size:9px;
        font-weight:500;
        letter-spacing:.34em;
        text-transform:uppercase;
        padding-left:.34em;
        opacity:0;
        animation:
          vxFadeUp .7s 1.85s cubic-bezier(.22,1,.36,1)
          forwards;
      }

      .vx-commercial::before,
      .vx-commercial::after{
        content:"";
        width:22px;
        height:1px;
        background:rgba(200,161,101,.65);
      }

      /* ---------------------------------------------------------
         TEXTO DE MARCA
         --------------------------------------------------------- */

      .vx-quality{
        margin:1.65rem 0 0;
        color:#e8e1d5;
        font-size:10px;
        font-weight:500;
        letter-spacing:.36em;
        text-transform:uppercase;
        padding-left:.36em;
        opacity:0;
        animation:
          vxFadeUp .7s 2.1s cubic-bezier(.22,1,.36,1)
          forwards;
      }

      .vx-city{
        margin:.8rem 0 0;
        color:#858077;
        font-size:10px;
        letter-spacing:.24em;
        text-transform:uppercase;
        padding-left:.24em;
        opacity:0;
        animation:
          vxFadeUp .7s 2.25s cubic-bezier(.22,1,.36,1)
          forwards;
      }

      .vx-slogan{
        max-width:330px;
        margin:.9rem 0 0;
        color:#a59f94;
        font-size:12px;
        font-weight:300;
        line-height:1.65;
        letter-spacing:.025em;
        opacity:0;
        animation:
          vxFadeUp .7s 2.45s cubic-bezier(.22,1,.36,1)
          forwards;
      }

      @keyframes vxFadeUp{
        from{
          opacity:0;
          transform:translateY(9px);
        }
        to{
          opacity:1;
          transform:translateY(0);
        }
      }

      /* ---------------------------------------------------------
         INDICADOR DE ENTRADA
         --------------------------------------------------------- */

      .vx-enter{
        position:absolute;
        left:50%;
        bottom:calc(43px + env(safe-area-inset-bottom));
        transform:translateX(-50%);
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:12px;
        color:#817c74;
        font-size:8px;
        font-weight:500;
        letter-spacing:.34em;
        text-transform:uppercase;
        padding-left:.34em;
        opacity:0;
        animation:
          vxEnter 1s 2.75s ease forwards;
      }

      .vx-enter-line{
        position:relative;
        width:42px;
        height:1px;
        overflow:hidden;
        background:rgba(200,161,101,.14);
      }

      .vx-enter-line::after{
        content:"";
        position:absolute;
        inset:0;
        width:100%;
        background:#c8a165;
        transform:translateX(-100%);
        animation:
          vxEnterLine 2.6s 2.8s
          cubic-bezier(.76,0,.24,1)
          infinite;
      }

      @keyframes vxEnter{
        to{opacity:.72}
      }

      @keyframes vxEnterLine{
        0%{transform:translateX(-100%)}
        45%{transform:translateX(0)}
        70%{transform:translateX(100%)}
        100%{transform:translateX(100%)}
      }

      /* ---------------------------------------------------------
         BOTÓN SALTAR
         --------------------------------------------------------- */

      .vx-skip{
        position:absolute;
        z-index:20;
        top:max(9px,env(safe-area-inset-top));
        right:9px;
        min-width:52px;
        min-height:44px;
        padding:0 11px;
        border:0;
        outline:0;
        background:transparent;
        color:#77726b;
        font:
          500 8px/1
          Inter,
          system-ui,
          sans-serif;
        letter-spacing:.27em;
        text-transform:uppercase;
        cursor:pointer;
        opacity:0;
        animation:vxSkip 1s 1.1s ease forwards;
        transition:
          color .25s ease,
          opacity .25s ease;
      }

      .vx-skip:hover{
        color:#c8a165;
      }

      .vx-skip:focus-visible{
        outline:1px solid rgba(200,161,101,.5);
        outline-offset:-4px;
      }

      @keyframes vxSkip{
        to{opacity:.72}
      }

      /* ---------------------------------------------------------
         BARRA INFERIOR
         --------------------------------------------------------- */

      .vx-progress{
        position:absolute;
        z-index:30;
        left:0;
        bottom:0;
        width:100%;
        height:1px;
        background:rgba(200,161,101,.09);
      }

      .vx-progress::after{
        content:"";
        position:absolute;
        inset:0;
        transform-origin:left center;
        transform:scaleX(0);
        background:#c8a165;
        animation:vxProgress 4.8s linear forwards;
      }

      @keyframes vxProgress{
        to{transform:scaleX(1)}
      }

      /* ---------------------------------------------------------
         SALIDA
         --------------------------------------------------------- */

      #vxi.out .vx-orb{
        opacity:0;
        transition:opacity .5s ease;
      }

      #vxi.out .vx-word,
      #vxi.out .vx-mark{
        transform:scale(.98);
        opacity:0;
        transition:
          opacity .45s ease,
          transform .7s cubic-bezier(.76,0,.24,1);
      }

      /* ---------------------------------------------------------
         MÓVIL
         --------------------------------------------------------- */

      @media(max-width:600px){
        .vx-mark{
          width:132px;
          height:132px;
        }

        .vx-logo{
          width:82px;
          height:82px;
        }

        .vx-word{
          margin-top:2rem;
          font-size:clamp(2.15rem,12vw,3.6rem);
          letter-spacing:.27em;
        }

        .vx-commercial{
          font-size:8px;
        }

        .vx-quality{
          font-size:9px;
          letter-spacing:.30em;
          padding-left:.30em;
        }

        .vx-city{
          font-size:9px;
        }

        .vx-slogan{
          font-size:11px;
        }

        .vx-orb{
          width:88vw;
          height:88vw;
        }
      }

      /* ---------------------------------------------------------
         PANTALLAS PEQUEÑAS
         --------------------------------------------------------- */

      @media(max-height:650px){
        .vx-mark{
          width:105px;
          height:105px;
        }

        .vx-logo{
          width:68px;
          height:68px;
        }

        .vx-word{
          margin-top:1.25rem;
          font-size:2rem;
        }

        .vx-divider{
          margin-top:1rem;
        }

        .vx-commercial{
          margin-top:.8rem;
        }

        .vx-quality{
          margin-top:1rem;
        }

        .vx-slogan{
          margin-top:.55rem;
        }

        .vx-enter{
          bottom:25px;
        }
      }

      /* ---------------------------------------------------------
         REDUCED MOTION
         --------------------------------------------------------- */

      @media(prefers-reduced-motion:reduce){
        #vxi *,
        #vxi *::before,
        #vxi *::after{
          animation:none!important;
          transition:none!important;
          filter:none!important;
        }

        .vx-top,
        .vx-bottom{
          opacity:0;
        }

        .vx-content{
          opacity:1!important;
          transform:none!important;
        }

        .vx-logo,
        .vx-letter,
        .vx-commercial,
        .vx-quality,
        .vx-city,
        .vx-slogan,
        .vx-label,
        .vx-enter,
        .vx-skip{
          opacity:1!important;
          transform:none!important;
        }

        .vx-ring circle{
          stroke-dashoffset:0;
        }

        .vx-progress{
          display:none;
        }

        .vx-noise{
          display:none;
        }
      }
    `;

    var st = document.createElement("style");
    st.id = "vx-intro-style";
    st.textContent = css;
    document.head.appendChild(st);

    /* =========================================================
       LETRAS
       ========================================================= */

    var letters = "VOLXEN"
      .split("")
      .map(function (c, i) {
        return '<span class="vx-letter" style="--i:' + i + '">' + c + "</span>";
      })
      .join("");

    /* =========================================================
       ESTRUCTURA
       ========================================================= */

    var d = document.createElement("div");
    d.id = "vxi";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-label", "Bienvenido a VOLXEN");

    d.innerHTML =
      '<div class="vx-bg"></div>' +
      '<div class="vx-noise"></div>' +
      '<div class="vx-orb"></div>' +

      '<div class="vx-top"></div>' +
      '<div class="vx-bottom"></div>' +

      '<div class="vx-content">' +

        '<div class="vx-label">Tecnología · Energía · Movilidad</div>' +

        '<div class="vx-mark">' +
          '<svg class="vx-ring" viewBox="0 0 148 148" aria-hidden="true">' +
            '<circle cx="74" cy="74" r="70"></circle>' +
          '</svg>' +
          '<div class="vx-ring-2"></div>' +
          '<img class="vx-logo" src="logo.svg" alt="VOLXEN">' +
          '<span class="vx-flare"></span>' +
        '</div>' +

        '<div class="vx-word" aria-label="VOLXEN">' +
          letters +
        '</div>' +

        '<div class="vx-divider"></div>' +

        '<div class="vx-commercial">' +
          'COMERCIALIZADORA' +
        '</div>' +

        '<p class="vx-quality">' +
          'CALIDAD · PRECIO · CONFIANZA' +
        '</p>' +

        '<p class="vx-city">' +
          'Tecnología y energía en La Habana' +
        '</p>' +

        '<p class="vx-slogan">' +
          'Transparencia y confianza en cada venta' +
        '</p>' +

        '<div class="vx-enter">' +
          '<span>Toque para entrar</span>' +
          '<span class="vx-enter-line"></span>' +
        '</div>' +

      '</div>' +

      '<button class="vx-skip" type="button" aria-label="Saltar introducción">' +
        'Saltar' +
      '</button>' +

      '<div class="vx-progress"></div>';

    document.body.appendChil
