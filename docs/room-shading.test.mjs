import test from 'node:test';
import assert from 'node:assert/strict';
import {wallFaces} from './architecture.mjs';
import {wallCorners,wallCornerFaces} from './geometry.mjs';
import {wallContactShadows,wallCornerAmbientShadows} from './room-shading.mjs';

const wall=(axis,x,z,kind='wall')=>({axis,x,z,kind,collapse:true,mount:true,material:'plaster'});
test('wall base and joined corner shade while the doorway stays open',()=>{
  const a=wall('x',0,0),b=wall('z',0,0),door=wall('x',1,0,'door');
  const level={id:'floor-1',tiles:{'0,0':{walk:true,place:true}},walls:{'x:0,0':a,'z:0,0':b,'x:1,0':door},rooms:[]};
  const faces=wallFaces(a,{level,corners:wallCorners(level.walls),paint:{fill:'#ddddcc',material:'plaster',opacity:1}});
  assert.ok(faces.some(f=>f.attrs?.['data-part']==='wall-base-ambient'));
  assert.ok(faces.some(f=>f.attrs?.['data-part']==='wall-corner-ambient'));
  const join=wallCorners(level.walls)[0],joinShadows=wallCornerAmbientShadows(wallCornerFaces(join),join);
  assert.ok(joinShadows.length>=4);
  assert.ok(joinShadows.every(f=>f.vertices.some(p=>p[2]>200)));
  const doorway=wallFaces(door,{level,paint:{fill:'#ddddcc',material:'plaster',opacity:1}});
  assert.ok(doorway.filter(f=>f.attrs?.['data-part']==='wall-base-ambient').every(f=>f.vertices.every(p=>Math.abs(p[1])>.4)));
});
test('contact bands reach the floor and respect floor holes',()=>{
  const a=wall('x',0,0),level={tiles:{'0,0':{}},walls:{'x:0,0':a},rooms:[{kind:'indoor',x:0,z:0,width:1,depth:1}]};
  assert.equal(wallContactShadows(level).length,32);
  assert.equal(wallContactShadows(level,new Set(['0,0'])).length,0);
});
