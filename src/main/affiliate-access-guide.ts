import type { AffiliatePlatform } from "../shared/affiliate-factory";
export type AffiliateAccessMode="beginner-manual"|"connected-api";
export type AffiliateAccessGuide={platform:AffiliatePlatform;mode:AffiliateAccessMode;canCreateVideos:boolean;canSearchExternal:boolean;canAutoAttachProduct:boolean;headline:string;detail:string};
export function getAffiliateAccessGuide(platform:AffiliatePlatform,connected=false):AffiliateAccessGuide{
  if(platform==="shopee")return {platform,mode:"beginner-manual",canCreateVideos:true,canSearchExternal:false,canAutoAttachProduct:false,headline:"เริ่มทำคลิป Shopee ได้โดยไม่ต้องมี Open API",detail:"วางลิงก์สินค้า/ลิงก์ Affiliate ที่มีอยู่ แล้วให้ AI สร้างคลิปและข้อมูลโพสต์ได้ทันที การค้นสินค้าและปักสินค้าอัตโนมัติจะเปิดใช้ภายหลังเมื่อบัญชีมีสิทธิ์ API"};
  if(platform==="tiktok-shop"&&connected)return {platform,mode:"connected-api",canCreateVideos:true,canSearchExternal:true,canAutoAttachProduct:false,headline:"เชื่อม TikTok Shop Creator แล้ว",detail:"ค้นสินค้า Showcase ได้ แต่การแนบสินค้าเข้าวิดีโออัตโนมัติยังไม่เปิดจนกว่าจะยืนยัน capability"};
  return {platform,mode:"beginner-manual",canCreateVideos:true,canSearchExternal:false,canAutoAttachProduct:false,headline:"เริ่มด้วยการนำเข้าสินค้าแบบ manual",detail:"ใช้ลิงก์สินค้าจริงเพื่อสร้างคลิปได้โดยไม่ต้องรอสิทธิ์ API"};
}
