(() => {
 'use strict';
 if(location.hostname.endsWith('.github.io'))return;
 const $=s=>document.querySelector(s);
 const labels={received:'New request',confirmed:'Accepted',preparing:'Preparing',out_for_delivery:'Out for delivery',delivered:'Delivered',served:'Served',completed:'Completed',rejected:'Declined'};
 const money=n=>`₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key=o=>`${o.type}:${o.id}`;
 const dateKey=value=>{const d=new Date(value);if(Number.isNaN(d.getTime()))return '';const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const part=t=>parts.find(p=>p.type===t)?.value;return `${part('year')}-${part('month')}-${part('day')}`;};
 const clock=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'});};
 const dateLabel=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'});};
 let orders=[],today=null,serverTime=null,loadedAt=0,selected=null,filter='all',loading=false,busy=false,paused=false,epoch=0,controller=null;
 let detailFingerprint='',listFingerprint='',pendingDecline=null,feedbackTimer=0;
 const drafts=new Map(),feeDrafts=new Map();
 const now=()=>serverTime?Date.parse(serverTime)+(Date.now()-loadedAt):Date.now();
 const waiting=o=>Math.max(0,Math.floor((now()-Date.parse(o.createdAt))/60000)||0);
 const ageLabel=o=>{const n=waiting(o);return n<1?'Just now':n<60?`${n}m ago`:n<1440?`${Math.floor(n/60)}h ${n%60}m ago`:`${Math.floor(n/1440)}d ago`;};
 const statusMatch=o=>filter==='all'||filter==='new'&&o.status==='received'||filter==='kitchen'&&['confirmed','preparing'].includes(o.status)||filter==='delivery'&&o.status==='out_for_delivery'||filter==='done'&&['completed','delivered'].includes(o.status)||filter==='rejected'&&o.status==='rejected';
 const badge=o=>`<span class="order-status ${esc(o.status)}"><i></i>${esc(labels[o.status]||o.status)}</span>`;
 function feedback(message){clearTimeout(feedbackTimer);$('#admin-feedback').textContent=message;$('#admin-feedback').hidden=false;feedbackTimer=setTimeout(()=>$('#admin-feedback').hidden=true,3500);}
 function paintSync(failed=false){
  const pill=$('#admin-connection');pill.textContent=failed?'Connection lost':paused?'Updates paused':loadedAt?'Auto-refresh on':'Connecting';pill.dataset.state=failed?'offline':paused?'paused':loadedAt?'live':'loading';
  $('#admin-pause').textContent=paused?'Resume updates':'Pause updates';$('#admin-pause').setAttribute('aria-pressed',String(paused));
  $('#admin-updated').textContent=loadedAt?`Updated ${clock(serverTime)}${paused?' · paused':' · every 10s'}`:'Connecting…';
 }
 function scope(){
  const query=$('#admin-search').value.trim().toLowerCase(),channel=$('#admin-channel').value,period=$('#admin-date').value;
  const current=today?.date||dateKey(now()),yesterday=dateKey(new Date(new Date(current+'T00:00:00+05:30').getTime()-86400000));
  return orders.filter(o=>(channel==='all'||o.type===channel)&&(period==='all'||dateKey(o.createdAt)===(period==='today'?current:yesterday))&&`${o.id} ${o.customer?.name||''} ${o.customer?.phone||''} ${o.table||''}`.toLowerCase().includes(query));
 }
 function visibleOrders(){
  const list=scope().filter(statusMatch),sort=$('#admin-sort').value;
  return list.sort((a,b)=>sort==='waiting'?(Number(b.status==='received')-Number(a.status==='received')||Date.parse(a.createdAt)-Date.parse(b.createdAt)):sort==='oldest'?Date.parse(a.createdAt)-Date.parse(b.createdAt):Date.parse(b.createdAt)-Date.parse(a.createdAt));
 }
 function setFilter(value){filter=value;document.querySelectorAll('#admin-status-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));render();}
 function render(){
  if(!loadedAt)return;
  const base=scope(),visible=visibleOrders();
  $('#today-orders').textContent=today?.received??'—';$('#today-value').textContent=today?money(today.confirmedValue):'—';$('#today-completed').textContent=today?.completed??'—';
  $('#stat-new').textContent=base.filter(o=>o.status==='received').length;$('#stat-kitchen').textContent=base.filter(o=>['confirmed','preparing'].includes(o.status)).length;$('#stat-out').textContent=base.filter(o=>o.status==='out_for_delivery').length;$('#stat-done').textContent=base.filter(o=>['delivered','completed'].includes(o.status)).length;
  document.querySelectorAll('[data-quick]').forEach(b=>b.classList.toggle('is-current',b.dataset.quick===filter));
  const count=orders.filter(o=>o.status==='received').length;$('#sidebar-new-count').textContent=count;$('#sidebar-new-count').hidden=!count;
  $('#admin-order-count').textContent=visible.length;$('#admin-empty').hidden=visible.length>0;$('#admin-export').disabled=!visible.length;
  $('#admin-list-value').textContent=visible.length?`${money(visible.reduce((n,o)=>n+o.total,0))} listed value`:'';
  $('#admin-list-value').title='Value of orders in this view. Not payment received.';
  $('#admin-empty-copy').textContent=orders.length?'Try another date, channel or search.':'New requests appear automatically when customers order through the local server.';
  if(!visible.some(o=>key(o)===selected)){selected=visible.length?key(visible[0]):null;detailFingerprint='';}
  const html=visible.map(o=>{const delivery=o.type==='delivery',name=delivery?o.customer.name:`Table ${o.table}`,wait=waiting(o),attention=o.status==='received'&&wait>=15;
   return `<button class="admin-order-row" data-order="${esc(key(o))}" aria-pressed="${key(o)===selected}" ${busy?'disabled':''}><span class="order-row-top"><strong>#${esc(o.id)}</strong>${badge(o)}</span><span class="order-row-middle"><span>${esc(name)}</span><strong title="${delivery&&o.deliveryFee===null?'Item total; delivery charge to confirm':'Order value'}">${money(o.total)}</strong></span><span class="order-row-bottom"><span class="order-channel">${delivery?'Delivery':'Dine-in'}<span> · ${o.items.reduce((n,i)=>n+i.quantity,0)} items</span></span><time class="${attention?'order-waiting':''}" datetime="${esc(o.createdAt)}" title="${dateLabel(o.createdAt)} at ${clock(o.createdAt)}">${attention?`Waiting ${wait}m`:ageLabel(o)}</time></span></button>`;}).join('');
  if(html!==listFingerprint){const focused=document.activeElement?.closest('[data-order]')?.dataset.order;$('#admin-orders').innerHTML=html;listFingerprint=html;if(focused)[...$('#admin-orders').children].find(el=>el.dataset.order===focused)?.focus({preventScroll:true});}
  renderDetail();
 }
 function renderDetail(force=false){
  const o=orders.find(o=>key(o)===selected);
  if(!o){$('#admin-detail').innerHTML='<div class="admin-detail-placeholder"><h2>A clear view<br>of every order.</h2><p>Choose an order to see its dishes, customer details and next step.</p></div>';detailFingerprint='';return;}
  const signature=JSON.stringify(o);
  if(!force&&signature===detailFingerprint)return;
  if(!force&&$('#admin-detail').contains(document.activeElement)&&['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;
  detailFingerprint=signature;const delivery=o.type==='delivery';
  const customer=delivery?`<div class="detail-customer"><div class="detail-customer-top"><strong>${esc(o.customer.name)}</strong><a class="detail-call" href="tel:+91${esc(o.customer.phone)}">Call customer ↗</a></div><span class="detail-phone">${esc(o.customer.phone)}</span><p>${esc(o.customer.address)}<br>${esc(o.customer.city)} · ${esc(o.customer.pincode)}</p>${o.customer.notes?`<div class="detail-note"><b>Customer instructions</b><p>${esc(o.customer.notes)}</p></div>`:''}</div>`:`<div class="detail-customer"><strong>Table ${esc(o.table)}</strong><p>Dine-in order · Confirm with the table</p>${o.notes?`<div class="detail-note"><b>Customer instructions</b><p>${esc(o.notes)}</p></div>`:''}</div>`;
  let actions='';
  if(o.status==='received')actions=delivery?`<form id="admin-accept" class="admin-fee-form"><label class="field">Confirmed delivery charge (₹)<input name="fee" type="number" min="0" max="2000" step="0.01" value="${esc(feeDrafts.get(selected)||'')}" placeholder="0 if delivery is waived" required></label><p class="admin-accept-note">Confirm the address, availability and charges with the customer first.</p><button class="button button-dark" type="submit">Accept order</button></form><button class="decline-button" data-decline>Decline order</button>`:'<button class="button button-dark" data-next="confirmed">Accept order</button><button class="decline-button" data-decline>Decline order</button>';
  if(o.status==='confirmed')actions='<button class="button button-dark" data-next="preparing">Start preparing</button><button class="decline-button" data-decline>Decline order</button>';
  if(o.status==='preparing')actions=`<button class="button button-dark" data-next="${delivery?'out_for_delivery':'served'}">${delivery?'Mark out for delivery':'Mark served'}</button>`;
  if(o.status==='out_for_delivery')actions='<button class="button button-dark" data-next="delivered">Mark delivered</button>';
  if(o.status==='served')actions='<button class="button button-dark" data-next="completed">Complete order</button>';
  const draft=drafts.has(selected)?drafts.get(selected):o.internalNote||'';
  $('#admin-detail').innerHTML=`<div class="print-ticket-heading">Bedesi · Order ticket</div><div class="detail-utility"><button data-back-list>← Order list</button><button data-print>Print ticket ↗</button></div><div class="detail-title"><div><span class="detail-channel">${delivery?'Home delivery':'Dine-in'}</span><h2>#${esc(o.id)}</h2><small>${dateLabel(o.createdAt)} at ${clock(o.createdAt)}</small></div>${badge(o)}</div>${customer}<div class="detail-items-heading"><h3>Order items</h3><span>${o.items.reduce((n,i)=>n+i.quantity,0)} items</span></div><div class="detail-items">${o.items.map(i=>`<div class="detail-item"><span><b class="item-qty">${i.quantity}</b><span>${esc(i.name)}${i.notes?`<small>${esc(i.notes)}</small>`:''}</span></span><strong>${money(i.price*i.quantity)}</strong></div>`).join('')}</div><div class="detail-bill"><div><span>Item subtotal</span><strong>${money(o.subtotal??o.total)}</strong></div>${o.discount?`<div><span>Discount</span><strong>−${money(o.discount)}</strong></div>`:''}${delivery?`<div><span>Delivery charge</span><strong>${o.deliveryFee===null?'To confirm':money(o.deliveryFee)}</strong></div>`:''}<div class="detail-total"><span>${delivery&&o.deliveryFee===null?'Item total':'Order total'}</span><strong>${money(o.total)}</strong></div></div><p class="detail-payment">${delivery?'Website payment not collected. Arrange payment directly.':'Payment is handled separately from order status.'}</p><p id="admin-action-error" class="detail-error" role="alert" hidden></p><div class="detail-actions">${actions}</div><form id="admin-note-form" class="staff-note-form"><div class="staff-note-heading"><label for="admin-staff-note">Staff note</label><span>Internal only</span></div><textarea id="admin-staff-note" name="note" maxlength="1000" rows="3" placeholder="Kitchen instructions or a reminder for your team">${esc(draft)}</textarea><div class="staff-note-footer"><span id="admin-note-state">${drafts.has(selected)?'Unsaved changes':o.internalNoteUpdatedAt?'Saved '+clock(o.internalNoteUpdatedAt):'Not shared with the customer'}</span><button type="submit" class="admin-secondary" ${busy?'disabled':''}>Save note</button></div></form>${o.events?.length?`<details class="detail-timeline"><summary>Order history <span>${o.events.length} updates</span></summary>${o.events.map(e=>`<div class="timeline-item"><span>${esc(labels[e.status]||e.status)}</span><time>${dateLabel(e.at)} · ${clock(e.at)}</time></div>`).join('')}</details>`:''}`;
  $('#admin-detail').querySelectorAll('button').forEach(b=>b.disabled=busy);
 }
 async function load(){
  if(loading||busy)return;const ticket=++epoch;loading=true;controller=new AbortController();$('#admin-refresh').disabled=true;
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetch('/api/admin/orders',{cache:'no-store',signal:controller.signal});const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to load orders');
   if(ticket!==epoch)return;
   orders=result.orders;today=result.today;serverTime=result.serverTime;loadedAt=Date.now();$('#admin-error').hidden=true;
   $('#admin-today-label').textContent=new Date(serverTime).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Kolkata'});
   render();paintSync();
  }catch(error){if(ticket!==epoch)return;$('#admin-error').textContent='Could not refresh orders. '+(loadedAt?'Your last loaded orders are still shown. ':'')+'Use Refresh to try again.';$('#admin-error').hidden=false;paintSync(true);}
  finally{clearTimeout(timeout);if(ticket===epoch){loading=false;$('#admin-refresh').disabled=false;$('#admin-orders').setAttribute('aria-busy','false');}}
 }
 async function mutate(path,payload,message,onSuccess){
  if(busy)return;const target=orders.find(o=>key(o)===selected);if(!target)return;
  busy=true;epoch++;controller?.abort();loading=false;$('#admin-refresh').disabled=true;
  document.querySelectorAll('#admin-detail button, .admin-order-row').forEach(b=>b.disabled=true);
  try{
   const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:target.id,type:target.type,...payload})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to save. Please try again.');
   onSuccess?.();orders=orders.map(o=>key(o)===key(target)?{...o,...result.order}:o);detailFingerprint='';render();feedback(`${message} · #${target.id}`);
  }catch(error){const box=$('#admin-action-error');if(box){box.textContent=error.message;box.hidden=false;}}
  finally{busy=false;document.querySelectorAll('#admin-detail button, .admin-order-row').forEach(b=>b.disabled=false);$('#admin-refresh').disabled=false;load();}
 }
 const update=(status,fee)=>mutate('/api/admin/orders/status',{status,...(fee===undefined?{}:{deliveryFee:fee})},labels[status]||'Order updated',()=>feeDrafts.delete(selected));
 function exportCsv(){
  const rows=visibleOrders();if(!rows.length)return;
  const cell=value=>{let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const csv=[['Order ID','Created at','Channel','Customer or table','Item count','Item subtotal','Delivery charge','Order value','Status','Payment collection'],...rows.map(o=>[o.id,o.createdAt,o.type==='delivery'?'Delivery':'Dine-in',o.type==='delivery'?o.customer.name:'Table '+o.table,o.items.reduce((n,i)=>n+i.quantity,0),o.subtotal??o.total,o.type==='delivery'?(o.deliveryFee??'Unconfirmed'):'',o.total,labels[o.status]||o.status,'Not tracked in order desk'])].map(row=>row.map(cell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`bedesi-orders-${today?.date||dateKey(now())}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback(`Exported ${rows.length} orders from this view`);
 }
 $('#admin-orders').addEventListener('click',e=>{const row=e.target.closest('[data-order]');if(!row||busy)return;selected=row.dataset.order;detailFingerprint='';render();if(innerWidth<1101)$('#admin-detail').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
 $('#admin-status-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(b)setFilter(b.dataset.filter);});
 document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>setFilter(b.dataset.quick));
 for(const id of ['admin-date','admin-channel','admin-sort'])$('#'+id).onchange=render;
 $('#admin-search').oninput=render;$('#admin-refresh').onclick=load;$('#admin-export').onclick=exportCsv;
 $('#admin-pause').onclick=()=>{paused=!paused;paintSync();if(!paused)load();};
 $('#admin-clear-filters').onclick=()=>{$('#admin-date').value='all';$('#admin-channel').value='all';$('#admin-search').value='';setFilter('all');};
 $('#admin-detail').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.next)update(b.dataset.next);if(b.hasAttribute('data-decline')){pendingDecline=selected;$('#admin-decline').showModal();}if(b.hasAttribute('data-print'))window.print();if(b.hasAttribute('data-back-list'))$('.admin-order-list').scrollIntoView({behavior:'smooth',block:'start'});});
 $('#admin-detail').addEventListener('input',e=>{if(e.target.id==='admin-staff-note'){drafts.set(selected,e.target.value);$('#admin-note-state').textContent='Unsaved changes';}if(e.target.name==='fee')feeDrafts.set(selected,e.target.value);});
 $('#admin-detail').addEventListener('submit',e=>{e.preventDefault();if(e.target.id==='admin-accept')update('confirmed',Number(new FormData(e.target).get('fee')));if(e.target.id==='admin-note-form'){const target=selected,note=$('#admin-staff-note').value;mutate('/api/admin/orders/note',{note},'Staff note saved',()=>{if(drafts.get(target)===note)drafts.delete(target);});}});
 $('#admin-decline-cancel').onclick=()=>$('#admin-decline').close();$('#admin-decline-confirm').onclick=()=>{if(pendingDecline===selected)update('rejected');$('#admin-decline').close();};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!paused)load();});
 setInterval(()=>{if(!document.hidden&&!paused&&!busy)load();},10000);
 load();
})();
