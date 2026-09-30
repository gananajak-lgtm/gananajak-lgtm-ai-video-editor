const el=(id)=>document.getElementById(id);
const state={image:null,plan:null,done:[]};
const status=(message)=>{el("status").textContent=message;};
const safeText=(x)=>String(x??"");
function storageSave(){
  if(!state.plan)return;
  try{localStorage.setItem("basket-studio-v1",JSON.stringify({plan:state.plan,done:state.done}));}catch{}
}
async function imageDataUrl(file){
  if(!file||!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("รองรับเฉพาะรูป PNG, JPG, WebP");
  if(file.size>12_000_000)throw new Error("ไฟล์ภาพใหญ่เกิน 12 MB");
  const img=await createImageBitmap(file);
  try{
    const max=1600;
    const scale=Math.min(1,max/Math.max(img.width,img.height));
    const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
    const canvas=document.createElement("canvas");
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
    let quality=.86;let uri=canvas.toDataURL("image/jpeg",quality);
    while(uri.length>7_500_000&&quality>.35){quality-=.12;uri=canvas.toDataURL("image/jpeg",quality);}
    if(uri.length>7_500_000)throw new Error("ภาพยังใหญ่เกิน กรุณาครอปก่อนอัปโหลด");
    return uri;
  }finally{img.close();}
}
async function copy(text){
  try{await navigator.clipboard.writeText(text);status("คัดลอกเรียบร้อยแล้ว ✅");}
  catch{status("คัดลอกไม่สำเร็จ กรุณาลองกดค้างเพื่อคัดลอกข้อความ");}
}
function shotText(shot){
  return safeText(shot.visualPrompt)+"\n\nเสียงบรรยายภาษาไทย (พูดให้ตรงทุกคำ): "+safeText(shot.thaiVoice)+
  "\n\nข้อความบนจอ: "+safeText(shot.onScreenText);
}
function captionText(plan){
  const tags=(plan.hashtags||[]).map(x=>String(x).startsWith("#")?x:"#"+x).join(" ");
  return [plan.caption,tags].filter(Boolean).join("\n\n");
}
function sceneCard(shot,index){
  const node=document.createElement("article");node.className="scene"+(state.done[index]?" done":"");
  const heading=document.createElement("h3");heading.textContent="🎞️ ช็อต "+(index+1)+" · 10 วินาที";
  const narration=document.createElement("div");narration.className="output";narration.textContent=shot.thaiVoice;
  const label=document.createElement("p");label.className="label";label.textContent="เสียงพูดภาษาไทย";
  const promptLabel=document.createElement("p");promptLabel.className="label";promptLabel.textContent="พรอมต์สำหรับ Meta AI";
  const prompt=document.createElement("div");prompt.className="output";prompt.textContent=shot.visualPrompt;
  const button=document.createElement("button");button.type="button";button.textContent="📋 คัดลอกพรอมต์ + เสียงพูด";
  button.addEventListener("click",()=>copy(shotText(shot)));
  const doneLabel=document.createElement("label");const check=document.createElement("input");
  check.type="checkbox";check.checked=Boolean(state.done[index]);
  check.addEventListener("change",()=>{state.done[index]=check.checked;node.classList.toggle("done",check.checked);storageSave();});
  doneLabel.append(check,document.createTextNode(" สร้างช็อตนี้แล้ว"));
  node.append(heading,label,narration,promptLabel,prompt,button,doneLabel);return node;
}
function render(plan){
  state.plan=plan;el("results").hidden=false;
  el("product").textContent=plan.productName||"สินค้าในภาพ";
  el("caption").textContent=captionText(plan);
  el("pinned").textContent=plan.pinnedComment||"";
  el("facts").replaceChildren(...(plan.visibleFacts||[]).map(x=>{const li=document.createElement("li");li.textContent=x;return li;}));
  el("unclear").textContent=(plan.uncertainFacts||[]).length?"ข้อมูลที่อ่านไม่ชัด: "+plan.uncertainFacts.join(" · "):"";
  el("unclear").hidden=!(plan.uncertainFacts||[]).length;
  el("scenes").replaceChildren(...plan.scenes.map(sceneCard));
  storageSave();
}
el("photo").addEventListener("change",async(e)=>{
  const file=e.target.files?.[0];state.image=null;el("analyze").disabled=true;
  if(!file)return;
  try{status("กำลังเตรียมภาพ...");
    state.image=await imageDataUrl(file);el("preview").src=state.image;el("preview").hidden=false;
    el("analyze").disabled=false;status("ภาพพร้อมวิเคราะห์ ✓");
  }catch(error){el("preview").hidden=true;status(error.message);}
});
el("analyze").addEventListener("click",async()=>{
  if(!state.image)return;
  const pin=el("pin").value;
  if(!pin){status("กรุณาใส่รหัสเข้าใช้แอป");return;}
  const button=el("analyze");button.disabled=true;status("กำลังส่งภาพให้ OpenAI วิเคราะห์...");
  try{
    const duration=Number(document.querySelector('input[name="duration"]:checked').value);
    const response=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json","x-studio-pin":pin},
      body:JSON.stringify({image:state.image,notes:el("notes").value,duration})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"วิเคราะห์ไม่ได้");
    state.done=new Array(data.result.scenes.length).fill(false);render(data.result);
    status("สร้างแคปชั่นและพรอมต์เรียบร้อย ✅");
    el("results").scrollIntoView({behavior:"smooth"});
  }catch(error){status(error.message);}
  finally{button.disabled=false;}
});

// Chrome Android supports intent:// links from a direct user tap. Meta AI may not
// register meta.ai as a browsable Android app link on every device/version.
const metaButton=el("meta");
const isAndroid=/Android/i.test(navigator.userAgent);
if(isAndroid){
  const fallback=encodeURIComponent("https://www.meta.ai/");
  metaButton.href="intent://www.meta.ai/#Intent;scheme=https;package=com.facebook.stella;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url="+fallback+";end";
  metaButton.removeAttribute("target");
  metaButton.addEventListener("click",()=>status("กำลังลองเปิดแอป Meta AI หากยังไปเว็บไซต์ ให้ตั้งค่า Android > แอป > Meta AI > เปิดตามค่าเริ่มต้น > เปิดลิงก์ที่รองรับ"));
}else{
  metaButton.textContent="🎬 เปิด Meta AI";
}

el("copy-caption").addEventListener("click",()=>state.plan&&copy(captionText(state.plan)));
el("copy-pinned").addEventListener("click",()=>state.plan&&copy(state.plan.pinnedComment));
el("download").addEventListener("click",()=>{
  if(!state.plan)return;
  const p=state.plan;
  const content=["Basket Studio: "+p.productName,captionText(p),"คอมเมนต์ปักหมุด: "+p.pinnedComment,
    ...p.scenes.map((s,i)=>"ช็อต "+(i+1)+" (10 วินาที)\n"+shotText(s))].join("\n\n--------------------\n\n");
  const blob=new Blob([content],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="basket-studio-prompts.txt";
  a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
});
try{
  const saved=JSON.parse(localStorage.getItem("basket-studio-v1")||"null");
  if(saved?.plan&&Array.isArray(saved.plan.scenes)&&Array.isArray(saved.done)){
    state.done=saved.done;render(saved.plan);status("กู้คืนพรอมต์ที่สร้างไว้ครั้งก่อนแล้ว");
  }
}catch{}
