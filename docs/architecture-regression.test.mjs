import test from 'node:test';
import assert from 'node:assert/strict';
import {wallFaces} from './architecture.mjs';
import {wallCorners,wallCornerFaces,KIT} from './geometry.mjs';
import {roomLayout} from './rooms.mjs';
import {roomCutawayEdges} from './room-cutaway.mjs';

const w=(axis,x,z,kind='wall')=>({axis,x,z,kind,collapse:true,material:'lw-redlounge'});
test('doorways have two visible casings inside their own footprint and full-depth jambs',()=>{
 for(const axis of ['x','z'])for(let r=0;r<4;r++){
  const wall=w(axis,0,0,'door'),faces=wallFaces(wall,{level:{id:'ground',walls:{wall},tiles:{}},rotation:r});
  const casings=faces.filter(f=>f.attrs['data-part']==='door-casing');
  assert.equal(casings.length,2);
  for(const f of casings)for(const p of f.vertices)assert.ok(p[axis==='x'?1:0]>-.5&&p[axis==='x'?1:0]<.5);
  const reveals=faces.filter(f=>f.attrs['data-part']==='door-reveal');assert.equal(reveals.length,2);
  for(const f of reveals)assert.ok(Math.abs(Math.max(...f.vertices.map(p=>p[axis==='x'?0:1]))-Math.min(...f.vertices.map(p=>p[axis==='x'?0:1]))-KIT.wallThickness)<1e-9);
  assert.equal(faces.filter(f=>f.attrs['data-part']==='door-soffit').length,1);
 }
});
test('an inside corner has no square post faces painted over its joined wall planes',()=>{
 const c=wallCorners({a:w('x',0,0),b:w('z',0,0)})[0];
 assert.equal(wallCornerFaces(c,0).filter(f=>f.part!=='cap').length,0);
 assert.equal(wallCornerFaces(c,2).filter(f=>f.part!=='cap').length,2);
 const caps=wallCornerFaces(c,0);assert.deepEqual(caps.map(f=>f.wall.axis),['x','z']);
});
function roomsFixture(){
 const level={tiles:{},walls:{},rooms:[{id:'foyer',kind:'indoor',x:0,z:0,width:5,depth:9},{id:'gallery',kind:'indoor',x:5,z:0,width:6,depth:9}]};
 for(let x=0;x<11;x++)for(let z=0;z<9;z++)level.tiles[`${x},${z}`]={};
 for(const x of [0,5,11])for(let z=0;z<9;z++)level.walls[`x:${x},${z}`]=w('x',x,z,z===4?'door':'wall');
 for(let x=0;x<11;x++)for(const z of [0,9])level.walls[`z:${x},${z}`]=w('z',x,z);
 const rooms=roomLayout(level).map(r=>({...r,cells:[...r.cells],boundaries:r.boundaries.map(b=>({edge:`${b.wall.axis}:${b.wall.x},${b.wall.z}`,outward:b.outward}))}));
 return {rooms,walls:level.walls};
}
test('walking in foyer lowers the shared partition, never the gallery rear wall behind it',()=>{
 const {rooms,walls}=roomsFixture(),selected=roomCutawayEdges(rooms,walls,rooms[0],0);
 for(let z=0;z<9;z++)assert.ok(selected.has(`x:5,${z}`));
 for(let x=5;x<11;x++)assert.ok(!selected.has(`z:${x},0`));
 for(let z=0;z<9;z++)assert.ok(!selected.has(`x:11,${z}`));
});
test('walking back into the gallery restores the now-rear shared partition',()=>{
 const {rooms,walls}=roomsFixture(),selected=roomCutawayEdges(rooms,walls,rooms[1],0);
 for(let z=0;z<9;z++){assert.ok(!selected.has(`x:5,${z}`));assert.ok(selected.has(`x:11,${z}`));}
});
test('all four rotations keep the occupied room rear edges raised',()=>{
 const {rooms,walls}=roomsFixture();
 for(let r=0;r<4;r++)for(const room of rooms){const selected=roomCutawayEdges(rooms,walls,room,r);for(const b of room.boundaries){const wall=walls[b.edge],sign=wall.axis==='x'?[1,1,-1,-1][r]:[1,-1,-1,1][r];assert.equal(selected.has(b.edge),b.outward*sign>0);}}
});
