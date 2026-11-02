let dietMode='all';
const $ = selector => document.querySelector(selector);
const rawTable = new URLSearchParams(location.search).get('table');
const table = rawTable && /^[A-Za-z]?\d{1,3}$/.test(rawTable) ? rawTable.toUpperCase() : 'R4';
$('#table-number').textContent = table;
$('#detail-table').textContent = table;
document.title = `Bedesi · Table ${table}`;
const cartKey = `bedesi-demo-table-${table}`;
const cart = new Map();
const dishIndex=new Map(dishes.map(d=>[d.id,d]));
const searchIndex=new Map(dishes.map(d=>[d.id,`${d.name} ${d.description} ${d.category}`.toLowerCase()]));
const variantParents=new Map();
for(const dish of dishes)for(const variant of dish.variants||[])variantParents.set(variant.id,dish.id);
let menuNodes=null,searchRenderTimer=0;
let selected='All', currentDish=null, draftQuantity=1, promoIndex=0, filterCategory='All', filterVeg=false;
function restoreCart() {
 try {
  const saved=JSON.parse(sessionStorage.getItem(cartKey)||'[]');
  if (Array.isArray(saved)) {
   cart.clear();
   saved.forEach(entry=>{if(Array.isArray(entry)&&dishes.some(d=>d.id===entry[0])&&Number.isInteger(entry[1])&&entry[1]>0&&entry[1]<=99)cart.set(entry[0],entry[1]);});
  }
 } catch { /* Browsing still works without session storage. */ }
}
restoreCart();
const quantity = id => cart.get(id)||0;
function menuQuantity(id){const d=dishIndex.get(id);return d?.variants?d.variants.reduce((n,v)=>n+quantity(v.id),0):quantity(id);}
function stepper(dish) {
 return `<div class="stepper" aria-label="${dish.name} quantity"><button data-change="-1" data-id="${dish.id}" aria-label="Remove ${dish.name}">−</button><span>${quantity(dish.id)}</span><button data-change="1" data-id="${dish.id}" aria-label="Add ${dish.name}" ${quantity(dish.id)>=99?'disabled':''}>+</button></div>`;
}
function addButton(dish,compact=false) {
 if(dish.variants){const count=menuQuantity(dish.id),target=dish.variants.find(v=>quantity(v.id)>0)?.id||dish.id;return `<button class="add variant-add" data-view="${target}" aria-label="Customize ${dish.displayName||dish.name}, ${count} added">${count?count+' added':'Choose'}<b>+</b></button>`;}
 return quantity(dish.id) ? stepper(dish) : `<button class="add ${compact?'compact-add':''}" data-change="1" data-id="${dish.id}" aria-label="Add ${dish.name}">${compact?'': 'Add '}<b>+</b></button>`;
}
// Delegate once per container so replacement controls never lose their click handlers.
function bindControls(root) {
 if(root.dataset.bound)return;
 root.dataset.bound='true';
 root.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||button.disabled)return;
  if(button.dataset.view){openDish(Number(button.dataset.view));return;}
  if(!button.dataset.change)return;
  const id=Number(button.dataset.id),dish=dishIndex.get(id);
  if(!dish)return;
  if(dish.variants&&button.dataset.change==='1'){openDish(id);return;}
  const next=Math.max(0,Math.min(99,quantity(id)+Number(button.dataset.change)));
  next?cart.set(id,next):cart.delete(id);if(!next)writeItemNote(id,'');
  updateCart();syncCartControls(id);
  $('#status').textContent=`${dish.name}, ${next} in your order`;
  requestAnimationFrame(()=>{const replacement=root.querySelector(`[data-controls="${id}"]`),dock=$('#review');if(!replacement||dock.hidden)return;const overlap=replacement.getBoundingClientRect().bottom-dock.getBoundingClientRect().top+12;if(overlap>0)window.scrollBy({top:overlap,behavior:'instant'});});
 });
}
// Update only the quantity controls: photos and card positions remain stable on Add.
function syncCartControls(changedId=null) {
 const affected=changedId===null?null:new Set([changedId,variantParents.get(changedId)].filter(id=>id!==undefined));
 const controls=affected?[...affected].flatMap(id=>[...document.querySelectorAll(`[data-controls="${id}"]`)]):document.querySelectorAll('[data-controls]');
 for(const control of controls){
  const d=dishIndex.get(Number(control.dataset.controls));
  control.innerHTML=addButton(d,control.dataset.compact==='true');
 }
 const cards=affected?[...affected].flatMap(id=>[...document.querySelectorAll(`[data-dish-id="${id}"]`)]):document.querySelectorAll('[data-dish-id]');
 for(const card of cards)card.classList.toggle('is-selected',menuQuantity(Number(card.dataset.dishId))>0);
 const badges=affected?[...affected].flatMap(id=>[...document.querySelectorAll(`[data-selected-count="${id}"]`)]):document.querySelectorAll('[data-selected-count]');
 for(const badge of badges){const count=quantity(Number(badge.dataset.selectedCount));badge.hidden=!count;badge.textContent=count;badge.setAttribute('aria-label',`${count} in your order`);}
}
function filteredDishes() {
 const query=$('#search').value.trim().toLowerCase();
 return dishes.filter(d=>!d.hiddenFromMenu&&(selected==='All'||d.category===selected)&&(dietMode==='all'||d.diet===dietMode)&&searchIndex.get(d.id).includes(query));
}
const menuSectionOrder=categories.filter(([name])=>name!=='All').map(([name])=>name);
function menuRow(d){return `<article class="food ${menuQuantity(d.id)?'is-selected':''}" data-dish-id="${d.id}"><button class="food-photo ${d.art&&!d.photo?'cutout':''}" data-view="${d.id}" aria-label="View ${d.name}"><img src="${dishVisual(d)}" alt="${d.name}" loading="lazy"></button><div class="food-info"><div class="food-name"><span class="food-type ${d.veg?'':'nonveg'}" aria-label="${d.diet==='egg'?'Contains egg':d.veg?'Vegetarian':'Non vegetarian'}"></span><h3><button class="dish-name-link" data-view="${d.id}">${d.displayName||d.name}</button></h3></div><span class="food-detail">${d.description}</span><span class="price">₹${d.price}</span></div><div class="food-bottom product-controls" data-controls="${d.id}">${addButton(d)}</div></article>`;}
function groupedMenu(items,prefix){return menuSectionOrder.map((name,index)=>{
 const group=items.filter(d=>d.category===name);if(!group.length)return '';
 return `<section class="menu-section" aria-labelledby="section-${prefix}-${index}"><div class="menu-section-heading"><h2 id="section-${prefix}-${index}">${name}</h2><span>${group.length} dishes</span></div><div class="section-items">${group.map(menuRow).join('')}</div></section>`;
}).join('');}
function render() {
 clearTimeout(searchRenderTimer);
 $('#clear-search').hidden=!$('#search').value;
 renderRecommended();updateFilterCount();updateMenuView();
}
function recommendedCard(d) {
 return `<article class="recommended-card ${quantity(d.id)?'is-selected':''}" data-dish-id="${d.id}"><span class="food-type recommended-diet ${d.veg?'':'nonveg'}" aria-label="${d.diet==='egg'?'Contains egg':d.veg?'Vegetarian':'Non vegetarian'}"></span><span class="selection-count" data-selected-count="${d.id}" ${quantity(d.id)?'':'hidden'} aria-label="${quantity(d.id)} in your order">${quantity(d.id)}</span><button class="recommended-photo ${d.art&&!d.photo?'cutout':''}" data-view="${d.id}" aria-label="View ${d.name}"><img src="${dishVisual(d)}" alt="${d.name}" loading="lazy"></button><span class="dish-tag tag-${d.id%3}">${d.category}</span><h3><button class="dish-name-link" data-view="${d.id}">${d.displayName||d.name}</button></h3><div class="recommended-bottom"><span class="price">₹${d.price}</span><span class="product-controls" data-controls="${d.id}" data-compact="true">${addButton(d,true)}</span></div></article>`;
}
function renderRecommended() {
 const rec=filteredDishes();
 if(!menuNodes){
  const root=$('#recommended');
  root.innerHTML=groupedMenu(dishes.filter(d=>!d.hiddenFromMenu),'home')+'<div class="menu-no-results" hidden><h3>No dishes found</h3><p>Try another search or clear your filters.</p><button id="reset-results" class="outline-button">Clear filters</button></div>';
  menuNodes={empty:root.querySelector('.menu-no-results'),sections:[...root.querySelectorAll('.menu-section')].map(section=>({section,count:section.querySelector('.menu-section-heading > span'),cards:[...section.querySelectorAll('.food')].map(card=>({card,id:Number(card.dataset.dishId)}))}))};
  $('#reset-results').onclick=resetFilters;
  bindControls(root);
 }
 const visible=new Set(rec.map(d=>d.id));
 for(const group of menuNodes.sections){
  let count=0;
  for(const {card,id} of group.cards){const hidden=!visible.has(id);if(card.hidden!==hidden)card.hidden=hidden;if(!hidden)count++;}
  if(group.section.hidden!==(count===0))group.section.hidden=count===0;
  const label=`${count} dishes`;if(group.count.textContent!==label)group.count.textContent=label;
 }
 menuNodes.empty.hidden=rec.length>0;
 const summary=document.querySelector('.recommended-heading'),query=$('#search').value.trim();
 summary.hidden=selected!=='All'&&!query&&rec.length>0;
 summary.querySelector('h2').textContent=query?'Search results':selected==='All'?'Our menu':selected;
 document.querySelectorAll('[data-mood]').forEach(button=>{
  const active=moods[Number(button.dataset.mood)].category===selected;
  if(button.classList.contains('selected-category')!==active)button.classList.toggle('selected-category',active);
  if(button.getAttribute('aria-pressed')!==String(active))button.setAttribute('aria-pressed',String(active));
 });
}
function updateMenuView() {
 $('#home-experience').hidden=Boolean($('#search').value.trim())||selected!=='All';
}
function renderFilterCategories() {
 $('#filter-categories').innerHTML=categories.map(([name])=>`<button data-category="${name}" aria-pressed="${filterCategory===name}" class="${filterCategory===name?'active':''}">${name==='All'?'All dishes':name}</button>`).join('');
}
$('#filter-categories').addEventListener('click',event=>{
 const button=event.target.closest('[data-category]');if(!button)return;
 filterCategory=button.dataset.category;renderFilterCategories();
});
function updateFilterCount() {
 const count=Number($('#veg').checked)+Number(selected!=='All');
 $('#filter-count').hidden=!count;$('#filter-count').textContent=count;
 $('#filter-open').setAttribute('aria-label',`Open menu filters${count?`, ${count} active`:''}`);
}
function updateCart() {
 try{sessionStorage.removeItem(cartKey+'-request');}catch{}
 let count=0,total=0;cart.forEach((qty,id)=>{count+=qty;total+=qty*dishIndex.get(id).price;});
 $('#review').hidden=!count;document.body.classList.toggle('has-cart',count>0);
 $('#cart-count').textContent=`${count} ${count===1?'item':'items'}`;$('#cart-total').textContent=`₹${total}`;$('#cart-badge').textContent=count;
 $('#cart-thumbnails').innerHTML=[...cart].slice(0,3).map(([id,qty])=>{const d=dishIndex.get(id);return `<span class="cart-thumb"><img src="${dishVisual(d)}" alt="${d.name}">${qty>1?`<small>${qty}</small>`:''}</span>`;}).join('');
 $('#review').setAttribute('aria-label',`Continue order, ${count} ${count===1?'item':'items'}, ₹${total}`);
 try{sessionStorage.setItem(cartKey,JSON.stringify([...cart]));}catch{/* Keep the current order in memory. */}
}
const moodPaths={
 starters:`<defs><linearGradient id="skewer-orange" x2="0" y2="1"><stop stop-color="#ffba57"/><stop offset="1" stop-color="#e16f36"/></linearGradient></defs><ellipse cx="40" cy="65" rx="28" ry="6" fill="#d9ab4a" opacity=".18"/><path d="m18 65 18-49m1 51 18-49m1 50L71 25" stroke="#be8c52" stroke-width="3" stroke-linecap="round"/><path d="m26 26 13 5-5 13-13-5zM18 46l13 5-5 13-13-5zM46 28l13 5-5 13-13-5zM38 49l13 5-5 13-13-5zM59 40l12 4-4 12-13-4z" fill="url(#skewer-orange)"/><path d="m24 39 12 4-3 7-12-4zM43 41l12 4-3 7-12-4zM56 54l12 4-3 7-12-4z" fill="#77a45e"/><path d="m30 27 5 2m15 2 5 2M22 49l5 2" stroke="#ffe0a3" stroke-width="2" stroke-linecap="round"/>`,
 main:`<defs><linearGradient id="curry-bowl" x2="0" y2="1"><stop stop-color="#fffafa"/><stop offset="1" stop-color="#d3c9d8"/></linearGradient></defs><ellipse cx="40" cy="66" rx="26" ry="6" fill="#b67b94" opacity=".18"/><path d="M12 37h56c-1 24-13 31-28 31S13 61 12 37Z" fill="url(#curry-bowl)"/><ellipse cx="40" cy="36" rx="28" ry="10" fill="#fff"/><ellipse cx="40" cy="36" rx="24" ry="7" fill="#e98b4b"/><path d="m26 31 9 3-2 7-10-3zM44 31l10 3-2 7-10-3z" fill="#ffbb71"/><path d="M36 36c-6-7 3-12 5-4 5-6 11 0 4 5" fill="#679c64"/><path d="M32 12q-6 5-1 10m14-13q-6 6-1 12" stroke="#b497ad" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
 rice:`<defs><linearGradient id="rice-bowl" x2="0" y2="1"><stop stop-color="#8faed4"/><stop offset="1" stop-color="#5989b6"/></linearGradient></defs><ellipse cx="40" cy="66" rx="27" ry="6" fill="#779cb8" opacity=".17"/><path d="M12 36h56c-2 24-13 31-28 31S14 60 12 36Z" fill="url(#rice-bowl)"/><ellipse cx="40" cy="36" rx="28" ry="9" fill="#dae7ee"/><path d="M17 35c-1-9 5-13 12-12 1-9 13-10 18-4 12-5 22 4 17 17L17 35Z" fill="#fff8db"/><path d="m23 30 5 2m6-9 5 3m8-2 5 2m2 7 5 1m-25-3 5 2m-17-1 4 1" stroke="#e9ba65" stroke-width="2.5" stroke-linecap="round"/><path d="M42 29q-9-10-2-13 8 4 4 12m0-2q5-8 10-4-2 8-10 7" fill="#74a65f"/>`,
 pizza:`<defs><linearGradient id="pizza-cheese" x2="0" y2="1"><stop stop-color="#ffe882"/><stop offset="1" stop-color="#f3b857"/></linearGradient></defs><ellipse cx="40" cy="66" rx="25" ry="5" fill="#d59668" opacity=".17"/><path d="m18 20 48 13-34 34L18 20Z" fill="url(#pizza-cheese)"/><path d="m18 20 48 13" stroke="#d78b51" stroke-width="9" stroke-linecap="round"/><path d="m19 18 47 12" stroke="#f7bd77" stroke-width="4" stroke-linecap="round"/><circle cx="29" cy="33" r="6" fill="#d86653"/><circle cx="46" cy="38" r="6" fill="#d86653"/><circle cx="35" cy="51" r="5" fill="#d86653"/><path d="m38 29 5 3-4 4m-9 9 4 2-3 4m17-5 3 2" stroke="#6b9b57" stroke-width="3" fill="none" stroke-linecap="round"/>`,
 burger:`<defs><linearGradient id="burger-bun" x2="0" y2="1"><stop stop-color="#ffc96e"/><stop offset="1" stop-color="#df9b4b"/></linearGradient></defs><ellipse cx="40" cy="67" rx="27" ry="5" fill="#a194bd" opacity=".18"/><path d="M14 34c1-25 51-25 52 0H14Z" fill="url(#burger-bun)"/><path d="M14 35h52v8H14z" fill="#79a463"/><path d="m14 42 9 6 8-4 10 7 11-7 14 2" stroke="#ffdc6c" stroke-width="7" stroke-linejoin="round"/><path d="M14 49h52v8H14z" fill="#815446"/><path d="M14 56h52c2 14-54 14-52 0Z" fill="url(#burger-bun)"/><path d="m26 25 3-1m8-3h3m10 5 3 1m-14 2h3" stroke="#fff0c9" stroke-width="2" stroke-linecap="round"/>`,
 dessert:`<defs><linearGradient id="cake-cream" x2="0" y2="1"><stop stop-color="#ffe5ec"/><stop offset="1" stop-color="#e3a5bd"/></linearGradient></defs><ellipse cx="40" cy="68" rx="22" ry="5" fill="#8eb79b" opacity=".18"/><path d="m20 43 5 22h30l5-22H20Z" fill="#b5a3d0"/><path d="m29 46 2 17m9-17v17m11-17-2 17" stroke="#d6c6e9" stroke-width="2"/><path d="M17 42c-3-8 3-15 11-15-2-9 9-15 16-9 3 8 14 5 13 17 10 1 11 12 2 13H23c-5 0-8-2-6-6Z" fill="url(#cake-cream)"/><circle cx="40" cy="15" r="6" fill="#d36b8a"/><path d="M40 10q-1-7 6-9" stroke="#61945e" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="m28 34 3 2m12-8 3 2m5 11 3-2" stroke="#fff5ef" stroke-width="2.5" stroke-linecap="round"/>`
};
const moods=[{name:'All',category:'All',color:'purple'},...menuSectionOrder.map((name,i)=>({name,category:name,color:['yellow','pink','blue','peach','purple','mint'][i%6],image:categoryVisuals[name]}))];
$('#moods').innerHTML=moods.map((m,i)=>`<button class="mood-card mood-${m.color}" data-mood="${i}" aria-pressed="false"><span class="mood-icon-wrap">${m.category==='All'?'<svg class="all-category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>':`<img src="${m.image}" alt="" loading="lazy">`}</span><span class="mood-label">${m.name}</span></button>`).join('');
$('#moods').querySelectorAll('button').forEach(button=>button.onclick=()=>{
 const mood=moods[Number(button.dataset.mood)];selected=selected===mood.category?'All':mood.category;$('#search').value='';render();
 scrollToMenu();
});
const promos=[dishes.find(d=>d.name==='Masala Tea'),dishes.find(d=>d.name==='Chicken Tikka Kebab'),dishes.find(d=>d.category==='Biryani, Pulao & Rice')].filter(Boolean).map(d=>({id:d.id}));
function renderPromo() {
 const carousel=document.querySelector('.promo-carousel');
 carousel.innerHTML=`<div class="promo-track" aria-label="Featured dishes">${promos.map((promo,i)=>{const d=dishes.find(d=>d.id===promo.id);return `<button class="promo-card promo-tone-${i}" data-promo-dish="${d.id}" aria-label="View ${d.name}"><span>${d.name}<small>₹${d.price}</small></span><img src="${dishVisual(d)}" alt="${d.name}"></button>`;}).join('')}</div>`;
 carousel.querySelectorAll('[data-promo-dish]').forEach(button=>button.onclick=()=>openDish(Number(button.dataset.promoDish)));
}
function setDraftQuantity(next) {
 const max=Math.max(0,99-quantity(currentDish.id));draftQuantity=Math.min(max,Math.max(1,next));
 $('#dish-quantity').textContent=draftQuantity;$('#dish-minus').disabled=draftQuantity<=1;$('#dish-plus').disabled=draftQuantity>=max;$('#dish-add').disabled=max===0;
 $('#dish-action-total').textContent=`₹${currentDish.price*draftQuantity}`;
}
function openDish(id) {
 currentDish=dishIndex.get(id);
 $('#dish-title').textContent=currentDish.name;$('#dish-price').textContent=`₹${currentDish.price}`;
 $('#dish-image').src=dishVisual(currentDish);$('#dish-image').alt=currentDish.name;
 $('#dish').classList.toggle('has-cutout',!!currentDish.art&&!currentDish.photo);
 $('#dish-kind').textContent=`${currentDish.diet==='egg'?'Contains egg':currentDish.veg?'Vegetarian':'Non vegetarian'} · ${currentDish.category}`;
 $('#dish-description').textContent=currentDish.description;
 $('#dish-note').value=readItemNote(currentDish.id);
 $('#dish-options').hidden=!currentDish.variants;
 if(currentDish.variants){$('#dish-options').innerHTML='<legend>Choose your portion</legend>'+currentDish.variants.map(v=>`<label><input type="radio" name="portion" value="${v.id}" ${v.id===id?'checked':''}>${v.label}<strong>₹${v.price}</strong></label>`).join('');}
 const related=dishes.filter(d=>!d.hiddenFromMenu&&d.id!==id&&d.category===currentDish.category).slice(0,3);
 $('#dish-suggestions').innerHTML=related.map(d=>`<button data-related="${d.id}"><span><img src="${dishVisual(d)}" alt=""></span>${d.name}</button>`).join('');
 $('#dish-suggestions').querySelectorAll('button').forEach(button=>button.onclick=()=>openDish(Number(button.dataset.related)));
 setDraftQuantity(1);if(!$('#dish').open)$('#dish').showModal();$('#dish').scrollTop=0;
}
$('#dish-minus').onclick=()=>setDraftQuantity(draftQuantity-1);$('#dish-plus').onclick=()=>setDraftQuantity(draftQuantity+1);
$('#dish-add').onclick=()=>{
 const id=currentDish.id;writeItemNote(id,$('#dish-note').value);cart.set(id,Math.min(99,quantity(id)+draftQuantity));updateCart();syncCartControls(id);$('#dish').close();
 $('#status').textContent=`${draftQuantity} ${currentDish.name} added to your order`;
};
function resetFilters(){dietMode='all';syncDiet();selected='All';$('#veg').checked=false;$('#search').value='';render();}
$('#search').oninput=()=>{selected='All';$('#clear-search').hidden=!$('#search').value;clearTimeout(searchRenderTimer);searchRenderTimer=setTimeout(render,80);};
$('#clear-search').onclick=()=>{$('#search').value='';render();$('#search').focus();};
$('#expand-moods').onclick=()=>$('#browse-categories').showModal();
$('#filter-open').onclick=()=>{filterCategory=selected;filterVeg=$('#veg').checked;renderFilterCategories();$('#filters').showModal();};
$('#clear-filters').onclick=()=>{filterCategory='All';$('#veg').checked=false;renderFilterCategories();};
$('#apply-filters').onclick=()=>{selected=filterCategory;filterVeg=$('#veg').checked;dietMode=filterVeg?'veg':'all';syncDiet();$('#filters').close('apply');$('#search').value='';render();window.scrollTo({top:0});};
$('#filters').addEventListener('close',()=>{if($('#filters').returnValue!=='apply')$('#veg').checked=filterVeg;$('#filters').returnValue='';});

$('#quick-menu').onclick=()=>$('#navigation').showModal();
$('#navigation-menu').onclick=()=>{$('#navigation').close();selected='All';$('#search').value='';render();window.scrollTo({top:0,behavior:'auto'});};
const goToOrder=()=>{location.href=`order.html?table=${encodeURIComponent(table)}`;};
$('#navigation-order').onclick=goToOrder;$('#review').onclick=goToOrder;
$('#navigation-help').onclick=()=>{$('#navigation').close();$('#info-title').textContent='Need help?';$('#info-content').textContent='For assistance, please speak to a staff member.';$('#info').showModal();};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>{const dialog=button.closest('dialog');if(dialog.id==='filters')$('#veg').checked=filterVeg;dialog.close();});
const expandButton=$('#expand-moods');document.querySelector('.menu-tabs').append(expandButton);
renderPromo();render();updateCart();
window.addEventListener('pageshow',event=>{if(event.persisted){restoreCart();updateCart();syncCartControls();render();}});

// Native dialogs support Escape, backdrop dismissal, and a predictable scroll start.
document.querySelectorAll('dialog').forEach(dialog=>{
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
});

function syncDiet(){document.querySelectorAll('[data-diet]').forEach(b=>{const active=b.dataset.diet===dietMode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$('#veg').checked=dietMode==='veg';}
document.querySelector('.diet-modes').addEventListener('click',e=>{const button=e.target.closest('[data-diet]');if(!button)return;dietMode=button.dataset.diet;syncDiet();render();});

let menuScrollFrame=0;
function scrollToMenu(){
 cancelAnimationFrame(menuScrollFrame);
 menuScrollFrame=requestAnimationFrame(()=>{
  const summary=document.querySelector('.recommended-heading');
  const heading=summary.hidden?$('#recommended .menu-section:not([hidden]) .menu-section-heading')||menuNodes.empty:summary;
  const header=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height'));
  const top=window.scrollY+heading.getBoundingClientRect().top-header-12;
  window.scrollTo({top:Math.max(0,top),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 });
}

$('#dish-options').addEventListener('change',event=>{const id=Number(event.target.value);if(dishes.some(d=>d.id===id))openDish(id);});
$('#browse-list').innerHTML=menuSectionOrder.map((name,i)=>`<button data-browse-category="${i}"><img src="${categoryVisuals[name]}" alt="" loading="lazy"><span>${name}</span><small>${dishes.filter(d=>!d.hiddenFromMenu&&d.category===name).length}</small></button>`).join('');
$('#browse-list').addEventListener('click',event=>{const button=event.target.closest('[data-browse-category]');if(!button)return;selected=menuSectionOrder[Number(button.dataset.browseCategory)];$('#search').value='';render();$('#browse-categories').close();scrollToMenu();});

const menuViewKey=`bedesi-menu-view-${table}`;
window.addEventListener('pagehide',()=>{try{sessionStorage.setItem(menuViewKey,JSON.stringify({selected,dietMode,query:$('#search').value,y:window.scrollY}));}catch{}});
if(new URLSearchParams(location.search).get('return')==='1'){
 try{const view=JSON.parse(sessionStorage.getItem(menuViewKey)||'null');if(view){selected=menuSectionOrder.includes(view.selected)?view.selected:'All';dietMode=['all','veg','egg','nonveg'].includes(view.dietMode)?view.dietMode:'all';$('#search').value=typeof view.query==='string'?view.query:'';syncDiet();render();requestAnimationFrame(()=>window.scrollTo({top:Math.max(0,Number(view.y)||0),behavior:'instant'}));}}catch{}
}

const linkedDish=Number(new URLSearchParams(location.search).get('dish'));
if(linkedDish&&dishes.some(d=>d.id===linkedDish))openDish(linkedDish);

function readItemNote(id){try{const notes=JSON.parse(sessionStorage.getItem(cartKey+'-item-notes')||'{}');return typeof notes?.[id]==='string'?notes[id].slice(0,300):'';}catch{return '';}}
function writeItemNote(id,value){try{let notes=JSON.parse(sessionStorage.getItem(cartKey+'-item-notes')||'{}');if(!notes||Array.isArray(notes)||typeof notes!=='object')notes={};if(value)notes[id]=value.slice(0,300);else delete notes[id];sessionStorage.setItem(cartKey+'-item-notes',JSON.stringify(notes));sessionStorage.removeItem(cartKey+'-request');}catch{}}

// Demonstrate the category rail once, then let the guest control it.
(() => {
 const rail=$('#moods'),next=$('#category-next');
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let delay=0,returnTimer=0,finishTimer=0,autoSwiping=false,interacted=false,atEnd=null,hasOverflow=null;
 function updateRail() {
  const max=rail.scrollWidth-rail.clientWidth;
  const overflow=max>1;
  if(overflow!==hasOverflow){next.hidden=!overflow;hasOverflow=overflow;}
  const end=max>0&&rail.scrollLeft>=max-2;
  if(end===atEnd)return;
  atEnd=end;next.classList.toggle('at-end',end);
  $('#category-swipe-text').textContent=end?'Back to start':'Swipe left';
  next.setAttribute('aria-label',end?'Back to first categories':'Show next categories');
 }
 function stopIntro() {
  interacted=true;clearTimeout(delay);clearTimeout(returnTimer);clearTimeout(finishTimer);
  if(autoSwiping){rail.scrollTo({left:rail.scrollLeft,behavior:'instant'});autoSwiping=false;}
  next.classList.remove('is-introducing');
 }
 function introduce() {
  if(interacted||motion.matches||document.hidden||document.querySelector('dialog[open]')||rail.scrollLeft>1||rail.scrollWidth<=rail.clientWidth||new URLSearchParams(location.search).get('return')==='1')return;
  next.classList.add('is-introducing');
  const first=rail.children[0],second=rail.children[1];
  if(!first||!second)return;
  const step=second.offsetLeft-first.offsetLeft;
  autoSwiping=true;
  rail.scrollTo({left:step,behavior:'smooth'});
  returnTimer=setTimeout(()=>{
   if(interacted)return;
   rail.scrollTo({left:0,behavior:'smooth'});
   finishTimer=setTimeout(()=>{autoSwiping=false;next.classList.remove('is-introducing');},700);
  },1000);
 }
 for(const name of ['pointerdown','touchstart','wheel','keydown'])rail.addEventListener(name,stopIntro,{passive:true});
 next.addEventListener('click',()=>{
  stopIntro();const max=rail.scrollWidth-rail.clientWidth;
  rail.scrollTo({left:rail.scrollLeft>=max-2?0:Math.min(max,rail.scrollLeft+rail.clientWidth+10),behavior:motion.matches?'instant':'smooth'});
 });
 rail.addEventListener('scroll',updateRail,{passive:true});
 motion.addEventListener('change',()=>{if(motion.matches)stopIntro();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopIntro();});
 window.addEventListener('pagehide',stopIntro);
 new ResizeObserver(updateRail).observe(rail);
 const observer=new IntersectionObserver(entries=>{
  if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();delay=setTimeout(introduce,450);}
 },{threshold:.8});
 observer.observe(rail);updateRail();
})();

// Native horizontal scrolling drives only small card transforms, once per frame.
(() => {
 const rail=$('#moods'),cards=[...rail.children],motion=matchMedia('(prefers-reduced-motion: reduce)');
 let step=1,frame=0;
 const previous=new Map();
 cards.forEach((card,index)=>card.style.setProperty('--card-order',index+1));
 function paint() {
  frame=0;
  const progress=rail.scrollLeft/step;
  cards.forEach((card,index)=>{
   const depth=motion.matches?0:Math.max(0,progress-index),layer=Math.min(3,depth);
   const inset=motion.matches?0:Math.min(1,progress)*24;
   const key=`${layer.toFixed(2)}:${inset.toFixed(2)}:${depth>=4}`;
   if(previous.get(card)===key)return;
   previous.set(card,key);
   card.style.setProperty('--stack-x',`${(inset-8*layer).toFixed(2)}px`);
   card.style.setProperty('--stack-y',`${(2*layer).toFixed(2)}px`);
   card.style.setProperty('--stack-scale',(1-layer*.045).toFixed(3));
   card.style.setProperty('--stack-opacity',depth>=4?'0':'1');
   card.style.pointerEvents=depth>=4?'none':'';
  });
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(paint);}
 function measure(){
  const enabled=!motion.matches;
  rail.classList.toggle('category-stack',enabled);
  step=parseFloat(getComputedStyle(cards[0]).width)+parseFloat(getComputedStyle(rail).columnGap);
  previous.clear();schedule();
 }
 rail.addEventListener('scroll',schedule,{passive:true});
 rail.addEventListener('focusin',event=>{
  const index=cards.indexOf(event.target.closest('.mood-card'));
  if(index>=0&&index<rail.scrollLeft/step-1)rail.scrollTo({left:index*step,behavior:'instant'});
 });
 new ResizeObserver(measure).observe(rail);
 motion.addEventListener('change',measure);
 window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));
 measure();
})();
