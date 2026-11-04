import test from 'node:test';
import assert from 'node:assert/strict';
import {wallPattern,textureAnchorPhase,wallEndTextureBasis} from './material-surfaces.mjs';
const project=([x,z,h])=>[64*(x-z),32*(x+z)-h];
test('natural wall material keeps a two-cell vertical repeat on both wall axes',()=>{
 for(const vertices of [[[0,0,0],[0,1,0],[0,1,132]],[[0,0,0],[1,0,0],[1,0,132]]]){
  const matrix=wallPattern(vertices,project,null,{period:2,verticalPeriod:2});
  assert.equal(matrix[2],0);assert.ok(Math.abs(matrix[3]-2*Math.sqrt(2*64**2)*Math.cos(Math.PI/6))<1e-9);
  const shifted=vertices.map(([x,z,h])=>[x+2,z+2,h]);
  const next=wallPattern(shifted,project,null,{period:2,verticalPeriod:2});
  assert.deepEqual(next.slice(0,4),matrix.slice(0,4));
 }
});
test('existing full-height and unconfigured wallpaper keep their previous repeat heights',()=>{
 const v=[[0,0,0],[1,0,0],[1,0,132]];
 assert.equal(wallPattern(v,project,null,{period:2})[3],256);
 assert.equal(wallPattern(v,project,null,{period:2,fullHeight:true})[3],3.5*Math.sqrt(2*64**2)*Math.cos(Math.PI/6));
 for(const invalid of [0,-1,Infinity,NaN])assert.equal(wallPattern(v,project,null,{verticalPeriod:invalid})[3],256);
});
test('hedge top uses the same small world repeat as its upright sides',()=>{
 const v=[[0,0,132],[1,0,132],[1,1,132],[0,1,132]];
 const top=wallPattern(v,project,null,{period:.65,verticalPeriod:.65});
 [64*.65,32*.65,-64*.65,32*.65].forEach((value,i)=>assert.ok(Math.abs(top[i]-value)<1e-9));
 assert.deepEqual(wallPattern(v,project,null,{}).slice(0,4),[128,64,-128,64]);
});
test('native texture cache distinguishes fractional hedge repeat phases four cells apart',()=>{
 const materials=[{texture:'hedge.png',period:.65,mirror:true}];
 assert.notDeepEqual(textureAnchorPhase([0,0],materials),textureAnchorPhase([4,0],materials));
 assert.deepEqual(textureAnchorPhase([0,0],materials),textureAnchorPhase([13,0],materials));
 const wallpaper=[{texture:'wall.png',period:2,mirror:true}];
 assert.deepEqual(textureAnchorPhase([0,0],wallpaper),textureAnchorPhase([4,0],wallpaper));
});
test('sci-fi wall ends continue the face repeat and keep trims at wall height in every view',()=>{
 const mat={period:2,fullHeight:true,mirror:true},H=3.5*Math.sqrt(2*64**2)*Math.cos(Math.PI/6);
 for(const axis of ['x','z'])for(let r=0;r<4;r++)for(const end of [-2.5,-1.5,.5,3.5])for(const height of [30,H]){
  const fixed=axis==='x'?0:1,along=1-fixed,side=(fixed===0?[1,1,-1,-1]:[1,-1,-1,1])[r];
  const p=(across,h)=>{const v=[0,0,h];v[fixed]=across;v[along]=end;return v};
  const vertices=[p(-.06,0),p(.06,0),p(.06,height),p(-.06,height)];
  const [a,b,c]=wallEndTextureBasis({axis,x:0,z:0},vertices,r,mat);
  // At the shared visible edge, U equals the full face's world-space phase.
  const u=(side*.06-a[fixed])/(b[fixed]-a[fixed]);
  assert.ok(Math.abs(u-(((end+.5+side*.06)%4+4)%4)/2)<1e-9);
  assert.equal(a[2],H);assert.equal(b[2],H);assert.equal(c[2],0);
  assert.equal(a[along],end);assert.equal(b[along],end);
 }
});

test('wallpaper phase is continuous where perpendicular faces meet',()=>{
 const material={fullHeight:true,period:2};
 const phase=(v,p)=>{const m=wallPattern(v,project,null,material),[x,y]=project(p),dx=x-m[4],dy=y-m[5],det=m[0]*m[3]-m[1]*m[2];return (dx*m[3]-dy*m[2])/det;};
 for(const x of [-2.56,.44,8.56])for(const z of [-.56,3.44,9.56]){
  const p=[x,z,110],a=[[x,z,0],[x+1,z,0],[x+1,z,270]],b=[[x,z,0],[x,z+1,0],[x,z+1,270]];
  assert.ok(Math.abs(phase(a,p)-phase(b,p))<1e-9);
 }
});

test('tiled wall ends retain the same vertical repeat as the face',()=>{
 const material={period:2,verticalPeriod:2,fullHeight:true};
 const vertices=[[0,-.5,0],[.12,-.5,0],[.12,-.5,270],[0,-.5,270]];
 const basis=wallEndTextureBasis({axis:'x',x:0,z:0},vertices,0,material);
 assert.equal(basis[0][2],wallPattern([[0,0,0],[0,1,0],[0,1,270]],project,null,material)[3]);
});
