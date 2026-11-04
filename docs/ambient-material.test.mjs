import test from 'node:test';
import assert from 'node:assert/strict';
import {bakeAmbientFaces} from './ambient-material.mjs';
import {wallFaces} from './architecture.mjs';
import {wallCorners} from './geometry.mjs';

test('wall shading belongs to its opaque paint, not a second narrow polygon',()=>{
 const wall={axis:'x',x:0,z:0,kind:'wall',collapse:true},cross={axis:'z',x:0,z:0,kind:'wall'};
 const level={id:'ground',tiles:{'0,0':{}},walls:{wall,cross}};
 for(let rotation=0;rotation<4;rotation++){
  const faces=wallFaces(wall,{level,rotation,corners:wallCorners(level.walls)});
  const baked=bakeAmbientFaces(faces);
  assert.ok(baked.some(f=>f.ambient.some(a=>a['data-part']==='wall-base-ambient')));
  assert.ok(baked.every(f=>!f.attrs?.['data-ambient-gradient']));
  assert.ok(baked.filter(f=>f.ambient.length).every(f=>f.attrs.fill));
 }
});
test('a floor contact shadow remains a transparent floor surface',()=>{
 const face={vertices:[[0,0,0],[1,0,0],[1,1,0]],attrs:{'data-part':'wall-contact-shadow','data-ambient-gradient':{alpha:.3}}};
 assert.deepEqual(bakeAmbientFaces([face])[0].attrs,face.attrs);
});
