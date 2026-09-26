import type { AffiliateProductConnector } from "../shared/affiliate-factory";
import { AFFILIATE_CONNECTOR_CAPABILITIES } from "./affiliate-platform-capabilities";

export const AFFILIATE_CONNECTORS:AffiliateProductConnector[]=AFFILIATE_CONNECTOR_CAPABILITIES.map((capability)=>({
  platform:capability.platform,
  mode:capability.productImport,
  canImportProduct:true,
  canCreateAffiliateLink:capability.affiliateData,
  canAttachProduct:capability.productAttachment==="verified"
}));

export function getAffiliateConnector(platform:AffiliateProductConnector["platform"]) {
  return AFFILIATE_CONNECTORS.find((connector) => connector.platform === platform);
}
