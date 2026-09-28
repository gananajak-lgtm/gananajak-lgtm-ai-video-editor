import type { AffiliateProduct } from "../shared/affiliate-factory";

export type AffiliateCreativePlan={hook:string;script:string;shots:Array<{order:number;narration:string;visualIntent:string}>;verifiedFacts:string[]};

export function verifiedAffiliateFacts(product:AffiliateProduct):string[]{
  return [
    `ชื่อสินค้า: ${product.title}`,
    product.description?.trim()? `รายละเอียด: ${product.description.trim()}` : "",
    product.price!=null? `ราคา: ${product.price} ${product.currency??""}`.trim() : "",
    product.sellerName?.trim()? `ร้าน: ${product.sellerName.trim()}` : "",
    typeof product.rating==="number"? `เรตติ้ง: ${product.rating}` : "",
    typeof product.soldCount==="number"? `ยอดขาย: ${product.soldCount}` : "",
    typeof product.commissionRate==="number"? `คอมมิชชัน: ${product.commissionRate}` : ""
  ].filter(Boolean);
}

export function buildAffiliateCreativePlan(product:AffiliateProduct):AffiliateCreativePlan{
  const facts=verifiedAffiliateFacts(product);
  const hook=`กำลังมองหา ${product.title} อยู่หรือเปล่า?`;
  const factLines=facts.slice(1,4);
  const narration=[hook,...factLines.map(f=>f.replace(/^[^:]+:\s*/,"")), "ดูรายละเอียดสินค้าจากลิงก์หรือตะกร้าที่แนบไว้"].filter(Boolean);
  return {hook,script:narration.join("\n"),verifiedFacts:facts,shots:narration.map((line,index)=>({order:index+1,narration:line,visualIntent:index===0?`เปิดด้วยภาพสินค้า ${product.title}`:`แสดงสินค้าโดยยึดข้อเท็จจริง: ${line}`}))};
}

export function buildAffiliateCreativePrompt(product:AffiliateProduct){
  const facts=verifiedAffiliateFacts(product);
  return [
    "สร้างสคริปต์วิดีโอขายสินค้าแนวตั้งแบบสั้นภาษาไทย",
    "ใช้ได้เฉพาะข้อเท็จจริงใน VERIFIED_FACTS เท่านั้น ห้ามเดาสรรพคุณ สเปก ราคา ส่วนลด ยอดขาย เรตติ้ง หรือคอมมิชชัน",
    "ถ้าข้อมูลใดไม่มี ให้ละเว้น ไม่ต้องเติมเอง",
    "โครงสร้าง: Hook สั้น → จุดเด่นจากข้อเท็จจริง → Call to action ที่ไม่รับประกันผลลัพธ์",
    "VERIFIED_FACTS:",
    ...facts.map(f=>`- ${f}`)
  ].join("\n");
}
