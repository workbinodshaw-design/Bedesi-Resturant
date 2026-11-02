(() => {
  const groups = [
    { name: 'A little of everything', category: null, ids: [1301715394,1301715151,1301715145,1301715252] },
    { name: 'From the tandoor', category: 'Tandoor & Kebabs' },
    { name: 'Biryani cravings', category: 'Biryani, Pulao & Rice' },
    { name: 'Coffee & sips', category: 'Milkshakes & Cold Coffee' },
    { name: 'Chinese favourites', category: 'Chinese Main Course' },
  ];
  const tabs = document.querySelector('#home-menu-tabs'), grid = document.querySelector('#home-dishes');
  function render(index) {
    const group = groups[index];
    tabs.querySelectorAll('button').forEach((button,i) => button.setAttribute('aria-pressed', String(i===index)));
    const items = group.ids ? group.ids.map(id => dishes.find(d=>d.id===id)) : dishes.filter(d=>!d.hiddenFromMenu&&d.category===group.category).slice(0,4);
    grid.innerHTML = items.filter(Boolean).map(d => `<article class="home-dish"><a class="home-dish-photo" href="delivery.html?dish=${d.id}" aria-label="Order ${d.name}"><img src="${d.art}" alt="${d.name}" loading="lazy" width="420" height="420"><span class="diet-label ${d.diet}"><i></i>${d.diet==='nonveg'?'Non-veg':d.diet==='egg'?'Egg':'Veg'}</span></a><div class="home-dish-info"><div><h3><a href="delivery.html?dish=${d.id}">${d.displayName||d.name}</a></h3><p>${d.variants?'From ':''}₹${d.price}</p></div><a class="dish-plus" href="delivery.html?dish=${d.id}" aria-label="Add ${d.name}">+</a></div></article>`).join('');
  }
  tabs.innerHTML = groups.map((group,index)=>`<button type="button" data-group="${index}" aria-pressed="${index===0}">${group.name}</button>`).join('');
  tabs.addEventListener('click',event=>{const button=event.target.closest('[data-group]');if(button)render(Number(button.dataset.group));});
  render(0);
})();
