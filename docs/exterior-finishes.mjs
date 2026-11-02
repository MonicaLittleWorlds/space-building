import {roomLayout} from './rooms.mjs';
import {edgeKey} from './model.mjs';
export const EXTERIOR_MATERIALS=['cc0-beige-wall-001','cc0-red-brick-03','cc0-sandstone-blocks-05','cc0-wood-planks-grey'];
// Opted-in lots have an explicit exterior finish, independent of each room.
export function ensureExteriorFinishes(project,{repaint=false}={}){
 if(!project.exteriorFinish)return project;
 project.decorGroups??=[];
 for(const [li,level]of project.levels.entries()){
  if(li>0)continue;
  const rooms=roomLayout(level).filter(r=>r.kind==='indoor'),id=`lw_exterior_${li}`,edges=new Map();
  for(const room of rooms)for(const b of room.boundaries){const k=edgeKey(b.wall);if(!edges.has(k))edges.set(k,[]);edges.get(k).push(b);}
  if(!project.decorGroups.some(g=>g.id===id))project.decorGroups.push({id,name:li?'Upper exterior':'Building exterior',kind:'wall',level:level.id,area:'outside',editable:true});
  for(const list of edges.values()){
   if(list.length!==1)continue;
   const {wall,outward}=list[0],inside=-outward;
   if(wall.facing&&wall.facing!==inside){[wall.material,wall.exteriorMaterial]=[wall.exteriorMaterial||wall.material,wall.material];[wall.decorGroup,wall.exteriorDecorGroup]=[wall.exteriorDecorGroup,wall.decorGroup];}
   wall.facing=inside;
   if(repaint||!wall.exteriorMaterial||wall.exteriorMaterial===wall.material)wall.exteriorMaterial=project.exteriorFinish;
   wall.exteriorDecorGroup=id;
  }
 }
 return project;
}
