/* VOLXEN - pantalla de entrada (versión 2) */
(function(){
var KEY="vx_intro",force=/[?&]intro\b/.test(location.search);
/* una vez por sesión; no sale si la dirección lleva un # (enlace a una sección) */
try{if(!force&&(sessionStorage.getItem(KEY)||location.hash))return;sessionStorage.setItem(KEY,"1")}catch(e){}

function run(){
var reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
var root=document.documentElement,done=false;

/* estilos */
var css=
'#vxi{position:fixed;inset:0;z-index:200;overflow:hidden;--e:cubic-bezier(.76,0,.24,1);font-family:Inter,system-ui,sans-serif}'+
'.vxa,.vxb{position:absolute;left:0;right:0;height:50.3%;background:#0c0c0d;transition:transform .9s var(--e) .25s}'+
'.vxa{top:0}.vxb{bottom:0}'+
'#vxi.out .vxa{transform:translateY(-100%)}#vxi.out .vxb{transform:translateY(100%)}'+
'.vxc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 1.5rem;transition:opacity .4s ease}'+
'#vxi.out .vxc{opacity:0}'+
'.vxg{position:absolute;inset:0;background:radial-gradient(60% 45% at 50% 46%,rgba(169,130,74,.17),transparent 70%);animation:vxg 3s ease-in-out infinite alternate}'+
'@keyframes vxg{from{opacity:.5}to{opacity:1}}'+
'.vxm{position:relative;width:132px;height:132px;display:grid;place-items:center;perspective:700px}'+
'.vxm svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}'+
'.vxm circle{fill:none;stroke:#a9824a;stroke-width:1;stroke-dasharray:390;stroke-dashoffset:390;animation:vxr 1.4s .3s cubic-bezier(.22,1,.36,1) forwards}'+
'@keyframes vxr{to{stroke-dashoffset:0}}'+
'.vxm img{width:84px;height:84px;opacity:0;animation:vxi .9s .2s cubic-bezier(.22,1,.36,1) forwards}'+
'@keyframes vxi{from{opacity:0;transform:scale(.7) rotateY(-60deg)}to{opacity:1;transform:none}}'+
'.vxw{display:flex;margin-top:2.4rem;padding-left:.35em;font:400 clamp(2.2rem,11vw,4rem)/1 Fraunces,Georgia,serif;letter-spacing:.35em;color:#ede7da}'+
'.vxw span{opacity:0;transform:translateY(.4em);filter:blur(8px);animation:vxl .6s calc(.9s + var(--i)*.08s) cubic-bezier(.22,1,.36,1) forwards}'+
'@keyframes vxl{to{opacity:1;transform:none;filter:none}}'+
'.vxh{display:block;width:120px;height:1px;margin-top:1.8rem;background:#a9824a;transform:scaleX(0);animation:vxh .8s 1.7s cubic-bezier(.22,1,.36,1) forwards}'+
'@keyframes vxh{to{transform:scaleX(1)}}'+
'.vxe,.vxp{opacity:0;animation:vxf .7s ease forwards}'+
'.vxe{margin-top:1.6rem;font:500 10px Inter,system-ui,sans-serif;letter-spacing:.28em;text-transform:uppercase;color:#a9824a;animation-delay:2s}'+
'.vxp{margin-top:.8rem;font:300 13px/1.6 Inter,system-ui,sans-serif;color:#a09a8f;animation-delay:2.4s}'+
'@keyframes vxf{to{opacity:1}}'+
'.vxt{position:absolute;left:0;right:0;bottom:calc(26px + env(safe-area-inset-bottom));text-align:center;font:500 10px Inter,system-ui,sans-serif;letter-spacing:.28em;text-transform:uppercase;color:#a09a8f;opacity:0;animation:vxt .8s 2.6s ease forwards}'+
'@keyframes vxt{to{opacity:.7}}'+
'.vxq{position:absolute;left:0;bottom:0;width:100%;height:1px;background:#a9824a;transform:scaleX(0);transform-origin:left;animation:vxq 4s linear forwards}'+
'@keyframes vxq{to{transform:scaleX(1)}}'+
'.vxs{position:absolute;top:max(10px,env(safe-area-inset-top));right:10px;min-width:44px;min-height:44px;padding:0 12px;background:none;border:0;color:#a09a8f;font:500 10px Inter,system-ui,sans-serif;letter-spacing:.28em;text-transform:uppercase;cursor:pointer}'+
'@media(prefers-reduced-motion:reduce){.vxa,.vxb{transition:none}.vxc{transition:opacity .4s}#vxi.out .vxa,#vxi.out .vxb{transform:none;opacity:0}#vxi *{animation:none!important;opacity:1!important;transform:none!important;filter:none!important;stroke-dashoffset:0!important}.vxq,.vxg,.vxt{display:none}}';
var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

/* estructura */
var letters="VOLXEN".split("").map(function(c,i){return '<span style="--i:'+i+'">'+c+'</span>'}).join("");
var d=document.createElement("div");d.id="vxi";d.setAttribute("role","presentation");
d.innerHTML=
'<div class="vxa"></div><div class="vxb"></div>'+
'<div class="vxc"><div class="vxg"></div>'+
'<div class="vxm"><svg viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="62"/></svg><img src="logo.svg" alt="" width="84" height="84"></div>'+
'<div class="vxw" aria-hidden="true">'+letters+'</div><i class="vxh"></i>'+
'<p class="vxe">Comercializadora · La Habana</p><p class="vxp">Transparencia y confianza en cada venta</p>'+
'<p class="vxt">Toque para entrar</p><i class="vxq"></i>'+
'<button class="vxs" type="button" aria-label="Saltar la introducción">Saltar</button></div>';
document.body.appendChild(d);
root.style.overflow="hidden";

/* salida */
function out(){
if(done)return;done=true;
d.classList.add("out");
setTimeout(function(){root.style.overflow=""},reduce?100:900);
setTimeout(function(){if(d.parentNode)d.remove()},reduce?500:1300);
}
d.addEventListener("click",out);
setTimeout(out,reduce?1300:4000);
/* seguro: si algo falla, nunca deja la web bloqueada */
setTimeout(function(){if(d.parentNode)d.remove();root.style.overflow=""},6500);
}

if(document.body)run();else document.addEventListener("DOMContentLoaded",run);
})();
