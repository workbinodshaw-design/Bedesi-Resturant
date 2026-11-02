(() => {
 'use strict';
 const KEY='bedesi-customer-orders-v1';
 const table=new URLSearchParams(location.search).get('table')||'R4';
 const safeTable=/^[A-Za-z]?\d{1,3}$/.test(table)?table:'R4';
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function parse(store){try{const data=JSON.parse(store.getItem(KEY)||'[]');return Array.isArray(data)?data.filter(o=>o&&/^[A-Fa-f0-9]{8}$/.test(o.id)&&typeof o.table==='string'&&/^[A-Za-z]?\d{1,3}$/.test(o.table)&&Number.isFinite(o.total)&&o.total>=0&&Number.isFinite(Date.parse(o.placedAt))&&Array.isArray(o.items)&&o.items.length&&o.items.every(i=>i&&Number.isInteger(i.id)&&typeof i.name==='string'&&i.name.length<250&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=99&&Number.isFinite(i.price)&&i.price>=0)):[];}catch{return [];}}
 function read(){const merged=new Map();for(const store of ['localStorage','sessionStorage'].map(name=>{try{return window[name];}catch{return null;}}))for(const o of parse(store))merged.set(o.id,o);return [...merged.values()].sort((a,b)=>Date.parse(b.placedAt)-Date.parse(a.placedAt));}
 function save(result){
  const order={discount:Number(result.discount)||0,coupon:typeof result.coupon==='string'?result.coupon:'',id:result.id,table:String(result.table),total:result.total,items:result.items.map(i=>({id:i.id,name:i.name,quantity:i.quantity,price:i.price,notes:typeof i.notes==='string'?i.notes.slice(0,300):''})),notes:typeof result.notes==='string'?result.notes.slice(0,500):'',placedAt:new Date().toISOString()};
  const history=read().filter(o=>o.id!==order.id);history.unshift(order);
  try{localStorage.setItem(KEY,JSON.stringify(history));refresh();return {saved:true,persistent:true};}
  catch{try{sessionStorage.setItem(KEY,JSON.stringify(history));refresh();return {saved:true,persistent:false};}catch{return {saved:false,persistent:false};}}
 }
 window.BedesiOrders={read,save};
 const menuIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z"/><path d="M8 4v16m3-11h5m-5 4h5"/></svg>';
 const ordersIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 7h6m-6 4h6m-6 4h4"/></svg>';
 const ordersPage=location.pathname.endsWith('/orders.html');
 const onMenu=location.pathname.endsWith('/table-menu.html')||location.pathname.endsWith('/index.html')||location.pathname==='/';
 const returnMenu=`table-menu.html?table=${encodeURIComponent(safeTable)}${onMenu?'':'&return=1'}`;
 const nav=document.createElement('nav');nav.className='customer-nav';nav.setAttribute('aria-label','Main navigation');
 nav.innerHTML=`<a href="${returnMenu}" ${ordersPage?'':'aria-current="page"'}>${menuIcon}<span>Menu</span></a><a href="orders.html?table=${encodeURIComponent(safeTable)}" ${ordersPage?'aria-current="page"':''}>${ordersIcon}<span>Orders</span><b id="saved-order-count" hidden></b></a>`;
 document.body.append(nav);document.body.classList.add('has-customer-nav');
 if(onMenu)nav.querySelector('a').addEventListener('click',event=>{event.preventDefault();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
 if(ordersPage)document.querySelectorAll('.history-header a,#history-empty a').forEach(a=>a.href=returnMenu);
 function refresh(){const history=read();const badge=document.getElementById('saved-order-count');badge.hidden=!history.length;badge.textContent=history.length;if(ordersPage)render(history);}
 function render(history){
  const list=document.getElementById('saved-orders');
  let pending=[];try{const raw=JSON.parse(sessionStorage.getItem(`bedesi-demo-table-${safeTable}`)||'[]');if(Array.isArray(raw))pending=raw.filter(e=>Array.isArray(e)&&dishes.some(d=>d.id===e[0])&&Number.isInteger(e[1])&&e[1]>0&&e[1]<=99);}catch{}
  const draft=document.getElementById('pending-order');draft.hidden=!pending.length;
  if(pending.length){const total=pending.reduce((sum,[id,qty])=>sum+dishes.find(d=>d.id===id).price*qty,0),count=pending.reduce((sum,e)=>sum+e[1],0);draft.innerHTML=`<div class="saved-order-top"><span>Your cart</span><span>Not placed yet</span></div><div class="saved-order-title"><h2>${count} ${count===1?'item':'items'}</h2><strong>₹${total}</strong></div><div class="saved-order-preview"><div class="saved-order-photos">${pending.slice(0,3).map(([id])=>{const d=dishes.find(d=>d.id===id);return `<img src="${dishVisual(d)}" alt="${esc(d.name)}">`;}).join('')}</div><a class="pending-continue" href="order.html?table=${encodeURIComponent(safeTable)}">Continue order →</a></div>`;}
  document.getElementById('history-empty').hidden=!!history.length||!!pending.length;
  document.getElementById('history-count').textContent=history.length?`${history.length} ${history.length===1?'order':'orders'} on this device`:pending.length?'Your cart is ready to review':'Your orders will appear here';
  const selected=new URLSearchParams(location.search).get('order');
  const notice=document.getElementById('history-notice');if(new URLSearchParams(location.search).get('storage')==='session'){notice.dataset.storageWarning='true';notice.textContent='Order placed. Persistent storage is unavailable; these details are saved for this browser session.';}notice.hidden=!selected||!history.some(o=>o.id===selected);
  list.innerHTML=history.map((order,index)=>{
   const count=order.items.reduce((n,i)=>n+i.quantity,0);const date=new Date(order.placedAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
   const isOpen=history.some(o=>o.id===selected)?order.id===selected:index===0;
   return `<details class="customer-order" ${isOpen?'open':''}><summary><div class="order-card-title"><h2>${index===0?'Latest order':'Earlier order'}</h2><time datetime="${esc(order.placedAt)}">${esc(date)} · Table ${esc(order.table)}</time></div><span class="order-card-right"><span class="order-card-state">Placed</span><span class="order-card-collapsed-total">₹${order.total}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></span></summary><div class="order-card-meta"><span>Order #${esc(order.id)}</span><span>${count} ${count===1?'item':'items'}</span></div><div class="order-card-items">${order.items.map(item=>{const d=dishes.find(d=>d.id===item.id);return `<div class="order-card-item"><img src="${d?dishVisual(d):'assets/menu/no-photo.svg'}" alt="${esc(item.name)}" loading="lazy"><div><h3>${esc(item.name)}</h3><p>Quantity: ${item.quantity}</p><small>₹${item.price} each</small>${item.notes?`<p class="history-item-note"><b>Note:</b> ${esc(String(item.notes).slice(0,300))}</p>`:''}</div><strong>₹${item.price*item.quantity}</strong></div>`;}).join('')}</div>${order.notes?`<div class="order-card-note"><strong>Cooking request</strong><p>${esc(String(order.notes).slice(0,500))}</p></div>`:''}${order.discount>0?`<div class="history-discount"><span>Coupon savings</span><strong>−₹${order.discount}</strong></div>`:''}<div class="order-card-total"><span>Total</span><strong>₹${order.total}</strong></div><p class="order-card-payment">Pay at the counter</p></details>`;
  }).join('');
 }
 window.addEventListener('storage',event=>{if(event.key===KEY)refresh();});window.addEventListener('pageshow',refresh);refresh();
})();
