import {parseProject,validate,walkable,canPlace,blocked,triggerCells,key} from './model.mjs';
import {decorManifest} from './decor.mjs';
import kit from './kit.mjs';

// A portable integration contract; registration in the game is a separate step.
export function buildSpace(input){
 const project=parseProject(input),issues=validate(project);
 for(const l of project.levels){
  if(!Object.keys(l.tiles).length)issues.push(`${l.name}: add floor tiles or remove this empty floor.`);
  for(const t of Object.values(l.tiles))if(!kit.floorMaterials.some(m=>m.id===(t.material||'blank')))issues.push(`${l.name}: unknown floor material.`);
  for(const w of Object.values(l.walls))if(!kit.wallMaterials.some(m=>m.id===(w.material||'blank')))issues.push(`${l.name}: unknown wall material.`);
 }
 if(issues.length)throw Error('Build needs attention:\n'+[...new Set(issues)].join('\n'));
 const levels=project.levels.map(l=>{
  const cells=Object.entries(l.tiles).map(([id,t])=>{const [x,z]=id.split(',').map(Number),n={level:l.id,x,z};return {x,z,walkable:walkable(project,n),placeable:canPlace(project,n),material:t.material||'blank',decorGroup:t.decorGroup||null};});
  const xs=cells.map(c=>c.x),zs=cells.map(c=>c.z);
  const bounds=cells.reduce((b,c)=>({minX:Math.min(b.minX,c.x),maxX:Math.max(b.maxX,c.x),minZ:Math.min(b.minZ,c.z),maxZ:Math.max(b.maxZ,c.z)}),{minX:xs[0],maxX:xs[0],minZ:zs[0],maxZ:zs[0]});
  const edges=[];
  for(const c of cells.filter(c=>c.walkable))for(const [dx,dz] of [[1,0],[0,1]]){const next={level:l.id,x:c.x+dx,z:c.z+dz};if(walkable(project,next)&&!blocked(l,c,next))edges.push([key(c.x,c.z),key(next.x,next.z)]);}
  return {id:l.id,name:l.name,...(l.rooms?{rooms:structuredClone(l.rooms)}:{}),bounds,cells,walkEdges:edges,walls:structuredClone(l.walls),items:structuredClone(l.items)};
 });
 const portals=project.stairs.flatMap(s=>[[s.a,s.b],[s.b,s.a]].map(([a,b])=>({id:s.id,level:a.level,cells:triggerCells(a).map(({x,z})=>({x,z})),destination:{level:b.level,x:b.x,z:b.z,angle:b.angle},activation:'route-end',suppressArrival:true})));
 return {format:'lw-space-build',version:1,requires:'lw-studio-game-importer-v1',project,scene:{projection:{halfWidth:64,halfHeight:32},background:['#9BECFC','#00C4F5'],entry:{...project.spawn,visible:false},levels,portals,stairs:structuredClone(project.stairs)},decor:decorManifest(project)};
}
export function openSpaceFile(raw){
 const value=typeof raw==='string'?JSON.parse(raw):raw;
 if(value?.format==='lw-space-build'){
  if(value.version!==1||value.requires!=='lw-studio-game-importer-v1')throw Error('Unsupported LW build version.');
  const checked=buildSpace(value.project);
  if(JSON.stringify(value.scene)!==JSON.stringify(checked.scene)||JSON.stringify(value.decor)!==JSON.stringify(checked.decor))throw Error('Build data does not match its project. Rebuild from the original project file.');
  return checked.project;
 }
 if(value?.format==='lw-studio-decor-mapping')throw Error('This is a décor mapping. Open its .lwspace.json project instead.');
 return parseProject(value);
}
