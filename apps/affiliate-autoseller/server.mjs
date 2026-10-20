import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.AUTOSELLER_DATA_FILE ? resolve(process.env.AUTOSELLER_DATA_FILE) : resolve(ROOT,'data','autoseller.json');
const PORT = Number(process.env.PORT || 4177);
const DEFAULT = { version:1, products:[], jobs:[], events:[] };
let queue = Promise.resolve();

function bad(message,status=400) { const e=new Error(message); e.status=status; throw e; }
function text(value,max=300) { if(typeof value!=='string'||!value.trim()||value.length>max) bad('Invalid text field'); return value.trim(); }
function safeUrl(value) { const v=text(value,2048); let u;try{u=new URL(v)}catch{bad('Invalid URL')} if(u.protocol!=='https:')bad('HTTPS URL required');return v; }
export async function load() { try { const parsed=JSON.parse(await readFile(DB_PATH,'utf8')); if(!Array.isArray(parsed.products)||!Array.isArray(parsed.jobs)) throw Error('Invalid database'); return parsed; }catch(e){if(e.code==='ENOENT')return structuredClone(DEFAULT);throw e;} }
async function save(state) { await mkdir(dirname(DB_PATH),{recursive:true});const temp=DB_PATH+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(state,null,2)+'\n',{mode:0o600});await rename(temp,DB_PATH); }
function edit(fn) { const work=queue.then(async()=>{const db=await load();const result=fn(db);await save(db);return result;});queue=work.catch(()=>{});return work; }
async function payload(req) {let content='';for await(const chunk of req){content+=chunk;if(content.length>100000)bad('Payload too large',413)}try{return JSON.parse(content||'{}')}catch{bad('Malformed JSON')} }
function send(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(obj));}
const validId = x => /^[0-9a-f-]{36}$/i.test(x);
export function routes(method,url,body,db){
 if(method==='POST' && url==='/api/products'){
  const product={id:randomUUID(),name:text(body.name),url:safeUrl(body.url),commissionPercent:Number(body.commissionPercent),price:Number(body.price),createdAt:new Date().toISOString()};
  if(!Number.isFinite(product.commissionPercent)||product.commissionPercent<0||product.commissionPercent>100)bad('Invalid commission');
  if(!Number.isFinite(product.price)||product.price<0)bad('Invalid price');
  db.products.push(product);return product;
 }
 if(method==='POST' && url==='/api/jobs'){
  const product=db.products.find(p=>p.id===body.productId);if(!product)bad('Unknown product');
  const job={id:randomUUID(),productId:product.id,title:text(body.title),sourcePath:text(body.sourcePath,2048),status:'draft',createdAt:new Date().toISOString(),publishUrl:null};
  db.jobs.push(job);return job;
 }
 const m=/^\/api\/jobs\/([0-9a-f-]{36})\/(approve|published)$/.exec(url);
 if(method==='POST' && m && validId(m[1])){
  const job=db.jobs.find(j=>j.id===m[1]);if(!job)bad('Unknown job',404);
  if(m[2]==='approve'){if(job.status!=='draft')bad('Only drafts can be approved');job.status='approved';}
  else{if(job.status!=='approved')bad('Approve first');job.publishUrl=safeUrl(body.publishUrl);job.status='published';}
  job.updatedAt=new Date().toISOString();return job;
 }
 bad('Not found',404);
}
const INDEX=resolve(ROOT,'public','index.html');
export function createServer() {
 return http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost').pathname;
   if(req.method==='GET' && url==='/health'){return send(res,200,{ok:true,service:'affiliate-autoseller'});}
   if(req.method==='GET' && url==='/api/state'){return send(res,200,await load());}
   if(req.method==='GET' && url==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});return res.end(await readFile(INDEX));}
   if(req.method==='GET' && url==='/app.js'){res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','x-content-type-options':'nosniff'});return res.end(await readFile(resolve(ROOT,'public','app.js')));}
   if(req.method==='POST'&&url.startsWith('/api/')){const b=await payload(req);return send(res,200,await edit(db=>routes('POST',url,b,db)));}
   return send(res,404,{error:'Not found'});
  }catch(e){return send(res,e.status||500,{error:e.status?e.message:'Server error'});}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!Number.isInteger(PORT)||PORT<1||PORT>65535)throw Error('Invalid PORT');
 createServer().listen(PORT,'127.0.0.1',()=>console.log('AutoSeller http://127.0.0.1:'+PORT));
}
