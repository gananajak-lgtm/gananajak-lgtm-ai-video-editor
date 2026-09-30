const MAX_BYTES = 8_000_000;
const attempts = new Map();
const daily = new Map();
let busy = 0;
const response = (status, data) => new Response(JSON.stringify(data), {
  status, headers: {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}
});
const problem = (error,status=400) => Object.assign(new Error(error),{status});
function equalSecret(a,b) {
  if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
function limited(key,max,windowMs,now=Date.now()){
  const seen=(attempts.get(key)||[]).filter(ts=>ts>now-windowMs);
  if(seen.length>=max){attempts.set(key,seen);return true;}
  attempts.set(key,[...seen,now]);return false;
}
function verifyImage(uri) {
  if(typeof uri!=="string")throw problem("กรุณาอัปโหลดภาพสินค้า");
  const match=/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/]+={0,2})$/.exec(uri);
  if(!match)throw problem("รองรับภาพ PNG, JPG และ WebP");
  const raw=atob(match[2]);
  if(raw.length<32||raw.length>6_000_000)throw problem("ภาพไม่ถูกต้องหรือใหญ่เกิน 6 MB",413);
  const sig=(bytes)=>bytes.every((n,i)=>raw.charCodeAt(i)===n);
  const png=sig([137,80,78,71,13,10,26,10]);
  const jpeg=sig([255,216,255]);
  const webp=sig([82,73,70,70])&&[87,69,66,80].every((n,i)=>raw.charCodeAt(i+8)===n);
  if(!((match[1]==="png"&&png)||(match[1]==="jpeg"&&jpeg)||(match[1]==="webp"&&webp)))
    throw problem("เนื้อหาภาพไม่ตรงกับชนิดไฟล์");
  return uri;
}
function systemPrompt(seconds) {
 return [
  "คุณเป็นผู้ช่วยสร้างคอนเทนต์ Affiliate ภาษาไทย วิเคราะห์เฉพาะข้อมูลที่มองเห็นชัดในภาพหน้าจอ",
  "ห้ามแต่งราคา ยอดขาย ส่วนลด คะแนนรีวิว วัสดุ สรรพคุณ การรับประกัน ผลการใช้งาน หรืออ้างว่าใช้สินค้าจริงหากไม่มีหลักฐาน",
  "หากไม่พบข้อมูลให้ไม่กล่าวถึง; รีวิวต้องโปร่งใส ไม่สัญญาผลลัพธ์ และระบุว่าอาจได้รับค่าคอมมิชชัน",
  "ตอบ JSON object เท่านั้น โดยมี productName, visibleFacts array, uncertainFacts array, caption, hashtags array, pinnedComment, cta, scenes array",
  "สร้าง scenes จำนวน "+(seconds/10)+" ฉากต่อเนื่องกัน แต่ละฉากมี visualPrompt, thaiVoice, onScreenText",
  "visualPrompt ต้องอธิบาย Meta AI สร้างวิดีโอแนวตั้ง 9:16 10 วินาที ใช้ภาพสินค้าเดิมเป็น reference ภาพสินค้าไม่ผิดแบบ",
  "ระบุเสียงบรรยายพูดภาษาไทยตาม thaiVoice ประมาณ 20-35 คำต่อ 10 วินาที มีเสียงธรรมชาติ ไม่มีเสียงคู่",
  "คำพูดในแต่ละฉากต้องต่อเรื่องกัน ฉากแรกเป็น hook ฉากท้ายเชิญชวนกดดูสินค้าจากตะกร้า",
  "แนะนำผู้ใช้ตรวจสอบคุณภาพเสียงไทยที่ Meta AI สร้างอีกครั้ง ไม่อ้างว่าจะพูดถูกเสมอ",
  "ฉากต้องครบ "+seconds+" วินาที ห้ามปลอมรีวิวจากผู้ใช้จริง"
 ].join("\n");
}
function extractOutput(o) {
 if(typeof o?.output_text==="string")return o.output_text;
 return (o?.output||[]).flatMap(x=>x.content||[]).filter(c=>c.type==="output_text").map(c=>c.text).join("");
}
function normalize(raw,duration) {
 const n=duration/10;
 if(!raw||!Array.isArray(raw.scenes)||raw.scenes.length!==n)throw problem("AI สร้างช็อตไม่ครบ กรุณาลองอีกครั้ง",502);
 const txt=(v,max=3000)=>typeof v==="string"?v.trim().slice(0,max):"";
 const scenes=raw.scenes.map((x,i)=>({
   index:i+1, durationSeconds:10,
   visualPrompt:txt(x.visualPrompt,2200), thaiVoice:txt(x.thaiVoice,600), onScreenText:txt(x.onScreenText,200)
 }));
 if(scenes.some(s=>!s.visualPrompt||!s.thaiVoice))throw problem("AI ส่งสคริปต์หรือพรอมต์ไม่ครบ",502);
 return {
   productName:txt(raw.productName,180)||"สินค้าในภาพ",
   visibleFacts:Array.isArray(raw.visibleFacts)?raw.visibleFacts.slice(0,12).map(x=>txt(x,200)):[],
   uncertainFacts:Array.isArray(raw.uncertainFacts)?raw.uncertainFacts.slice(0,12).map(x=>txt(x,200)):[],
   caption:txt(raw.caption,2400),hashtags:Array.isArray(raw.hashtags)?raw.hashtags.slice(0,10).map(x=>txt(x,80)):[],
   pinnedComment:txt(raw.pinnedComment,500),cta:txt(raw.cta,240),scenes
 };
}
export function createWorker(upstreamFetch=fetch) {
 return {async fetch(request,env) {
   const url=new URL(request.url);
   if(url.pathname==="/api/health")
     return response(200,{ok:true,configured:Boolean(env.OPENAI_API_KEY&&env.APP_ACCESS_PIN?.length>=12)});
   if(url.pathname!=="/api/analyze")return env.ASSETS?env.ASSETS.fetch(request):response(404,{error:"not found"});
   if(request.method!=="POST")return response(405,{error:"POST เท่านั้น"});
   if(!env.OPENAI_API_KEY||!env.APP_ACCESS_PIN||env.APP_ACCESS_PIN.length<12)
     return response(503,{error:"ยังไม่ได้ตั้งค่า OPENAI_API_KEY และ APP_ACCESS_PIN บน Cloudflare"});
   const origin=request.headers.get("origin");
   if(origin&&origin!==url.origin)return response(403,{error:"ไม่อนุญาตให้เว็บไซต์อื่นเรียก API"});
   const ip=request.headers.get("cf-connecting-ip")||"unknown";
   if(!equalSecret(request.headers.get("x-studio-pin"),env.APP_ACCESS_PIN)){
     if(limited("pin:"+ip,8,15*60_000))return response(429,{error:"ลองรหัสมากเกินไป รอ 15 นาที"});
     return response(401,{error:"รหัสเข้าใช้งานไม่ถูกต้อง"});
   }
   if(limited("calls:"+ip,6,60_000))return response(429,{error:"เรียกวิเคราะห์บ่อยเกินไป"});
   const day=new Date().toISOString().slice(0,10);
   const budget=Math.max(1,Math.min(100,Number(env.MAX_DAILY_ANALYSES)||12));
   if((daily.get(day)||0)>=budget)return response(429,{error:"ครบจำนวนวิเคราะห์วันนี้"});
   if(busy>=1)return response(429,{error:"มีรายการกำลังวิเคราะห์"});
   try {
     if(Number(request.headers.get("content-length")||0)>MAX_BYTES)throw problem("ข้อมูลเกินขนาด",413);
     const reader=request.body?.getReader();
     if(!reader)throw problem("ไม่มีข้อมูล");
     const chunks=[];let size=0;
     try {while(true) {
       const {done,value}=await reader.read();if(done)break;
       size+=value.length;if(size>MAX_BYTES)throw problem("ข้อมูลใหญ่เกินกำหนด",413);
       chunks.push(value);
     }}finally{await reader.cancel().catch(()=>{});}
     const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
     let payload;
     try{payload=JSON.parse(new TextDecoder().decode(bytes));}catch{throw problem("รูปแบบข้อมูลไม่ถูกต้อง");}
     const image=verifyImage(payload.image);
     const duration=payload.duration===60?60:30;
     const notes=typeof payload.notes==="string"?payload.notes.slice(0,350):"";
     busy++;daily.set(day,(daily.get(day)||0)+1);
     try {
       const body={
         model:env.OPENAI_MODEL||"gpt-4.1-mini",store:false,max_output_tokens:5000,
         text:{format:{type:"json_object"}},
         input:[
           {role:"system",content:[{type:"input_text",text:systemPrompt(duration)}]},
           {role:"user",content:[
             {type:"input_text",text:"โปรดอ่านภาพสินค้าและสร้างแคปชั่น พรอมต์ และเสียงพูด "+duration+" วินาที หมายเหตุจากผู้ใช้ที่ยังต้องตรวจสอบ: "+(notes||"ไม่มี")},
             {type:"input_image",image_url:image,detail:"high"}
           ]}
         ]
       };
       const result=await upstreamFetch("https://api.openai.com/v1/responses",{
         method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
         body:JSON.stringify(body),signal:AbortSignal.timeout(60_000)
       });
       if(!result.ok)throw problem(result.status===401?"OpenAI API Key ไม่ถูกต้อง":result.status===429?"OpenAI ใช้ครบโควตาหรือถูกจำกัดการใช้งาน":"OpenAI ตอบ HTTP "+result.status,502);
       const output=extractOutput(await result.json());
       let parsed;try{parsed=JSON.parse(output);}catch{throw problem("AI ส่งข้อมูลที่ไม่ใช่ JSON",502);}
       return response(200,{result:normalize(parsed,duration)});
     }finally{busy--;}
   }catch(error){return response(error.status||502,{error:error.message||"ประมวลผลไม่ได้"});}
 }};
}
export default createWorker();
