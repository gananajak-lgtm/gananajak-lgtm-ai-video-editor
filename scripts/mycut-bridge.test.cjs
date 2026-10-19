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
