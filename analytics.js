(function(){
'use strict';
var page=location.pathname.indexOf('/produtos')===0?'products':'home';
var lastSearch=0;
function send(event,category,productId){
  try{fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    event:event,page:page,category:category||'',productId:productId||0
  }),keepalive:true}).catch(function(){});}catch(e){}
}
function categoryOf(target){var el=target&&target.closest?target.closest('[data-cat]'):null;return el?String(el.dataset.cat||'') :'';}
document.addEventListener('click',function(e){
  var cat=categoryOf(e.target);
  if(cat)send('category_selected',cat,0);
  if(e.target.closest&&e.target.closest('#cartBtn'))send('cart_opened','',0);
});
document.addEventListener('cart:add',function(e){
  var d=e&&e.detail||{};
  if(d.productId)send('product_added',d.category||'',d.productId);
});
document.addEventListener('esquina:whatsapp-handoff',function(){send('whatsapp_handoff','',0)});
document.addEventListener('cart:sync',function(e){
  var d=e&&e.detail||{};
  if(d.n>0&&!window.__emCheckoutSeen){window.__emCheckoutSeen=true;send('checkout_opened','',0);}
  if(!d.n)window.__emCheckoutSeen=false;
});
var search=document.querySelector('#q, #hq');
if(search)search.addEventListener('input',function(){
  var now=Date.now();if(now-lastSearch<1800)return;lastSearch=now;send('search_used','',0);
});
send('page_view','',0);
})();