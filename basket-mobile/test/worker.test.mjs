import test from "node:test";
import assert from "node:assert/strict";
import {createWorker} from "../src/worker.mjs";

const env={APP_ACCESS_PIN:"example-long-pin-12345",OPENAI_API_KEY:"test-not-a-real-key"};
const sample=Buffer.from([137,80,78,71,13,10,26,10,...Array(32).fill(0)]);
const image="data:image/png;base64,"+sample.toString("base64");
const request=(payload,pin=env.APP_ACCESS_PIN)=>new Request("https://test.workers.dev/api/analyze",{
  method:"POST",headers:{"content-type":"application/json","x-studio-pin":pin},
  body:JSON.stringify(payload)
});
const plan={
 productName:"Kito รองเท้าแตะ",caption:"รองเท้าแตะตามภาพ มีลิงก์สินค้า อาจได้รับค่าคอมมิชชัน",
 hashtags:["#รองเท้าแตะ"],pinnedComment:"ดูรายละเอียดในตะกร้า",visibleFacts:["รองเท้าแตะ"],
 uncertainFacts:[],scenes:[1,2,3].map(i=>({index:i,visualPrompt:"รีวิวรองเท้า 9:16 10 วินาที",thaiVoice:"สวัสดีค่ะ รีวิวรองเท้า",onScreenText:"ดูรายละเอียด"}))
};
test("health never exposes secrets",async()=>{
 const result=await createWorker().fetch(new Request("https://test.workers.dev/api/health"),env);
 const data=await result.json();
 assert.deepEqual(data,{ok:true,configured:true});
 assert.equal(JSON.stringify(data).includes(env.OPENAI_API_KEY),false);
});
test("requires a strong configured PIN",async()=>{
 const result=await createWorker().fetch(request({image,duration:30}),{...env,APP_ACCESS_PIN:"short"});
 assert.equal(result.status,503);
});
test("rejects incorrect PIN without calling OpenAI",async()=>{
 let called=0;const w=createWorker(async()=>{called++;throw new Error("should not call");});
 const result=await w.fetch(request({image,duration:30},"incorrect-pass"),env);
 assert.equal(result.status,401);assert.equal(called,0);
});
test("rejects invalid image and does not call OpenAI",async()=>{
 let called=0;const w=createWorker(async()=>{called++;throw new Error("should not call");});
 const result=await w.fetch(request({image:"data:text/html;base64,PGgxPg==",duration:30}),env);
 assert.equal(result.status,400);assert.equal(called,0);
});
test("rejects cross-origin API calls",async()=>{
 const w=createWorker(async()=>new Response(JSON.stringify({output_text:JSON.stringify(plan)})));
 const req=new Request("https://test.workers.dev/api/analyze",{method:"POST",headers:{origin:"https://evil.example","x-studio-pin":env.APP_ACCESS_PIN},body:JSON.stringify({image,duration:30})});
 const result=await w.fetch(req,env);assert.equal(result.status,403);
});
test("OpenAI image request creates three valid ten-second Thai scenes",async()=>{
 let sent=null;
 const w=createWorker(async(url,init)=>{
   assert.equal(url,"https://api.openai.com/v1/responses");
   assert.equal(init.headers.Authorization,"Bearer "+env.OPENAI_API_KEY);
   sent=JSON.parse(init.body);
   return new Response(JSON.stringify({output_text:JSON.stringify(plan)}),{status:200});
 });
 const result=await w.fetch(request({image,duration:30}),env);
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.result.scenes.length,3);
 assert.equal(data.result.scenes[0].durationSeconds,10);
 assert.equal(sent.store,false);
 assert.equal(sent.input[1].content[1].type,"input_image");
});
test("60 seconds requires six scenes",async()=>{
 const w=createWorker(async()=>new Response(JSON.stringify({output_text:JSON.stringify(plan)}),{status:200}));
 const result=await w.fetch(request({image,duration:60}),env);
 assert.equal(result.status,502);
 assert.match((await result.json()).error,/ไม่ครบ/);
});
