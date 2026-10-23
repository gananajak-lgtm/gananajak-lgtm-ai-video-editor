'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {build,exportProject}=require('./mycut-bridge.cjs');
test('MyCut integration exports contiguous V1 and 0.3 second gaps on A1',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mycut-bridge-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const file of ['a.mp3','b.mp3','one.png','two.png'])fs.writeFileSync(path.join(dir,file),'fixture');
 const manifest={title:'Test',lines:[{audio:'a.mp3',duration:2,speaker:'Narrator'},{audio:'b.mp3',duration:3,speaker:'Actor'}],visuals:[{image:'one.png',fromLine:1},{image:'two.png',fromLine:2}]};
 const project=build(manifest,dir),a=project.clips.filter(c=>c.track==='A1'),v=project.clips.filter(c=>c.track==='V1');
 assert.equal(project.dur,5.3);assert.equal(Number((a[1].start-a[0].start-a[0].dur).toFixed(3)),0.3);
 assert.equal(Number((v[1].start-v[0].start-v[0].dur).toFixed(3)),0);
 assert.equal(Number((v[1].start+v[1].dur).toFixed(3)),5.3);
 const input=path.join(dir,'manifest.json'),output=path.join(dir,'test.mycut');
 fs.writeFileSync(input,JSON.stringify(manifest));exportProject(input,output);
 assert.equal(JSON.parse(fs.readFileSync(output)).clips.length,4);
 assert.throws(()=>exportProject(input,output),/refusing overwrite/);
});
test('MyCut export refuses to move locked images across a pause',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mycut-locked-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const file of ['a.mp3','b.mp3','one.png','two.png'])fs.writeFileSync(path.join(dir,file),'fixture');
 assert.throws(()=>build({lines:[{audio:'a.mp3',duration:1},{audio:'b.mp3',duration:1}],visuals:[{image:'one.png',fromLine:1,locked:true},{image:'two.png',fromLine:2,locked:true}]},dir),/Locked images leave a gap/);
});

test('MyCut 3-line acceptance fixture writes a portrait timeline with no V1 gaps or trailing A1 pause',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mycut-3line-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const file of ['voice-1.mp3','voice-2.mp3','voice-3.mp3','shot-1.png','shot-2.png','shot-3.png'])
   fs.writeFileSync(path.join(dir,file),'offline-fixture');
 const manifest={title:'3-line Windows acceptance',width:1080,height:1920,fps:30,
  lines:[{audio:'voice-1.mp3',duration:1.25,speaker:'A'},
         {audio:'voice-2.mp3',duration:2.5,speaker:'B'},
         {audio:'voice-3.mp3',duration:0.75,speaker:'A'}],
  visuals:[{image:'shot-1.png',fromLine:1},{image:'shot-2.png',fromLine:2},{image:'shot-3.png',fromLine:3}]};
 const input=path.join(dir,'manifest.json'),output=path.join(dir,'approved.mycut');
 fs.writeFileSync(input,JSON.stringify(manifest));
 const expected=exportProject(input,output);
 const saved=JSON.parse(fs.readFileSync(output,'utf8'));
 assert.equal(saved.dur,5.1);assert.equal(saved.w,1080);assert.equal(saved.h,1920);assert.equal(saved.fps,30);
 assert.equal(saved.media.length,6);assert.deepEqual(saved.tracks.map(track=>track.id),['V1','A1']);
 const a=saved.clips.filter(clip=>clip.track==='A1').sort((x,y)=>x.start-y.start);
 const v=saved.clips.filter(clip=>clip.track==='V1').sort((x,y)=>x.start-y.start);
 assert.equal(a.length,3);assert.equal(v.length,3);
 assert.deepEqual(a.map(clip=>Number(clip.start.toFixed(3))),[0,1.55,4.35]);
 assert.equal(Number((a[1].start-a[0].start-a[0].dur).toFixed(3)),0.3);
 assert.equal(Number((a[2].start-a[1].start-a[1].dur).toFixed(3)),0.3);
 assert.equal(Number((saved.dur-a[2].start-a[2].dur).toFixed(3)),0);
 assert.equal(v[0].start,0);
 for(let i=1;i<v.length;i++)assert.ok(Math.abs(v[i].start-v[i-1].start-v[i-1].dur)<1e-7,'V1 has no gap or overlap');
 assert.ok(Math.abs(v[v.length-1].start+v[v.length-1].dur-saved.dur)<1e-7);
 for(const clip of saved.clips){
  assert.ok(fs.existsSync(clip.path),'serialized media path exists');
  assert.ok(saved.media.some(media=>media.id===clip.mediaId && media.path===clip.path),'clip points to serialized media');
 }
 assert.equal(expected.clips.length,saved.clips.length);
 const unchanged=fs.readFileSync(output);
 assert.throws(()=>exportProject(input,output),/refusing overwrite/);
 assert.deepEqual(fs.readFileSync(output),unchanged,'failed overwrite leaves original bytes untouched');
});

test('MyCut invalid late visual fails without creating partial destination',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mycut-invalid-late-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'voice.mp3'),'fixture');
 fs.writeFileSync(path.join(dir,'one.png'),'fixture');
 const input=path.join(dir,'manifest.json'),output=path.join(dir,'must-not-exist.mycut');
 fs.writeFileSync(input,JSON.stringify({lines:[{audio:'voice.mp3',duration:1}],
  visuals:[{image:'one.png',fromLine:1},{image:'missing.png',fromLine:1}]}));
 assert.throws(()=>exportProject(input,output),/Missing image asset/);
 assert.equal(fs.existsSync(output),false);
});
