import type { AffiliateProduct } from "../shared/affiliate-factory";

export type AffiliateProductSearchResult={
  products:AffiliateProduct[];
  source:"catalog";
  searchedAt:string;
  query:string;
};

const text=(value:string|undefined)=>value?.toLocaleLowerCase()??"";

export function searchAffiliateCatalog(products:AffiliateProduct[],query:string,limit=24):AffiliateProductSearchResult{
  const normalized=query.trim().toLocaleLowerCase();
  const ranked=products
    .map((product)=>{
      const title=text(product.title),seller=text(product.sellerName),description=text(product.description);
      let score=0;
      if(!normalized) score=1;
      else {
        if(title===normalized) score+=100;
        if(title.startsWith(normalized)) score+=60;
        if(title.includes(normalized)) score+=40;
        if(seller.includes(normalized)) score+=20;
        if(description.includes(normalized)) score+=10;
        for(const token of normalized.split(/\s+/).filter(Boolean)){
          if(title.includes(token)) score+=8;
          if(seller.includes(token)) score+=4;
          if(description.includes(token)) score+=2;
        }
      }
      return {product,score};
    })
    .filter((entry)=>entry.score>0)
    .sort((a,b)=>b.score-a.score || (b.product.rating??0)-(a.product.rating??0) || (b.product.soldCount??0)-(a.product.soldCount??0))
    .slice(0,Math.max(1,Math.min(100,limit)))
    .map((entry)=>entry.product);
  return {products:ranked,source:"catalog",searchedAt:new Date().toISOString(),query:query.trim()};
}
