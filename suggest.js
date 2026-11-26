/* Auto-preenchimento compartilhado (busca do topo e busca da barra lateral de filtros).
   Sugere produtos do catálogo (window.EM_CATALOG) com foto, categoria e preço enquanto a pessoa digita.
   Entende erro de digitação e termos como "ipa até 9". Funciona em celular (toque) e desktop (teclado/mouse).
   Uso: EsquinaSuggest.attach(input, {inline:true|false}).
   Eventos disparados no input: "suggest:pick" (detail = produto), "suggest:more" e "suggest:submit". */
(function(){
  'use strict';
  var CAT=window.EM_CATALOG||[];
  var NAMES={narguile:'Narguile',headshop:'Headshop',tabacos:'Cigarros e tabacos',bebidas:'Bebidas',outros:'Outros'};
  var SYN={breja:'cerveja',cervejinha:'cerveja',gelada:'cerveja',latinha:'lata',longneck:'long',sem:'zero'};
  var MAX=6,uid=0;

  function norm(s){return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
  function brl(v){return Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function lev(a,b){var m=a.length,n=b.length,d=[],i,j;for(i=0;i<=m;i++)d[i]=[i];for(j=1;j<=n;j++)d[0][j]=j;
    for(i=1;i<=m;i++)for(j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n]}
  function words(x){return x._sw||(x._sw=norm(x.n+' '+(NAMES[x.cat]||'')+(x.promo?' promocao oferta':'')).split(/[^a-z0-9]+/).filter(Boolean))}
  function nameWords(x){return x._sn||(x._sn=norm(x.n).split(/[^a-z0-9]+/).filter(Boolean))}
  function tokenMatch(t,ws){var k=t.length>6?2:1;return ws.some(function(w){return w.indexOf(t)>-1||(t.length>3&&w.length>3&&(lev(w.slice(0,t.length),t)<=k||lev(w,t)<=k))})}
  function parse(v){var s=norm(v),mx=null,mn=null,m,num=function(a){return parseFloat(a.replace(',','.'))};
    if((m=s.match(/(?:ate|menos de|abaixo de|max(?:imo)?)\s*(?:r\$)?\s*(\d+(?:[.,]\d+)?)/))){mx=num(m[1]);s=s.replace(m[0],' ')}
    if((m=s.match(/(?:acima de|mais de|a partir de|min(?:imo)?)\s*(?:r\$)?\s*(\d+(?:[.,]\d+)?)/))){mn=num(m[1]);s=s.replace(m[0],' ')}
    return{w:s.split(/[^a-z0-9]+/).filter(Boolean).map(function(t){return SYN[t]||t}),mx:mx,mn:mn}}
  function rank(x,t){var s=norm(x.n);if(s.indexOf(t)===0)return 0;
    if(s.replace(/^(cerveja|aperitivo|barril de cerveja|bebida mista)\s+/,'').indexOf(t)===0)return 1;
    if(nameWords(x).some(function(w){return w.indexOf(t)===0}))return 2;return s.indexOf(t)>-1?3:4}
  function find(v){var p=parse(v);if(!p.w.length&&p.mx==null&&p.mn==null)return{list:[],t:''};
    var last=p.w[p.w.length-1]||'';
    var l=CAT.filter(function(x){return(p.mx==null||x.p<=p.mx)&&(p.mn==null||x.p>=p.mn)&&p.w.every(function(t){return tokenMatch(t,words(x))})});
    l=l.map(function(x,i){return{x:x,r:last?rank(x,last):0,i:i}}).sort(function(a,b){return a.r-b.r||a.i-b.i}).map(function(o){return o.x});
    return{list:l,t:last}}
  function mark(el,name,t){var k=t?norm(name).indexOf(t):-1;if(k<0){el.textContent=name;return}
    el.appendChild(document.createTextNode(name.slice(0,k)));var m=document.createElement('mark');m.textContent=name.slice(k,k+t.length);
    el.appendChild(m);el.appendChild(document.createTextNode(name.slice(k+t.length)))}

  function attach(input,opts){
    if(!input||input._sugOn)return;input._sugOn=true;opts=opts||{};
    var id='sg'+(++uid),box=document.createElement('ul'),items=[],act=-1,muted=false;
    box.id=id;box.className='sug sug--shared'+(opts.inline?' sug--inline':'');box.setAttribute('role','listbox');box.hidden=true;
    if(opts.float){box.className='sug sug--shared sug--float';document.body.appendChild(box)}
    else if(opts.inline)input.insertAdjacentElement('afterend',box);
    else (opts.host||input.closest('.search')||input.parentNode).appendChild(box);
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',id);
    input.setAttribute('aria-expanded','false');input.setAttribute('autocomplete','off');input.setAttribute('autocapitalize','off');input.setAttribute('spellcheck','false');
    input.setAttribute('enterkeyhint','search');

    /* Sugestão flutuante: posiciona fora de painéis com overflow e respeita o teclado virtual. */
    function place(){
      if(!opts.float||box.hidden)return;
      var vv=window.visualViewport,vw=vv?vv.width:window.innerWidth;
      var top0=vv?vv.offsetTop:0,left0=vv?vv.offsetLeft:0,vh=vv?vv.height:window.innerHeight;
      var r=input.getBoundingClientRect(),gap=6,pad=8;
      var w=Math.min(Math.max(r.width,280),Math.max(160,vw-pad*2));
      var left=Math.min(Math.max(r.left,left0+pad),left0+vw-w-pad);
      var below=top0+vh-r.bottom-gap-pad,above=r.top-top0-gap-pad;
      box.style.width=w+'px';box.style.left=left+'px';box.style.right='auto';
      if(below>=170||below>=above){
        box.style.top=(r.bottom+gap)+'px';box.style.bottom='auto';
        box.style.maxHeight=Math.max(110,Math.min(360,below))+'px';
      }else{
        box.style.top='auto';box.style.bottom=Math.max(8,window.innerHeight-(r.top+top0)+gap)+'px';
        box.style.maxHeight=Math.max(110,Math.min(360,above))+'px';
      }
    }
    if(opts.float){
      window.addEventListener('scroll',place,true);window.addEventListener('resize',place);
      if(window.visualViewport){
        window.visualViewport.addEventListener('resize',place);
        window.visualViewport.addEventListener('scroll',place);
      }
    }

    function fire(name,detail){input.dispatchEvent(new CustomEvent('suggest:'+name,{bubbles:true,detail:detail}))}
    function close(){box.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');act=-1}
    function show(){
      if(muted)return;
      var v=input.value;box.textContent='';items=[];act=-1;
      if(!v.trim()){close();return}
      var r=find(v),total=r.list.length;
      r.list.slice(0,MAX).forEach(function(x){items.push({x:x})});
      if(!items.length){var n=document.createElement('li');n.className='sug__empty';n.textContent='Nenhum produto encontrado';box.appendChild(n);box.hidden=false;input.setAttribute('aria-expanded','true');place();return}
      if(total>MAX)items.push({more:1});
      items.forEach(function(o,k){
        var li=document.createElement('li');li.id=id+'-'+k;li.setAttribute('role','option');li.setAttribute('aria-selected','false');
        li.className='sug__i'+(o.more?' sug__more':'');li.dataset.k=k;
        if(o.more){li.textContent='Ver todos os '+total+' resultados →'}
        else{
          var im=document.createElement('img');im.src=o.x.img||'assets/logo.webp';im.alt='';im.width=40;im.height=40;im.loading='lazy';im.decoding='async';li.appendChild(im);
          var tx=document.createElement('span');tx.className='sug__n';var nm=document.createElement('span');nm.className='sug__nm';mark(nm,o.x.n,r.t);tx.appendChild(nm);
          var sm=document.createElement('small');sm.textContent=NAMES[o.x.cat]||'';tx.appendChild(sm);li.appendChild(tx);
          var pr=document.createElement('b');pr.textContent=brl(o.x.p);li.appendChild(pr);
        }
        box.appendChild(li);
      });
      box.hidden=false;input.setAttribute('aria-expanded','true');place();
    }
    function setAct(k){var all=box.querySelectorAll('.sug__i');if(!all.length)return;act=(k+all.length)%all.length;
      [].forEach.call(all,function(e,i){e.classList.toggle('is-act',i===act);e.setAttribute('aria-selected',i===act?'true':'false')});
      input.setAttribute('aria-activedescendant',all[act].id);
      var item=all[act],itemTop=item.offsetTop,itemBottom=itemTop+item.offsetHeight;
      if(itemTop<box.scrollTop)box.scrollTop=itemTop;
      else if(itemBottom>box.scrollTop+box.clientHeight)box.scrollTop=itemBottom-box.clientHeight}
    function pick(k){var o=items[k];if(!o)return;
      if(o.more){close();fire('more',input.value);return}
      muted=true;input.value=o.x.n;
      input.dispatchEvent(new Event('input',{bubbles:true})); /* os filtros da página reagem como se a pessoa tivesse digitado o nome */
      muted=false;close();fire('pick',o.x)}

    input.addEventListener('input',show);
    input.addEventListener('focus',function(){if(input.value.trim())show()});
    input.addEventListener('keydown',function(e){
      if(e.key==='ArrowDown'){if(box.hidden)show();setAct(act+1);e.preventDefault()}
      else if(e.key==='ArrowUp'){if(!box.hidden){setAct(act-1);e.preventDefault()}}
      else if(e.key==='Enter'){if(!box.hidden&&act>-1){e.preventDefault();pick(act)}else{close();fire('submit',input.value)}}
      else if(e.key==='Escape'){if(!box.hidden){close();e.stopPropagation()}}
      else if(e.key==='Tab'){close()}
    });
    /* não tira o foco do campo ao tocar/clicar numa sugestão (evita fechar o teclado antes do clique) */
    box.addEventListener('mousedown',function(e){e.preventDefault()});
    box.addEventListener('click',function(e){var li=e.target.closest('.sug__i');if(li)pick(+li.dataset.k)});
    document.addEventListener('pointerdown',function(e){if(box.hidden)return;if(e.target===input||box.contains(e.target))return;close()});
    return{close:close,show:show};
  }
  window.EsquinaSuggest={attach:attach};
})();
