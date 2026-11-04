// A shared wall has two independent finishes, owned by its adjacent rooms.
export function roomAtCell(level,x,z){
 return (level.rooms||[]).find(r=>x>=r.x&&x<r.x+r.width&&z>=r.z&&z<r.z+r.depth);
}
export function wallFaceMaterial(level,wall,rotation){
 const adjacent=[roomAtCell(level,wall.x,wall.z),roomAtCell(level,wall.x-(wall.axis==='x'?1:0),wall.z-(wall.axis==='z'?1:0))];
 if(wall.material==='lw-decor-hedge'||wall.exteriorMaterial==='lw-decor-hedge'||adjacent.some(r=>r?.wallMaterial==='lw-decor-hedge'))return 'lw-decor-hedge';
 const side=(wall.axis==='x'?[1,1,-1,-1]:[1,-1,-1,1])[((rotation%4)+4)%4];
 const x=wall.x-(wall.axis==='x'&&side<0?1:0),z=wall.z-(wall.axis==='z'&&side<0?1:0);
 const room=roomAtCell(level,x,z);
 if(room?.kind==='indoor'&&room.wallMaterial)return room.wallMaterial;
 const positive=!!level.tiles[`${wall.x},${wall.z}`],negative=!!level.tiles[`${wall.x-(wall.axis==='x'?1:0)},${wall.z-(wall.axis==='z'?1:0)}`];
 const facing=wall.facing||(positive!==negative?(positive?1:-1):1);
 return side*facing>0?wall.material:(wall.exteriorMaterial||wall.material);
}
export function applyRoomFinish(level,roomId,kind,material){
 const room=level.rooms?.find(r=>r.id===roomId);if(!room)return false;
 if(kind==='wall'){room.wallMaterial=material;return true;}
 for(const [id,tile]of Object.entries(level.tiles)){const [x,z]=id.split(',').map(Number);if(roomAtCell(level,x,z)===room)tile.material=material;}
 return true;
}
