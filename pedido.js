/* VOLXEN - registro de pedidos en Supabase. Se carga despues del script principal. */
(function(){
    const f=$("fd");
    if(f&&!$("ft")){f.insertAdjacentHTML("afterend",'<input id="ft" type="tel" inputmode="tel" placeholder="Teléfono *" autocomplete="tel"><input id="fe" type="email" placeholder="Correo electrónico (opcional)" autocomplete="email">')}
    const bt=document.querySelector('[data-a="send"]');if(bt)bt.textContent="Registrar pedido";
    document.querySelectorAll("dd").forEach(d=>{if(d.textContent.indexOf("edite el mensaje")>-1)d.textContent="Arme su pedido en el sitio y regístrelo con sus datos. Recibirá un código para dar seguimiento y su asesor le contactará para confirmar."});
    
    window.send=async function(){
        const n=$("fn").value.trim(),d=$("fd").value.trim(),pv=$("fp").value,tl=$("ft").value.trim(),em=$("fe").value.trim(),ci=$("fc").value.replace(/\D/g,""),o=$("fo").value.trim(),b=document.querySelector('[data-a="send"]');
        const er=$("er");
        if(!n||!d||!tl){setError(er, "Complete su nombre, teléfono y dirección.");return}
        if(!pv){setError(er, "Seleccione su municipio.");return}
        if(ci&&ci.length!==11){setError(er, "El carnet de identidad tiene 11 dígitos. Complételo o déjelo en blanco.");return}
        clearError(er);
        const it=Object.keys(K).map(id=>P.find(x=>x.id===id)).filter(Boolean);
        if(!it.length){setError(er, "Su pedido está vacío.");return}
        b.disabled=true;b.textContent="Registrando…";
        b.setAttribute("aria-busy", "true");
        try{
            const r=await fetch(C.SUPABASE_URL+"/rest/v1/rpc/crear_pedido",{method:"POST",headers:{apikey:C.SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({p_nombre_cliente:n,p_email:em,p_telefono:tl,p_direccion:d,p_municipio:pv,p_notas:o,p_items:it.map(p=>({producto_id:p.id,cantidad:K[p.id]}))})});
            const j=await r.json();
            if(!r.ok)throw new Error((j&&j.message)||"No se pudo registrar el pedido.");
            const g=(x,k)=>x&&typeof x==="object"?(k in x?x[k]:Object.values(x).map(v=>g(v,k)).find(v=>v!=null)):undefined;
            const cod=g(j,"codigo"),tk=g(j,"tracking_token"),tot=g(j,"total_usd");
            Object.keys(K).forEach(k=>delete K[k]);sv();cart();
            let m="Buenas, acabo de registrar el pedido "+(cod||"")+" en el sitio.";if(ci)m+="\nCarnet de identidad: "+ci;
            $("cl").innerHTML='<div style="margin-top:1.5rem"><p class="ey">Pedido registrado</p><h3 style="margin:.5rem 0">'+esc(cod||"")+'</h3>'+(tot!=null?'<p>Total: <b>'+fm(Number(tot))+'</b></p>':'')+(tk?'<p style="margin-top:1rem">Código de seguimiento:</p><p><b style="word-break:break-all">'+esc(tk)+'</b></p>':'')+'<p class="nt">Guarde estos datos: los necesitará para consultar su pedido. Su asesor le contactará para confirmar.</p><a class="btn-primary" style="width:100%;margin-top:1.5rem" href="'+wa(m)+'" target="_blank" rel="noopener">Avisar a mi asesor por WhatsApp</a></div>';
            clearError(er);
        }catch(e){setError(er, e.message||"No se pudo registrar el pedido. Inténtelo de nuevo.")}
        b.disabled=false;b.textContent="Registrar pedido";
        b.removeAttribute("aria-busy");
    };

    function setError(el, msg) {
        if (!el) return;
        el.textContent = msg;
        el.setAttribute("role", "alert");
        el.setAttribute("aria-live", "assertive");
        el.setAttribute("aria-atomic", "true");
    }
    function clearError(el) {
        if (!el) return;
        el.textContent = "";
        el.removeAttribute("role");
        el.removeAttribute("aria-live");
        el.removeAttribute("aria-atomic");
    }
})();