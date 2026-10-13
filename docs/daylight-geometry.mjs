import kit from './kit.mjs';
import {wallFaces} from './architecture.mjs';
import {wallCorners,wallCornerFaces,wallFacing,wallSide,fenceFaces,fencePostOwners,stairFaces,stairLevels,stairwell,itemFaces} from './geometry.mjs';
export const HEIGHT_UNIT=Math.sqrt(6144);
export const DEFAULT_DAYLIGHT=Object.freeze({azimuth:225,elevation:48,intensity:2.3});
export function daylightSettings(value={}) {
 const clamp=(v,d,a,b)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):d;
 return {azimuth:clamp(value?.azimuth,225,0,360),elevation:clamp(value?.elevation,48,10,85),intensity:clamp(value?.intensity,2.3,0,4)};
}
export function sunlightPosition(settings,distance=30){const s=daylightSettings(settings),a=s.azimuth*Math.PI/180,e=s.elevation*Math.PI/180;return [Math.cos(a)*Math.cos(e)*distance,Math.sin(e)*distance,Math.sin(a)*Math.cos(e)*distance];}
// UV phase belongs to world coordinates, never to an individual tile or wall.
export function worldUV([x,z,h=0],axis='floor',period=2){return axis==='floor'?[x/period,-z/period]:[(axis==='x'?z:x)/period,h/HEIGHT_UNIT/period];}
export function daylightGeometry(project,levelId,{rotation:cameraRotation=0,cutaway=false,collapsed=[],openGates=[]}={}){
 const level=project.levels.find(l=>l.id===levelId);if(!level)return {faces:[],warnings:[]};
 const faces=[],warnings=new Set(),walls=Object.values(level.walls),corners=wallCorners(level.walls,w=>collapsed.includes(`${w.axis}:${w.x},${w.z}`)),seen=new Set();
 const wells=project.stairs.filter(s=>stairLevels(project,s).upper.level===levelId).map(s=>stairwell(project,s,0)).filter(Boolean),holes=new Set(wells.flatMap(w=>w.cells.map(c=>`${c.x},${c.z}`)));
 function add(face,material,kind='wall'){
  const v=face.vertices,a=face.attrs||{},part=a['data-part']||face.part||'';
  if(v.length<3||/grain|mortar|vein|chip|board-joint|masonry-face|masonry-bevel|masonry-undercut|timber-board|board-bevel|reflection/.test(part))return;
  const id=v.map(p=>p.map(n=>Math.round(n*1e6)).join(',')).sort().join(';');if(seen.has(id))return;seen.add(id);
  const horizontal=v.every(p=>Math.abs((p[2]||0)-(v[0][2]||0))<1e-6),axis=horizontal?'floor':v.every(p=>Math.abs(p[0]-v[0][0])<1e-6)?'x':'z';
  const color=a.fill||face.color||'#d3d7c9',light=Number(a['data-surface-light'])||1;
  const unlit=/^#[a-f0-9]{6}$/i.test(color)?'#'+color.slice(1).match(/../g).map(c=>Math.min(255,Math.round(parseInt(c,16)/light)).toString(16).padStart(2,'0')).join(''):'#d3d7c9';
  if(a['data-sprite'])warnings.add('Model fences retain their existing baked sprite appearance.');
  faces.push({vertices:v.map(([x,z,h=0])=>[x,h/HEIGHT_UNIT,z]),uv:v.map(p=>worldUV(p,axis)),material:a['data-texture']||material||null,color:unlit,kind,part,opacity:Number(a.opacity??1),sprite:a['data-sprite']||null,basis:a['data-sprite-basis']?.map(([x,z,h=0])=>[x,h/HEIGHT_UNIT,z])});
 }
 for(const [id,t]of Object.entries(level.tiles)){if(holes.has(id))continue;const [x,z]=id.split(',').map(Number);add({vertices:[[x-.5,z-.5,0],[x-.5,z+.5,0],[x+.5,z+.5,0],[x+.5,z-.5,0]],color:kit.floorMaterials.find(m=>m.id===t.material)?.color},t.material||'blank','floor');}
 const hidden=new Set(walls.filter(w=>cutaway&&w.kind!=='fence'&&wallSide({...w,facing:wallFacing(w,level.tiles)},cameraRotation)==='back'));
 for(const w of walls)for(let rotation=0;rotation<4;rotation++){
  if(hidden.has(w))continue;
  if(w.kind==='fence'){for(const f of fenceFaces({...w,gateOpen:openGates.includes(`${w.axis}:${w.x},${w.z}`)},rotation,fencePostOwners(w,walls)))if(!f.attrs?.['data-sprite']||rotation===cameraRotation)add(f,null,'fence');continue;}
  const back=wallSide({...w,facing:wallFacing(w,level.tiles)},rotation)==='back',material=back?(w.exteriorMaterial||w.material):w.material;
  for(const f of wallFaces(w,{level,rotation,corners,collapsed:collapsed.includes(`${w.axis}:${w.x},${w.z}`),paint:{back:false,material,fill:kit.wallMaterials.find(m=>m.id===material)?.color||'#d3d7c9',opacity:1}}))add(f,material||'blank');
 }
 for(const c of corners.filter(c=>!c.walls.every(w=>hidden.has(w))))for(let r=0;r<4;r++)for(const f of wallCornerFaces(c,r))add(f,f.wall?.material||'blank');
 for(const s of project.stairs)if(stairLevels(project,s).lower.level===levelId)for(let r=0;r<4;r++)for(const f of stairFaces(stairLevels(project,s).lower,r))add(f,null,'stair');
 for(const well of wells)for(const f of well.faces){
  let vertices=f.vertices;
  if(vertices.every(v=>v[2]<=0))for(const axis of [0,1])for(const sign of [1,-1]){
   const bound=(sign===1?Math.min:Math.max)(...well.opening.map(v=>v[axis])),out=[];
   for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],da=(a[axis]-bound)*sign,db=(b[axis]-bound)*sign;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((n,j)=>n+(b[j]-n)*t));}}vertices=out;
  }
  if(vertices.length>=3)add({...f,vertices},null,'stair');
 }
 for(const item of level.items)for(let r=0;r<4;r++)for(const f of itemFaces(item,r))add(f,null,'item');
 if(wells.length)warnings.add('Stair openings show the descending flight; downstairs room contents remain in the native view.');
 return {faces,warnings:[...warnings],level:levelId};
}
