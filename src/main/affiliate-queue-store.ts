import { app } from "electron";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { AffiliateContentJob, AffiliateProduct } from "../shared/affiliate-factory";

export type AffiliateQueueState={products:AffiliateProduct[];jobs:AffiliateContentJob[];updatedAt:string};
const queuePath=()=>path.join(app.getPath("userData"),"affiliate-factory","queue.json");
export async function saveAffiliateQueue(state:Omit<AffiliateQueueState,"updatedAt">|AffiliateQueueState){
  const next:AffiliateQueueState={products:state.products,jobs:state.jobs,updatedAt:new Date().toISOString()};
  await mkdir(path.dirname(queuePath()),{recursive:true});
  await writeFile(queuePath(),JSON.stringify(next,null,2),"utf8");
  return next;
}
export async function loadAffiliateQueue():Promise<AffiliateQueueState>{
  try{return JSON.parse(await readFile(queuePath(),"utf8")) as AffiliateQueueState;}
  catch{return {products:[],jobs:[],updatedAt:new Date(0).toISOString()};}
}
