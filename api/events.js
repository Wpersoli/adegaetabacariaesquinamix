'use strict';
const A = require('../lib/esquina-auth');
const ALLOWED = new Set(['page_view','search_used','category_selected','product_added','cart_opened','checkout_opened','whatsapp_handoff']);
const PAGES = new Set(['home','products']);
const CATEGORIES = new Set(['','todos','promo','bebidas','tabacos','headshop','narguile','outros']);
const recent = new Map();
function rateLimited(key) {
  const now=Date.now(), prev=recent.get(key)||[];
  const keep=prev.filter(t=>now-t<60000);
  if(keep.length>=60)return true;
  keep.push(now);recent.set(key,keep);
  if(recent.size>2000){for(const [k,v] of recent)if(!v.length||now-v[v.length-1]>60000)recent.delete(k);}
  return false;
}
module.exports=async function(req,res){
  try{
    A.method(req,['POST']);
    const d=await A.body(req);
    const name=String(d.event||''),page=String(d.page||''),category=String(d.category||'');
    const id=Number.isInteger(d.productId)?d.productId:0;
    if(!ALLOWED.has(name)||!PAGES.has(page)||!CATEGORIES.has(category)||id<0||id>10000||(name==='product_added'&&id<1))
      return A.send(res,400,{code:'INVALID_EVENT'});
    const ip=String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||'unknown').split(',')[0].slice(0,80);
    if(rateLimited(ip))return A.send(res,429,{code:'RATE_LIMIT'});
    const c=A.config();
    await A.sbFetch(c,'/rest/v1/rpc/record_store_event',{method:'POST',admin:true,body:{
      p_event_name:name,p_page:page,p_category:category,p_product_id:id
    }});
    return A.send(res,204,{});
  }catch(e){
    if(e.message==='METHOD_NOT_ALLOWED')return A.send(res,405,{code:'METHOD_NOT_ALLOWED'},{Allow:'POST'});
    return A.send(res,503,{code:'UNAVAILABLE'});
  }
};