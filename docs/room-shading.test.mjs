import test from 'node:test';
import assert from 'node:assert/strict';
import {wallFaces} from './architecture.mjs';
import {wallCorners,wallCornerFaces,KIT} from './geometry.mjs';
import {wallContactShadows,wallCornerAmbientShadows} from './room-shading.mjs';
import {cutProfile} from './rooms.mjs';

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
  assert.equal(wallContactShadows(level).length,1);
  assert.ok(wallContactShadows(level)[0].attrs['data-ambient-gradient']);
  assert.equal(wallContactShadows(level,new Set(['0,0'])).length,0);
});
test('collapsed wall slopes up only to an upright neighbour',()=>{
  const low=wall('x',0,0),upright=wall('x',0,1);
  assert.deepEqual(cutProfile(low,{'x:0,0':low,'x:0,1':upright},new Set(['x:0,0'])),[[0,26],[.6,26],[1,KIT.wallHeight]]);
  assert.deepEqual(cutProfile(low,{'x:0,0':low,'x:0,1':upright},new Set(['x:0,0','x:0,1'])),[[0,26],[1,26]]);
});

test('a wall joining from behind does not shade the front face in any view',()=>{
 const a=wall('x',0,0),behind=wall('z',-1,0),level={id:'floor-1',tiles:{'0,0':{}},walls:{a,behind},rooms:[]};
 const corners=wallCorners(level.walls);
 for(let rotation=0;rotation<4;rotation++){
  const faces=wallFaces(a,{level,rotation,corners});
  const shaded=faces.some(f=>f.attrs?.['data-part']==='wall-corner-ambient');
  assert.equal(shaded,rotation>=2);
 }
});

test('a straight wall exports one floor gradient without overlapping tile strips',()=>{
 const walls=Object.fromEntries([0,1,2].map(z=>[z,wall('x',0,z)]));
 const tiles=Object.fromEntries([0,1,2].map(z=>[`0,${z}`,{}]));
 const faces=wallContactShadows({walls,tiles});
 assert.equal(faces.length,1);
 const zs=faces[0].vertices.map(p=>p[1]);
 assert.equal(Math.min(...zs),-.5);assert.equal(Math.max(...zs),2.5);
 assert.equal(faces[0].attrs.stroke,'none');
});
