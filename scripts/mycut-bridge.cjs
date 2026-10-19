#!/usr/bin/env node
'use strict';
/**
 * Offline interchange from existing AI Video voice assets to a MyCut project.
 * Does not invoke ElevenLabs, overwrite a MyCut project, or edit source assets.
 * Manifest: {title,width,height,fps,lines:[{audio,duration,speaker,text}],
 *            visuals:[{image,fromLine,toLine?,locked?}],gapSeconds?:0.3}.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
function build(manifest, baseDir = process.cwd()) {
  if (!Array.isArray(manifest?.lines) || !manifest.lines.length) throw new Error('lines required');
  const w=Number(manifest.width??1080),h=Number(manifest.height??1920),fps=Number(manifest.fps??30);
  const gap=Number(manifest.gapSeconds??0.3);
  if (!Number.isInteger(w)||!Number.isInteger(h)||w<240||h<240||w%2||h%2||![24,25,30,60].includes(fps)) throw new Error('Invalid dimensions/fps');
  if (!Number.isFinite(gap)||gap<0||gap>30) throw new Error('Invalid voice gap');
  const id=p=>p+'-'+randomUUID(),media=[],clips=[],lookup=new Map();
  const defaults={speed:1,volume:1,opacity:1,bright:0,contrast:1,sat:1,sepia:0,hue:0,fadeIn:0,fadeOut:0,scale:1,px:0,py:0,filter:'none',chroma:false,chromaColor:'#00b140',chromaSim:0.15,chromaBlend:0.08,rot:0,cropL:0,cropR:0,cropT:0,cropB:0};
  function asset(filename,kind) {
    if (typeof filename!=='string'||!filename.trim()) throw new Error('Missing '+kind+' path');
    const full=path.resolve(baseDir,filename);
    if (!fs.existsSync(full)||!fs.statSync(full).isFile()) throw new Error('Missing '+kind+' asset: '+filename);
    const ext=path.extname(full).toLowerCase();
    const allowed=kind==='audio'?['.mp3','.wav','.m4a','.aac','.flac','.ogg']:['.png','.jpg','.jpeg','.webp','.bmp'];
    if (!allowed.includes(ext)) throw new Error('Unsupported '+kind+' extension');
    if (!lookup.has(full)) {const item={id:id('m'),path:full,name:path.basename(full),kind,dur:0,w:kind==='image'?w:0,h:kind==='image'?h:0,hasAudio:false};lookup.set(full,item);media.push(item);}
    return lookup.get(full);
  }
  const timeline=[];let cursor=0;
  for (const [i,line] of manifest.lines.entries()) {
    const d=Number(line?.duration);
    if (!Number.isFinite(d)||d<=0||d>3600) throw new Error('Invalid duration for line '+(i+1));
    const m=asset(line.audio,'audio');
    clips.push({...defaults,id:id('c'),kind:'audio',mediaId:m.id,path:m.path,name:String(line.speaker||m.name)+' · '+(i+1),w:0,h:0,hasAudio:true,srcDur:d,track:'A1',start:cursor,in:0,dur:d,thumb:null});
    timeline.push({start:cursor,end:cursor+d});
    cursor+=d+(i===manifest.lines.length-1?0:gap);
  }
  const visuals=(manifest.visuals||[]).slice().sort((a,b)=>a.fromLine-b.fromLine);
  const placed=[];
  for (const [i,v] of visuals.entries()) {
    const first=Number(v.fromLine),last=Number(v.toLine??v.fromLine);
    if (!Number.isInteger(first)||!Number.isInteger(last)||first<1||last<first||last>timeline.length) throw new Error('Invalid visual range '+(i+1));
    const m=asset(v.image,'image'),start=timeline[first-1].start,end=timeline[last-1].end;
    placed.push({start,end,locked:!!v.locked,m});
  }
  if (placed.length) {
    const eps=1e-7;
    if (placed[0].start>eps){if(placed[0].locked)throw new Error('Locked first image leaves a gap');placed[0].start=0;}
    for(let i=1;i<placed.length;i++){
      const prev=placed[i-1],cur=placed[i];
      if(cur.start<prev.end-eps)throw new Error('Overlapping image ranges');
      if(cur.start>prev.end+eps){
        if(!prev.locked)prev.end=cur.start;
        else if(!cur.locked)cur.start=prev.end;
        else throw new Error('Locked images leave a gap');
      }
    }
    const last=placed[placed.length-1];
    if(last.end<cursor-eps){if(last.locked)throw new Error('Locked final image leaves a gap');last.end=cursor;}
    for(const x of placed)clips.push({...defaults,id:id('c'),kind:'image',mediaId:x.m.id,path:x.m.path,name:x.m.name,w,h,hasAudio:false,srcDur:x.end-x.start,track:'V1',start:x.start,in:0,dur:x.end-x.start,thumb:null});
  }
  const now=Date.now();
  return {id:id('p'),name:String(manifest.title||'AI Video + MyCut').slice(0,150),created:now,updated:now,w,h,fps,media,clips,magnet:true,snap:true,dur:cursor,thumb:null,tracks:[{id:'V1',type:'video',main:true,hide:false,mute:false,lock:false},{id:'A1',type:'audio',main:false,hide:false,mute:false,lock:false}]};
}
function exportProject(input,output){
  const source=path.resolve(input),target=path.resolve(output);
  if(path.extname(target).toLowerCase()!=='.mycut')throw new Error('Output must end in .mycut');
  if(fs.existsSync(target))throw new Error('Output exists; refusing overwrite');
  const data=JSON.parse(fs.readFileSync(source,'utf8'));
  const project=build(data,path.dirname(source));
  fs.writeFileSync(target,JSON.stringify(project,null,2),{flag:'wx'});
  return project;
}
if(require.main===module){
  try {if(process.argv.length!==4)throw new Error('Usage: node scripts/mycut-bridge.cjs manifest.json new-project.mycut');const p=exportProject(process.argv[2],process.argv[3]);console.log('Created '+p.clips.length+' clips, '+p.dur.toFixed(3)+' seconds');}
  catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={build,exportProject};
