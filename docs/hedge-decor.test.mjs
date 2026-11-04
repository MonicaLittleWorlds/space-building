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
