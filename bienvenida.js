(function(){
try{if(sessionStorage.getItem("vx_w"))return}catch(e){}
var css='#vw{display:none!important}'
+'#vx{position:fixed;inset:0;z-index:200;background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .6s ease;overflow:hidden}'
+'#vx.out{opacity:0;pointer-events:none}'
+'#vx .lw{position:relative;width:150px;height:100px;display:flex;align-items:center;justify-content:center}'
+'#vx .lg{display:block;clip-path:inset(50% 0 50% 0);animation:vxo 1s .7s cubic-bezier(.22,.61,.36,1) forwards}'
+'#vx img.lg{width:100%;height:100%;object-fit:contain}'
+'#vx .ln{position:absolute;left:50%;top:50%;height:1px;width:0;margin-top:-.5px;background:#c9a96e;transform:translateX(-50%);animation:vxl .7s .2s cubic-bezier(.22,.61,.36,1) forwards,vxf .5s 1.05s ease forwards}'
+'#vx .t{opacity:0;transform:translateY(6px);animation:vxu .8s ease forwards}'
+'#vx .nm{font:500 38px/1 "Cormorant Garamond",Georgia,serif;letter-spacing:.42em;padding-left:.42em;color:#f6f2ea;margin-top:30px;animation-delay:1.3s}'
+'#vx .cm{display:flex;align-items:center;gap:14px;margin-top:18px;animation-delay:1.75s}'
+'#vx .cm i{display:block;width:30px;height:1px;background:#c9a96e;opacity:.7}'
+'#vx .cm span{font:400 11px "Jost",system-ui,sans-serif;letter-spacing:.42em;padding-left:.42em;color:#c9a96e}'
+'#vx .tg{font:300 clamp(8.5px,2.6vw,10px) "Jost",system-ui,sans-serif;letter-spacing:.3em;padding-left:.3em;color:#8f8878;margin-top:30px;white-space:nowrap;animation-delay:2.15s}'
+'@keyframes vxl{to{width:150px}}@keyframes vxf{to{opacity:0}}@keyframes vxo{to{clip-path:inset(0 0 0 0)}}@keyframes vxu{to{opacity:1;transform:none}}'
+'@media(prefers-reduced-motion:reduce){#vx *{animation:none!important;opacity:1!important;transform:none!important;clip-path:none!important}#vx .ln{display:none}}';
var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
var d=document.createElement("div");d.id="vx";
d.innerHTML='<div class="lw"><div class="ln"></div></div>'
+'<div class="t nm">VOLXEN</div>'
+'<div class="t cm"><i></i><span>COMERCIALIZADORA</span><i></i></div>'
+'<div class="t tg">CALIDAD • PRECIO • CONFIANZA</div>';
var lw=d.firstChild;
var im=new Image();im.className="lg";im.alt="VOLXEN";
var tries=["logo.png","logo.svg"],k=0;
im.onerror=function(){k++;if(k<tries.length){im.src=tries[k]}else{
var f=document.createElement("div");
f.innerHTML='<svg class="lg" width="86" height="86" viewBox="0 0 100 100"><defs><linearGradient id="vxg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2dfb0"/><stop offset=".55" stop-color="#c9a96e"/><stop offset="1" stop-color="#8f6a2c"/></linearGradient></defs><path d="M0 0H24L50 64L76 0H100L50 100Z" fill="url(#vxg)"/></svg>';
lw.replaceChild(f.firstChild,im)}};
im.src=tries[0];
lw.appendChild(im);
document.body.appendChild(d);
document.body.style.overflow="hidden";
var done=false;
function out(){if(done)return;done=true;
try{sessionStorage.setItem("vx_w","1")}catch(e){}
d.classList.add("out");document.body.style.overflow="";
setTimeout(function(){d.remove()},650)}
d.onclick=out;
var rm=window.matchMedia&&matchMedia("(prefers-reduced-motion:reduce)").matches;
setTimeout(out,rm?1400:2900);
})();
