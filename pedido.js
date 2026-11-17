(function(){
'use strict';
/* Pedido pelo WhatsApp — módulo compartilhado pela home (app.js) e por produtos.html (produtos.js).
   • Telefone (obrigatório), forma de pagamento e troco (quando for dinheiro)
   • Botão "Limpar sacola" (a sacola em si pertence a cada página; aqui só pedimos para limpar via evento "cart:clear")
   • Mensagem no formato de comanda de restaurante
   As páginas avisam este módulo a cada mudança da sacola com o evento "cart:sync" ({n: itens, t: total})
   e chamam EsquinaOrder.send([{n:nome,q:quantidade,p:preço}, ...]) ao tocar em "Enviar pedido pelo WhatsApp". */
var $=function(i){return document.getElementById(i)};
var save=function(k,v){try{localStorage.setItem(k,v)}catch(e){}};
var load=function(k){try{return localStorage.getItem(k)}catch(e){return null}};
var brl=function(v){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})};
var r2=function(v){return Math.round(v*100)/100};
var PHONE_RE=/^[1-9][0-9][2-9][0-9]{7,8}$/;
var KP='emPhone',KN='emName';
var st={pay:'',change:'',phoneTouched:false,nameTouched:false,addressMode:'saved',total:0,count:0};

/* ---------- telefone ---------- */
function phoneDigits(v){var d=String(v||'').replace(/\D/g,'');if(d.indexOf('55')===0&&d.length>11)d=d.slice(2);return d.slice(0,11)}
function maskPhone(v){var d=phoneDigits(v);if(!d)return '';if(d.length<3)return '('+d;var r=d.slice(2),n=d.length>10?5:4;return '('+d.slice(0,2)+') '+r.slice(0,n)+(r.length>n?'-'+r.slice(n):'')}
function user(){return window.EsquinaAuth&&window.EsquinaAuth.user||null}

/* ---------- nome do cliente ---------- */
function firstName(v){return String(v||'').trim().split(/\s+/)[0]||''}
function cleanName(v){return String(v||'').replace(/[\u0000-\u001f\u007f*_~`]/g,' ').replace(/\s+/g,' ').trim().slice(0,60)}
function nameOk(v){return v.length>=2&&/[A-Za-zÀ-ÿ]/.test(v)}
/* logado: mostra "Pedido de <primeiro nome>" e esconde o campo; visitante: campo de nome obrigatório */
function paintWho(){
  var u=user(),fn=u&&u.name?firstName(u.name):'',box=$('ckNameBox'),who=$('ckWho'),nm=$('ckWhoName');
  if(!box||!who)return;
  box.hidden=!!fn;who.hidden=!fn;
  if(nm)nm.textContent=fn;
  if(!fn){var el=$('ckName');if(el&&!st.nameTouched&&!el.value){var v=load(KN);if(v)el.value=v}}}
function custName(){var u=user(),fn=u&&u.name?firstName(u.name):'';return fn||cleanName($('ckName')&&$('ckName').value)}

/* ---------- valores em reais digitados pelo cliente ("50", "50,00", "R$ 1.050,50") ---------- */
function money(v){var s=String(v||'').replace(/[^\d.,]/g,'');if(!s)return null;
  if(s.indexOf(',')>-1)s=s.replace(/\./g,'').replace(',','.');else if(/\.\d{3}$/.test(s))s=s.replace(/\./g,'');
  var n=parseFloat(s);return isFinite(n)&&n>0?n:null}

/* ---------- mensagens de erro ---------- */
function clearErr(){[].forEach.call(document.querySelectorAll('#checkout .ck__err'),function(p){p.hidden=true;p.textContent=''});
  [].forEach.call(document.querySelectorAll('#checkout [aria-invalid]'),function(i){i.removeAttribute('aria-invalid')})}
function fail(errId,msg,focusEl){var p=$(errId);if(p){p.textContent=msg;p.hidden=false}
  if(focusEl){if(focusEl.tagName==='INPUT'&&focusEl.type!=='radio')focusEl.setAttribute('aria-invalid','true');
    try{focusEl.focus({preventScroll:true})}catch(e){focusEl.focus()}
    var box=focusEl.closest?(focusEl.closest('.ck__f')||focusEl):focusEl;if(box.scrollIntoView)box.scrollIntoView({block:'center',behavior:'smooth'})}}

/* ---------- interface do pagamento ---------- */
function paintCash(){
  var cash=st.pay==='Dinheiro';
  $('ckCash').hidden=!cash;
  $('ckChangeBox').hidden=!(cash&&st.change==='sim');
  var h=$('ckChangeHint');if(h)h.textContent='Total do pedido: '+brl(st.total)}
function resetCheckout(){
  st.pay='';st.change='';
  [].forEach.call(document.querySelectorAll('#checkout input[type=radio]'),function(r){r.checked=false});
  var c=$('ckChange');if(c)c.value='';
  clearErr();paintCash()}
function prefillPhone(){
  var el=$('ckPhone');if(!el||st.phoneTouched)return;
  var u=user(),v=(u&&u.phone)||load(KP)||'';
  if(v&&maskPhone(v)!==el.value)el.value=maskPhone(v)}
function paintAddress(){
  var u=user(),saved=String(u&&u.address||'').trim(),modes=$('ckAddressModes'),field=$('ckAddress'),hint=$('ckAddressHint');
  if(!field)return;
  if(saved){
    modes.hidden=false;
    var mode=st.addressMode==='new'?'new':'saved';
    var radio=document.querySelector('#ckAddressModes input[value="'+mode+'"]');if(radio)radio.checked=true;
    field.hidden=mode==='saved';
    field.value=mode==='new'?field.value:saved;
    hint.textContent=mode==='saved'?'Usando o endereço padrão salvo na sua conta.':'Este endereço será usado somente neste pedido e não altera o endereço salvo na conta.';
  }else{
    modes.hidden=true;field.hidden=false;
    hint.textContent='Este endereço será usado somente neste pedido. Para salvar um endereço padrão, edite os dados da sua conta.';
  }
}
function cleanAddress(v){return String(v||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,300)}
function selectedAddress(){
  var u=user(),saved=cleanAddress(u&&u.address||'');
  if(saved&&st.addressMode!=='new')return saved;
  return cleanAddress($('ckAddress')&&$('ckAddress').value||'');
}

$('ckName').addEventListener('input',function(){st.nameTouched=true;this.removeAttribute('aria-invalid');$('ckNameErr').hidden=true});
document.addEventListener('esquina:user',function(){paintWho();paintAddress()});
$('ckPhone').addEventListener('input',function(){st.phoneTouched=true;this.value=maskPhone(this.value);this.removeAttribute('aria-invalid');$('ckPhoneErr').hidden=true});
$('checkout').addEventListener('change',function(e){
  var t=e.target;if(!t||t.type!=='radio')return;
  if(t.name==='addressMode'){if(t.value==='new'&&st.addressMode!=='new')$('ckAddress').value='';st.addressMode=t.value;paintAddress();$('ckAddressErr').hidden=true;return}
  if(t.name==='pay'){st.pay=t.value;if(st.pay!=='Dinheiro'){st.change='';[].forEach.call(document.querySelectorAll('input[name=change]'),function(r){r.checked=false})}$('ckPayErr').hidden=true}
  else if(t.name==='change'){st.change=t.value;$('ckChangeErr').hidden=true;
    if(st.change==='sim'){setTimeout(function(){try{$('ckChange').focus({preventScroll:true})}catch(x){}},30)}}
  paintCash()});
$('ckChange').addEventListener('input',function(){this.removeAttribute('aria-invalid');$('ckChangeErr').hidden=true});

/* ---------- sacola vazia / botão limpar ---------- */
var cb=$('clearCart'),cbTx=cb?cb.querySelector('span'):null,armTm=0;
function disarm(){clearTimeout(armTm);if(!cb)return;cb.classList.remove('is-armed');cb.removeAttribute('data-armed');if(cbTx)cbTx.textContent='Limpar sacola'}
if(cb)cb.addEventListener('click',function(){
  if(!cb.hasAttribute('data-armed')){
    /* 1º toque pede confirmação (evita apagar a sacola sem querer); some sozinho em ~4 s */
    cb.setAttribute('data-armed','1');cb.classList.add('is-armed');if(cbTx)cbTx.textContent='Toque de novo para limpar';
    armTm=setTimeout(disarm,4000);return}
  disarm();
  document.dispatchEvent(new Event('cart:clear'));
  resetCheckout();
  var x=$('closeCart');if(x)x.focus()});
document.addEventListener('cart:sync',function(e){
  var d=(e&&e.detail)||{};st.count=d.n||0;st.total=r2(d.t||0);
  var has=st.count>0;
  $('cartEmpty').hidden=has;$('checkout').hidden=!has;$('cartTools').hidden=!has;
  var ct=$('cartCount');if(ct)ct.textContent=st.count+(st.count===1?' item':' itens');
  if(!has)disarm();
  paintCash();prefillPhone();paintWho();paintAddress()});

/* ao abrir a sacola, preenche o telefone da conta (ou o último usado) */
var dw=$('drawer');
if(dw&&window.MutationObserver)new MutationObserver(function(){if(!dw.hidden){prefillPhone();paintWho();paintAddress()}}).observe(dw,{attributes:true,attributeFilter:['hidden']});

/* ---------- comanda ---------- */
var LINE='━━━━━━━━━━━━━━━━━━━━';
function stamp(){
  var f=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}),o={};
  f.formatToParts(new Date()).forEach(function(p){o[p.type]=p.value});
  return{date:o.day+'/'+o.month+'/'+o.year,time:o.hour+':'+o.minute,num:o.day+o.month+'-'+o.hour+o.minute}}
function build(items,phone,changeFor,stp,address){
  var s=stp||stamp(),u=user(),total=0,qty=0,l=[];
  l.push(LINE,'🍺 *ESQUINA MIX*','_Adega e Tabacaria · Guarulhos_',LINE,
    '🧾 *COMANDA DE PEDIDO*','Nº: *'+s.num+'*','Data: '+s.date+' às '+s.time,LINE,
    '*CLIENTE*');
  l.push('Nome: '+(custName()||'Não informado'));
  l.push('Telefone: '+maskPhone(phone));
  l.push('Endereço de entrega: '+(address||'Não informado'));
  if(u&&u.cpfStatus)l.push('Conta: '+(u.cpfStatus==='verified'?'verificada':'em validação'));
  l.push(LINE,'*ITENS*');
  items.forEach(function(x,i){var sub=r2(x.q*x.p);total=r2(total+sub);qty+=x.q;
    l.push(('0'+(i+1)).slice(-2)+') '+x.q+'x '+x.n,'      '+x.q+' × '+brl(x.p)+' = *'+brl(sub)+'*')});
  l.push(LINE,'Qtde. de itens: '+qty,'*TOTAL: '+brl(total)+'*',LINE,'*PAGAMENTO*','Forma: '+st.pay);
  if(st.pay==='Dinheiro'){
    if(st.change==='sim'&&changeFor>total+0.004){l.push('Troco: Sim, para '+brl(changeFor),'Valor do troco: *'+brl(r2(changeFor-total))+'*')}
    else if(st.change==='sim'){l.push('Troco: Não precisa (valor exato)')}
    else l.push('Troco: Não precisa')}
  l.push(LINE,'Aguardo a confirmação do pedido. Obrigado!');
  return l.join('\n')}

function send(items){
  clearErr();
  if(!items||!items.length)return;
  var nm=custName();
  if(!nameOk(nm)){fail('ckNameErr','Informe seu nome.',$('ckName'));return}
  var ph=phoneDigits($('ckPhone').value);
  if(!PHONE_RE.test(ph)){fail('ckPhoneErr','Informe um telefone válido com DDD, ex.: (11) 99999-9999.',$('ckPhone'));return}
  var address=selectedAddress();
  if(address.length<8){fail('ckAddressErr','Informe um endereço de entrega válido.',$('ckAddress'));return}
  if(!st.pay){fail('ckPayErr','Escolha a forma de pagamento.',document.querySelector('input[name=pay]'));return}
  var total=items.reduce(function(a,x){return r2(a+x.q*x.p)},0),changeFor=0;
  if(st.pay==='Dinheiro'){
    if(!st.change){fail('ckChangeErr','Informe se precisa de troco.',document.querySelector('input[name=change]'));return}
    if(st.change==='sim'){changeFor=money($('ckChange').value);
      if(changeFor==null||changeFor<total-0.004){fail('ckChangeErr','Informe um valor igual ou maior que o total ('+brl(total)+').',$('ckChange'));return}}}
  var m=document.querySelector('meta[name="esquina-whatsapp"]'),num=((m&&m.content)||'').replace(/\D/g,'');
  if(!num)return;
  save(KP,maskPhone(ph));
  var u=user();if(!(u&&u.name))save(KN,nm);
  var stp=stamp();
  window.open('https://wa.me/'+num+'?text='+encodeURIComponent(build(items,ph,changeFor,stp,address)),'_blank','noopener');
  /* cliente logado: guarda o pedido para acompanhar em "Pedidos" (não bloqueia nem altera o envio pelo WhatsApp) */
  if(u&&window.EsquinaAuth&&window.EsquinaAuth.recordOrder){
    try{window.EsquinaAuth.recordOrder({code:stp.num,items:items.map(function(x){return{n:x.n,q:x.q,p:x.p}}),total:total,pay:st.pay,changeFor:changeFor||null,phone:ph}).catch(function(){})}catch(e){}}}

window.EsquinaOrder={send:send,build:build,phone:maskPhone};
paintAddress();
paintCash();
})();
