/* VOLXEN - pantalla de entrada */
(function(){
try{if(sessionStorage.getItem("vx_intro")||location.hash)return;sessionStorage.setItem("vx_intro","1")}catch(e){}
function run(){
const rm=matchMedia("(prefers-reduced-motion:reduce)").matches;
const S=document.createElement("style");
S.textContent='#vxi{position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0c0c0d;transition:transform .8s cubic-bezier(.76,0,.24,1)}#vxi::before{content:"";position:absolute;inset:0;background:url(texture-stone.jpg) center/cover;opacity:.18}#vxi>*{position:relative}#vxi.out{transform:translateY(-100%)}.vxl{perspective:600px}.vxl img{width:96px;height:96px;opacity:0;animation:vxa .9s .1s cubic-bezier(.22,1,.36,1) forwards}@keyframes vxa{from{opacity:0;transform:scale(.8) rotateY(-40deg)}to{opacity:1;transform:none}}.vxn{display:flex;margin-top:2.2rem;padding-left:.35em;font:400 clamp(2.2rem,11vw,4rem)/1 Fraunces,Georgia,serif;letter-spacing:.35em;color:#ede7da}.vxn span{opacity:0;transform:translateY(.5em);animation:vxb .5s calc(.6s + var(--i)*.07s) cubic-bezier(.22,1,.36,1) forwards}@keyframes vxb{to{opacity:1;transform:none}}.vxh{display:block;width:96px;height:1px;margin-top:1.8rem;background:#a9824a;transform:scaleX(0);animation:vxc .7s 1.2s cubic-bezier(.22,1,.36,1) forwards}@keyframes vxc{to{transform:scaleX(1)}}.vxp{margin-top:1.6rem;padding:0 1.5rem;text-align:center;font:500 10px Inter,system-ui,sans-serif;letter-spacing:.28em;text-transform:uppercase;color:#a09a8f;opacity:0;animation:vxd .7s 1.5s ease forwards}@keyframes vxd{to{opacity:1}}@media(prefers-reduced-motion:reduce){#vxi{transition:opacity .4s}#vxi.out{transform:none;opacity:0}#vxi *{animation:none!important;opacity:1!important;transform:none!important}}';
document.head.appendChild(S);
const d=document.createElement("div");d.id="vxi";d.setAttribute("aria-hidden","true");
d.innerHTML='<div class="vxl"><img src="logo.svg" alt="" width="96" height="96"></div><div class="vxn">'+"VOLXEN".split("").map((c,i)=>'<span style="--i:'+i+'">'+c+'</span>').join("")+'</div><i class="vxh"></i><p class="vxp">Transparencia y confianza en cada venta</p>';
document.body.appendChild(d);
document.documentElement.style.overflow="hidden";
let done=false;
function out(){if(done)return;done=true;d.classList.add("out");document.documentElement.style.overflow="";setTimeout(()=>d.remove(),rm?400:900)}
d.addEventListener("click",out);
setTimeout(out,rm?900:2300);
setTimeout(()=>{if(d.parentNode){d.remove();document.documentElement.style.overflow=""}},3600);
}
document.body?run():document.addEventListener("DOMContentLoaded",run);
})();
