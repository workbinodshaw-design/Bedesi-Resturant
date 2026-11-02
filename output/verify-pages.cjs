const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('pages-runtime.js','utf8');
function run(host,path,search=''){
  const events={},redirects=[];
  const location={hostname:host,pathname:path,search,replace:url=>redirects.push(url)};
  const document={currentScript:{src:`https://${host}/Bedesi-Resturant/pages-runtime.js`},addEventListener:(name,handler)=>events[name]=handler,querySelectorAll:()=>[],querySelector:()=>null};
  const window={};vm.runInNewContext(source,{window,document,location,URL,URLSearchParams,Node:{TEXT_NODE:3}});
  return {window,events,redirects};
}
assert.equal(run('127.0.0.1','/').window.BEDESI_PAGES_PREVIEW,undefined);
const qr=run('workbinodshaw-design.github.io','/Bedesi-Resturant/','?table=07');
assert.equal(qr.redirects[0],'https://workbinodshaw-design.github.io/Bedesi-Resturant/table-menu.html?table=07');
const admin=run('workbinodshaw-design.github.io','/Bedesi-Resturant/admin.html');
assert.equal(admin.redirects[0],'https://workbinodshaw-design.github.io/Bedesi-Resturant/admin-preview.html');
const home=run('workbinodshaw-design.github.io','/Bedesi-Resturant/');
assert.equal(home.window.BEDESI_PAGES_PREVIEW,undefined);
home.events.DOMContentLoaded();
assert.equal(home.events.submit,undefined);
assert.equal(home.events.click,undefined);
for(const name of ['order.html','delivery.html']){
 const html=fs.readFileSync(name,'utf8');assert.ok(html.includes('api-client.js')&&html.includes('order-api-config.js'));
}
const client=fs.readFileSync('api-client.js','utf8');
(async()=>{
 for(const hosted of [true,false]){
  const calls=[],window={BEDESI_ORDER_API:'https://orders.example.test'};
  vm.runInNewContext(client,{window,location:{hostname:hosted?'workbinodshaw-design.github.io':'127.0.0.1'},AbortController,setTimeout,clearTimeout,fetch:async(url)=>{calls.push(url);return {status:200};}});
  await window.BedesiApi.request('/api/orders',{method:'POST'});
  assert.equal(calls[0],hosted?'https://orders.example.test/api/orders':'/api/orders');
  await assert.rejects(()=>window.BedesiApi.request('/api/admin/orders'));
 }
 console.log('PASS: QR redirects, private admin, active ordering, hosted/local API routing and public route allowlist.');
})().catch(error=>{console.error(error);process.exitCode=1;});
