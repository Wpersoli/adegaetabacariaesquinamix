(function(){
'use strict';
var page=location.pathname.indexOf('/produtos')===0?'products':'home';
var lastSearch=0;
function send(event,category,productId){
  try{fetch('/api/orders?route=events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    event:event,page:page,category:category||'',productId:productId||0
  }),keepalive:true}).catch(function(){});}catch(e){}
}
function categoryOf(target){var el=target&&target.closest?target.closest('[data-cat]'):null;return el?String(el.dataset.cat||'') :'';}
document.addEventListener('click',function(e){
  var cat=categoryOf(e.target);
  if(cat)send('category_selected',cat,0);
  if(e.target.closest&&e.target.closest('#cartBtn')){send('cart_opened','',0);send('checkout_opened','',0);}
});
document.addEventListener('cart:add',function(e){
  var d=e&&e.detail||{};
  if(d.productId)send('product_added',d.category||'',d.productId);
});
document.addEventListener('esquina:whatsapp-handoff',function(){send('whatsapp_handoff','',0)});
var search=document.querySelector('#q, #hq'),searchTimer;
if(search)search.addEventListener('input',function(){
  clearTimeout(searchTimer);
  searchTimer=setTimeout(function(){if(search.value.trim())send('search_used','',0);},700);
});
send('page_view','',0);
})();