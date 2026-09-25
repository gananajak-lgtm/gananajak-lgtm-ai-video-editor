import type { PublishPlatform } from "../shared/content-factory";

export type PublishConnectorCapability = {
  platform: PublishPlatform;
  mode: "direct" | "draft-upload" | "planned";
  requiresOAuth: boolean;
  readyForIntegration: boolean;
  note: string;
};

export const PUBLISH_CONNECTOR_CAPABILITIES: PublishConnectorCapability[] = [
  { platform:"youtube", mode:"direct", requiresOAuth:true, readyForIntegration:true, note:"YouTube Data API videos.insert supports authenticated video upload and metadata." },
  { platform:"tiktok", mode:"direct", requiresOAuth:true, readyForIntegration:true, note:"TikTok Content Posting API supports Direct Post and draft upload; app review/scopes apply." },
  { platform:"facebook", mode:"planned", requiresOAuth:true, readyForIntegration:false, note:"Connector pending provider-specific authorization and publishing implementation." },
  { platform:"instagram", mode:"planned", requiresOAuth:true, readyForIntegration:false, note:"Connector pending provider-specific authorization and publishing implementation." }
];

export function getPublishConnectorCapability(platform: PublishPlatform) {
  return PUBLISH_CONNECTOR_CAPABILITIES.find((entry) => entry.platform === platform);
}
