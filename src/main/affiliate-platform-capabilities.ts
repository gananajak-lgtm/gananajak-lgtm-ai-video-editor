import type { AffiliatePlatform } from "../shared/affiliate-factory";

export type AffiliateConnectorCapabilities = {
  platform:AffiliatePlatform;
  productImport:"official-api"|"manual-import";
  creatorAuthorization:boolean;
  sellerAuthorization:boolean;
  affiliateData:boolean;
  videoUpload:boolean;
  productAttachment:"verified"|"unverified";
  note:string;
};

export const AFFILIATE_CONNECTOR_CAPABILITIES:AffiliateConnectorCapabilities[]=[
  {platform:"shopee",productImport:"manual-import",creatorAuthorization:false,sellerAuthorization:false,affiliateData:false,videoUpload:false,productAttachment:"unverified",note:"Keep manual until an official creator/affiliate API capability is verified."},
  {platform:"lazada",productImport:"official-api",creatorAuthorization:false,sellerAuthorization:true,affiliateData:false,videoUpload:true,productAttachment:"unverified",note:"Official Open Platform documents seller authorization, product APIs and seller video upload; affiliate creator/cart attachment remains unverified."},
  {platform:"tiktok-shop",productImport:"official-api",creatorAuthorization:true,sellerAuthorization:true,affiliateData:true,videoUpload:false,productAttachment:"unverified",note:"Official Affiliate Creator APIs and creator OAuth are documented. Product attachment to a published video remains a separate capability and must be verified before enabling."}
];
