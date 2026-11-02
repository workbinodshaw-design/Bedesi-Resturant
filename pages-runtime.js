// Keep GitHub project links and table QR entry points in the correct subdirectory.
(() => {
 if(!location.hostname.endsWith('.github.io'))return;
 const base=new URL('.',document.currentScript.src),table=new URLSearchParams(location.search).get('table');
 const home=location.pathname===base.pathname||location.pathname===new URL('index.html',base).pathname;
 if(home&&table&&/^[A-Za-z]?\d{1,3}$/.test(table)){location.replace(new URL('table-menu.html'+location.search,base).href);return;}
 if(location.pathname.endsWith('/admin.html')){location.replace(new URL('admin-preview.html',base).href);return;}
 document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('a[href="/"]').forEach(link=>link.href=base.href));
})();
