(function(){
'use strict';
/* Página "Todos os produtos": lê o mesmo catálogo da home (catalog.js) e a mesma sacola (localStorage "emCart"). */
var catalog=window.EM_CATALOG||[];
var $=function(i){return document.getElementById(i)};
var save=function(k,v){try{localStorage.setItem(k,v)}catch(e){}};
var load=function(k){try{return localStorage.getItem(k)}catch(e){return null}};
var brl=function(v){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})};
var norm=function(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()};
var names={narguile:'Narguile',headshop:'Headshop',tabacos:'Cigarros e tabacos',bebidas:'Bebidas',outros:'Outros'};

/* Filtros disponíveis */
var CATS=[['todos','Todos'],['promo','Promoções'],['bebidas','Bebidas'],['tabacos','Cigarros e Tabacos'],['headshop','Headshop'],['narguile','Narguile'],['outros','Outros']];
var PRICES=[['Até R$ 10',null,10],['R$ 10 a 30',10,30],['R$ 30 a 60',30,60],['R$ 60 a 120',60,120],['Acima de R$ 120',120,null]];
var st={cat:'todos',min:null,max:null,q:'',sort:'rel'};

/* ---------- Faixa etária (mesma regra da home) ---------- */
var gate=$('gate');
function lock(dlg,on){[].forEach.call(document.body.children,function(n){if(n!==dlg&&n.tagName!=='SCRIPT'&&n.id!=='veil')n.inert=on});document.body.style.overflow=on?'hidden':''}
if(load('esquinaMixAge18')==='yes'){gate.hidden=true}else{lock(gate,true);$('yes').focus()}
$('yes').onclick=function(){save('esquinaMixAge18','yes');gate.hidden=true;lock(gate,false)};
$('no').onclick=function(){$('deny').hidden=false};

/* ---------- Sacola (compartilhada com a home) ---------- */
var cart={};
function readCart(){cart={};try{var raw=JSON.parse(load('emCart')||'{}')||{};catalog.forEach(function(x){var q=parseInt(raw[x.id],10);if(q>0)cart[x.id]=Math.min(q,99)})}catch(e){cart={}}}
function add(id){cart[id]=Math.min((cart[id]||0)+1,99);sync();if($('badge').animate)$('badge').animate([{transform:'scale(1.5)'},{transform:'scale(1)'}],{duration:250})}
function sync(){
  var n=0,t=0,ul=$('items');ul.textContent='';
  catalog.forEach(function(x){var q=cart[x.id];if(!q)return;n+=q;t+=q*x.p;
    var li=document.createElement('li');
    li.innerHTML='<span></span><b></b><div class="q"><button type="button" aria-label="Menos">−</button><span>'+q+'</span><button type="button" aria-label="Mais">+</button></div>';
    li.children[0].textContent=x.n;li.children[1].textContent=brl(q*x.p);
    var b=li.querySelectorAll('button');b[0].setAttribute('aria-label','Diminuir '+x.n);b[1].setAttribute('aria-label','Aumentar '+x.n);
    b[0].onclick=function(){cart[x.id]--;if(cart[x.id]<1)delete cart[x.id];sync()};
    b[1].onclick=function(){add(x.id)};
    ul.appendChild(li)});
  $('badge').textContent=n;$('total').textContent=brl(t);$('send').disabled=!n;
  $('cartBtn').setAttribute('aria-label','Abrir sacola ('+n+(n===1?' item':' itens')+')');
  save('emCart',JSON.stringify(cart))}
var lastFocus=null;
function toggle(o){var d=$('drawer');if(o===!d.hidden)return;d.hidden=!o;$('veil').hidden=!o;lock(d,o);
  if(o){lastFocus=document.activeElement;$('closeCart').focus()}else if(lastFocus){lastFocus.focus();lastFocus=null}}
$('cartBtn').onclick=function(){toggle(true)};
$('closeCart').onclick=$('veil').onclick=function(){toggle(false)};
document.addEventListener('keydown',function(e){if(e.key==='Escape')toggle(false)});
$('send').onclick=function(){
  var l=['*Pedido — Esquina Mix*'],t=0;
  catalog.forEach(function(x){var q=cart[x.id];if(q){l.push(q+'x '+x.n+' — '+brl(q*x.p));t+=q*x.p}});
  l.push('*Total: '+brl(t)+'*');
  var customer=window.EsquinaAuth&&window.EsquinaAuth.user;
  if(customer&&customer.name)l.push('*Cliente: '+customer.name+'*');
  if(customer&&customer.cpfStatus)l.push('Status da conta: '+(customer.cpfStatus==='verified'?'verificada':'em validação'));
  var m=document.querySelector('meta[name="esquina-whatsapp"]'),num=((m&&m.content)||'').replace(/\D/g,'');
  if(!num)return;window.open('https://wa.me/'+num+'?text='+encodeURIComponent(l.join('\n')),'_blank','noopener')};
/* mantém a sacola igual à da home ao voltar pelo histórico ou ao mudar em outra aba */
window.addEventListener('pageshow',function(e){if(e.persisted){readCart();sync()}});
window.addEventListener('storage',function(e){if(e.key==='emCart'){readCart();sync()}});

/* WhatsApp flutuante: mesmo número da meta; inclui o nome do cliente quando logado */
(function(){
  var wa=$('waFab'),mm=document.querySelector('meta[name="esquina-whatsapp"]'),num=((mm&&mm.content)||'').replace(/\D/g,'');
  if(!wa||!num)return;
  wa.href='https://wa.me/'+num+'?text='+encodeURIComponent('Ol\u00e1! Vim pelo card\u00e1pio digital da Esquina Mix.');
  wa.addEventListener('click',function(e){
    var c=window.EsquinaAuth&&window.EsquinaAuth.user;if(!c||!c.name)return;
    e.preventDefault();
    var m='Ol\u00e1! Sou '+c.name+'. Vim pelo card\u00e1pio digital da Esquina Mix.';
    if(c.cpfStatus)m+=' Status da conta: '+(c.cpfStatus==='verified'?'verificada':'em valida\u00e7\u00e3o')+'.';
    window.open('https://wa.me/'+num+'?text='+encodeURIComponent(m),'_blank','noopener')})
})();

/* ---------- Filtros ---------- */
function parsePrice(v){
  var s=String(v==null?'':v).trim();if(!s||s.charAt(0)==='-')return null;s=s.replace(/[^\d.,]/g,'');if(!s)return null;
  if(s.indexOf(',')>-1)s=s.replace(/\./g,'').replace(',','.');   /* 1.234,50 -> 1234.50 */
  var n=parseFloat(s);return isFinite(n)&&n>=0?n:null}
function okCat(x,c){return c==='todos'||(c==='promo'?!!x.promo:x.cat===c)}
function okPrice(x){return(st.min==null||x.p>=st.min)&&(st.max==null||x.p<=st.max)}
function okText(x){if(!st.q)return true;var s=norm(x.n+' '+(names[x.cat]||'')+(x.promo?' promocao oferta':''));
  return norm(st.q).split(/\s+/).filter(Boolean).every(function(t){return s.indexOf(t)>-1})}
function filtered(ignoreCat){return catalog.filter(function(x){return(ignoreCat||okCat(x,st.cat))&&okPrice(x)&&okText(x)})}
function active(){return st.cat!=='todos'||st.min!=null||st.max!=null||!!st.q}
function badRange(){return st.min!=null&&st.max!=null&&st.min>st.max}

function chip(label,on,extra){var b=document.createElement('button');b.type='button';b.className='feat-chip'+(on?' is-active':'')+(extra||'');b.setAttribute('aria-pressed',on?'true':'false');b.appendChild(document.createTextNode(label));return b}
function drawChips(){
  var cb=$('cats'),pb=$('prices'),base=filtered(true);cb.textContent='';pb.textContent='';
  CATS.forEach(function(c){var n=base.filter(function(x){return okCat(x,c[0])}).length,
    b=chip(c[1],st.cat===c[0],(c[0]==='promo'?' is-warn':'')+(n===0&&st.cat!==c[0]?' is-empty':''));
    b.dataset.cat=c[0];var sm=document.createElement('small');sm.textContent=n;b.appendChild(sm);
    b.setAttribute('aria-label',c[1]+', '+n+(n===1?' produto':' produtos'));cb.appendChild(b)});
  PRICES.forEach(function(p,i){var on=st.min===p[1]&&st.max===p[2],b=chip(p[0],on);b.dataset.i=i;pb.appendChild(b)})}

function card(x){
  var c=document.createElement('article');c.className='prod-card';
  c.innerHTML='<div class="prod-filete"></div>'+(x.promo?'<span class="prod-tag">Promo</span>':'')+'<div class="prod-img'+(x.img?' prod-img--foto':'')+'"><img src="'+(x.img||'assets/logo.webp')+'" alt="" width="'+(x.img?800:120)+'" height="'+(x.img?800:120)+'" loading="lazy"></div><p class="prod-cat"></p><h3 class="prod-name"></h3><div class="prod-price"></div><button class="prod-buy" type="button">Comprar →</button>';
  c.querySelector('.prod-cat').textContent=names[x.cat]||'';c.querySelector('.prod-name').textContent=x.n;c.querySelector('img').alt=x.img?x.n:'';c.querySelector('.prod-price').textContent=brl(x.p);
  var buy=c.querySelector('.prod-buy');buy.setAttribute('aria-label','Adicionar '+x.n+' à sacola');
  buy.onclick=function(){add(x.id);buy.textContent='Adicionado ✓';clearTimeout(buy.t);buy.t=setTimeout(function(){buy.textContent='Comprar →'},1200)};
  return c}

function render(){
  var list=badRange()?[]:filtered(false);
  if(st.sort==='asc')list.sort(function(a,b){return a.p-b.p});else if(st.sort==='desc')list.sort(function(a,b){return b.p-a.p});else if(st.sort==='az')list.sort(function(a,b){return a.n.localeCompare(b.n,'pt-BR')});
  drawChips();
  var g=$('grid'),ct=$('count');g.textContent='';
  if(!list.length){
    var p=document.createElement('p');p.className='feat__empty';
    p.textContent=badRange()?'O preço mínimo está maior que o máximo. Ajuste os valores.':'Nenhum produto encontrado com esses filtros. Tente outro preço ou categoria, ou pergunte pelo WhatsApp!';
    g.appendChild(p)}
  else{var fr=document.createDocumentFragment();list.forEach(function(x){fr.appendChild(card(x))});g.appendChild(fr)}
  ct.textContent='';var b=document.createElement('b');b.textContent=list.length;
  ct.appendChild(b);ct.appendChild(document.createTextNode(list.length===1?' produto':' produtos'));
  if(active())ct.appendChild(document.createTextNode(' de '+catalog.length));
  $('clear').hidden=!active();
  var nf=(st.cat!=='todos'?1:0)+(st.min!=null||st.max!=null?1:0)+(st.q?1:0);
  $('filtBtnTx').textContent=nf?'Filtros ('+nf+')':'Filtros';
  url()}

/* endereço compartilhável: produtos.html?cat=bebidas&min=10&max=50 */
function url(){try{var p=[];
  if(st.cat!=='todos')p.push('cat='+st.cat);
  if(st.min!=null)p.push('min='+st.min);
  if(st.max!=null)p.push('max='+st.max);
  if(st.q)p.push('q='+encodeURIComponent(st.q));
  if(st.sort!=='rel')p.push('ordem='+st.sort);
  history.replaceState(null,'',location.pathname+(p.length?'?'+p.join('&'):''))}catch(e){}}
function fromUrl(){try{var u=new URLSearchParams(location.search),c=u.get('cat'),o=u.get('ordem');
  if(c&&CATS.some(function(k){return k[0]===c}))st.cat=c;
  st.min=parsePrice(u.get('min'));st.max=parsePrice(u.get('max'));
  st.q=(u.get('q')||'').slice(0,60);
  if(o&&/^(asc|desc|az)$/.test(o))st.sort=o}catch(e){}}

function sync_inputs(){$('pq').value=st.q;$('pmin').value=st.min==null?'':String(st.min).replace('.',',');$('pmax').value=st.max==null?'':String(st.max).replace('.',',');$('psort').value=st.sort}

$('cats').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;st.cat=b.dataset.cat;render()});
$('prices').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var p=PRICES[+b.dataset.i];
  if(st.min===p[1]&&st.max===p[2]){st.min=null;st.max=null}else{st.min=p[1];st.max=p[2]}
  sync_inputs();render()});
/* um único debounce lê os três campos juntos (nenhuma digitação se perde) */
var tm;function fromInputs(){st.q=$('pq').value.trim();st.min=parsePrice($('pmin').value);st.max=parsePrice($('pmax').value);render()}
['pq','pmin','pmax'].forEach(function(id){$(id).addEventListener('input',function(){clearTimeout(tm);tm=setTimeout(fromInputs,180)})});
$('psort').addEventListener('change',function(){st.sort=this.value;render()});
$('clear').addEventListener('click',function(){st={cat:'todos',min:null,max:null,q:'',sort:st.sort};sync_inputs();render()});

/* filtros recolhíveis no celular */
var fb=$('filtBtn'),fp=$('filters');
fb.addEventListener('click',function(){var o=!fp.classList.contains('is-open');fp.classList.toggle('is-open',o);fb.setAttribute('aria-expanded',o?'true':'false')});

/* altura do cabeçalho -> posição dos filtros fixos */
(function(){var h=document.querySelector('.pg-top');if(!h)return;function set(){document.documentElement.style.setProperty('--pg-top-h',h.offsetHeight+'px')}set();
  if(window.ResizeObserver)new ResizeObserver(set).observe(h);else window.addEventListener('resize',set)})();

/* Service worker (mesmo da home: deixa a página instalável e disponível com internet ruim) */
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});

readCart();fromUrl();sync_inputs();render();sync();
})();
