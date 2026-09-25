export type AffiliatePlatform = "shopee" | "lazada" | "tiktok-shop";

export type AffiliateProduct = {
  id:string;
  platform:AffiliatePlatform;
  sourceUrl:string;
  title:string;
  description?:string;
  price?:number;
  currency?:string;
  imageUrls:string[];
  commissionRate?:number;
  affiliateUrl?:string;
  sellerName?:string;
  rating?:number;
  soldCount?:number;
  importedAt:string;
};

export type AffiliateContentJobStatus = "imported" | "planning" | "ready" | "producing" | "rendered" | "publishing" | "published" | "failed";

export type AffiliateContentJob = {
  id:string;
  product:AffiliateProduct;
  status:AffiliateContentJobStatus;
  contentBatchItemId?:string;
  publishPlatform?:import("./content-factory").PublishPlatform;
  attachProduct:boolean;
  error?:string;
};

export type AffiliateProductConnector = {
  platform:AffiliatePlatform;
  mode:"official-api" | "browser-assisted" | "manual-import";
  canImportProduct:boolean;
  canCreateAffiliateLink:boolean;
  canAttachProduct:boolean;
};

export type AffiliateAccountStatus = "disconnected"|"connected"|"error";
export type AffiliateAccount = {
  platform:AffiliatePlatform;
  role:"creator"|"seller";
  status:AffiliateAccountStatus;
  displayName?:string;
  grantedScopes?:string[];
  error?:string;
};

export type AffiliateProductFactSource="manual"|"official-api"|"browser-assisted";
export type AffiliateProductFactField="title"|"description"|"price"|"currency"|"images"|"commissionRate"|"affiliateUrl"|"sellerName"|"rating"|"soldCount";
export type AffiliateProductProvenance={ source:AffiliateProductFactSource; verifiedFields:AffiliateProductFactField[]; capturedAt:string };
