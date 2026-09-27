import assert from "node:assert/strict";
import { signTikTokShopRequest } from "./tiktok-shop-showcase-provider";

const params=new URLSearchParams({timestamp:"1700000000",page_size:"10",app_key:"abc"});
const a=signTikTokShopRequest({path:"/affiliate_creator/202405/showcases/products",query:params,appSecret:"secret"});
const b=signTikTokShopRequest({path:"/affiliate_creator/202405/showcases/products",query:new URLSearchParams({app_key:"abc",page_size:"10",timestamp:"1700000000"}),appSecret:"secret"});
assert.equal(a,b);
assert.match(a,/^[a-f0-9]{64}$/);
console.log("TikTok Shop showcase provider tests passed");
