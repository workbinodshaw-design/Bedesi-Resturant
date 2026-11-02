(() => {
  'use strict';
  if(window.BEDESI_PAGES_PREVIEW)return;
  const $=selector=>document.querySelector(selector);
  const labels={received:'New request',confirmed:'Accepted',preparing:'Preparing',out_for_delivery:'Out for delivery',delivered:'Delivered',served:'Served',completed:'Completed',rejected:'Declined'};
  const active=['confirmed','preparing','out_for_delivery','served'],done=['delivered','completed','rejected'];
  const money=value=>`₹${Number(value||0).toLocaleString('en-IN')}`;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'});};
  const dateLabel=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'});};
  let orders=[],selected=null,filter='all',loading=false,busy=false,detailFingerprint='',pendingDecline=null;
  const key=order=>`${order.type}:${order.id}`;
  function badge(order){return `<span class="order-status ${esc(order.status)}">${esc(labels[order.status]||order.status)}</span>`;}
  function render(){
    $('#stat-new').textContent=orders.filter(o=>o.status==='received').length;
    $('#stat-kitchen').textContent=orders.filter(o=>['confirmed','preparing'].includes(o.status)).length;
    $('#stat-out').textContent=orders.filter(o=>o.status==='out_for_delivery').length;
    $('#stat-done').textContent=orders.filter(o=>['delivered','completed'].includes(o.status)).length;
    const query=$('#admin-search').value.trim().toLowerCase(),channel=$('#admin-channel').value;
    const visible=orders.filter(o=>(channel==='all'||o.type===channel)&&(filter==='all'||filter==='new'&&o.status==='received'||filter==='active'&&active.includes(o.status)||filter==='done'&&done.includes(o.status))&&`${o.id} ${o.customer?.name||''} ${o.customer?.phone||''} ${o.table||''}`.toLowerCase().includes(query));
    $('#admin-order-count').textContent=visible.length;$('#admin-empty').hidden=visible.length>0;
    $('#admin-orders').innerHTML=visible.map(o=>`<button class="admin-order-row" data-order="${esc(key(o))}" aria-pressed="${key(o)===selected}"><span class="order-row-top"><strong>#${esc(o.id)}</strong>${badge(o)}</span><span class="order-row-middle"><span>${esc(o.type==='delivery'?o.customer.name:'Table '+o.table)}</span><strong>${money(o.total)}</strong></span><span class="order-row-bottom"><span><span class="order-channel">${o.type==='delivery'?'Home delivery':'Dine-in'}</span> · ${o.items.reduce((n,item)=>n+item.quantity,0)} items</span><small>${dateLabel(o.createdAt)} · ${clock(o.createdAt)}</small></span></button>`).join('');
    renderDetail();
  }
  function renderDetail(force=false){
    const order=orders.find(o=>key(o)===selected);if(!order)return;
    const fingerprint=JSON.stringify(order);
    if(!force&&fingerprint===detailFingerprint)return;
    if(!force&&$('#admin-detail').contains(document.activeElement)&&['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;
    detailFingerprint=fingerprint;
    const delivery=order.type==='delivery',customer=order.customer;
    const customerHtml=delivery?`<div class="detail-customer"><h3>${esc(customer.name)}</h3><a href="tel:+91${esc(customer.phone)}">${esc(customer.phone)} ↗</a><p>${esc(customer.address)}<br>${esc(customer.city)} · ${esc(customer.pincode)}</p>${customer.notes?`<div class="detail-note"><strong>Customer instructions</strong><br>${esc(customer.notes)}</div>`:''}</div>`:`<div class="detail-customer"><h3>Table ${esc(order.table)}</h3><p>Dine-in order · Confirm with the table</p>${order.notes?`<div class="detail-note">${esc(order.notes)}</div>`:''}</div>`;
    let actions='';
    if(order.status==='received')actions=`${delivery?'<form class="admin-fee-form" id="admin-accept"><label class="field">Confirmed delivery charge (₹)<input name="fee" type="number" min="0" max="2000" step="0.01" placeholder="Enter charge, or 0 if waived" required></label><p class="admin-accept-note">Confirm the address, delivery availability and charges with the customer before accepting.</p><button class="button button-dark" type="submit">Accept order ↗</button></form>':'<button class="button button-dark" data-next="confirmed">Accept order ↗</button>'}<button class="decline-button" data-decline>Decline order</button>`;
    if(order.status==='confirmed')actions='<button class="button button-dark" data-next="preparing">Start preparing →</button><button class="decline-button" data-decline>Decline order</button>';
    if(order.status==='preparing')actions=`<button class="button button-dark" data-next="${delivery?'out_for_delivery':'served'}">${delivery?'Mark out for delivery':'Mark served'} →</button>`;
    if(order.status==='out_for_delivery')actions='<button class="button button-dark" data-next="delivered">Mark delivered ✓</button>';
    if(order.status==='served')actions='<button class="button button-dark" data-next="completed">Complete order ✓</button>';
    const events=order.events||[];
    $('#admin-detail').innerHTML=`<div class="detail-title"><div><h2>#${esc(order.id)}</h2><small>${dateLabel(order.createdAt)} at ${clock(order.createdAt)}</small><span class="detail-channel">${delivery?'Home delivery':'Dine-in'}</span></div>${badge(order)}</div>${customerHtml}<div class="detail-items">${order.items.map(item=>`<div class="detail-item"><span>${item.quantity} × ${esc(item.name)}${item.notes?`<small>${esc(item.notes)}</small>`:''}</span><strong>${money(item.price*item.quantity)}</strong></div>`).join('')}</div><div class="detail-bill"><div><span>Item subtotal</span><strong>${money(order.subtotal??order.total)}</strong></div>${order.discount?`<div><span>Discount</span><strong>−${money(order.discount)}</strong></div>`:''}${delivery?`<div><span>Delivery charge</span><strong>${order.deliveryFee===null?'To confirm':money(order.deliveryFee)}</strong></div>`:''}<div class="detail-total"><span>${delivery&&order.deliveryFee===null?'Item total':'Order total'}</span><strong>${money(order.total)}</strong></div></div><p class="detail-payment">${delivery?'Payment is not collected on the website. Arrange it directly with the customer.':'Payment is handled separately from this order status.'}</p><p id="admin-action-error" class="detail-error" role="alert" hidden></p><div class="detail-actions">${actions}</div>${events.length?`<div class="detail-timeline"><h3>Order history</h3>${events.map(event=>`<div class="timeline-item"><span>${esc(labels[event.status]||event.status)}</span><time>${dateLabel(event.at)} · ${clock(event.at)}</time></div>`).join('')}</div>`:''}`;
  }
  async function load(){
    if(loading)return;loading=true;$('#admin-refresh').disabled=true;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch('/api/admin/orders',{cache:'no-store',signal:controller.signal});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to load orders');
      orders=result.orders;$('#admin-error').hidden=true;
      $('#admin-updated').textContent=`Updated ${clock(result.serverTime)} · Refreshes every 10 seconds`;
      render();
    }catch(error){$('#admin-error').textContent=error.message||'Connection interrupted. Your last loaded orders are retained.';$('#admin-error').hidden=false;}
    finally{clearTimeout(timeout);loading=false;$('#admin-refresh').disabled=false;}
  }
  async function update(status,fee){
    if(busy)return;const order=orders.find(o=>key(o)===selected);if(!order)return;
    busy=true;$('#admin-detail').querySelectorAll('button').forEach(b=>b.disabled=true);
    try{
      const response=await fetch('/api/admin/orders/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:order.id,type:order.type,status,...(fee===undefined?{}:{deliveryFee:fee})})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to update order');
      orders=orders.map(o=>key(o)===key(order)?result.order:o);detailFingerprint='';render();
    }catch(error){const message=$('#admin-action-error');if(message){message.textContent=error.message;message.hidden=false;}}
    finally{busy=false;$('#admin-detail').querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  $('#admin-orders').addEventListener('click',e=>{const row=e.target.closest('[data-order]');if(row){selected=row.dataset.order;render();if(innerWidth<951)$('#admin-detail').scrollIntoView({block:'start',behavior:'smooth'});}});
  $('#admin-status-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(b){filter=b.dataset.filter;$('#admin-status-tabs').querySelectorAll('button').forEach(btn=>btn.setAttribute('aria-pressed',String(btn===b)));render();}});
  $('#admin-channel').onchange=render;$('#admin-search').oninput=render;$('#admin-refresh').onclick=load;
  $('#admin-detail').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.next)update(b.dataset.next);if(b.hasAttribute('data-decline')){pendingDecline=selected;$('#admin-decline').showModal();}});
  $('#admin-detail').addEventListener('submit',e=>{if(e.target.id==='admin-accept'){e.preventDefault();update('confirmed',Number(new FormData(e.target).get('fee')));}});
  $('#admin-decline-cancel').onclick=()=>$('#admin-decline').close();
  $('#admin-decline-confirm').onclick=()=>{if(pendingDecline===selected)update('rejected');$('#admin-decline').close();};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  setInterval(()=>{if(!document.hidden&&!busy)load();},10000);
  load();
})();
