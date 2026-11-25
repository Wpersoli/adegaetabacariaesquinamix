(function(){
'use strict';
var rail=document.getElementById('showcaseRail');
var dots=document.getElementById('showcaseDots');
if(!rail)return;
var cards=[].slice.call(rail.querySelectorAll('.showcase__product'));
var calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var active=0,raf=0;
function mark(index){
  active=Math.max(0,Math.min(cards.length-1,index));
  if(!dots)return;
  [].forEach.call(dots.querySelectorAll('button'),function(b,i){
    var on=i===active;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',on?'true':'false');
  });
}
function nearest(){
  raf=0;
  if(!cards.length)return;
  var x=rail.scrollLeft,idx=0,dist=Infinity;
  cards.forEach(function(card,i){var d=Math.abs(card.offsetLeft-rail.offsetLeft-x);if(d<dist){dist=d;idx=i}});
  mark(idx);
}
rail.addEventListener('scroll',function(){if(!raf)raf=requestAnimationFrame(nearest)},{passive:true});
if(dots)dots.addEventListener('click',function(e){
  var b=e.target.closest('button[data-showcase-page]');if(!b)return;
  var i=Number(b.getAttribute('data-showcase-page'));if(!cards[i])return;
  rail.scrollTo({left:cards[i].offsetLeft-rail.offsetLeft,behavior:calm?'auto':'smooth'});mark(i);
});
window.addEventListener('resize',nearest,{passive:true});
[].forEach.call(document.querySelectorAll('[data-add-product]'),function(button){
  button.addEventListener('click',function(){
    var id=Number(button.getAttribute('data-add-product'));
    if(!Number.isInteger(id)||id<=0)return;
    document.dispatchEvent(new CustomEvent('em:cart-add',{detail:{id:id}}));
    var original=button.innerHTML,originalLabel=button.getAttribute('aria-label');
    button.textContent='Adicionado ✓';button.setAttribute('aria-label','Adicionado à sacola');
    button.disabled=true;
    window.setTimeout(function(){button.innerHTML=original;button.disabled=false;if(originalLabel)button.setAttribute('aria-label',originalLabel);else button.removeAttribute('aria-label')},1200);
  });
});
nearest();
})();