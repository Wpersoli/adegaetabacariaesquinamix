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
var PER=20;   /* limite solicitado: no máximo 20 produtos por página */
var st={cat:'todos',min:null,max:null,q:'',sort:'az',page:1};

/* ---------- Faixa etária (mesma regra da home) ---------- */
var gate=$('gate');
function lock(dlg,on){[].forEach.call(document.body.children,function(n){if(n!==dlg&&n.tagName!=='SCRIPT'&&n.id!=='veil'&&n.id!=='pgVeil')n.inert=on});document.body.style.overflow=on?'hidden':''}
if(load('esquinaMixAge18')==='yes'){gate.hidden=true}else{lock(gate,true);$('yes').focus()}
$('yes').onclick=function(){save('esquinaMixAge18','yes');gate.hidden=true;lock(gate,false)};
$('no').onclick=function(){$('deny').hidden=false};

/* ---------- Sacola (compartilhada com a home) ---------- */
var cart={};
function readCart(){cart={};try{var raw=JSON.parse(load('emCart')||'{}')||{};catalog.forEach(function(x){var q=parseInt(raw[x.id],10);if(q>0)cart[x.id]=Math.min(q,99)})}catch(e){cart={}}}
function add(id){cart[id]=Math.min((cart[id]||0)+1,99);sync();var added=catalog.find(function(x){return x.id===id})||{};document.dispatchEvent(new CustomEvent('cart:add',{detail:{productId:id,category:added.cat||''}}));if($('badge').animate)$('badge').animate([{transform:'scale(1.5)'},{transform:'scale(1)'}],{duration:250})}
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
  save('emCart',JSON.stringify(cart));
  document.dispatchEvent(new CustomEvent('cart:sync',{detail:{n:n,t:t}}))}
document.addEventListener('cart:clear',function(){cart={};sync()});
var lastFocus=null;
function toggle(o){var d=$('drawer');if(o===!d.hidden)return;d.hidden=!o;$('veil').hidden=!o;lock(d,o);
  if(o){lastFocus=document.activeElement;$('closeCart').focus()}else if(lastFocus){lastFocus.focus();lastFocus=null}}
$('cartBtn').onclick=function(){toggle(true)};
$('closeCart').onclick=$('veil').onclick=function(){toggle(false)};
document.addEventListener('keydown',function(e){if(e.key==='Escape')toggle(false)});
$('send').onclick=function(){
  var items=[];catalog.forEach(function(x){var q=cart[x.id];if(q)items.push({n:x.n,q:q,p:x.p})});
  if(window.EsquinaOrder)window.EsquinaOrder.send(items)};
/* mantém a sacola igual à da home ao voltar pelo histórico ou ao mudar em outra aba */
window.addEventListener('pageshow',function(e){if(e.persisted){readCart();sync()}});
window.addEventListener('storage',function(e){if(e.key==='emCart'){readCart();sync()}});

/* Voltar ao topo: aparece depois de rolar a página (mesmo botão da home) */
(function(){
  var up=$('toTop');if(!up)return;var on=false,busy=false;
  function upd(){busy=false;var s=(window.pageYOffset||document.documentElement.scrollTop||0)>400;if(s!==on){on=s;up.classList.toggle('is-on',s)}}
  window.addEventListener('scroll',function(){if(!busy){busy=true;requestAnimationFrame(upd)}},{passive:true});
  up.addEventListener('click',function(){
    var calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:0,behavior:calm?'auto':'smooth'})});
  upd();
})();

/* WhatsApp flutuante: mesmo número da meta; inclui o nome do cliente quando logado */
(function(){
  var wa=$('waFab'),mm=document.querySelector('meta[name="esquina-whatsapp"]'),num=((mm&&mm.content)||'').replace(/\D/g,'');
  if(!wa||!num)return;
  wa.href='https://wa.me/'+num+'?text='+encodeURIComponent('Ol\u00e1! Vim pelo card\u00e1pio digital da Esquina Mix.');
  wa.addEventListener('click',function(e){
    var c=window.EsquinaAuth&&window.EsquinaAuth.user;if(!c||!c.name)return;
    e.preventDefault();
    var m='Ol\u00e1! Sou '+c.name+'. Vim pelo card\u00e1pio digital da Esquina Mix.';
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
  if(st.sort==='asc')list.sort(function(a,b){return a.p-b.p});else if(st.sort==='desc')list.sort(function(a,b){return b.p-a.p});else if(st.sort==='az')list.sort(function(a,b){return a.n.localeCompare(b.n,'pt-BR',{sensitivity:'base'} )});
  drawChips();
  var total=list.length,pages=Math.max(1,Math.ceil(total/PER));
  if(st.page>pages)st.page=pages;if(st.page<1)st.page=1;
  var from=(st.page-1)*PER,part=list.slice(from,from+PER);
  var g=$('grid'),ct=$('count');g.textContent='';
  if(!total){
    var p=document.createElement('p');p.className='feat__empty';
    p.textContent=badRange()?'O preço mínimo está maior que o máximo. Ajuste os valores.':'Nenhum produto encontrado com esses filtros. Tente outro preço ou categoria, ou pergunte pelo WhatsApp!';
    g.appendChild(p)}
  else{var fr=document.createDocumentFragment();part.forEach(function(x){fr.appendChild(card(x))});g.appendChild(fr)}
  ct.textContent='';var b=document.createElement('b');b.textContent=total;
  ct.appendChild(b);ct.appendChild(document.createTextNode(total===1?' produto':' produtos'));
  if(active())ct.appendChild(document.createTextNode(' de '+catalog.length));
  if(pages>1){var sp=document.createElement('span');sp.textContent=' · exibindo '+(from+1)+'–'+(from+part.length);ct.appendChild(sp)}
  drawPages(pages,total,from,part.length);
  $('clear').hidden=!active();
  var nf=(st.cat!=='todos'?1:0)+(st.min!=null||st.max!=null?1:0)+(st.q?1:0);
  $('filtBtnTx').textContent=nf?'Filtros ('+nf+')':'Filtros';
  $('apply').textContent=total?'Ver '+total+(total===1?' produto':' produtos'):'Ver produtos';
  markNav();url()}

/* Paginação: Anterior, números (com reticências) e Próxima */
function pgBtn(label,page,opt){var b=document.createElement('button');b.type='button';b.className='pg-pg'+(opt&&opt.txt?' pg-pg--txt':'');b.dataset.page=page;
  if(opt&&opt.html){b.innerHTML=opt.html}else b.textContent=label;
  if(opt&&opt.aria)b.setAttribute('aria-label',opt.aria);
  if(opt&&opt.cur){b.setAttribute('aria-current','page');b.setAttribute('aria-label','Página '+label+', página atual')}
  else if(!opt||!opt.aria)b.setAttribute('aria-label','Ir para a página '+label);
  if(opt&&opt.off)b.disabled=true;return b}
function drawPages(pages,total,from,n){
  var nav=$('pages');nav.textContent='';
  if(pages<2){nav.hidden=true;return}
  nav.hidden=false;var cur=st.page,seq=[],i;
  for(i=1;i<=pages;i++)if(i===1||i===pages||Math.abs(i-cur)<=1||(cur<=3&&i<=4)||(cur>=pages-2&&i>=pages-3))seq.push(i);
  var arrL='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
      arrR='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  nav.appendChild(pgBtn('',cur-1,{html:arrL+'<span>&nbsp;Anterior</span>',txt:1,aria:'Página anterior',off:cur===1}));
  var prev=0;seq.forEach(function(k){
    if(prev&&k-prev>1){var g=document.createElement('span');g.className='pg-gap';g.setAttribute('aria-hidden','true');g.textContent='…';nav.appendChild(g)}
    nav.appendChild(pgBtn(String(k),k,{cur:k===cur}));prev=k});
  nav.appendChild(pgBtn('',cur+1,{html:'<span>Próxima&nbsp;</span>'+arrR,txt:1,aria:'Próxima página',off:cur===pages}));
  var info=document.createElement('p');info.className='pg-pages__info';info.textContent='Página '+cur+' de '+pages+' · '+(from+1)+'–'+(from+n)+' de '+total;nav.appendChild(info)}
$('pages').addEventListener('click',function(e){var b=e.target.closest('button');if(!b||b.disabled)return;
  var n=parseInt(b.dataset.page,10);if(!(n>0)||n===st.page)return;
  st.page=n;render();goList()});
function goList(){var el=$('lista');if(!el)return;hold=Date.now()+1200;barShow();
  el.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'})}

/* endereço compartilhável: produtos.html?cat=bebidas&min=10&max=50 */
function url(){try{var p=[];
  if(st.cat!=='todos')p.push('cat='+st.cat);
  if(st.min!=null)p.push('min='+st.min);
  if(st.max!=null)p.push('max='+st.max);
  if(st.q)p.push('q='+encodeURIComponent(st.q));
  if(st.sort!=='rel')p.push('ordem='+st.sort);
  if(st.page>1)p.push('pagina='+st.page);
  history.replaceState(null,'',location.pathname+(p.length?'?'+p.join('&'):''))}catch(e){}}
function fromUrl(){try{var u=new URLSearchParams(location.search),c=u.get('cat'),o=u.get('ordem');
  if(c&&CATS.some(function(k){return k[0]===c}))st.cat=c;
  st.min=parsePrice(u.get('min'));st.max=parsePrice(u.get('max'));
  st.q=(u.get('q')||'').slice(0,60);
  if(o&&/^(asc|desc|az)$/.test(o))st.sort=o;
  var pg=parseInt(u.get('pagina'),10);st.page=pg>0&&pg<1000?pg:1}catch(e){}}

function sync_inputs(){$('pq').value=st.q;$('hq').value=st.q;$('pmin').value=st.min==null?'':String(st.min).replace('.',',');$('pmax').value=st.max==null?'':String(st.max).replace('.',',');$('psort').value=st.sort}

$('cats').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;st.cat=b.dataset.cat;st.page=1;render()});
$('prices').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var p=PRICES[+b.dataset.i];
  if(st.min===p[1]&&st.max===p[2]){st.min=null;st.max=null}else{st.min=p[1];st.max=p[2]}
  st.page=1;sync_inputs();render()});
/* um único debounce lê os três campos juntos (nenhuma digitação se perde) */
var tm;function fromInputs(){st.q=$('pq').value.trim();st.min=parsePrice($('pmin').value);st.max=parsePrice($('pmax').value);st.page=1;render()}
['pq','pmin','pmax'].forEach(function(id){$(id).addEventListener('input',function(){if(id==='pq')$('hq').value=$('pq').value;clearTimeout(tm);tm=setTimeout(fromInputs,180)})});
/* busca do topo (mesma da home) -> mesmo filtro de texto */
$('hq').addEventListener('input',function(){$('pq').value=$('hq').value;clearTimeout(tm);tm=setTimeout(fromInputs,180)});
$('psort').addEventListener('change',function(){st.sort=this.value;st.page=1;render()});
$('clear').addEventListener('click',function(){st={cat:'todos',min:null,max:null,q:'',sort:st.sort,page:1};sync_inputs();render()});

/* ---------- Painel de filtros: encostado na borda, altura total; minimiza/abre pela aba ">" (clique ou arraste) ---------- */
var fp=$('filters'),fb=$('filtBtn'),ftab=$('filtTab'),fveil=$('pgVeil'),mqD=window.matchMedia('(min-width:1025px)'),fOpen=false,fLocked=false,fLast=null;
function setFilters(open,silent){
  open=!!open;var desk=mqD.matches;fOpen=open;
  fp.classList.toggle('is-closed',!open);
  document.body.classList.toggle('pg-min',desk&&!open);   /* desktop: conteúdo ocupa a largura toda quando minimizado */
  ftab.setAttribute('aria-expanded',open?'true':'false');
  ftab.setAttribute('aria-label',open?'Minimizar filtros':'Abrir filtros');
  fb.setAttribute('aria-expanded',open?'true':'false');
  if(desk){if(fLocked){fLocked=false;fveil.hidden=true;lock(fp,false)}if(!silent)save('emFiltMin',open?'0':'1')}
  else{
    fveil.hidden=!open;
    if(open&&!fLocked){fLocked=true;fLast=document.activeElement;lock(fp,true);setTimeout(function(){$('filtClose').focus()},60)}
    else if(!open&&fLocked){fLocked=false;lock(fp,false);if(fLast&&fLast.focus)fLast.focus();fLast=null}}}
function initFilters(){setFilters(false,true)}
if(mqD.addEventListener)mqD.addEventListener('change',initFilters);else mqD.addListener(initFilters);
fb.addEventListener('click',function(){setFilters(!fOpen)});
$('filtClose').addEventListener('click',function(){setFilters(false)});
fveil.addEventListener('click',function(){setFilters(false)});
$('apply').addEventListener('click',function(){setFilters(false);goList()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&fOpen&&!mqD.matches)setFilters(false)});
/* aba ">": toque/clique alterna; arrastar para a direita abre, para a esquerda minimiza */
(function(){
  var sx=0,id=null,moved=false,done=false;
  ftab.addEventListener('pointerdown',function(e){id=e.pointerId;sx=e.clientX;moved=false;done=false;try{ftab.setPointerCapture(id)}catch(_){}});
  ftab.addEventListener('pointermove',function(e){if(e.pointerId!==id||done)return;var dx=e.clientX-sx;if(Math.abs(dx)>=24){done=moved=true;setFilters(dx>0)}});
  function end(e){if(e.pointerId!==id)return;id=null;try{ftab.releasePointerCapture(e.pointerId)}catch(_){}}
  ftab.addEventListener('pointerup',end);ftab.addEventListener('pointercancel',end);
  ftab.addEventListener('click',function(e){if(moved){moved=false;e.preventDefault();return}setFilters(!fOpen)});
  /* celular: arrastar o painel para a esquerda fecha; deslizar a partir da borda esquerda da tela abre */
  var px=0,py=0,pid=null,pdone=false;
  fp.addEventListener('pointerdown',function(e){if(e.pointerType==='mouse')return;pid=e.pointerId;px=e.clientX;py=e.clientY;pdone=false});
  fp.addEventListener('pointermove',function(e){if(e.pointerId!==pid||pdone||mqD.matches)return;var dx=e.clientX-px,dy=Math.abs(e.clientY-py);if(dx<=-64&&-dx>dy*1.5){pdone=true;setFilters(false)}});
  fp.addEventListener('pointerup',function(){pid=null});fp.addEventListener('pointercancel',function(){pid=null});
  var ex=null,ey=0;
  document.addEventListener('touchstart',function(e){if(mqD.matches||fOpen||e.touches.length!==1||document.body.style.overflow==='hidden'){ex=null;return}var t=e.touches[0];ex=t.clientX<=18?t.clientX:null;ey=t.clientY},{passive:true});
  document.addEventListener('touchmove',function(e){if(ex==null)return;var t=e.touches[0],dx=t.clientX-ex,dy=Math.abs(t.clientY-ey);if(dx>=56&&dx>dy*1.5){ex=null;setFilters(true)}},{passive:true});
  document.addEventListener('touchend',function(){ex=null},{passive:true});
})();
initFilters();
requestAnimationFrame(function(){requestAnimationFrame(function(){document.body.classList.add('pg-ready')})});

/* ---------- Barra do topo (mesma da home): categorias, busca e menu do celular ---------- */
var bar=$('bar'),navEl=$('nav'),top=document.querySelector('.top'),sb=$('searchBtn'),mb=$('menuBtn'),mqM=window.matchMedia('(max-width:1024.98px)'),dr=null,dLast=null,hold=0,hidden=false,lastY=window.pageYOffset||0,ticking=false;
function nd(tag,cls,txt){var n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n}
function markNav(){
  [].forEach.call(document.querySelectorAll('#nav button[data-cat],.mnav__a[data-cat]'),function(b){if(b.dataset.cat===st.cat)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
  var chips=$('catChips');if(chips)[].forEach.call(chips.querySelectorAll('[data-cat]'),function(b){var on=b.dataset.cat===st.cat;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on))});
}
navEl.addEventListener('click',function(e){var b=e.target.closest('button[data-cat]');if(!b)return;if(b.dataset.cat==='outros'){location.href='/produtos?ordem=az';return}st.cat=b.dataset.cat;st.page=1;hold=Date.now()+900;render();goList()});
var catChips=$('catChips');if(catChips)catChips.addEventListener('click',function(e){var b=e.target.closest('button[data-cat]');if(!b)return;st.cat=b.dataset.cat;st.page=1;render();goList()});
/* busca em linha própria (ícone) no celular */
function searchRow(on){top.classList.toggle('is-search',on);sb.setAttribute('aria-expanded',on?'true':'false');if(on)$('hq').focus();else $('hq').blur()}
sb.addEventListener('click',function(){searchRow(!top.classList.contains('is-search'))});
$('hq').addEventListener('keydown',function(e){if(e.key==='Escape'&&mqM.matches&&top.classList.contains('is-search'))searchRow(false)});
/* menu de categorias em tela cheia (celular/tablet) */
dr=nd('aside','mnav');dr.id='mnav';dr.setAttribute('role','dialog');dr.setAttribute('aria-modal','true');dr.setAttribute('aria-label','Menu de categorias');dr.setAttribute('aria-hidden','true');
(function(){
  var hd=nd('div','mnav__top'),lg=nd('img');lg.src='assets/logo.webp';lg.alt='';lg.width=48;lg.height=48;hd.appendChild(lg);hd.appendChild(nd('strong','','Menu'));
  var x=nd('button','mnav__x','✕');x.type='button';x.setAttribute('aria-label','Fechar menu');hd.appendChild(x);dr.appendChild(hd);
  var ul=nd('ul','mnav__list');dr.appendChild(ul);
  [].forEach.call(navEl.children,function(b){
    var li=nd('li'),a,tag=b.querySelector('.tag'),label=(b.firstChild&&b.firstChild.textContent||b.textContent).trim();
    if(b.tagName==='A'){a=nd('a','mnav__a',label);a.href=b.getAttribute('href')}
    else{a=nd('button','mnav__a',label);a.type='button';a.dataset.cat=b.dataset.cat;
      a.onclick=function(){st.cat=a.dataset.cat;st.page=1;closeM(true);render();goList()}}
    if(tag)a.appendChild(nd('span','tag',tag.textContent));
    li.appendChild(a);ul.appendChild(li)});
  document.body.appendChild(dr);
  function openM(){if(dr.classList.contains('is-open'))return;dLast=document.activeElement;dr.classList.add('is-open');dr.setAttribute('aria-hidden','false');mb.setAttribute('aria-expanded','true');lock(dr,true);setTimeout(function(){x.focus()},50)}
  window.closeM=function(skipFocus){if(!dr.classList.contains('is-open'))return;dr.classList.remove('is-open');dr.setAttribute('aria-hidden','true');mb.setAttribute('aria-expanded','false');lock(dr,false);if(!skipFocus&&dLast&&dLast.focus)dLast.focus();dLast=null};
  mb.addEventListener('click',openM);x.addEventListener('click',function(){closeM()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeM()});
  var chg=function(){if(!mqM.matches){closeM(true);top.classList.remove('is-search');sb.setAttribute('aria-expanded','false')}};
  if(mqM.addEventListener)mqM.addEventListener('change',chg);else mqM.addListener(chg);
})();
/* menu do topo: se as opções não couberem na linha, reduz a fonte até caberem */
(function(){var raf;
  function fit(){navEl.style.removeProperty('--nf');var f=parseFloat(getComputedStyle(navEl.firstElementChild).fontSize),n=0;
    while(navEl.scrollWidth>navEl.clientWidth+0.5&&f>5.5&&n++<80){f-=0.25;navEl.style.setProperty('--nf',f+'px')}}
  function sched(){cancelAnimationFrame(raf);raf=requestAnimationFrame(fit)}
  window.addEventListener('resize',sched);window.addEventListener('orientationchange',sched);window.addEventListener('load',sched);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(sched);
  if(window.ResizeObserver)new ResizeObserver(sched).observe(navEl);sched()})();
/* barra: some ao rolar para baixo e volta ao rolar para cima (também no celular) */
function barShow(){if(hidden){hidden=false;bar.classList.remove('is-hidden')}}
function barHide(){if(!hidden){hidden=true;bar.classList.add('is-hidden')}}
function blocked(){return Date.now()<hold||document.body.style.overflow==='hidden'||document.activeElement===$('hq')}
function barUpdate(){ticking=false;var y=Math.max(0,window.pageYOffset||0),d=y-lastY;
  if(y<=bar.offsetHeight){barShow();lastY=y;return}
  if(Math.abs(d)<8)return;lastY=y;if(d<0)barShow();else if(!blocked())barHide()}
window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(barUpdate)}},{passive:true});
bar.addEventListener('focusin',barShow);
document.addEventListener('cart:add',function(){hold=Date.now()+1500;barShow()});
/* altura da barra -> deslocamento de âncoras e rolagens */
(function(){function set(){document.documentElement.style.setProperty('--bar-h',bar.offsetHeight+'px')}set();
  if(window.ResizeObserver)new ResizeObserver(set).observe(bar);else window.addEventListener('resize',set)})();

/* Service worker (mesmo da home: deixa a página instalável e disponível com internet ruim) */
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});

readCart();fromUrl();sync_inputs();render();sync();
})();
