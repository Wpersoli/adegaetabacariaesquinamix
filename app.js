(function(){
'use strict';
/* Catálogo: os produtos ficam em catalog.js (compartilhado com a página produtos.html) */
var catalog=window.EM_CATALOG||[];
var $=function(i){return document.getElementById(i)};
var save=function(k,v){try{localStorage.setItem(k,v)}catch(e){}};
var load=function(k){try{return localStorage.getItem(k)}catch(e){return null}};
var cat='todos',term='',cart={};
try{var raw=JSON.parse(load('emCart')||'{}')||{};catalog.forEach(function(x){var q=parseInt(raw[x.id],10);if(q>0)cart[x.id]=Math.min(q,99)})}catch(e){cart={}}
var brl=function(v){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})};
var norm=function(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()};
var names={todos:'Cardápio digital',promo:'Promoções',narguile:'Narguile',headshop:'Headshop',tabacos:'Cigarros e tabacos',bebidas:'Bebidas',outros:'Outros'};

/* Age gate */
var gate=$('gate');
/* Isola o fundo (inert) e trava o scroll enquanto um diálogo está aberto */
function lock(dlg,on){[].forEach.call(document.body.children,function(n){if(n!==dlg&&n.tagName!=='SCRIPT'&&n.id!=='veil')n.inert=on});document.body.style.overflow=on?'hidden':''}
if(load('esquinaMixAge18')==='yes'){gate.hidden=true}else{lock(gate,true);$('yes').focus()}
$('yes').onclick=function(){save('esquinaMixAge18','yes');gate.hidden=true;lock(gate,false)};
$('no').onclick=function(){$('deny').hidden=false};

/* Catálogo */
/* Filtro inteligente: tags automaticas a partir do nome (ou x.t:['Tag'] no catalogo), busca tolerante e preco em linguagem natural ("ipa ate 9") */
var sel={},sortBy='az',subF=null,homePage=1,homePer=20;
var ZERO=/zero alcool|sem alcool|0\.0/,T=function(re){return function(x,s){return re.test(s)}};
/* Filtros fixos, na ordem em que aparecem. Cada item entra automaticamente pelo nome ou manualmente com t:['Nome do filtro'] no catalogo */
var CH=[['Ofertas',function(x){return !!x.promo}],
['Cerveja Gelada',function(x,s){return /cerveja/.test(s)&&!ZERO.test(s)}],
['Drinks Prontos',T(/cabare|mascate|cha de cana|xeque mate/)],
['Vinhos',T(/vinho|espumante|prosecco|champanhe/)],
['Salgadinhos',T(/salgadinho|batata|amendoim|ruffles|doritos|cheetos|torcida/)],
['Refri e Energ',T(/energetico|refrigerante|refri\b|guarana|coca|pepsi/)],
['Zero e Fit',function(x,s){return ZERO.test(s)||/ultra|light|diet|\bfit\b/.test(s)}],
['Churrasco',function(x,s){return /carvao|churrasc|espeto|sal grosso|picanha/.test(s)&&!/narguile/.test(s)}],
['Chopp',T(/chopp|chope|barril/)],
['Novidades',function(){return false}],
['Cerveja Sem Alcool',T(ZERO)],
['Águas e Gelo',T(/agua|gelo/)],
['Sobremesas',T(/sobremesa|sorvete|pudim|chocolate|picole/)],
['Mercadinho',function(){return false}],
['Conveniência',T(/isqueiro|pilha|carregador|chiclete|\bbala\b/)],
['Destilados',T(/whisk|vodka|\bgin\b|cachaca|pinga|tequila|busca brisa/)],
['Aperitivos',T(/aperitivo|campari|aperol/)],
['Sucos e Chás',T(/\bsuco|cha gelado|cha verde|ice tea|leao/)]];
var PR=[['Até R$ 10',-1,10],['R$ 10 a 30',10,30],['R$ 30 a 60',30,60],['R$ 60 a 120',60,120],['Acima de R$ 120',120,999999]];

/* Menu suspenso do topo: subcategorias (filtram o catalogo do proprio site). Cada item entra pelo nome ou manualmente com t:['Nome do item'] */
var S=function(label,re,ex){return[label,function(x,s){return(re.test(s)&&!(ex&&ex.test(s)))||(x.t||[]).indexOf(label)>-1}]};
var SUBS={
narguile:[S('Carvão Alumínio Narguile Acessórios',/carvao|aluminio|acessorio/),S('Essências Narguile',/essencia/)],
headshop:[S('Sedas e Celulose Tabacaria',/seda|celulose/),S('Piteiras de Papel',/piteira/,/vidro/),S('Isqueiros e Maçarico a Gás',/isqueiro|macarico/),S('Filtros Tabacaria',/filtro/),S('Acessórios Headshop e Tabacaria',/dichavador|acessorio|balanca|bong|tesoura/),S('Piteiras de Vidro',/piteira.*vidro|vidro.*piteira/),S('Cinzeiros',/cinzeiro/),S('Incenso Indiano',/incenso/),S('Variedade e Conveniência',/pilha|carregador|chiclete|\bbala\b|variedade/)],
tabacos:[S('Tabaco',/tabaco|\bfumo\b/),S('Cigarros',/cigarro/,/palha/),S('Charutos e Cigarrilhas',/charuto|cigarrilha/),S('Cigarro de Palha',/palha|palheiro/)],
bebidas:[S('Copão Não?! Sacão!',/copao|sacao/),S('Licores e Aperitivos',/licor|aperitivo|campari|aperol/),S('Cervejas Artesanais e Sem Glúten',/artesanal|sem gluten|\bipa\b|lagunitas|dogma|blue moon|lohn|1906|ultra/),S('Cervejas sem álcool',ZERO),S('Cervejas Lata e Long Neck',/cerveja.*(lata|long neck)/),S('Bebida Mista e Drink Pronto',/cabare|mascate|cha de cana|xeque mate|bebida mista|drink/),S('Drink Mansão Maromba',/mansao|maromba/),S('Vinhos e Chopp de Vinho',/vinho|espumante|chopp de vinho/),S('Refrigerantes Gelados',/refrigerante|refri\b|coca|guarana|pepsi/),S('Energético',/energetico/),S('Gin e Combo de Gin',/\bgin\b/),S('Whisky e Combo de Whisky',/whisk/),S('Vodka e Combo de Vodka',/vodka/)]};
var SYN={breja:'cerveja',cervejinha:'cerveja',gelada:'cerveja',latinha:'lata',longneck:'long',sem:'zero'};
function tagsOf(x){if(x._t)return x._t;var s=norm(x.n),t=[];CH.forEach(function(c){if(c[1](x,s))t.push(c[0])});(x.t||[]).forEach(function(a){if(t.indexOf(a)<0)t.push(a)});x._t=t;return t}
function wordsOf(x){if(!x._w)x._w=norm(x.n+' '+names[x.cat]+' '+tagsOf(x).join(' ')).split(/[^a-z0-9]+/).filter(Boolean);return x._w}
function lev(a,b){var m=a.length,n=b.length,d=[],i,j;for(i=0;i<=m;i++)d[i]=[i];for(j=1;j<=n;j++)d[0][j]=j;for(i=1;i<=m;i++)for(j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n]}
function tokenMatch(t,ws){var k=t.length>6?2:1;return ws.some(function(w){return w.indexOf(t)>-1||(t.length>3&&w.length>3&&(lev(w.slice(0,t.length),t)<=k||lev(w,t)<=k))})}
function parseTerm(v){var s=norm(v==null?term:v),mx=null,mn=null,m,num=function(v){return parseFloat(v.replace(',','.'))};
  if((m=s.match(/(?:ate|menos de|abaixo de|max(?:imo)?)\s*(?:r\$)?\s*(\d+(?:[.,]\d+)?)/))){mx=num(m[1]);s=s.replace(m[0],' ')}
  if((m=s.match(/(?:acima de|mais de|a partir de|min(?:imo)?)\s*(?:r\$)?\s*(\d+(?:[.,]\d+)?)/))){mn=num(m[1]);s=s.replace(m[0],' ')}
  return{w:s.split(/[^a-z0-9]+/).filter(Boolean).map(function(t){return SYN[t]||t}),mx:mx,mn:mn}}
function has(x,k){if(k.slice(0,2)==='p:'){var r=PR[+k.slice(2)];return x.p>r[1]&&x.p<=r[2]}return tagsOf(x).indexOf(k)>-1}
function matchSel(x){var ks=Object.keys(sel),cs=ks.filter(function(k){return k.slice(0,2)!=='p:'}),pk=ks.filter(function(k){return k.slice(0,2)==='p:'})[0];
  return(!cs.length||cs.some(function(k){return has(x,k)}))&&(!pk||has(x,pk))}
/* Subcategorias do cardapio = exatamente os itens do menu suspenso do topo (SUBS) */
function facets(base,q){
  var box=$('facets');if(!box)return;box.textContent='';
  (SUBS[cat]||[]).forEach(function(sb,i){var on=!!(subF&&subF.label===sb[0]),b=document.createElement('button');b.type='button';
    b.className='feat-chip'+(on?' is-active':'');b.dataset.i=i;b.setAttribute('aria-pressed',on?'true':'false');b.textContent=sb[0];box.appendChild(b)});
  if(q.mx!=null||q.mn!=null){var n=document.createElement('span');n.className='facet-note';n.textContent='Preço '+(q.mn!=null?'a partir de '+brl(q.mn)+' ':'')+(q.mx!=null?'até '+brl(q.mx):'');box.appendChild(n)}}
function render(){
  var q=parseTerm();
  var base=catalog.filter(function(x){
    var okCat=cat==='todos'||(cat==='promo'?x.promo:x.cat===cat);
    return okCat&&(!subF||subF.t(x,norm(x.n)))&&(q.mx==null||x.p<=q.mx)&&(q.mn==null||x.p>=q.mn)&&q.w.every(function(t){return tokenMatch(t,wordsOf(x))})});
  facets(base,q);
  var list=base.filter(matchSel);
  drawAll();
  if(sortBy==='asc')list.sort(function(a,b){return a.p-b.p});else if(sortBy==='desc')list.sort(function(a,b){return b.p-a.p});else if(sortBy==='az')list.sort(function(a,b){return a.n.localeCompare(b.n,'pt-BR',{sensitivity:'base'})});
  var g=$('grid');g.textContent='';
  var totalPages=Math.max(1,Math.ceil(list.length/homePer));if(homePage>totalPages)homePage=totalPages;
  var pageItems=list.slice((homePage-1)*homePer,homePage*homePer);
  if(!list.length){g.innerHTML='<p class="feat__empty">'+(subF?'Ainda não temos itens em “'+subF.label+'” no cardápio digital. Pergunte pelo WhatsApp!':'Nada encontrado. Tente outra busca.')+'</p>';drawHomePages(1);return}
  pageItems.forEach(function(x){
    var c=document.createElement('article');c.className='prod-card';
    c.innerHTML='<div class="prod-filete"></div>'+(x.promo?'<span class="prod-tag">Promo</span>':'')+'<div class="prod-img'+(x.img?' prod-img--foto':'')+'"><img src="'+(x.img||'assets/logo.webp')+'" alt="" width="'+(x.img?800:120)+'" height="'+(x.img?800:120)+'" loading="lazy"></div><p class="prod-cat"></p><h3 class="prod-name"></h3><div class="prod-price"></div><button class="prod-buy">Comprar →</button>';
    c.querySelector('.prod-cat').textContent=names[x.cat];c.querySelector('.prod-name').textContent=x.n;c.querySelector('img').alt=x.img?x.n:'';c.querySelector('.prod-price').textContent=brl(x.p);
    var buy=c.querySelector('.prod-buy');buy.setAttribute('aria-label','Adicionar '+x.n+' à sacola');
    buy.onclick=function(){add(x.id);buy.textContent='Adicionado ✓';clearTimeout(buy.t);buy.t=setTimeout(function(){buy.textContent='Comprar →'},1200)};
    g.appendChild(c)});drawHomePages(totalPages)}
/* Todos / Promoções: atalho para a página com todos os produtos disponíveis */
function drawAll(){var a=$('allLink');if(!a)return;
  var on=(cat==='todos'||cat==='promo')&&!subF&&!term&&!Object.keys(sel).length;a.hidden=!on;if(!on)return;
  var promos=catalog.filter(function(x){return x.promo}).length,n=catalog.length;
  $('allTitle').textContent='Ver todos os produtos disponíveis';
  $('allSub').textContent=cat==='promo'?promos+(promos===1?' promoção':' promoções')+' aqui · catálogo completo com '+n+' produtos':'Catálogo completo com '+n+' produtos e '+promos+(promos===1?' promoção':' promoções')}
function drawHomePages(total){var box=$('homePages');if(!box)return;box.textContent='';box.hidden=total<=1;if(total<=1)return;for(var i=1;i<=total;i++){var b=document.createElement('button');b.type='button';b.textContent=i;if(i===homePage)b.setAttribute('aria-current','page');b.onclick=function(){homePage=+this.textContent;render();document.getElementById('cardapio').scrollIntoView({behavior:'smooth',block:'start'})};box.appendChild(b)}}

/* Sacola */
function add(id){cart[id]=Math.min((cart[id]||0)+1,99);sync();document.dispatchEvent(new Event('cart:add'));if($('badge').animate)$('badge').animate([{transform:'scale(1.5)'},{transform:'scale(1)'}],{duration:250})}
function sync(open){
  var n=0,t=0,ul=$('items');ul.textContent='';
  catalog.forEach(function(x){var q=cart[x.id];if(!q)return;n+=q;t+=q*x.p;
    var li=document.createElement('li');
    li.innerHTML='<span></span><b></b><div class="q"><button aria-label="Menos">−</button><span>'+q+'</span><button aria-label="Mais">+</button></div>';
    li.children[0].textContent=x.n;li.children[1].textContent=brl(q*x.p);
    var b=li.querySelectorAll('button');b[0].setAttribute('aria-label','Diminuir '+x.n);b[1].setAttribute('aria-label','Aumentar '+x.n);
    b[0].onclick=function(){cart[x.id]--;if(cart[x.id]<1)delete cart[x.id];sync()};
    b[1].onclick=function(){add(x.id)};
    ul.appendChild(li)});
  $('badge').textContent=n;$('total').textContent=brl(t);$('send').disabled=!n;$('cartBtn').setAttribute('aria-label','Abrir sacola ('+n+(n===1?' item':' itens')+')');
  save('emCart',JSON.stringify(cart));
  document.dispatchEvent(new CustomEvent('cart:sync',{detail:{n:n,t:t}}));
  if(open)toggle(true)}
document.addEventListener('cart:clear',function(){cart={};sync()});
var lastFocus=null;
function toggle(o){var d=$('drawer');if(o===!d.hidden)return;d.hidden=!o;$('veil').hidden=!o;lock(d,o);
  if(o){lastFocus=document.activeElement;$('closeCart').focus()}else if(lastFocus){lastFocus.focus();lastFocus=null}}
$('cartBtn').onclick=function(){toggle(true)};
$('closeCart').onclick=$('veil').onclick=function(){toggle(false)};
$('send').onclick=function(){
  var items=[];catalog.forEach(function(x){var q=cart[x.id];if(q)items.push({n:x.n,q:q,p:x.p})});
  if(window.EsquinaOrder)window.EsquinaOrder.send(items)};

/* Navegação e busca */
function setCat(c,keep){if(c==='outros'){location.href='/produtos?ordem=az';return}homePage=1;cat=c;if(!keep)subF=null;
  [].forEach.call(document.querySelectorAll('#nav button'),function(x){x.classList.toggle('on',x.dataset.cat===c&&c!=='todos'?true:(c==='todos'&&x.textContent.trim()==='Início'))});
  [].forEach.call($('chips').children,function(x){x.classList.toggle('is-active',x.dataset.cat===c);x.setAttribute('aria-pressed',String(x.dataset.cat===c))});
  var on=document.querySelector('#nav button.on');if(on&&on.scrollIntoView)on.scrollIntoView({inline:'center',block:'nearest'});
  render()}
$('nav').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.textContent.trim().indexOf('Início')===0){location.href='/#inicio';return}setCat(b.dataset.cat);document.getElementById('cardapio').scrollIntoView()});
$('chips').addEventListener('click',function(e){var b=e.target.closest('button');if(b)setCat(b.dataset.cat)});
$('facets').addEventListener('click',function(e){homePage=1;var b=e.target.closest('button');if(!b||b.dataset.i==null)return;var sb=(SUBS[cat]||[])[+b.dataset.i];if(!sb)return;subF=(subF&&subF.label===sb[0])?null:{label:sb[0],t:sb[1]};render()});
$('sort').addEventListener('change',function(){sortBy=this.value;homePage=1;render()});
var qt;$('q').addEventListener('input',function(){var v=this.value;clearTimeout(qt);qt=setTimeout(function(){term=v;homePage=1;render()},120)});

/* Painel lateral de filtros persistente na home */
(function(){
 var panel=$('homeFilter'),toggle=$('homeFilterToggle'),close=$('homeFilterClose'),veil=$('homeFilterVeil'),cats=$('homeFilterCats'),prices=$('homeFilterPrices'),search=$('homeFilterSearch');if(!panel||!toggle)return;
 function open(on){panel.classList.toggle('is-open',on);panel.setAttribute('aria-hidden',on?'false':'true');toggle.setAttribute('aria-expanded',on?'true':'false');toggle.setAttribute('aria-label',on?'Fechar filtros':'Abrir filtros');veil.hidden=!on;if(on){search.value=$('q').value;search.focus()}}
 function draw(){cats.textContent='';[['todos','Todos'],['promo','Promoções'],['bebidas','Bebidas'],['narguile','Narguile'],['headshop','Headshop'],['tabacos','Cigarros e Tabacos']].forEach(function(c){var b=document.createElement('button');b.type='button';b.className='feat-chip'+(cat===c[0]?' is-active':'')+(c[0]==='promo'?' is-warn':'');b.setAttribute('aria-pressed',String(cat===c[0]));b.textContent=c[1];b.onclick=function(){setCat(c[0]);homePage=1;draw()};cats.appendChild(b)});
 prices.textContent='';PR.forEach(function(r,i){var b=document.createElement('button');b.type='button';b.className='feat-chip'+(sel['p:'+i]?' is-active':'');b.textContent=r[0];b.onclick=function(){Object.keys(sel).forEach(function(k){if(k.indexOf('p:')===0)delete sel[k]});if(!b.classList.contains('is-active'))sel['p:'+i]=true;homePage=1;render();draw()};prices.appendChild(b)})}
 toggle.addEventListener('click',function(){open(!panel.classList.contains('is-open'))});close.addEventListener('click',function(){open(false)});veil.addEventListener('click',function(){open(false)});document.addEventListener('keydown',function(e){if(e.key==='Escape')open(false)});
 search.addEventListener('input',function(){ $('q').value=this.value;term=this.value;homePage=1;render() });
 $('homeFilterClear').addEventListener('click',function(){sel={};subF=null;cat='todos';term='';$('q').value='';search.value='';homePage=1;setCat('todos');render();draw()});
 draw();
})();

/* Auto-preenchimento da busca do topo: sugere produtos pelas iniciais (tolera erro de digitacao e entende "ipa ate 9") */
(function(){
  var q=$('q'),box=document.createElement('ul'),items=[],act=-1,total=0;
  box.id='sug';box.className='sug';box.setAttribute('role','listbox');box.hidden=true;q.parentNode.appendChild(box);
  q.setAttribute('role','combobox');q.setAttribute('aria-autocomplete','list');q.setAttribute('aria-controls','sug');q.setAttribute('aria-expanded','false');
  function rank(x,t){var s=norm(x.n);if(s.indexOf(t)===0)return 0;if(s.replace(/^(cerveja|aperitivo|barril de cerveja|bebida mista)\s+/,'').indexOf(t)===0)return 1;
    if(wordsOf(x).some(function(w){return w.indexOf(t)===0}))return 2;return s.indexOf(t)>-1?3:4}
  function nw(x){return x._nw||(x._nw=norm(x.n).split(/[^a-z0-9]+/).filter(Boolean))}
  function find(v){var p=parseTerm(v);if(!p.w.length&&p.mx==null&&p.mn==null)return{list:[],t:''};var last=p.w[p.w.length-1]||'';
    var l=catalog.filter(function(x){return(p.mx==null||x.p<=p.mx)&&(p.mn==null||x.p>=p.mn)&&p.w.every(function(t){return tokenMatch(t,nw(x))})});
    l=l.map(function(x,i){return{x:x,r:last?rank(x,last):0,i:i}}).sort(function(a,b){return a.r-b.r||a.i-b.i}).map(function(o){return o.x});
    return{list:l,t:last}}
  function close(){box.hidden=true;q.setAttribute('aria-expanded','false');q.removeAttribute('aria-activedescendant');act=-1}
  function mark(el,name,t){var k=t?norm(name).indexOf(t):-1;if(k<0){el.textContent=name;return}
    el.appendChild(document.createTextNode(name.slice(0,k)));var m=document.createElement('mark');m.textContent=name.slice(k,k+t.length);el.appendChild(m);el.appendChild(document.createTextNode(name.slice(k+t.length)))}
  function go(){var t=document.querySelector('.top'),sbt=$('searchBtn');if(t)t.classList.remove('is-search');if(sbt)sbt.setAttribute('aria-expanded','false');var el=document.getElementById('cardapio');if(el)el.scrollIntoView()}
  function pick(k){var o=items[k];if(!o)return;
    if(o.more){term=q.value;sel={};close();render();go();return}
    q.value=o.x.n;term=o.x.n;sel={};close();if(cat!=='todos')setCat('todos');else render();go()}
  function show(){var r=find(q.value);box.textContent='';items=[];act=-1;total=r.list.length;
    if(!q.value.trim()){close();return}
    r.list.slice(0,6).forEach(function(x){items.push({x:x})});
    if(!items.length){var n=document.createElement('li');n.className='sug__empty';n.textContent='Nenhum produto encontrado';box.appendChild(n);box.hidden=false;q.setAttribute('aria-expanded','true');return}
    if(total>6)items.push({more:1});
    items.forEach(function(o,k){var li=document.createElement('li');li.id='sug'+k;li.setAttribute('role','option');li.className='sug__i'+(o.more?' sug__more':'');li.dataset.k=k;
      if(o.more){li.textContent='Ver todos os '+total+' resultados →'}
      else{var im=document.createElement('img');im.src=o.x.img||'assets/logo.webp';im.alt='';im.width=40;im.height=40;im.loading='lazy';li.appendChild(im);
        var tx=document.createElement('span');tx.className='sug__n';var nm=document.createElement('span');mark(nm,o.x.n,r.t);tx.appendChild(nm);var sm=document.createElement('small');sm.textContent=names[o.x.cat];tx.appendChild(sm);li.appendChild(tx);
        var pr=document.createElement('b');pr.textContent=brl(o.x.p);li.appendChild(pr)}
      box.appendChild(li)});
    box.hidden=false;q.setAttribute('aria-expanded','true')}
  function setAct(k){var all=box.querySelectorAll('.sug__i');if(!all.length)return;act=(k+all.length)%all.length;
    [].forEach.call(all,function(e,i){e.classList.toggle('is-act',i===act);e.setAttribute('aria-selected',i===act?'true':'false')});q.setAttribute('aria-activedescendant','sug'+act);all[act].scrollIntoView({block:'nearest'})}
  q.addEventListener('input',show);q.addEventListener('focus',function(){if(q.value.trim())show()});
  q.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'){if(box.hidden)show();setAct(act+1);e.preventDefault()}
    else if(e.key==='ArrowUp'){setAct(act-1);e.preventDefault()}
    else if(e.key==='Enter'){e.preventDefault();if(!box.hidden&&act>-1)pick(act);else{term=q.value;sel={};close();render();go()}}
    else if(e.key==='Escape'){close()}});
  box.addEventListener('mousedown',function(e){e.preventDefault()});
  box.addEventListener('click',function(e){var li=e.target.closest('.sug__i');if(li)pick(+li.dataset.k)});
  document.addEventListener('click',function(e){if(!e.target.closest('.search'))close()});
  q.addEventListener('blur',function(){setTimeout(close,120)});
})();

/* Menu suspenso flutuante (hover no desktop, toque no celular) com entrada em cascata */
(function(){
  var nav=$('nav'),m=document.createElement('div'),ul=document.createElement('ul'),cur=null,tm,
      touch=function(){return window.matchMedia('(hover:none)').matches};
  m.id='mega';m.className='mega';m.hidden=true;m.setAttribute('role','menu');ul.className='mega__list';m.appendChild(ul);document.body.appendChild(m);
  [].forEach.call(nav.querySelectorAll('button[data-cat]'),function(b){if(SUBS[b.dataset.cat]){b.classList.add('has-sub');b.setAttribute('aria-haspopup','true');b.setAttribute('aria-expanded','false')}});
  function close(){clearTimeout(tm);if(cur)cur.setAttribute('aria-expanded','false');cur=null;m.hidden=true}
  function later(){clearTimeout(tm);tm=setTimeout(close,220)}
  function place(b){var r=b.getBoundingClientRect(),w=m.offsetWidth;m.style.left=Math.max(8,Math.min(r.left,window.innerWidth-w-8))+'px';m.style.top=r.bottom+'px';m.style.maxHeight=Math.max(160,window.innerHeight-r.bottom-12)+'px'}
  function go(c,sub){close();subF=sub?{label:sub[0],t:sub[1]}:null;setCat(c,true);var el=document.getElementById('cardapio');if(el)el.scrollIntoView()}
  function open(b){clearTimeout(tm);if(cur===b&&!m.hidden)return;close();cur=b;var c=b.dataset.cat,list=SUBS[c];ul.textContent='';
    var add=function(label,fn,cls,i){var li=document.createElement('li');li.setAttribute('role','none');var a=document.createElement('button');a.type='button';a.setAttribute('role','menuitem');a.className='mega__i'+(cls?' '+cls:'');a.style.setProperty('--i',i);a.textContent=label;a.onclick=fn;li.appendChild(a);ul.appendChild(li)};
    add('Ver tudo em '+names[c],function(){go(c,null)},'mega__all',0);
    list.forEach(function(sb,i){add(sb[0],function(){go(c,sb)},'',i+1)});
    m.classList.toggle('cols',list.length>6&&window.innerWidth>=640);m.hidden=false;place(b);b.setAttribute('aria-expanded','true')}
  nav.addEventListener('mouseover',function(e){if(touch())return;var b=e.target.closest('button');if(!b)return;clearTimeout(tm);
    if(b.classList.contains('has-sub'))tm=setTimeout(function(){open(b)},70);else later()});
  nav.addEventListener('mouseleave',function(){if(!touch())later()});
  m.addEventListener('mouseenter',function(){clearTimeout(tm)});m.addEventListener('mouseleave',function(){if(!touch())later()});
  nav.addEventListener('click',function(e){var b=e.target.closest('button.has-sub');if(!b||!touch())return;e.stopPropagation();if(cur===b&&!m.hidden)close();else open(b)},true);
  nav.addEventListener('click',function(){close()});
  nav.addEventListener('keydown',function(e){var b=e.target.closest('button.has-sub');if(b&&e.key==='ArrowDown'){e.preventDefault();open(b);var f=ul.querySelector('button');if(f)f.focus()}else if(e.key==='Escape')close()});
  m.addEventListener('keydown',function(e){var all=[].slice.call(ul.querySelectorAll('button')),i=all.indexOf(document.activeElement);
    if(e.key==='ArrowDown'){e.preventDefault();all[(i+1)%all.length].focus()}else if(e.key==='ArrowUp'){e.preventDefault();all[(i-1+all.length)%all.length].focus()}
    else if(e.key==='Escape'||e.key==='Tab'){var b=cur;close();if(b&&e.key==='Escape')b.focus()}});
  document.addEventListener('click',function(e){if(!m.contains(e.target)&&!nav.contains(e.target))close()});
  window.addEventListener('scroll',function(){if(!m.hidden)close()},{passive:true});nav.addEventListener('scroll',close,{passive:true});window.addEventListener('resize',close);
})();

/* Menu do topo: se as opcoes nao couberem na linha, reduz a fonte (e tudo que usa em) ate caberem */
(function(){
  var nav=$('nav'),raf;
  function fit(){nav.style.removeProperty('--nf');var f=parseFloat(getComputedStyle(nav.firstElementChild).fontSize),n=0;
    while(nav.scrollWidth>nav.clientWidth+0.5&&f>5.5&&n++<80){f-=0.25;nav.style.setProperty('--nf',f+'px')}}
  function sched(){cancelAnimationFrame(raf);raf=requestAnimationFrame(fit)}
  window.addEventListener('resize',sched);window.addEventListener('orientationchange',sched);window.addEventListener('load',sched);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(sched);sched();
})();

/* Cabecalho mobile: busca em linha propria (icone) e menu de categorias em tela cheia (hamburguer) */
(function(){
  var top=document.querySelector('.top'),sb=$('searchBtn'),mb=$('menuBtn'),mq=window.matchMedia('(max-width:1024.98px)'),dr,last=null;
  function node(tag,cls,txt){var n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n}
  function searchRow(on){top.classList.toggle('is-search',on);sb.setAttribute('aria-expanded',on?'true':'false');if(on)$('q').focus();else $('q').blur()}
  sb.addEventListener('click',function(){searchRow(!top.classList.contains('is-search'))});
  $('q').addEventListener('keydown',function(e){if(e.key==='Escape'&&mq.matches&&top.classList.contains('is-search'))searchRow(false)});
  /* menu em tela cheia */
  dr=node('aside','mnav');dr.id='mnav';dr.setAttribute('role','dialog');dr.setAttribute('aria-modal','true');dr.setAttribute('aria-label','Menu de categorias');dr.setAttribute('aria-hidden','true');
  var hd=node('div','mnav__top'),lg=node('img');lg.src='assets/logo.webp';lg.alt='';lg.width=48;lg.height=48;hd.appendChild(lg);hd.appendChild(node('strong','','Menu'));
  var x=node('button','mnav__x','✕');x.type='button';x.setAttribute('aria-label','Fechar menu');hd.appendChild(x);dr.appendChild(hd);
  var ul=node('ul','mnav__list');dr.appendChild(ul);
  function go(c,sub){close();subF=sub?{label:sub[0],t:sub[1]}:null;setCat(c,true);var el=document.getElementById('cardapio');if(el)el.scrollIntoView()}
  [].forEach.call($('nav').querySelectorAll('button[data-cat]'),function(b){
    var c=b.dataset.cat,subs=SUBS[c],li=node('li'),a=node('button','mnav__a');a.type='button';
    a.appendChild(node('span','',b.firstChild.textContent.trim()));var tg=b.querySelector('.tag');if(tg)a.appendChild(tg.cloneNode(true));
    li.appendChild(a);if(b.firstChild.textContent.trim()==='Início')a.dataset.home='1';
    if(subs){var sl=node('ul','mnav__sub');sl.hidden=true;a.setAttribute('aria-expanded','false');a.appendChild(node('span','chev','▾'));
      var add=function(t,cls,fn){var l=node('li'),bt=node('button',cls,t);bt.type='button';bt.onclick=fn;l.appendChild(bt);sl.appendChild(l)};
      add('Ver tudo em '+names[c],'all',function(){go(c,null)});subs.forEach(function(sbi){add(sbi[0],'',function(){go(c,sbi)})});li.appendChild(sl);
      a.onclick=function(){var open=a.getAttribute('aria-expanded')==='true';[].forEach.call(ul.querySelectorAll('.mnav__a[aria-expanded]'),function(o){o.setAttribute('aria-expanded','false');o.parentNode.querySelector('.mnav__sub').hidden=true});
        if(!open){a.setAttribute('aria-expanded','true');sl.hidden=false;a.scrollIntoView({block:'nearest'})}}}
    else a.onclick=function(){if(a.dataset.home){location.href='/#inicio';return}go(c,null)};
    ul.appendChild(li)});
  document.body.appendChild(dr);
  function openD(){if(dr.classList.contains('is-open'))return;last=document.activeElement;dr.classList.add('is-open');dr.setAttribute('aria-hidden','false');mb.setAttribute('aria-expanded','true');lock(dr,true);setTimeout(function(){x.focus()},50)}
  function close(){if(!dr.classList.contains('is-open'))return;dr.classList.remove('is-open');dr.setAttribute('aria-hidden','true');mb.setAttribute('aria-expanded','false');lock(dr,false);if(last&&last.focus)last.focus()}
  mb.addEventListener('click',openD);x.addEventListener('click',close);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
  var chg=function(){if(!mq.matches){close();top.classList.remove('is-search');sb.setAttribute('aria-expanded','false')}};
  if(mq.addEventListener)mq.addEventListener('change',chg);else mq.addListener(chg);
})();

/* Convite para instalar o app: Android/Chrome/Edge usam o botao nativo; iPhone/iPad mostram o passo a passo "Adicionar a Tela de Inicio" */
(function(){
  var KEY='esquinaMixInstall',DIAS=7,dp=null,el=null,shown=false,tm,
      ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),
      standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
  if(standalone)return;
  var snooze=function(d){save(KEY,String(Date.now()+d*864e5))},muted=function(){var t=+load(KEY);return !!t&&Date.now()<t};
  function hide(){if(el){el.remove();el=null}}
  function schedule(ms){clearTimeout(tm);tm=setTimeout(maybe,ms)}
  function node(tag,cls,txt){var n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n}
  function maybe(){if(shown||muted()||!gate.hidden||(!dp&&!ios))return;shown=true;
    el=node('div','pwa');el.setAttribute('role','dialog');el.setAttribute('aria-label','Instalar aplicativo');
    var ic=node('img','pwa__ic');ic.src='assets/icon-192.png';ic.alt='';ic.width=48;ic.height=48;el.appendChild(ic);
    var tx=node('div','pwa__tx');tx.appendChild(node('strong','','Instale o app da Esquina Mix'));tx.appendChild(node('span','',ios?'Adicione à tela inicial e peça mais rápido, sem digitar o endereço.':'Abra direto da tela inicial do seu aparelho e peça mais rápido.'));
    var steps=null;if(ios){steps=node('ol','pwa__st');steps.hidden=true;['Toque em Compartilhar (o quadrado com a seta para cima) na barra do navegador.','Role a lista e toque em “Adicionar à Tela de Início”.','Toque em “Adicionar”. Pronto!'].forEach(function(t){steps.appendChild(node('li','',t))});tx.appendChild(steps)}
    el.appendChild(tx);
    var ac=node('div','pwa__ac'),go=node('button','pwa__go',ios?'Como instalar':'Instalar');go.type='button';
    go.onclick=function(){if(ios){steps.hidden=!steps.hidden;go.textContent=steps.hidden?'Como instalar':'Entendi';if(steps.hidden){snooze(30);hide()}return}
      if(!dp)return;dp.prompt();dp.userChoice.then(function(c){dp=null;snooze(c&&c.outcome==='accepted'?365:DIAS);hide()},function(){hide()})};
    var no=node('button','pwa__x','Agora não');no.type='button';no.onclick=function(){snooze(DIAS);hide()};
    ac.appendChild(go);ac.appendChild(no);el.appendChild(ac);document.body.appendChild(el)}
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();dp=e;schedule(4000)});
  window.addEventListener('appinstalled',function(){snooze(365);hide()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&el){snooze(DIAS);hide()}});
  $('yes').addEventListener('click',function(){schedule(6000)});
  if(gate.hidden&&ios)schedule(7000);
})();
document.addEventListener('keydown',function(e){if(e.key==='Escape')toggle(false)});

/* Ranking, marcas e avaliações — EDITE os dados abaixo */
var topIds=[1,2,4,5,3,6,9,10];
var brands=[{n:'Girls in Green',f:'girls-in-green'},{n:'Papelito',f:'papelito'},{n:'Smoking',f:'smoking'},{n:'ZGY Brasil',f:'zgy-brasil'},{n:'Zomo',f:'zomo'},{n:'OCB',f:'ocb'},{n:'Pay-Pay',f:'pay-pay'},{n:'Sadhu',f:'sadhu'}];
/* Avaliações reais do Google (adicione novas no início: {n:'Nome',t:'há 1 semana',x:'Texto da avaliação'}) */
var reviews=[
{n:'Sabrina Duque',t:'Uma semana atrás',x:'Sempre tem tudo que a gente procura, de bebida e tabacaria, eu amo!!!!'},
{n:'Ulisses Gomes',t:'Uma semana atrás',x:'Cerveja muito gelada, e ótimos produtos de tabacaria'},
{n:'Leo Batista',t:'Há 2 semanas',x:'A melhor que existe, sou cliente a muitos anos, os proprietários são sensacionais e merecem todo o sucesso do mundo!!'}
];
(function(){
  var tr=$('rankTrack');
  topIds.forEach(function(id,i){var x=catalog.filter(function(c){return c.id===id})[0];if(!x)return;
    var a=document.createElement('button');a.className='rank-card';
    a.innerHTML='<b class="rank-n"></b><img src="assets/logo.webp" alt="" width="64" height="64" loading="lazy"><span class="rank-i"><small></small><strong></strong><em></em></span>';
    a.querySelector('.rank-n').textContent=('0'+(i+1)).slice(-2);a.querySelector('small').textContent=names[x.cat];
    a.querySelector('strong').textContent=x.n;a.querySelector('em').textContent=brl(x.p);
    a.setAttribute('aria-label','Adicionar '+x.n+' à sacola');a.onclick=function(){add(x.id)};tr.appendChild(a)});
  var d=0,sx=0,sl=0;
  tr.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse')return;d=1;sx=e.clientX;sl=tr.scrollLeft;tr.classList.add('is-grabbing')});
  window.addEventListener('pointermove',function(e){if(d)tr.scrollLeft=sl-(e.clientX-sx)});
  window.addEventListener('pointerup',function(){d=0;tr.classList.remove('is-grabbing')});
  var bt=$('brandsT');brands.forEach(function(b){var s=document.createElement('span');s.className='fleet__i fleet__i--'+b.f;var im=document.createElement('img');im.src='assets/marcas/'+b.f+'.webp';im.alt=b.n;im.decoding='async';s.appendChild(im);bt.appendChild(s)});
  /* letreiros: deslizam para a esquerda em loop contínuo; pausam com mouse/toque */
  function slide(track){var box=track.parentNode,base=[].slice.call(track.children),w=track.getBoundingClientRect().width||1,
    reps=Math.max(1,Math.ceil(Math.max(window.innerWidth,box.offsetWidth)/w)),f=document.createDocumentFragment();
    for(var i=1;i<reps;i++)base.forEach(function(k){f.appendChild(k.cloneNode(true))});
    track.appendChild(f);
    [].slice.call(track.children).forEach(function(k,i){if(i>=base.length)k.setAttribute('aria-hidden','true')});
    var all=[].slice.call(track.children);f=document.createDocumentFragment();
    all.forEach(function(k){var c=k.cloneNode(true);c.setAttribute('aria-hidden','true');f.appendChild(c)});
    track.appendChild(f);
    track.style.animationDuration=Math.max(12,track.getBoundingClientRect().width/2/70)+'s';
    box.addEventListener('touchstart',function(){track.classList.add('is-paused')},{passive:true});
    ['touchend','touchcancel'].forEach(function(ev){box.addEventListener(ev,function(){track.classList.remove('is-paused')},{passive:true})})}
  slide(document.querySelector('#mq .mq-t'));slide(bt);
  /* Google Reviews: carrossel automático em loop (mesmo motor dos letreiros: esquerda, contínuo, pausa com mouse/toque) */
  var rt=$('revT'),avc=['#1f8a57','#e7ab2f','#d6204f','#ec1ab5','#3ec8ff'];
  if(rt){
    if(!reviews.length){rt.innerHTML='<article class="rev-card"><p>Já pediu na Esquina Mix? Conte como foi a sua experiência no Google.</p></article>'}
    reviews.forEach(function(v,i){var c=document.createElement('article');c.className='rev-card';
      c.innerHTML='<header><span class="av" aria-hidden="true"></span><div><strong></strong><small></small></div></header><div class="st" role="img" aria-label="5 de 5 estrelas">★★★★★</div><p></p>';
      var av=c.querySelector('.av');av.textContent=v.n.charAt(0);av.style.background=avc[i%avc.length];
      c.querySelector('strong').textContent=v.n;c.querySelector('small').textContent=v.t;c.querySelector('p').textContent=v.x;rt.appendChild(c)});
    if(reviews.length)slide(rt);
  }
})();
/* Botoes flutuantes: WhatsApp (numero vem da meta esquina-whatsapp) e voltar ao topo */
(function(){
  var wa=$('waFab'),up=$('toTop'),mm=document.querySelector('meta[name="esquina-whatsapp"]'),num=((mm&&mm.content)||'').replace(/\D/g,'');
  if(wa&&num){
    wa.href='https://wa.me/'+num+'?text='+encodeURIComponent('Ol\u00e1! Vim pelo card\u00e1pio digital da Esquina Mix.');
    wa.addEventListener('click',function(e){
      var customer=window.EsquinaAuth&&window.EsquinaAuth.user;
      if(!customer||!customer.name)return;
      e.preventDefault();
      var message='Ol\u00e1! Sou '+customer.name+'. Vim pelo card\u00e1pio digital da Esquina Mix.';
      if(customer.cpfStatus)message+=' Status da conta: '+(customer.cpfStatus==='verified'?'verificada':'em valida\u00e7\u00e3o')+'.';
      window.open('https://wa.me/'+num+'?text='+encodeURIComponent(message),'_blank','noopener');
    });
  }
  if(!up)return;
  var on=false,busy=false;
  function upd(){busy=false;var s=(window.pageYOffset||document.documentElement.scrollTop||0)>400;if(s!==on){on=s;up.classList.toggle('is-on',s)}}
  window.addEventListener('scroll',function(){if(!busy){busy=true;requestAnimationFrame(upd)}},{passive:true});
  up.addEventListener('click',function(){
    var calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:0,behavior:calm?'auto':'smooth'})});
  upd();
})();
/* Rota até a loja: mapa embutido + tela cheia no celular/tablet (≤900px), atualizada a cada passo.
   Localização sob demanda (HTTPS). Este site não grava a posição; ela só vai ao Google Maps para desenhar a rota. */
(function(){
  var MAPS_KEY='', /* opcional: chave da Maps Embed API restrita por referrer (rota oficial com trânsito) */
      DEST='Adega e Tabacaria Esquina Mix, R. São Francisco, 285, Vila Galvão, Guarulhos - SP',
      ADDR='R. São Francisco, 285 – Vila Galvão, Guarulhos – SP, 07071-010',
      TO={lat:-23.4546859,lng:-46.5682857},
      FLG={driving:'d',walking:'w',bicycling:'b',transit:'r'},
      KMH={driving:28,walking:5,bicycling:15,transit:20},
      fr=$('mapFrame'),btn=$('routeBtn'),st=$('routeStatus'),lnk=$('routeOpen');
  if(!fr||!btn)return;
  var rm=$('rm'),rst=$('rmStatus'),rOpen=$('rmOpen'),
      org=$('dirOrigin'),mq=window.matchMedia('(max-width:900px)'),
      mode='driving',pos=null,acc=0,typed='',last=null,watch=null,busy=false,popping=false,opener=null;
  function say(t){st.textContent=t;rst.textContent=t}
  function dist(a,b){var r=Math.PI/180,R=6371e3,p=(b.lat-a.lat)*r,q=(b.lng-a.lng)*r,
    x=Math.sin(p/2)*Math.sin(p/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(q/2)*Math.sin(q/2);return 2*R*Math.asin(Math.sqrt(x))}
  function km(m){return m<1000?Math.round(m/10)*10+' m':(m/1000).toFixed(m<10000?1:0).replace('.',',')+' km'}
  function eta(m){var min=Math.max(1,Math.round(m*1.3/1000/KMH[mode]*60));return min<60?min+' min':Math.floor(min/60)+' h '+('0'+min%60).slice(-2)+' min'}
  function stats(){
    var d=pos&&!typed?dist(pos,TO):null;
    $('rmDist').textContent=d===null?'—':km(d);
    $('rmEta').textContent=d===null?'—':(d<30?'Chegou':'≈ '+eta(d));
    $('rmAcc').textContent=pos&&acc?'± '+Math.round(acc)+' m':'—';
    if(d!==null&&d<30)say('Você chegou à Esquina Mix! 🎉')}
  function src(){
    var o=typed?encodeURIComponent(typed):pos.lat.toFixed(6)+','+pos.lng.toFixed(6),d=encodeURIComponent(DEST);
    return{
      f:MAPS_KEY?'https://www.google.com/maps/embed/v1/directions?key='+encodeURIComponent(MAPS_KEY)+'&origin='+o+'&destination='+d+'&mode='+mode+'&language=pt-BR&region=BR'
        :'https://maps.google.com/maps?saddr='+o+'&daddr='+d+'&dirflg='+FLG[mode]+'&hl=pt-BR&output=embed',
      l:'https://www.google.com/maps/dir/?api=1&origin='+o+'&destination='+d+'&travelmode='+mode}}
  /* troca o iframe por um novo (mudar o src empilha histórico e o botão Voltar do celular andaria no mapa) */
  function setSrc(f,u){if(!f||f.dataset.u===u)return;var n=f.cloneNode(false);n.removeAttribute('loading');n.dataset.u=u;n.src=u;f.parentNode.replaceChild(n,f)}
  function draw(){
    if(!pos&&!typed)return;
    var s=src();setSrc($('mapFrame'),s.f);if(!rm.hidden)setSrc($('rmFrame'),s.f);
    lnk.href=s.l;lnk.hidden=false;rOpen.href=s.l;
    last={lat:pos?pos.lat:0,lng:pos?pos.lng:0,t:Date.now()}}
  function onPos(p){
    pos={lat:p.coords.latitude,lng:p.coords.longitude};acc=p.coords.accuracy||0;
    org.placeholder='Sua localização atual';stats();
    if(typed)return;
    var open=!rm.hidden,need=!last||(dist(pos,last)>(open?20:100)&&Date.now()-last.t>=(open?6000:30000));
    if(need){draw();if(!(pos&&dist(pos,TO)<30))say('Rota traçada a partir da sua posição (precisão ≈ '+Math.round(acc)+' m). Atualiza a cada passo em direção à loja.')}}
  function onErr(e){busy=false;btn.disabled=false;
    if(e&&e.code===1)org.placeholder='Localização não autorizada';
    say(e&&e.code===1?'Permissão de localização negada. Libere no cadeado do navegador e tente de novo, ou digite o ponto de partida.'
      :e&&e.code===3?'Tempo esgotado ao obter a localização. Tente novamente.':'Não foi possível determinar sua posição. Verifique o GPS e a internet.')}
  function watchStart(){if(watch===null)watch=navigator.geolocation.watchPosition(onPos,function(){},{enableHighAccuracy:true,maximumAge:2000,timeout:20000})}
  function ok(p){busy=false;btn.disabled=false;btn.textContent='Atualizar rota';last=null;typed='';onPos(p);watchStart()}
  function start(){
    if(busy)return;
    if(!navigator.geolocation){say('Seu navegador não oferece localização. Digite o ponto de partida.');return}
    busy=true;say('Obtendo a sua localização…');btn.disabled=true;
    navigator.geolocation.getCurrentPosition(ok,function(e){
      if(e&&e.code!==1)navigator.geolocation.getCurrentPosition(ok,onErr,{enableHighAccuracy:false,timeout:15000,maximumAge:60000});
      else onErr(e)},{enableHighAccuracy:true,timeout:12000,maximumAge:0})}
  function setMode(m){mode=m;
    [].forEach.call(document.querySelectorAll('.js-modes [data-mode]'),function(x){x.setAttribute('aria-pressed',x.dataset.mode===m?'true':'false')});
    stats();draw()}
  document.addEventListener('click',function(e){var b=e.target.closest('.js-modes [data-mode]');if(b)setMode(b.dataset.mode)});
  btn.onclick=start;
  /* Origem digitada */
  function useTyped(){var v=org.value.trim();if(!v)return start();typed=v;last=null;stats();draw();say('Rota traçada a partir de “'+v+'”.')}
  $('dirGo').onclick=useTyped;
  org.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();useTyped()}});
  $('dirLocate').onclick=function(){org.value='';typed='';last=null;if(pos){draw();stats()}start()};
  /* Copiar endereço */
  var tx=$('dirCopyTx'),txt0=tx.textContent,tm=0;
  function copied(okk){tx.textContent=okk?'Endereço copiado ✓':'Não foi possível copiar';clearTimeout(tm);tm=setTimeout(function(){tx.textContent=txt0},2200)}
  function copy(){
    if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(ADDR).then(function(){copied(1)},function(){copied(0)});
    var t=document.createElement('textarea');t.value=ADDR;t.setAttribute('readonly','');t.style.cssText='position:fixed;opacity:0';document.body.appendChild(t);t.select();
    var r=false;try{r=document.execCommand('copy')}catch(x){}document.body.removeChild(t);copied(r)}
  $('dirCopy').onclick=copy;tx.onclick=copy;
  /* Tela de rota (celular/tablet) */
  function openRm(from){
    opener=from||document.activeElement;rm.hidden=false;document.documentElement.classList.add('rm-open');
    try{history.pushState({rm:1},'')}catch(x){}
    $('rmClose').focus();stats();
    if(pos||typed){draw();setSrc($('rmFrame'),src().f)}else{setSrc($('rmFrame'),'https://maps.google.com/maps?q=R.+S%C3%A3o+Francisco,+285,+Vila+Galv%C3%A3o,+Guarulhos&output=embed');start()}}
  function closeRm(){
    if(rm.hidden)return;rm.hidden=true;document.documentElement.classList.remove('rm-open');
    if(!popping&&history.state&&history.state.rm)history.back();
    if(opener&&opener.focus)opener.focus()}
  $('rmClose').onclick=closeRm;
  $('rmRefresh').onclick=function(){last=null;if(typed){draw()}else if(pos){draw();start()}else start()};
  window.addEventListener('popstate',function(){if(!rm.hidden){popping=true;closeRm();popping=false}});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeRm()});
  document.addEventListener('click',function(e){
    var a=e.target.closest('[data-route-open]');if(!a)return;
    if(mq.matches){e.preventDefault();openRm(a);return}
    if(a.hasAttribute('data-route-keep'))return;
    e.preventDefault();start()});
  /* Automático ao chegar na seção do mapa; se o usuário liberar depois pelo cadeado, traça na hora */
  var sec=$('encontre'),armed=false;
  function arm(){if(armed)return;armed=true;start()}
  if(navigator.permissions&&navigator.permissions.query){
    navigator.permissions.query({name:'geolocation'}).then(function(perm){
      perm.onchange=function(){if(perm.state==='granted'&&armed)start()}}).catch(function(){})}
  if('IntersectionObserver' in window&&sec){
    var io=new IntersectionObserver(function(es){if(es[0].isIntersecting){io.disconnect();arm()}},{rootMargin:'200px'});io.observe(sec)}
  else arm();
  window.addEventListener('pagehide',function(){if(watch!==null)navigator.geolocation.clearWatch(watch)});
  /* Selo de horário do cartão */
  var dot=$('lcDot'),tt=$('lcTxt'),fmt=new Intl.DateTimeFormat('pt-BR',{hour:'numeric',hourCycle:'h23',timeZone:'America/Sao_Paulo'});
  function badge(){var h=parseInt(fmt.format(new Date()),10),o=h>=10||h<2;
    dot.className='dot '+(o?'is-open':'is-closed');tt.textContent=o?'Aberto agora • fecha às 02h00':'Fechado agora • abre às 10h00'}
  badge();setInterval(badge,60000);
})();
/* Barra do topo: some ao rolar para baixo e volta ao rolar para cima (também no celular) */
(function(){
  var bar=$('bar');if(!bar)return;
  var lastY=window.pageYOffset||0,ticking=false,hold=0,hidden=false;
  function show(){if(hidden){hidden=false;bar.classList.remove('is-hidden')}}
  function hide(){if(!hidden){hidden=true;bar.classList.add('is-hidden')}}
  /* não esconde: logo após clicar no menu/adicionar item, com sacola ou gate abertos, ou com a busca em foco */
  function blocked(){return Date.now()<hold||document.body.style.overflow==='hidden'||document.activeElement===$('q')}
  function update(){
    ticking=false;
    var y=Math.max(0,window.pageYOffset||0),d=y-lastY;
    if(y<=bar.offsetHeight){show();lastY=y;return}
    if(Math.abs(d)<8)return;
    lastY=y;
    if(d<0)show();else if(!blocked())hide()}
  window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(update)}},{passive:true});
  bar.addEventListener('focusin',show);
  $('nav').addEventListener('click',function(){hold=Date.now()+900;show()});
  document.addEventListener('cart:add',function(){hold=Date.now()+1500;show()});
  document.addEventListener('bar:hold',function(){hold=Date.now()+1500;show()});
})();
/* Altura da barra fixa -> offset de rolagem das âncoras */
(function(){var b=$('bar');if(!b)return;function set(){document.documentElement.style.setProperty('--bar-h',b.offsetHeight+'px')}set();if(window.ResizeObserver)new ResizeObserver(set).observe(b);else window.addEventListener('resize',set)})();
/* Status da loja (horário de Brasília): aberto das OPEN às CLOSE, virando a meia-noite.
   O relógio HH:MM:SS anda a cada segundo; o status é rechecado a cada virada de minuto (e no 1º segundo). */
(function(){
  var OPEN=10,CLOSE=2,dot=$('shopDot'),txt=$('shopTxt'),tr=$('shopTrust'),clk=$('shopClockTx');
  if(!dot||!txt)return;
  var fmt=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:'America/Sao_Paulo'}),
      hh=function(n){return ('0'+n).slice(-2)+':00'},lastMin=-1;
  function paint(h){
    var open=h>=OPEN||h<CLOSE;
    dot.className='dot '+(open?'is-open':'is-closed');
    txt.textContent=open?'Esquina-Mix aberta • Fecha às '+hh(CLOSE):'Esquina-Mix fechada • Abre às '+hh(OPEN);
    if(tr)tr.textContent=open?'Esquina-Mix aberta':'Esquina-Mix fechada'}
  function tick(){
    var o={};fmt.formatToParts(new Date()).forEach(function(p){o[p.type]=p.value});
    var t=o.hour+':'+o.minute+':'+o.second;
    if(clk){clk.textContent=t;clk.setAttribute('datetime',t)}
    if(o.minute!==lastMin){lastMin=o.minute;paint(parseInt(o.hour,10))}}
  tick();
  /* alinha o intervalo à virada do segundo para o relógio não "pular" */
  setTimeout(function(){tick();setInterval(tick,1000)},1000-(Date.now()%1000));
  document.addEventListener('visibilitychange',function(){if(!document.hidden)tick()});
})();
render();sync();
})();


/* Barra flutuante inferior (celulares): início, busca, como chegar, WhatsApp e produtos */
(function(){
  var bar=document.getElementById('mbar');if(!bar)return;
  var mq=window.matchMedia('(max-width:820px)'),items=bar.querySelectorAll('[data-k]'),
      top=document.querySelector('.top'),sb=document.getElementById('searchBtn'),raf=0;
  var calm=function(){return window.matchMedia('(prefers-reduced-motion:reduce)').matches};
  function searchOpen(){return !!(top&&top.classList.contains('is-search'))}
  function paint(){raf=0;if(!mq.matches)return;
    var y=window.pageYOffset||document.documentElement.scrollTop||0,c=document.getElementById('cardapio'),k='';
    if(searchOpen())k='search';
    else if(y<200)k='home';
    else if(c){var r=c.getBoundingClientRect();if(r.top<window.innerHeight*.6&&r.bottom>window.innerHeight*.25)k='products'}
    [].forEach.call(items,function(b){var on=b.dataset.k===k;b.classList.toggle('is-active',on);if(on)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
    var s=bar.querySelector('[data-act="search"]');if(s)s.setAttribute('aria-expanded',searchOpen()?'true':'false')}
  function req(){if(!raf)raf=requestAnimationFrame(paint)}
  bar.addEventListener('click',function(e){
    var b=e.target.closest('[data-act]');if(!b)return;
    if(b.dataset.act==='home'){e.preventDefault();if(searchOpen()&&sb)sb.click();window.scrollTo({top:0,behavior:calm()?'auto':'smooth'})}
    else if(b.dataset.act==='search'){e.preventDefault();if(sb)sb.click()}});
  window.addEventListener('scroll',req,{passive:true});window.addEventListener('resize',req);
  if(top&&window.MutationObserver)new MutationObserver(req).observe(top,{attributes:true,attributeFilter:['class']});
  /* esconde a barra enquanto o teclado está aberto (campos de texto) */
  document.addEventListener('focusin',function(e){if(mq.matches&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))bar.classList.add('is-kb')});
  document.addEventListener('focusout',function(){setTimeout(function(){var a=document.activeElement;if(!a||!/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))bar.classList.remove('is-kb')},60)});
  paint();
})();

/* Hero: carrossel automático (slide cardápio + slide promo), troca a cada 10s */
(function(){
  var root=document.getElementById('heroSlider');if(!root)return;
  var slides=[].slice.call(root.querySelectorAll('.hero-slide'));
  var dots=[].slice.call(root.querySelectorAll('.hero-dot'));
  if(slides.length<2)return;
  var INTERVAL=10000,i=0,timer=0;
  function go(n){
    if(n===i)return;
    slides[i].classList.remove('is-active');slides[i].setAttribute('aria-hidden','true');
    if(dots[i]){dots[i].classList.remove('is-active');dots[i].setAttribute('aria-selected','false')}
    i=n;
    slides[i].classList.add('is-active');slides[i].removeAttribute('aria-hidden');
    if(dots[i]){dots[i].classList.add('is-active');dots[i].setAttribute('aria-selected','true')}
  }
  function next(){go((i+1)%slides.length)}
  function start(){stop();timer=setInterval(next,INTERVAL)}
  function stop(){if(timer){clearInterval(timer);timer=0}}
  dots.forEach(function(d){d.addEventListener('click',function(){
    var n=parseInt(d.dataset.goto,10);if(!isNaN(n)){go(n);start()}
  })});
  document.addEventListener('visibilitychange',function(){
    if(document.hidden)stop();else start()
  });
  start();
})();


/* Neon da marca: intensidade e brilho reagem à proximidade do mouse (só apresentação) */
(function(){
'use strict';
var bt=document.querySelector('.brand-t');
if(!bt||!window.matchMedia||!matchMedia('(hover:hover)').matches||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
var raf=0,px=0,py=0;
function paint(){
  raf=0;
  var r=bt.getBoundingClientRect();if(!r.width)return;
  var cx=r.left+r.width/2,cy=r.top+r.height/2,d=Math.hypot(px-cx,py-cy);
  bt.style.setProperty('--k',Math.max(0,Math.min(1,1-d/420)).toFixed(3));
}
window.addEventListener('pointermove',function(e){px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(paint)},{passive:true});
document.addEventListener('pointerleave',function(){bt.style.setProperty('--k','.3')});
})();

/* Âncora #cardapio: posiciona o título "// cardápio digital" logo abaixo da barra fixa, mesmo vindo de outra página
   (produtos.html → "Voltar ao cardápio"). Reajusta enquanto imagens/fontes carregam, até o usuário rolar por conta própria. */
(function(){
  var calm=function(){return window.matchMedia('(prefers-reduced-motion:reduce)').matches},user=false,tries=0;
  function goCardapio(smooth){
    var el=document.getElementById('cardapio'),bar=document.getElementById('bar');if(!el)return;
    document.dispatchEvent(new Event('bar:hold'));
    var bh=bar?bar.offsetHeight:0,y=el.getBoundingClientRect().top+(window.pageYOffset||0)-bh-6;
    window.scrollTo({top:Math.max(0,Math.round(y)),behavior:smooth&&!calm()?'smooth':'auto'})}
  function settle(){if(user||location.hash!=='#cardapio'||tries++>6)return;
    var el=document.getElementById('cardapio'),bar=document.getElementById('bar');if(!el)return;
    var want=el.getBoundingClientRect().top-(bar?bar.offsetHeight:0)-6;
    if(Math.abs(want)>3)goCardapio(false)}
  ['wheel','touchstart','keydown','mousedown'].forEach(function(ev){window.addEventListener(ev,function(){user=true},{passive:true,once:true})});
  if(location.hash==='#cardapio'){
    if('scrollRestoration' in history)history.scrollRestoration='manual';
    [0,250,700,1500].forEach(function(ms){setTimeout(settle,ms)});
    window.addEventListener('load',settle);
    document.addEventListener('esquina:preloader-done',settle);
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(settle)}
  /* cliques em links internos para #cardapio (banner, "Pular para o cardápio", rodapé…) */
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href="#cardapio"]');if(!a||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey)return;
    e.preventDefault();user=true;goCardapio(true);try{history.replaceState(null,'','#cardapio')}catch(x){}});
})();

