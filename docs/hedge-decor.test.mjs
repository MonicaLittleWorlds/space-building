import test from 'node:test';import assert from 'node:assert/strict';
import {wallFaces} from './architecture.mjs';
const w={kind:'wall',axis:'x',x:0,z:0,material:'lw-decor-hedge',collapse:true};const level={id:'ground',walls:{'x:0,0':w},tiles:{'0,0':{}}};
test('hedge wall replacement stays shrub height in all views and low when cut',()=>{
 for(let rotation=0;rotation<4;rotation++)for(const collapsed of [false,true]){
  const faces=wallFaces(w,{level,rotation,collapsed,paint:{material:w.material,fill:'#345a26'}});
  assert.ok(faces.length);assert.equal(Math.max(...faces.flatMap(f=>f.vertices.map(v=>v[2]))),collapsed?26:132);
  assert.ok(faces.some(f=>f.attrs?.['data-part']==='cap'&&f.attrs?.['data-texture']===w.material));
 }
});
test('hedge replacement removes door header and window casing but keeps doorway passable',()=>{
 assert.deepEqual(wallFaces({...w,kind:'door'},{level,paint:{material:w.material,fill:"#345a26"}}),[]);
 const faces=wallFaces({...w,kind:'window'},{level,paint:{material:w.material,fill:"#345a26"}});
 assert.ok(faces.length);assert.ok(!faces.some(f=>/casing|window/.test(f.attrs?.['data-part']||'')));
});
test('hedge owns a complete end even when its authored wall object is replaced',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const faces=wallFaces({...w},{level,rotation,paint:{material:w.material,fill:'#345a26'}});
  const end=faces.find(f=>f.attrs?.['data-part']==='end');assert.ok(end,'visible end is sealed');
  assert.equal(Math.max(...end.vertices.map(v=>v[2])),132);
  assert.equal(Math.min(...end.vertices.map(v=>v[2])),0);
 }
});
test('hedge fills the corner footprint independently of a taller adjoining wall',()=>{
 const corner={x:-.5,z:-.5};
 for(let rotation=0;rotation<4;rotation++){
  const faces=wallFaces(w,{level,rotation,corners:[corner],paint:{material:w.material,fill:'#345a26'}});
  const front=faces.find(f=>f.attrs?.['data-part']==='room-cut');
  assert.ok(Math.min(...front.vertices.map(v=>v[1]))<=-.56);
  const cap=faces.find(f=>f.attrs?.['data-part']==='cap');
  assert.equal(Math.min(...cap.vertices.map(v=>v[1])),Math.min(...front.vertices.map(v=>v[1])));
 }
});
test('modern finish identifiers survive project save and reload',async()=>{
 const {blankProject,parseProject}=await import('./model.mjs');
 const p=blankProject();p.levels[0].rooms=[{id:'test',name:'Test',kind:'indoor',x:0,z:0,width:2,depth:2,wallMaterial:'lw-colour_wash'}];
 p.levels[0].walls={'x:0,0':{...w,mount:true,material:'lw-half_tile',exteriorMaterial:'lw-everyday_matte'}};
 assert.equal(parseProject(JSON.stringify(p)).levels[0].rooms[0].wallMaterial,'lw-colour_wash');
});
