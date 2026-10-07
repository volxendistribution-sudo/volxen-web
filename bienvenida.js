(function(){
try{if(sessionStorage.getItem("vx_w"))return}catch(e){}
var css='#vw{position:fixed;inset:0;z-index:100;background:radial-gradient(ellipse at 50% 38%,#17130c 0%,#0b0b0b 65%);transition:opacity .7s;overflow:hidden}'
+'#vw.out{opacity:0;pointer-events:none}'
+'#vw svg.vv{position:absolute;inset:0;width:100%;height:100%}'
+'.vwc{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 20px 40px}'
+'.vwi{opacity:0;transform:translateY(14px);animation:vwup 1s forwards}'
+'@keyframes vwup{to{opacity:1;transform:none}}'
+'@keyframes vwln{from{transform:scaleX(0)}to{transform:scaleX(1)}}'
+'.vwl{width:100%;height:1px;margin:30px 0 28px;background:linear-gradient(90deg,transparent,#6b5530,transparent);opacity:0;animation:vwup .01s .5s forwards}'
+'.vwl i{display:block;height:1px;background:#6b5530;transform:scaleX(0);animation:vwln 1s .5s forwards}'
+'.vwn{font:500 44px/1 "Cormorant Garamond",Georgia,serif;letter-spacing:.4em;padding-left:.4em;color:#efe6d2}'
+'.vwr{width:100px;height:1px;background:#6b5530;margin:26px auto}'
+'.vws{font:400 12px "Jost",system-ui,sans-serif;letter-spacing:.3em;color:#a8a090;padding-left:.3em}'
+'#vwb{position:absolute;left:50%;bottom:max(60px,calc(env(safe-area-inset-bottom) + 40px));transform:translate(-50%,14px);background:none;border:1px solid #4a4132;color:#cfc7b4;font:400 13px "Jost",system-ui,sans-serif;letter-spacing:.38em;padding:16px 38px 16px 44px;cursor:pointer;transition:border-color .3s,color .3s}'
+'#vwb:active{border-color:#c9a96e;color:#c9a96e}'
+'.vwlg{filter:drop-shadow(0 0 14px rgba(201,169,110,.28))}'
+'@media(prefers-reduced-motion:reduce){.vwi,.vwl,.vwl i{animation:none!important;opacity:1;transform:none}}';
var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
var d=document.createElement("div");d.id="vw";
d.innerHTML='<svg class="vv" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#5a4727" stroke-width=".8" opacity=".38"><path d="M-10 120C60 150 90 100 150 140S260 200 330 150S390 90 420 110"/><path d="M0 420C70 380 120 450 200 430S330 360 410 400"/><path d="M120 800C140 700 100 640 170 590S260 520 250 440"/><path d="M420 560C360 600 380 680 320 720"/><path d="M-10 640C40 610 70 660 130 640"/></svg>'
+'<div class="vwc">'
+'<svg class="vwi vwlg" style="animation-delay:.1s" width="86" height="86" viewBox="0 0 100 100"><defs><linearGradient id="vwg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2dfb0"/><stop offset=".55" stop-color="#c9a96e"/><stop offset="1" stop-color="#8f6a2c"/></linearGradient></defs><path d="M0 0H24L50 64L76 0H100L50 100Z" fill="url(#vwg)"/></svg>'
+'<div class="vwl"><i></i></div>'
+'<div class="vwi vwn" style="animation-delay:.6s">VOLXEN</div>'
+'<div class="vwi vwr" style="animation-delay:.9s"></div>'
+'<div class="vwi vws" style="animation-delay:1s">COMERCIALIZACIÓN · LA HABANA</div>'
+'</div>'
+'<button id="vwb" class="vwi" style="animation-delay:1.3s">ENTRAR</button>';
document.body.appendChild(d);
document.body.style.overflow="hidden";
document.getElementById("vwb").onclick=function(){
try{sessionStorage.setItem("vx_w","1")}catch(e){}
d.classList.add("out");
setTimeout(function(){d.remove();document.body.style.overflow=""},700)};
})();
