import type { AffiliateProduct } from "../shared/affiliate-factory";

export type AffiliateProductSearchResult={
  products:AffiliateProduct[];
  source:"catalog";
  searchedAt:string;
  query:string;
};

const text=(value:string|undefined)=>value?.toLocaleLowerCase()??"";

export function scoreAffiliateProduct(product:AffiliateProduct,query:string){const normalized=query.trim().toLocaleLowerCase(),title=text(product.title),seller=text(product.sellerName),description=text(product.description);let relevance=normalized?0:1;if(normalized){if(title===normalized)relevance+=100;if(title.startsWith(normalized))relevance+=60;if(title.includes(normalized))relevance+=40;if(seller.includes(normalized))relevance+=20;if(description.includes(normalized))relevance+=10;for(const token of normalized.split(/\\s+/).filter(Boolean)){if(title.includes(token))relevance+=8;if(seller.includes(token))relevance+=4;if(description.includes(token))relevance+=2;}}const evidence=(product.rating??0)*2+Math.log10(Math.max(1,(product.soldCount??0)+1))*3+(product.commissionRate??0)*10;return {relevance,evidence,total:relevance*100+evidence};}

export function explainAffiliateProduct(product:AffiliateProduct,query:string){const score=scoreAffiliateProduct(product,query),reasons:string[]=[];if(score.relevance>=100)reasons.push("ตรงคำค้นมาก");else if(score.relevance>=40)reasons.push("ตรงคำค้น");else if(score.relevance>0)reasons.push("เกี่ยวข้องกับคำค้น");if(typeof product.rating==="number"&&product.rating>=4.5)reasons.push("เรตติ้งสูง");if(typeof product.soldCount==="number"&&product.soldCount>=1000)reasons.push("ยอดขายสูง");if(typeof product.commissionRate==="number"&&product.commissionRate>0)reasons.push("มีข้อมูลคอมมิชชัน");return reasons.slice(0,3);}

export function rankAffiliateProducts(products:AffiliateProduct[],query:string){return products.map(product=>({product,score:scoreAffiliateProduct(product,query)})).filter(x=>x.score.relevance>0).sort((a,b)=>b.score.total-a.score.total).map(x=>x.product);}

export function searchAffiliateCatalog(products:AffiliateProduct[],query:string,limit=24):AffiliateProductSearchResult{const ranked=rankAffiliateProducts(products,query).slice(0,Math.max(1,Math.min(100,limit)));return {products:ranked,source:"catalog",searchedAt:new Date().toISOString(),query:query.trim()};}
