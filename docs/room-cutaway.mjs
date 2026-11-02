// Matches the apartment room-zone rule: lower the active camera edges and
// complete partitions of nearer rooms whose projected wall bounds occlude it.
const bounds=room=>room.cells.reduce((b,id)=>{const [x,z]=id.split(',').map(Number);return {minX:Math.min(b.minX,x-.5),maxX:Math.max(b.maxX,x+.5),minZ:Math.min(b.minZ,z-.5),maxZ:Math.max(b.maxZ,z+.5)};},{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity});
const overlap=(a,b)=>a.maxX>=b.minX&&a.minX<=b.maxX&&a.maxY>=b.minY&&a.minY<=b.maxY;
function rect(b,r,height=274.34285){
 const sx=[1,1,-1,-1][r],sz=[1,-1,-1,1][r];
 const p=[[b.minX,b.minZ],[b.minX,b.maxZ],[b.maxX,b.minZ],[b.maxX,b.maxZ]].map(([x,z])=>[(sz*x-sx*z)*64,(sx*x+sz*z)*32]);
 return {minX:Math.min(...p.map(p=>p[0])),maxX:Math.max(...p.map(p=>p[0])),minY:Math.min(...p.map(p=>p[1]))-height,maxY:Math.max(...p.map(p=>p[1]))};
}
const nearer=(a,b,r)=>r===0?(b.minX>a.minX&&b.maxZ>a.minZ)||(b.minZ>a.minZ&&b.maxX>a.minX):r===1?(b.maxZ<a.maxZ&&b.maxX>a.minX)||(b.minX>a.minX&&b.minZ<a.maxZ):r===2?(b.maxX<a.maxX&&b.minZ<a.maxZ)||(b.maxZ<a.maxZ&&b.minX<a.maxX):(b.minZ>a.minZ&&b.minX<a.maxX)||(b.maxX>a.maxX&&b.maxZ>a.minZ);
export function roomCutawayEdges(rooms,walls,active,rotation){
 const selected=new Set();if(!active||active.kind!=='indoor')return selected;
 const r=((rotation%4)+4)%4,sx=[1,1,-1,-1][r],sz=[1,-1,-1,1][r],ab=bounds(active),ar=rect(ab,r);
 const inset={minX:ar.minX+Math.min(50,(ar.maxX-ar.minX)*.15),maxX:ar.maxX-Math.min(50,(ar.maxX-ar.minX)*.15),minY:ar.minY+50,maxY:ar.maxY-50};
 for(const b of active.boundaries||[]){const w=walls[b.edge];if(w?.collapse&&b.outward*(w.axis==='x'?sx:sz)>0)selected.add(b.edge);}
 for(const room of rooms){
  if(room===active||room.kind!=='indoor'||!room.cells?.length)continue;
  const rb=bounds(room);if(!nearer(ab,rb,r)||!overlap(ar,rect(rb,r)))continue;
  const runs=new Map();
  for(const b of room.boundaries||[]){const w=walls[b.edge];if(!w?.collapse||!Number.isFinite(w.x)||!Number.isFinite(w.z))continue;const id=w.axis+':'+(w.axis==='x'?w.x:w.z)+':'+b.outward;if(!runs.has(id))runs.set(id,[]);runs.get(id).push([b.edge,w]);}
  for(const run of runs.values())if(run.some(([,w])=>overlap(inset,rect({minX:w.x-.5,maxX:w.x+(w.axis==='z'?.5:-.5),minZ:w.z-.5,maxZ:w.z+(w.axis==='x'?.5:-.5)},r))))for(const [edge]of run)selected.add(edge);
 }
 return selected;
}
