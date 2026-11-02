async page => {
 const base='http://127.0.0.1:8085',errors=[];page.on('pageerror',error=>errors.push(error.message));
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 async function fixture(name){
  const response=await page.request.post(base+'/api/delivery/orders',{data:{requestId:crypto.randomUUID(),customer:{name,phone:'9999999999',address:'Disposable admin QA address. Not a real order.',city:'Kokrajhar',pincode:'111111',notes:'Isolated browser test'},items:[{id:1301715153,quantity:2}]}});
  check(response.ok(),'Create isolated QA order');return (await response.json()).id;
 }
 const first=await fixture('Admin notes QA'),second=await fixture('=2+2');
 const initial=await (await page.request.get(base+'/api/admin/orders')).json();
 const newCount=initial.orders.filter(o=>o.status==='received').length;
 let refreshRequests=0;page.on('request',request=>{if(request.url()===base+'/api/admin/orders'&&request.method()==='GET')refreshRequests++;});
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/admin.html');
 await page.locator('.admin-order-row').filter({hasText:first}).waitFor({state:'visible'});
 const row=id=>page.locator('.admin-order-row').filter({hasText:id});
 await row(first).click();
 const note=page.locator('#admin-staff-note');
 await note.fill('Saved kitchen instruction <plain text>');await page.getByRole('button',{name:'Save note',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#admin-note-state').textContent.startsWith('Saved '));
 await note.fill('Unsaved draft retained while switching');await row(second).click();await row(first).click();
 check(await note.inputValue()==='Unsaved draft retained while switching','Staff draft lost while switching orders');
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 check(await note.inputValue()==='Unsaved draft retained while switching','Staff draft lost during refresh');
 await page.reload();await row(first).click();check(await note.inputValue()==='Saved kitchen instruction <plain text>','Saved note did not persist');
 await page.locator('#admin-date').selectOption('yesterday');check(await page.locator('.admin-order-row').count()===1,'Yesterday filter');
 await page.locator('#admin-date').selectOption('today');await page.locator('#admin-sort').selectOption('waiting');
 check((await page.locator('.admin-order-row').first().textContent()).includes('Waiting '),'Waiting longest sort');
 await page.locator('[data-quick=new]').click();check(await page.locator('.admin-order-row').count()===newCount,'New-request quick filter');
 await page.locator('#admin-search').fill(second);check(await page.locator('.admin-order-row').count()===1,'Search filter');
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();
 const download=await downloading;await download.saveAs('output/playwright/admin-export-qa.csv');
 await page.locator('#admin-search').fill('');await page.locator('#admin-sort').selectOption('newest');await page.locator('[data-filter=all]').click();await row(first).click();
 await page.locator('#admin-accept [name=fee]').fill('25');await page.getByRole('button',{name:'Accept order',exact:true}).click();
 await page.getByRole('button',{name:'Start preparing',exact:true}).waitFor({state:'visible'});
 await page.locator('[data-filter=all]').click();await row(first).click();await page.getByRole('button',{name:'Start preparing',exact:true}).click();
 await page.getByRole('button',{name:'Mark out for delivery',exact:true}).waitFor({state:'visible'});
 await page.emulateMedia({media:'print'});
 check(await page.locator('.print-ticket-heading').isVisible(),'Print heading missing');
 check(await page.locator('.admin-order-list').isHidden(),'Print includes other orders');
 check(await page.locator('.staff-note-form').isHidden(),'Print includes staff editing form');
 await page.emulateMedia({media:'screen'});
 await page.screenshot({path:'output/playwright/admin-desk-v2-desktop.png'});
 const sizes=[];for(const width of [320,393,768,1024,1440]){await page.setViewportSize({width,height:1000});sizes.push({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
 check(sizes.every(size=>!size.overflow),'Admin responsive overflow: '+JSON.stringify(sizes));
 await page.setViewportSize({width:393,height:852});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'output/playwright/admin-desk-v2-mobile.png'});
 await page.getByRole('button',{name:'Pause updates',exact:true}).click();
 await page.waitForTimeout(100);const before=refreshRequests;await page.waitForTimeout(11000);
 check(refreshRequests===before,'Auto-refresh continued while paused');
 check(await page.locator('#admin-pause').getAttribute('aria-pressed')==='true','Pause state');
 await page.getByRole('button',{name:'Resume updates',exact:true}).click();
 check(errors.length===0,'Browser errors: '+errors.join(', '));
 return {notesSaved:true,draftsRetained:true,dateFilters:true,waitingSort:true,exportFile:'output/playwright/admin-export-qa.csv',printSelectedOrderOnly:true,sizes,pauseResume:true,browserErrors:errors};
}
