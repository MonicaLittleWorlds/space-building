import {key,edgeKey} from './model.mjs';
import {KIT,wallEnds} from './geometry.mjs';
const structural=w=>w&&['wall','door','window'].includes(w.kind);
const edgeBetween=(x,z,dx,dz)=>({axis:dx?'x':'z',x:x+(dx>0?1:0),z:z+(dz>0?1:0)});
const sides=w=>w.axis==='x'?[key(w.x,w.z),key(w.x-1,w.z)]:[key(w.x,w.z),key(w.x,w.z-1)];
export function roomLayout(level){
 const tiles=Object.keys(level.tiles),assigned=new Set(),rooms=[];
 for(const area of level.rooms||[]){
  const cells=new Set(tiles.filter(id=>{const [x,z]=id.split(',').map(Number);return x>=area.x&&x<area.x+area.width&&z>=area.z&&z<area.z+area.depth;}));
  rooms.push({...area,cells});for(const id of cells)assigned.add(id);
 }
 const remaining=new Set(tiles.filter(id=>!assigned.has(id)));
 while(remaining.size){
  const start=remaining.values().next().value,cells=new Set([start]),queue=[start];remaining.delete(start);let enclosed=true;
  for(let i=0;i<queue.length;i++){
   const [x,z]=queue[i].split(',').map(Number);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    if(structural(level.walls[edgeKey(edgeBetween(x,z,dx,dz))]))continue;
    const next=key(x+dx,z+dz);
    if(!level.tiles[next]||assigned.has(next)){enclosed=false;continue;}
    if(remaining.delete(next)){cells.add(next);queue.push(next);}
   }
  }
  rooms.push({id:'auto:'+start,name:enclosed?'Detected room '+(rooms.filter(r=>r.kind==='indoor').length+1):'Outside',kind:enclosed?'indoor':'outdoor',cells});
 }
 for(const room of rooms){
  room.boundaries=Object.values(level.walls).filter(structural).flatMap(w=>{const [a,b]=sides(w),pa=room.cells.has(a),pb=room.cells.has(b);return pa!==pb?[{wall:w,outward:pa?-1:1}]:[];});
 }
 return rooms;
}
const box=points=>points.reduce((b,p)=>({left:Math.min(b.left,p[0]),right:Math.max(b.right,p[0]),top:Math.min(b.top,p[1]),bottom:Math.max(b.bottom,p[1])}),{left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity});
const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
export function roomCutaway(level,{avatar=null,rotation=0,mode='auto',rooms=roomLayout(level)}={}){
 const selected=new Set(),walls=Object.values(level.walls);
 if(mode==='full')return {selected,room:null};
 if(mode==='cut'){for(const w of walls)if(w.collapse&&structural(w))selected.add(edgeKey(w));return {selected,room:null};}
 if(!avatar||avatar.level!==level.id)return {selected,room:null};
 const room=rooms.find(r=>r.cells.has(key(Math.round(avatar.x),Math.round(avatar.z))));
 if(!room||room.kind!=='indoor')return {selected,room};
 const sx=[1,1,-1,-1][rotation],sz=[1,-1,-1,1][rotation];
 const project=([x,z,h=0])=>[(sz*x-sx*z)*64,(sx*x+sz*z)*32-h];
 const footprint=box([...room.cells].flatMap(id=>{const [x,z]=id.split(',').map(Number);return [[x-.5,z-.5],[x+.5,z+.5],[x+.5,z-.5],[x-.5,z+.5]].map(project);}));
 const avatarDepth=(sx*avatar.x+sz*avatar.z)*32;
 for(const candidate of rooms){
  if(candidate.kind!=='indoor')continue;
  const runs=new Map();
  for(const boundary of candidate.boundaries){
   const w=boundary.wall;if(!w.collapse||boundary.outward*(w.axis==='x'?sx:sz)<=0)continue;
   const id=w.axis+':'+(w.axis==='x'?w.x:w.z)+':'+boundary.outward;
   if(!runs.has(id))runs.set(id,[]);runs.get(id).push(w);
  }
  for(const run of runs.values()){
   const intersects=candidate===room||run.some(w=>{
    const ends=wallEnds(w),base=ends.map(project);
    if(Math.max(...base.map(p=>p[1]))<=avatarDepth)return false;
    const rect=box(ends.flatMap(p=>[project([...p,0]),project([...p,KIT.wallHeight])]));
    return overlap(rect,footprint);
   });
   if(intersects)for(const w of run)selected.add(edgeKey(w));
  }
 }
 return {selected,room};
}
export function cutProfile(w,walls,selected){
 const high=wallEnds(w).map(p=>Object.values(walls).some(other=>other!==w&&structural(other)&&!selected.has(edgeKey(other))&&wallEnds(other).some(q=>q[0]===p[0]&&q[1]===p[1])));
 const result=[[0,high[0]?KIT.wallHeight:26]];
 if(high[0])result.push([.4,26]);
 if(high[1])result.push([.6,26]);
 result.push([1,high[1]?KIT.wallHeight:26]);return result;
}

export function roomWallOpacity(w,selected,mode,visibility,back=false){
 const faded=['auto-fade','transparent'].includes(mode)&&selected.has(edgeKey(w));
 return faded?visibility:back&&!w.collapse?.3:1;
}
