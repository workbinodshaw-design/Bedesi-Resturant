async page => {
  await page.setViewportSize({width:393,height:852});
  await page.goto('http://127.0.0.1:8085/delivery.html');
  await page.getByRole('searchbox',{name:'Search delivery menu'}).fill('Tandoori Chicken');
  await page.getByRole('button',{name:'Choose portion for Tandoori Chicken',exact:true}).click();
  await page.locator('[data-variant="13017151431"]').click();
  await page.locator('#mobile-basket-open').click();
  if((await page.locator('#basket-subtotal').textContent())!=='₹600')throw Error('Full portion price');
  await page.getByRole('button',{name:'Continue to delivery'}).click();
  const form=page.locator('#delivery-checkout');
  for(const [name,value] of Object.entries({name:'Recovery QA Customer',phone:'9999999999',address:'Disposable QA fixture address only',pincode:'111111'}))await form.locator(`[name=${name}]`).fill(value);
  await page.route('**/api/delivery/orders',route=>route.abort());
  await page.getByRole('button',{name:'Send order request'}).click();
  await page.locator('#delivery-error').waitFor({state:'visible'});
  if(!(await form.isVisible()))throw Error('Checkout lost on failure');
  if(!(await form.locator('[name=name]').inputValue()).includes('Recovery'))throw Error('Details lost');
  await page.screenshot({path:'output/playwright/delivery-checkout-recovery.png'});
  await page.unroute('**/api/delivery/orders');
  await page.getByRole('button',{name:'Send order request'}).click();
  await page.locator('#delivery-confirmation').waitFor({state:'visible'});
  return {fullPortion:600,failedRequestRetainedCartAndForm:true,retrySaved:true};
}
