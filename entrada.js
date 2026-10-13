/* VOLXEN - pantalla de entrada con transición de logo a cabecera */
(function(){
    var KEY="vx_intro", force=/[?&]intro\b/.test(location.search);
    try{if(!force&&(sessionStorage.getItem(KEY)||location.hash))return;sessionStorage.setItem(KEY,"1")}catch(e){}

    function run(){
        var reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
        var root=document.documentElement,done=false;

        var css=
        '#vxi{position:fixed;inset:0;z-index:200;overflow:hidden;--e:cubic-bezier(.22,1,.36,1);font-family:"Inter Tight",sans-serif;background:var(--bg)}'+
        '.vxa,.vxb{position:absolute;left:0;right:0;height:50%;background:var(--bg);transition:transform .8s var(--e) .15s}'+
        '.vxa{top:0}.vxb{bottom:0}'+
        '#vxi.out .vxa{transform:translateY(-100%)}#vxi.out .vxb{transform:translateY(100%)}'+
        '.vxc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 1.5rem;transition:opacity .4s ease}'+
        '#vxi.out .vxc{opacity:0}'+
        '.vxm{position:relative;width:120px;height:120px;display:grid;place-items:center;transition:transform .8s var(--e),opacity .4s ease}'+
        '.vxm img{width:80px;height:80px}'+
        '.vxw{display:flex;margin-top:1.5rem;padding-left:.35em;font:400 clamp(2rem,10vw,3.5rem)/1 "DM Sans",sans-serif;letter-spacing:.35em;color:var(--fg)}'+
        '.vxw span{opacity:0;transform:translateY(.3em);animation:vxl .5s calc(.6s + var(--i)*.05s) var(--e) forwards}'+
        '@keyframes vxl{to{opacity:1;transform:none}}'+
        '.vxh{display:block;width:100px;height:1px;margin-top:1.2rem;background:var(--g);transform:scaleX(0);animation:vxh .5s 1.1s var(--e) forwards}'+
        '@keyframes vxh{to{transform:scaleX(1)}}'+
        '.vxe{margin-top:1rem;font:500 10px var(--s);letter-spacing:.28em;text-transform:uppercase;color:var(--g);opacity:0;animation:vxf .5s 1.3s var(--e) forwards}'+
        '.vxp{margin-top:.5rem;font:300 13px/1.6 var(--s);color:var(--mu);opacity:0;animation:vxf .5s 1.5s var(--e) forwards}'+
        '@keyframes vxf{to{opacity:1}}'+
        '.vxt{position:absolute;left:0;right:0;bottom:calc(24px + env(safe-area-inset-bottom));text-align:center;font:500 10px var(--s);letter-spacing:.28em;text-transform:uppercase;color:var(--mu);opacity:0;animation:vxt .5s 1.8s var(--e) forwards}'+
        '@keyframes vxt{to{opacity:.7}}'+
        '.vxq{position:absolute;left:0;bottom:0;width:100%;height:1px;background:var(--g);transform:scaleX(0);transform-origin:left;animation:vxq 2.5s linear forwards}'+
        '@keyframes vxq{to{transform:scaleX(1)}}'+
        '.vxs{position:absolute;top:max(10px,env(safe-area-inset-top));right:10px;min-width:44px;min-height:44px;padding:0 12px;background:none;border:0;color:var(--mu);font:500 10px var(--s);letter-spacing:.28em;text-transform:uppercase;cursor:pointer}'+
        '#vxi.out .vxm{transform:translate(-50%, -50%) scale(0.5);opacity:0}'+
        '@media(prefers-reduced-motion:reduce){.vxa,.vxb{transition:none}#vxi .vxm{transition:none}#vxi *{animation:none!important;opacity:1!important;transform:none!important}.vxq,.vxt{display:none}}';
        var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

        var letters="VOLXEN".split("").map(function(c,i){return '<span style="--i:'+i+'">'+c+'</span>'}).join("");
        var d=document.createElement("div");d.id="vxi";d.setAttribute("role","presentation");
        d.innerHTML=
        '<div class="vxa"></div><div class="vxb"></div>'+
        '<div class="vxc">'+
        '<div class="vxm" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"><img src="logo-light.svg" alt="" width="80" height="80"></div>'+
        '<div class="vxw" aria-hidden="true">'+letters+'</div><i class="vxh"></i>'+
        '<p class="vxe">Comercializadora · La Habana</p><p class="vxp">Transparencia y confianza en cada venta</p>'+
        '<p class="vxt">Toque para entrar</p><i class="vxq"></i>'+
        '<button class="vxs" type="button" aria-label="Saltar la introducción">Saltar</button></div>';
        document.body.appendChild(d);

        function getHeaderLogoPos(){
            var hdr=document.getElementById('hd');
            if(!hdr)return null;
            var logo=hdr.querySelector('a[href="index.html"] img');
            if(!logo)return null;
            var r=logo.getBoundingClientRect();
            return {x:r.left+r.width/2,y:r.top+r.height/2};
        }

        function out(){
            if(done)return;done=true;
            var pos=getHeaderLogoPos();
            var vm=d.querySelector('.vxm');
            if(pos&&vm){
                var centerX=window.innerWidth/2;
                var centerY=window.innerHeight/2;
                var dx=pos.x-centerX;
                var dy=pos.y-centerY;
                vm.style.transition='transform .8s cubic-bezier(.22,1,.36,1),opacity .4s ease';
                vm.style.transform='translate('+dx+'px,'+dy+'px) scale(0.5)';
                vm.style.opacity='0';
            }
            d.classList.add("out");
            setTimeout(function(){root.style.overflow=""},reduce?100:800);
            setTimeout(function(){if(d.parentNode)d.remove()},reduce?500:1200);
        }
        d.addEventListener("click",out);
        setTimeout(out,reduce?800:2800);
        setTimeout(function(){if(d.parentNode)d.remove();root.style.overflow=""},5000);
    }

    if(document.body)run();else document.addEventListener("DOMContentLoaded",run);
})();