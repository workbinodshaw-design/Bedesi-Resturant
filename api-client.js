(() => {
 const routes=new Set(['/api/orders','/api/coupons/validate','/api/delivery/orders']);
 window.BedesiApi={async request(path,options={}){
  if(!routes.has(path))throw Error('This request is not supported.');
  const hosted=location.hostname.endsWith('.github.io');
  const base=hosted?window.BEDESI_ORDER_API:'';
  if(hosted&&!base)throw Error('Ordering is temporarily unavailable. Please try again shortly.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch((base||'')+path,{...options,signal:controller.signal,...(hosted?{credentials:'omit'}:{})});
   if(response.status>=500)throw Error('Unable to reach the restaurant. Please try again shortly.');
   return response;
  }catch(error){
   if(error.name==='AbortError'||error instanceof TypeError)throw Error('Connection interrupted. Please try again; your order details are still here.');
   throw error;
  }finally{clearTimeout(timer);}
 }};
})();
