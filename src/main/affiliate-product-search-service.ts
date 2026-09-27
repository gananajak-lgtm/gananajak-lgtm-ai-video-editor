import type { AffiliateProduct } from "../shared/affiliate-factory";
import { rankAffiliateProducts, searchAffiliateCatalog, type AffiliateProductSearchResult } from "./affiliate-product-search";

export type AffiliateExternalSearchProvider={
  id:string;
  label:string;
  configured():Promise<boolean>;
  search(query:string,limit:number):Promise<AffiliateProduct[]>;
};

export type UnifiedAffiliateSearchResult=Omit<AffiliateProductSearchResult,"source"> & {
  source:"catalog"|"catalog+external";
  providers:Array<{id:string;label:string;configured:boolean;count:number;error?:string}>;
};

function dedupe(products:AffiliateProduct[]){
  const seen=new Set<string>();
  return products.filter((product)=>{const key=product.sourceUrl.trim().toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
}

export async function searchAffiliateProducts(input:{catalog:AffiliateProduct[];query:string;limit?:number;providers?:AffiliateExternalSearchProvider[]}):Promise<UnifiedAffiliateSearchResult>{
  const limit=Math.max(1,Math.min(100,input.limit??24));
  const local=searchAffiliateCatalog(input.catalog,input.query,limit);
  const providerStates:UnifiedAffiliateSearchResult["providers"]=[];
  const external:AffiliateProduct[]=[];
  for(const provider of input.providers??[]){
    let configured=false;
    try{
      configured=await provider.configured();
      if(!configured){providerStates.push({id:provider.id,label:provider.label,configured:false,count:0});continue;}
      const found=await provider.search(input.query,limit);
      external.push(...found);
      providerStates.push({id:provider.id,label:provider.label,configured:true,count:found.length});
    }catch(error){
      providerStates.push({id:provider.id,label:provider.label,configured,count:0,error:error instanceof Error?error.message:String(error)});
    }
  }
  const merged=rankAffiliateProducts(dedupe([...external,...local.products]),input.query).slice(0,limit);
  return {products:merged,source:external.length?"catalog+external":"catalog",searchedAt:new Date().toISOString(),query:input.query.trim(),providers:providerStates};
}
