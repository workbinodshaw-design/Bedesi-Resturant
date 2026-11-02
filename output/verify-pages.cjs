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
assert.equal(home.window.BEDESI_PAGES_PREVIEW,true);
home.events.DOMContentLoaded();
let prevented=false,stopped=false;
home.events.submit({target:{matches:()=>true},preventDefault:()=>prevented=true,stopImmediatePropagation:()=>stopped=true});
assert.ok(prevented&&stopped);
for(const name of ['index.html','delivery.html','table-menu.html','order.html','orders.html','admin.html'])assert.ok(fs.readFileSync(name,'utf8').includes('pages-runtime.js'));
console.log('PASS: Pages-only activation, QR redirect, admin isolation, submit blocking and entry-point integration.');
