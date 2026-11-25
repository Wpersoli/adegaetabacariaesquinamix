/* Esquina Mix — abertura (preloader) + loader de transição.
   • Abertura: animação curta em CSS; libera a navegação em ~1,4 s.
   • Loader de transição: barra de cerveja + caneca em laço, mostrado quando o usuário troca de
     página/tela e é preciso aguardar (links internos, recarregar, mapa/iframes, imagens da tela).
     Só aparece se a espera passar de ~0,2 s e fica no mínimo ~0,7 s para não piscar.
     Toque/clique no loader o dispensa. API: window.EsquinaLoading.show()/hide()/wrap(promise). */
(function(){
  'use strict';
  var el=document.getElementById('esquinaPreloader');
  var tpl=null;                                   /* guarda a barra+caneca para o loader de transição */
  if(el){var ld=el.querySelector('.pl__load');if(ld)tpl=ld.outerHTML}

  /* ---------- abertura ---------- */
  if(el){
    var done=false;
    var remove=function(){
      if(el&&el.parentNode)el.parentNode.removeChild(el);
      try{document.dispatchEvent(new Event('esquina:preloader-done'))}catch(e){}
    };
    var finish=function(){
      if(done)return;done=true;
      el.classList.add('pl--out');
      el.addEventListener('transitionend',remove,{once:true});
      setTimeout(remove,800);
    };
    var fill=el.querySelector('.pl__fill');
    if(fill){
      fill.addEventListener('animationend',function(e){if(e.animationName==='plFill')finish()});
      setTimeout(finish,2600);
    }else setTimeout(finish,2400);
  }

  /* ---------- loader de transição ---------- */
  var MIN_VISIBLE=700,DELAY=200,FAILSAFE=8000;
  var ov=null,visible=false,pending=0,shownAt=0,showT=null,hideT=null,failT=null;

  function build(){
    if(ov||!tpl)return ov;
    ov=document.createElement('div');
    ov.id='esquinaLoader';ov.className='pl pl--wait';
    ov.setAttribute('role','status');ov.setAttribute('aria-live','polite');
    ov.setAttribute('aria-label','Carregando');ov.setAttribute('aria-hidden','true');
    ov.innerHTML=tpl.replace(/plMugClip/g,'plMugClip2').replace(/plLiq/g,'plLiq2');
    ov.addEventListener('click',function(){hide(true)});
    document.body.appendChild(ov);
    return ov;
  }
  function reveal(){
    showT=null;
    if(visible||pending<1||document.getElementById('esquinaPreloader')||!build())return;
    visible=true;shownAt=Date.now();
    ov.setAttribute('aria-hidden','false');
    void ov.offsetWidth;                          /* reinicia as animações a cada exibição */
    ov.classList.add('pl--show');
    clearTimeout(failT);failT=setTimeout(function(){hide(true)},FAILSAFE);
  }
  function show(delay){
    pending++;clearTimeout(hideT);hideT=null;
    if(visible||showT)return;
    var d=delay==null?DELAY:delay;
    if(d<=0)reveal();else showT=setTimeout(reveal,d);
  }
  function hide(force){
    pending=force?0:Math.max(0,pending-1);
    if(pending>0)return;
    clearTimeout(showT);showT=null;
    if(!visible)return;
    clearTimeout(hideT);
    hideT=setTimeout(function(){
      if(pending>0||!ov)return;
      visible=false;clearTimeout(failT);
      ov.classList.remove('pl--show');ov.setAttribute('aria-hidden','true');
    },force?0:Math.max(0,MIN_VISIBLE-(Date.now()-shownAt)));
  }
  function wrap(p,delay){show(delay);var h=function(){hide()};return Promise.resolve(p).then(function(v){h();return v},function(e){h();throw e})}
  window.EsquinaLoading={show:show,hide:hide,wrap:wrap};

  /* 1) troca de página: clique em link interno/externo que abre na mesma aba */
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    var a=e.target&&e.target.closest&&e.target.closest('a[href]');
    if(!a||(a.target&&a.target!=='_self')||a.hasAttribute('download'))return;
    var u;try{u=new URL(a.href,location.href)}catch(x){return}
    if(u.protocol!=='http:'&&u.protocol!=='https:')return;
    if(u.origin===location.origin&&u.pathname===location.pathname&&u.search===location.search)return; /* só âncora (#) */
    show(120);
  });
  /* recarregar / sair da página */
  window.addEventListener('beforeunload',function(){show(150)});
  /* voltar pelo histórico (cache): garante que o loader não fique preso */
  window.addEventListener('pageshow',function(e){if(e.persisted)hide(true)});

  /* 2) mapas e iframes que (re)carregam: espera o "load" */
  function watchFrame(f){
    if(!f||f.__plw)return;f.__plw=1;
    var end=function(){hide()};
    show(250);
    f.addEventListener('load',end,{once:true});f.addEventListener('error',end,{once:true});
  }
  /* 3) troca de tela/categoria: espera as imagens visíveis que ainda estão carregando */
  function waitImages(){
    var vh=window.innerHeight,list=[].filter.call(document.images,function(i){
      if(i.complete)return false;var r=i.getBoundingClientRect();
      return r.height>0&&r.bottom>0&&r.top<vh;
    });
    if(!list.length)return;
    var p=Promise.all(list.map(function(i){return new Promise(function(ok){i.addEventListener('load',ok,{once:true});i.addEventListener('error',ok,{once:true})})}));
    wrap(Promise.race([p,new Promise(function(ok){setTimeout(ok,4000)})]),250);
  }
  function init(){
    if(!document.body)return;
    new MutationObserver(function(ms){
      ms.forEach(function(m){
        [].forEach.call(m.addedNodes,function(n){if(n.nodeType===1&&n.tagName==='IFRAME')watchFrame(n)});
      });
    }).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',function(e){
      var t=e.target&&e.target.closest&&e.target.closest('[data-cat],.mnav a,.mnav button,.nav button,.mega a,.mega button');
      if(t)setTimeout(waitImages,80);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
