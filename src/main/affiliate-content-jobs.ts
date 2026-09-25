import type { AffiliateContentJob, AffiliateProduct } from "../shared/affiliate-factory";

export function createAffiliateContentJobs(products:AffiliateProduct[]):AffiliateContentJob[] {
  return products.map((product,index)=>({ id:`affiliate-job-${Date.now()}-${index}`, product, status:"imported", attachProduct:true }));
}

export function affiliateProductToTopic(product:AffiliateProduct) {
  const facts=[product.title, product.price != null ? `${product.price} ${product.currency ?? ""}`.trim() : "", product.sellerName ? `Seller: ${product.sellerName}` : ""].filter(Boolean);
  return `Create an affiliate product video using only verified product facts: ${facts.join(" | ")}. Do not invent price, specifications, sales, ratings, or commission.`;
}
