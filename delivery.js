(() => {
  'use strict';
  const $=selector=>document.querySelector(selector), index=new Map(dishes.map(d=>[d.id,d]));
  const menu=dishes.filter(d=>!d.hiddenFromMenu), key='bedesi-delivery-cart-v1';
  const cart=new Map();let selected='All',diet='all',limit=12,timer=0,toastTimer=0,busy=false,lastRequest=null;
  try{for(const entry of JSON.parse(localStorage.getItem(key)||'[]'))if(Array.isArray(entry)&&index.has(entry[0])&&Number.isInteger(entry[1])&&entry[1]>0&&entry[1]<=99)cart.set(entry[0],entry[1]);}catch{}
  const money=value=>`₹${Number(value).toLocaleString('en-IN')}`;
  const countFor=d=>d.variants?d.variants.reduce((n,v)=>n+(cart.get(v.id)||0),0):cart.get(d.id)||0;
  function toast(message){clearTimeout(toastTimer);$('#delivery-status').textContent=message;$('#delivery-status').hidden=false;toastTimer=setTimeout(()=>$('#delivery-status').hidden=true,1800);}
  function action(d){const count=countFor(d);return `<button class="product-add" data-add="${d.id}" aria-label="${d.variants?'Choose portion for':'Add'} ${d.displayName||d.name}">${count?count+' added':d.variants?'Choose':'Add'}<strong>+</strong></button>`;}
  function renderMenu(){
    const query=$('#delivery-search').value.trim().toLowerCase();
    const visible=menu.filter(d=>(selected==='All'||d.category===selected)&&(diet==='all'||d.diet===diet)&&`${d.name} ${d.category}`.toLowerCase().includes(query));
    $('#delivery-list-title').textContent=query?'Search results':selected==='All'?'All dishes':selected;
    $('#delivery-result-count').textContent=`${visible.length} dishes`;
    $('#delivery-products').innerHTML=visible.slice(0,limit).map(d=>`<article class="delivery-product" data-product="${d.id}"><div class="delivery-product-photo"><img src="${d.art}" alt="${d.name}" loading="lazy" decoding="async" width="420" height="420"><span class="diet-label ${d.diet}"><i></i>${d.diet==='nonveg'?'Non-veg':d.diet==='egg'?'Egg':'Veg'}</span></div><h3>${d.displayName||d.name}</h3><div class="product-action"><span>${d.variants?'From ':''}${money(d.price)}</span><span class="product-button">${action(d)}</span></div></article>`).join('');
    $('#delivery-empty').hidden=visible.length>0;$('#delivery-more').hidden=visible.length<=limit;
    $('#delivery-categories').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===selected)));
  }
  function renderBasket(){
    let subtotal=0,count=0;
    $('#delivery-basket-items').innerHTML=[...cart].map(([id,qty])=>{const d=index.get(id);subtotal+=d.price*qty;count+=qty;return `<article class="basket-item"><img src="${d.art}" alt="" width="42" height="48"><div><h3>${d.name}</h3><span class="item-price">${money(d.price*qty)}</span></div><div class="quantity-stepper" aria-label="${d.name} quantity"><button data-change="-1" data-id="${id}" type="button" aria-label="Remove ${d.name}">−</button><span>${qty}</span><button data-change="1" data-id="${id}" type="button" aria-label="Add ${d.name}" ${qty>=99?'disabled':''}>+</button></div></article>`;}).join('');
    const confirming=!$('#delivery-confirmation').hidden;
    $('#basket-empty').hidden=cart.size>0||confirming;$('#basket-bill').hidden=!cart.size||!$('#delivery-checkout').hidden||confirming;
    $('#basket-subtotal').textContent=$('#checkout-subtotal').textContent=money(subtotal);
    $('#mobile-basket-count').textContent=`${count} ${count===1?'item':'items'}`;$('#mobile-basket-total').textContent=money(subtotal);$('#mobile-basket-open').hidden=!cart.size||confirming;
    if(!cart.size)$('#delivery-checkout').hidden=true;
    document.querySelectorAll('[data-product]').forEach(card=>card.querySelector('.product-button').innerHTML=action(index.get(Number(card.dataset.product))));
    try{localStorage.setItem(key,JSON.stringify([...cart]));}catch{}
  }
  function change(id,delta){
    if(busy)return;
    const qty=Math.max(0,Math.min(99,(cart.get(id)||0)+delta));qty?cart.set(id,qty):cart.delete(id);lastRequest=null;
    $('#delivery-confirmation').hidden=true;renderBasket();
  }
  function add(id){
    const d=index.get(id);if(!d||busy)return;
    if(d.variants){$('#delivery-options-title').textContent=d.displayName||d.name;$('#delivery-variant-options').innerHTML=d.variants.map(v=>`<button class="variant-choice" data-variant="${v.id}"><span>${v.label||v.name||index.get(v.id).name}</span><strong>${money(v.price)}</strong></button>`).join('');$('#delivery-options').showModal();return;}
    change(id,1);toast(`${d.name} added`);
  }
  $('#delivery-categories').innerHTML=[...new Set(['All',...menu.map(d=>d.category)])].map(name=>`<button data-category="${name}" aria-pressed="${name==='All'}">${name==='All'?'All dishes':name}</button>`).join('');
  $('#delivery-categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;selected=b.dataset.category;limit=12;renderMenu();});
  $('#delivery-diets').addEventListener('click',e=>{const b=e.target.closest('[data-diet]');if(!b)return;diet=b.dataset.diet;limit=12;$('#delivery-diets').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));renderMenu();});
  $('#delivery-search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{limit=12;renderMenu();},80);});
  $('#delivery-reset').onclick=()=>{selected='All';diet='all';limit=12;$('#delivery-search').value='';$('#delivery-diets [data-diet=all]').click();};
  $('#delivery-more').onclick=()=>{limit+=12;renderMenu();};
  $('#delivery-products').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(b)add(Number(b.dataset.add));});
  $('#delivery-variant-options').addEventListener('click',e=>{const b=e.target.closest('[data-variant]');if(b){change(Number(b.dataset.variant),1);$('#delivery-options').close();toast('Added to your order');}});
  $('#close-delivery-options').onclick=()=>$('#delivery-options').close();
  $('#delivery-basket-items').addEventListener('click',e=>{const b=e.target.closest('[data-change]');if(b)change(Number(b.dataset.id),Number(b.dataset.change));});
  const mobile=matchMedia('(max-width: 760px)'),dialog=$('#mobile-basket'),basket=$('#delivery-basket'),host=$('#basket-host');
  $('#mobile-basket-open').onclick=()=>{dialog.append(basket);dialog.showModal();};
  $('.mobile-basket-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>host.append(basket));
  mobile.addEventListener('change',()=>{if(!mobile.matches&&dialog.open)dialog.close();});
  $('#delivery-continue').onclick=()=>{$('#delivery-checkout').hidden=false;$('#basket-bill').hidden=true;$('#delivery-checkout [name=name]').focus();};
  $('#back-to-basket').onclick=()=>{$('#delivery-checkout').hidden=true;renderBasket();};
  $('#delivery-checkout').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!cart.size)return;
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const payload={customer:data,items:[...cart].map(([id,quantity])=>({id,quantity}))};
    const fingerprint=JSON.stringify(payload);
    if(!lastRequest||lastRequest.fingerprint!==fingerprint)lastRequest={fingerprint,id:requestId()};
    busy=true;$('#delivery-submit').disabled=true;$('#delivery-submit').textContent='Sending your order…';$('#delivery-error').hidden=true;
    try{
      const response=await fetch('/api/delivery/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId:lastRequest.id})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to send your order. Please try again.');
      $('#delivery-checkout').hidden=true;$('#basket-bill').hidden=true;$('#delivery-basket-items').replaceChildren();$('#delivery-confirmation').hidden=false;$('#delivery-reference').textContent=`#${result.id}`;
      cart.clear();lastRequest=null;$('#delivery-checkout').reset();renderBasket();
      if(!dialog.open&&mobile.matches){dialog.append(basket);dialog.showModal();}
      basket.scrollIntoView({block:'start',behavior:'smooth'});
    }catch(error){$('#delivery-error').textContent=error.message||'Connection interrupted. Please try again or call the restaurant.';$('#delivery-error').hidden=false;}
    finally{busy=false;$('#delivery-submit').disabled=false;$('#delivery-submit').textContent='Send order request ↗';}
  });
  $('#delivery-new-order').onclick=()=>{$('#delivery-confirmation').hidden=true;if(dialog.open)dialog.close();renderBasket();};
  function requestId(){if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
  renderMenu();renderBasket();
  const linked=Number(new URLSearchParams(location.search).get('dish'));if(index.has(linked)){const d=index.get(linked);selected=d.category;renderMenu();add(linked);}
})();
