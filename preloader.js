/* Abertura (preloader) do Esquina Mix — só controla a saída; a animação é toda CSS.
   Sincroniza com o fim do enchimento da barra (animationend) e tem tempo-limite de segurança. */
(function(){
  'use strict';
  var el=document.getElementById('esquinaPreloader');
  if(!el)return;
  var reduce=false;
  try{reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
  var done=false;

  function remove(){
    if(el&&el.parentNode)el.parentNode.removeChild(el);
    try{document.dispatchEvent(new Event('esquina:preloader-done'))}catch(e){}
  }
  function finish(){
    if(done)return;done=true;
    el.classList.add('pl--out');                 /* fade-out por transition (funciona até com "reduzir movimento") */
    el.addEventListener('transitionend',remove,{once:true});
    setTimeout(remove,800);                       /* garante a remoção */
  }

  var fill=el.querySelector('.pl__fill');
  if(!reduce&&fill){
    fill.addEventListener('animationend',function(e){if(e.animationName==='plFill')finish()});
    setTimeout(finish,6200);                      /* teto: nunca passa de ~6 s */
  }else{
    setTimeout(finish,1400);                      /* movimento reduzido: logo estático e sai */
  }
})();
