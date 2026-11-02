// Apartment-style cutaways: camera-facing edges of the occupied room lower
// together; other partitions lower only when they stand between that room
// and the camera. Test world-space sight lines, not overlapping screen boxes.
// A rear wall can overlap the same pixels without being in front of the room.
const HEIGHT=274.34285;
const samples=room=>[...room.cells].flatMap(id=>{
 const [x,z]=id.split(',').map(Number);
 return [[x,z],[x-.35,z-.35],[x+.35,z+.35],[x-.35,z+.35],[x+.35,z-.35]];
});
function blocksRoom(w,points,sx,sz){
 const isX=w.axis==='x',plane=(isX?w.x:w.z)-.5,sign=isX?sx:sz;
 const lo=(isX?w.z:w.x)-.5,hi=lo+1;
 return points.some(([x,z])=>{
  const distance=(plane-(isX?x:z))/sign;
  if(distance<=.001||distance*64>=HEIGHT)return false;
  const along=(isX?z:x)+distance*(isX?sz:sx);
  return along>lo+.001&&along<hi-.001;
 });
}
export function roomCutawayEdges(rooms,walls,active,rotation){
 const selected=new Set();if(!active||active.kind!=='indoor')return selected;
 const r=((rotation%4)+4)%4,sx=[1,1,-1,-1][r],sz=[1,-1,-1,1][r];
 const own=new Set();
 for(const b of active.boundaries||[]){
  own.add(b.edge);const w=walls[b.edge];
  if(w?.collapse&&b.outward*(w.axis==='x'?sx:sz)>0)selected.add(b.edge);
 }
 const points=samples(active);
 for(const room of rooms){
  if(room===active||room.kind!=='indoor'||!room.cells?.length)continue;
  const runs=new Map();
  for(const b of room.boundaries||[]){
   const w=walls[b.edge];if(!w?.collapse||own.has(b.edge)||!Number.isFinite(w.x)||!Number.isFinite(w.z))continue;
   const id=w.axis+':'+(w.axis==='x'?w.x:w.z)+':'+b.outward;
   if(!runs.has(id))runs.set(id,[]);runs.get(id).push([b.edge,w]);
  }
  for(const entries of runs.values()){
   entries.sort((a,b)=>a[1].axis==='x'?a[1].z-b[1].z:a[1].x-b[1].x);
   let run=[];
   const flush=()=>{if(run.some(([,w])=>blocksRoom(w,points,sx,sz)))for(const [edge]of run)selected.add(edge);run=[];};
   for(const entry of entries){const w=entry[1],prev=run.at(-1)?.[1];if(prev&&(w.axis==='x'?w.z-prev.z:w.x-prev.x)>1.01)flush();run.push(entry);}
   flush();
  }
 }
 return selected;
}
