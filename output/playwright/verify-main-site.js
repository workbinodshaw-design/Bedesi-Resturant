async page => {
  const base='http://127.0.0.1:8085';
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  await page.setViewportSize({width:393,height:852});
  await page.goto(base+'/');
  await page.getByRole('button',{name:'From the tandoor',exact:true}).click();
  check(await page.locator('.home-dish').count()===4,'Homepage menu tabs');
  await page.getByRole('link',{name:'Order for home',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search delivery menu'}).fill('Masala Tea');
  await page.getByRole('button',{name:'Add Masala Tea',exact:true}).click();
  await page.locator('#mobile-basket-open').click();
  await page.getByRole('button',{name:'Continue to delivery'}).click();
  const form=page.locator('#delivery-checkout');
  await form.locator('[name=name]').fill('Browser QA Customer');
  await form.locator('[name=phone]').fill('9999999999');
  await form.locator('[name=address]').fill('Browser test address. Disposable QA database only.');
  await form.locator('[name=pincode]').fill('111111');
  await form.locator('[name=notes]').fill('Test request, not a real customer order.');
  await page.getByRole('button',{name:'Send order request'}).click();
  await page.locator('#delivery-confirmation').waitFor({state:'visible'});
  const reference=(await page.locator('#delivery-reference').textContent()).replace('#','');
  check(reference.startsWith('D'),'Delivery reference');
  check(await page.locator('#delivery-confirmation').textContent().then(t=>t.includes('Awaiting restaurant confirmation')),'Pending confirmation is clear');
  await page.screenshot({path:'output/playwright/delivery-request-confirmation.png'});
  await page.goto(base+'/admin.html');
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.admin-order-row').filter({hasText:reference}).click();
  await page.locator('#admin-accept [name=fee]').fill('20');
  await page.getByRole('button',{name:'Accept order',exact:false}).click();
  await page.getByRole('button',{name:'Start preparing',exact:false}).click();
  await page.screenshot({path:'output/playwright/admin-order-desk.png'});
  await page.getByRole('button',{name:'Mark out for delivery',exact:false}).click();
  await page.getByRole('button',{name:'Mark delivered',exact:false}).click();
  await page.waitForFunction(()=>document.querySelector('#admin-detail .detail-title .order-status')?.textContent==='Delivered');
  check((await page.locator('#admin-detail .detail-title .order-status').textContent())==='Delivered','Admin lifecycle');
  await page.reload();
  await page.locator('.admin-order-row').filter({hasText:reference}).click();
  check((await page.locator('#admin-detail .detail-title .order-status').textContent())==='Delivered','Status persisted');
  const widths=[];
  for(const path of ['/','/delivery.html']){
    await page.goto(base+path);
    for(const width of [320,393,768,1440]){
      await page.setViewportSize({width,height:900});
      widths.push({path,width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
    }
  }
  check(widths.every(result=>!result.overflow),'Horizontal page overflow: '+JSON.stringify(widths));
  await page.goto(base+'/?table=07');
  check(await page.getByRole('heading',{name:'Bedesi table menu',exact:true}).count()===1,'Legacy QR routing');
  check(await page.locator('#table-number').textContent()==='07','QR table identity');
  await page.setViewportSize({width:393,height:852});
  await page.locator('#moods').dispatchEvent('pointerdown');
  await page.getByRole('group',{name:'Menu categories'}).getByRole('button',{name:'Tea',exact:true}).click();
  check(await page.locator('#recommended .food:not([hidden])').count()===7,'Table menu filter');
  await page.getByRole('button',{name:'Add Masala Tea',exact:true}).click();
  await page.locator('#review').click();
  await page.waitForURL('**/order.html?table=07');
  check((await page.locator('#order-items').textContent()).includes('Masala Tea'),'Table checkout preserved');
  await page.locator('#back-menu').click();
  await page.waitForURL('**/table-menu.html?table=07&return=1');
  check(await page.locator('#table-number').textContent()==='07','Table return route');
  check(errors.length===0,'Browser errors: '+errors.join(', '));
  return {deliveryReference:reference,adminLifecycle:'received → confirmed → preparing → out_for_delivery → delivered',widths,legacyQrAndCheckout:'passed',browserErrors:errors};
}
