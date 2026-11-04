import {roomCutawayEdges} from './room-cutaway.mjs';
import {key,edgeKey} from './model.mjs';
import {KIT,wallEnds} from './geometry.mjs';
const structural=w=>w&&['wall','door','window'].includes(w.kind);
const edgeBetween=(x,z,dx,dz)=>({axis:dx?'x':'z',x:x+(dx>0?1:0),z:z+(dz>0?1:0)});
const sides=w=>w.axis==='x'?[key(w.x,w.z),key(w.x-1,w.z)]:[key(w.x,w.z),key(w.x,w.z-1)];
export function roomLayout(level){
 const tiles=Object.keys(level.tiles),assigned=new Set(),rooms=[];
 for(const area of level.rooms||[]){
  const cells=new Set(tiles.filter(id=>{const [x,z]=id.split(',').map(Number);return !assigned.has(id)&&x>=area.x&&x<area.x+area.width&&z>=area.z&&z<area.z+area.depth;}));
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
 const normalized=rooms.map(r=>({...r,cells:[...r.cells],boundaries:r.boundaries.map(b=>({edge:edgeKey(b.wall),outward:b.outward}))}));
 for(const edge of roomCutawayEdges(normalized,level.walls,normalized.find(r=>r.id===room.id),rotation))selected.add(edge);
 return {selected,room};
}
export function cutProfile(w,walls,selected){
 // Meet an upright neighbour with a sloped return. Unconnected ends and
 // joins between two lowered walls keep the low, level profile.
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
