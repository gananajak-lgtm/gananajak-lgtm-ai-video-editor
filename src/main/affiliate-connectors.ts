import type { AffiliateProductConnector } from "../shared/affiliate-factory";

export const AFFILIATE_CONNECTORS: AffiliateProductConnector[] = [
  { platform:"shopee", mode:"manual-import", canImportProduct:true, canCreateAffiliateLink:false, canAttachProduct:false },
  { platform:"lazada", mode:"official-api", canImportProduct:true, canCreateAffiliateLink:false, canAttachProduct:false },
  { platform:"tiktok-shop", mode:"official-api", canImportProduct:true, canCreateAffiliateLink:true, canAttachProduct:false }
];

export function getAffiliateConnector(platform:AffiliateProductConnector["platform"]) {
  return AFFILIATE_CONNECTORS.find((connector) => connector.platform === platform);
}
