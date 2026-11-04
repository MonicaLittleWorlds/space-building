// New projects have one continuous ground plane; existing floating projects opt out by omission.
export function ensureGroundLot(project){
 const lot=project.groundLot,level=project.levels[0];if(!lot||!level)return project;
 const cells=Object.keys(level.tiles).map(id=>id.split(',').map(Number));
 const minX=Math.min(lot.x,...cells.map(c=>c[0])),minZ=Math.min(lot.z,...cells.map(c=>c[1]));
 const maxX=Math.max(lot.x+lot.width-1,...cells.map(c=>c[0])),maxZ=Math.max(lot.z+lot.depth-1,...cells.map(c=>c[1]));
 if(maxX-minX>=128||maxZ-minZ>=128)throw Error('Keep the grass lot within 128 × 128 tiles.');
 Object.assign(lot,{x:minX,z:minZ,width:maxX-minX+1,depth:maxZ-minZ+1});
 for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++)level.tiles[`${x},${z}`]??={walk:true,place:true,material:'legacy-grass'};
 return project;
}
