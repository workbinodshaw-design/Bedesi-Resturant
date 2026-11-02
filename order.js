const $ = selector => document.querySelector(selector);
const rawTable = new URLSearchParams(location.search).get('table');
const table = rawTable && /^[A-Za-z]?\d{1,3}$/.test(rawTable) ? rawTable.toUpperCase() : 'R4';
const key = `bedesi-demo-table-${table}`;
const notesKey = `${key}-notes`;
const menuUrl = `table-menu.html?table=${encodeURIComponent(table)}&return=1`;
const cart = new Map();
let itemNotes={};
const openItemNotes=new Set();
try{const notes=JSON.parse(sessionStorage.getItem(key+'-item-notes')||'{}');if(notes&&!Array.isArray(notes)&&typeof notes==='object')for(const [id,value] of Object.entries(notes))if(dishes.some(d=>d.id===Number(id))&&typeof value==='string')itemNotes[id]=value.slice(0,300);}catch{}
let appliedCoupon='',couponDiscount=0,couponBusy=false;
try {
  const saved = JSON.parse(sessionStorage.getItem(key) || '[]');
  if (Array.isArray(saved)) saved.forEach(entry => {
    if (Array.isArray(entry) && dishes.some(d => d.id === entry[0]) && Number.isInteger(entry[1]) && entry[1] > 0 && entry[1] <= 99) cart.set(entry[0],entry[1]);
  });
  $('#order-notes').value = sessionStorage.getItem(notesKey) || '';
} catch { /* Show a usable empty state if storage is unavailable. */ }
$('#order-table').textContent = table;
document.title = `Your order · Table ${table} · Bedesi`;
['#back-menu','#brand-menu','#add-more','#empty-menu'].forEach(id => $(id).href = menuUrl);
function renderOrder() {
  let count = 0, total = 0;
  cart.forEach((qty,id) => { count += qty; total += qty * dishes.find(d => d.id === id).price; });
  $('#order-count').textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
  $('#order-content').hidden = !count;
  $('#empty-order').hidden = !!count;
  $('#add-more').hidden = !count;
  $('#order-total').textContent = `₹${total}`;$('#checkout-total').textContent=`₹${Math.max(0,total-couponDiscount)}`;$('#bill-discount').hidden=!couponDiscount;$('#discount-amount').textContent=`−₹${couponDiscount}`;$('#coupon-remove').hidden=!appliedCoupon;
  $('#order-items').innerHTML = [...cart].map(([id,qty]) => {
    const dish = dishes.find(d => d.id === id);
    return `<article class="order-item"><img class="order-thumb ${dish.art&&!dish.photo ? 'cutout' : ''}" src="${dishVisual(dish)}" alt="${dish.name}"><div class="order-item-info"><span class="order-item-type ${dish.diet}"><i></i>${dish.diet==='egg'?'Egg':dish.veg?'Veg':'Non-veg'}</span><h2>${dish.name}</h2>${qty>1?`<span class="unit-price">₹${dish.price} each</span>`:''}<button class="item-note-toggle" data-note-toggle="${id}" aria-expanded="${openItemNotes.has(id)}" aria-controls="item-note-field-${id}">${itemNotes[id]?'Edit note':'Add note'}</button></div><div class="order-item-actions"><strong class="line-total">₹${dish.price*qty}</strong><div class="stepper" aria-label="${dish.name} quantity"><button data-id="${id}" data-change="-1" aria-label="Remove ${dish.name}">−</button><span>${qty}</span><button data-id="${id}" data-change="1" aria-label="Add ${dish.name}" ${qty>=99?'disabled':''}>+</button></div></div><div class="item-note-field" id="item-note-field-${id}" ${openItemNotes.has(id)?'':'hidden'}><label class="sr-only" for="item-note-${id}">Note for ${dish.name}</label><span aria-hidden="true">✎</span><input id="item-note-${id}" data-item-note="${id}" type="text" maxlength="300" placeholder="Add a note (optional)"></div></article>`;
  }).join('');
  $('#order-items').querySelectorAll('[data-note-toggle]').forEach(button=>button.addEventListener('click',()=>{
    const id=Number(button.dataset.noteToggle),field=$(`#item-note-field-${id}`);field.hidden=!field.hidden;button.setAttribute('aria-expanded',String(!field.hidden));if(!field.hidden){openItemNotes.add(id);field.querySelector('input').focus({preventScroll:true});field.scrollIntoView({block:'nearest',behavior:'smooth'});}else openItemNotes.delete(id);
  }));
  $('#order-items').querySelectorAll('[data-item-note]').forEach(input=>{
    input.value=itemNotes[input.dataset.itemNote]||'';
    input.addEventListener('input',()=>{const id=input.dataset.itemNote;if(input.value)itemNotes[id]=input.value;else delete itemNotes[id];const toggle=$(`[data-note-toggle="${id}"]`);if(toggle)toggle.textContent=input.value?'Edit note':'Add note';try{sessionStorage.setItem(key+'-item-notes',JSON.stringify(itemNotes));sessionStorage.removeItem(key+'-request');}catch{}});
  });
  $('#order-items').querySelectorAll('[data-change]').forEach(button => button.onclick = () => {
    const id = Number(button.dataset.id);
    sessionStorage.removeItem(key+'-request');
    clearCoupon();
    const next = Math.min(99,(cart.get(id) || 0) + Number(button.dataset.change));
    if (next > 0) cart.set(id,next); else {cart.delete(id);delete itemNotes[id];try{sessionStorage.setItem(key+'-item-notes',JSON.stringify(itemNotes));}catch{}}
    try { sessionStorage.setItem(key,JSON.stringify([...cart])); } catch { /* Keep this view usable in memory. */ }
    renderOrder();
    $('#order-status').textContent = `${dishes.find(d => d.id === id).name}: ${next} in your order`;
    const target = $('#order-items').querySelector(`[data-id="${id}"][data-change="${button.dataset.change}"]`) || $('#order-items').querySelector('[data-change]');
    if (target) target.focus({preventScroll:true});
    else $('#empty-menu').focus({preventScroll:true});
  });
}
$('#order-notes').oninput = () => { sessionStorage.removeItem(key+'-request'); try { sessionStorage.setItem(notesKey,$('#order-notes').value); } catch { /* Retain exact text in the current page. */ } };
renderOrder();

window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  try{const stored=JSON.parse(sessionStorage.getItem(key+'-item-notes')||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))itemNotes=stored;}catch{}
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) {
      cart.clear();
      saved.forEach(entry => {
        if (Array.isArray(entry) && dishes.some(d => d.id === entry[0]) && Number.isInteger(entry[1]) && entry[1] > 0 && entry[1] <= 99) cart.set(entry[0], entry[1]);
      });
      $('#order-notes').value = sessionStorage.getItem(notesKey) || '';
      renderOrder();
    }
  } catch { /* Keep the current in-memory order usable. */ }
});

let placing=false;
$('#place-order').addEventListener('click',async()=>{
 if(placing||couponBusy||!cart.size)return;
 placing=true;const button=$('#place-order');button.disabled=true;button.textContent='Placing order…';$('#place-error').hidden=true;
 try{
  let requestId=sessionStorage.getItem(key+'-request');if(!requestId){requestId=makeRequestId();sessionStorage.setItem(key+'-request',requestId);}
  const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({table,items:[...cart].map(([id,quantity])=>({id,quantity,notes:itemNotes[id]||''})),notes:$('#order-notes').value,coupon:appliedCoupon,requestId})});
  const result=await response.json();if(!response.ok){$('#coupon-message').textContent=result.error||'Please check your order.';if(appliedCoupon){clearCoupon();renderOrder();}throw Error(result.error||'Unable to place order. Please try again.');}
  $('#confirmation-number').textContent=`Order #${result.id} · Table ${table}`;
  $('#confirmation-items').replaceChildren(...Array.from($('#order-items').children).map(node=>node.cloneNode(true)));
  $('#confirmation-items').querySelectorAll('.stepper').forEach(control=>control.replaceWith(document.createTextNode('Qty '+control.querySelector('span').textContent)));
  $('#confirmation-total').textContent=`₹${result.total}`;
  $('#order-content').hidden=true;document.querySelector('.order-heading').hidden=true;$('#order-confirmation').hidden=false;
  const historyResult=window.BedesiOrders.save(result);
  $('#new-order').href=menuUrl;cart.clear();sessionStorage.removeItem(key);sessionStorage.removeItem(notesKey);sessionStorage.removeItem(key+'-item-notes');sessionStorage.removeItem(key+'-request');window.scrollTo({top:0});
  if(historyResult.saved){location.href=`orders.html?table=${encodeURIComponent(table)}&order=${encodeURIComponent(result.id)}${historyResult.persistent?'':'&storage=session'}`;}else{document.querySelector('#order-confirmation>p:last-of-type').textContent='Order placed. Browser storage is unavailable; keep this order number for reference.';}
 }catch(error){$('#place-error').textContent='Could not place your order. Please try again or ask a staff member.';$('#place-error').hidden=false;}
 finally{placing=false;button.disabled=false;button.textContent='Place order';}
});

function makeRequestId(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

$('#extras-menu').href=menuUrl;
const highlighted=[dishes.find(d=>d.name==='Masala Tea'),dishes.find(d=>d.name==='Chicken Tikka Kebab'),dishes.find(d=>d.category==='Desserts')].filter(Boolean);
$('#checkout-highlights').innerHTML=highlighted.map(d=>`<a class="checkout-highlight" href="${menuUrl}&dish=${d.id}"><span>${d.name}<b>₹${d.price}</b></span><img src="${dishVisual(d)}" alt="${d.name}" loading="lazy"></a>`).join('');
$('#coupon-toggle').addEventListener('click',()=>{const panel=$('#coupon-panel');panel.hidden=!panel.hidden;$('#coupon-toggle').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)$('#coupon-input').focus({preventScroll:true});});
function clearCoupon(){appliedCoupon='';couponDiscount=0;$('#coupon-message').textContent='';$('#coupon-remove').hidden=true;$('#bill-discount').hidden=true;}
$('#coupon-remove').onclick=()=>{clearCoupon();$('#coupon-message').textContent='Coupon removed.';try{sessionStorage.removeItem(key+'-request');}catch{}renderOrder();};
$('#coupon-panel').addEventListener('submit',async event=>{
 event.preventDefault();if(couponBusy||placing||!cart.size)return;
 const code=$('#coupon-input').value.trim().toUpperCase();if(!code){$('#coupon-message').textContent='Enter a coupon code first.';return;}
 couponBusy=true;$('#coupon-apply').disabled=true;$('#coupon-apply').textContent='Checking…';$('#place-order').disabled=true;
 const snapshot=JSON.stringify([...cart]);
 try{
  const response=await fetch('/api/coupons/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({table,items:[...cart].map(([id,quantity])=>({id,quantity,notes:itemNotes[id]||''})),coupon:code})});
  const result=await response.json();
  if(snapshot!==JSON.stringify([...cart])){$('#coupon-message').textContent='Your cart changed. Apply the code again.';return;}
  if(!response.ok){clearCoupon();$('#coupon-message').textContent=result.error||'This coupon is not available.';renderOrder();return;}
  appliedCoupon=result.coupon;couponDiscount=result.discount;$('#discount-label').textContent=`${appliedCoupon} savings`;$('#coupon-message').textContent=`Coupon applied. You save ₹${couponDiscount}.`;try{sessionStorage.removeItem(key+'-request');}catch{}renderOrder();
 }catch{$('#coupon-message').textContent='Unable to check this code. Please try again.';}
 finally{couponBusy=false;$('#coupon-apply').disabled=false;$('#coupon-apply').textContent='Apply';$('#place-order').disabled=placing;}
});
