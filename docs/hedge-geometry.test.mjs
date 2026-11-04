import test from 'node:test';
import assert from 'node:assert/strict';
import {hedgeFaces,hedgeJoins,hedgeFootprint} from './hedge-geometry.mjs';
import {fenceFaces,fencePostOwners} from './geometry.mjs';
const wall=(axis,x,z)=>({axis,x,z,kind:'fence',fenceStyle:'hedge'});
const inside=(p,poly)=>poly.every((a,i)=>{const b=poly[(i+1)%poly.length];return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-1e-9});
test('straight hedge runs have no internal upright end caps in any rotation',()=>{
 const walls=[0,1,2].map(z=>wall('x',0,z));
 for(let r=0;r<4;r++){const faces=fenceFaces(walls[1],r,fencePostOwners(walls[1],walls));assert.equal(faces.filter(f=>f.part==='hedge-side').length,1);assert.equal(faces.filter(f=>f.part==='hedge-top').length,1);}
});
test('L, T and cross hedge joins partition the footprint without gaps or overlapping top faces',()=>{
 const arms=[wall('x',0,0),wall('z',0,0),wall('x',0,-1),wall('z',-1,0)];
 for(const walls of [arms.slice(0,2),arms.slice(0,3),arms]){
  const polys=walls.map(w=>hedgeFootprint(w,hedgeJoins(w,walls)).polygon);
  for(let x=-1.55;x<.6;x+=.019)for(let z=-1.55;z<.6;z+=.023){
   const expected=walls.some(w=>w.axis==='x'?Math.abs(x-(w.x-.5))<=.13+1e-8&&z>=w.z-.5-(w.z===0?.13:0)-1e-8&&z<=w.z+.5+(w.z===-1?.13:0)+1e-8:Math.abs(z-(w.z-.5))<=.13+1e-8&&x>=w.x-.5-(w.x===0?.13:0)-1e-8&&x<=w.x+.5+(w.x===-1?.13:0)+1e-8);
   const hits=polys.filter(poly=>inside([x,z],poly)).length;
   // Shared miter boundaries have zero area; exclude exact diagonal samples.
   if(Math.abs(Math.abs(x+.5)-Math.abs(z+.5))<1e-7)continue;
   assert.equal(hits,expected?1:0,`${walls.length}-way join at ${x},${z}`);
  }
  for(let r=0;r<4;r++)for(const w of walls){const faces=hedgeFaces(w,r,hedgeJoins(w,walls));assert.ok(faces.every(f=>f.vertices.every(p=>p.every(Number.isFinite))));}
 }
});
