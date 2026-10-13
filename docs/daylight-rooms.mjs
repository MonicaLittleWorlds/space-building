import {roomLayout} from './rooms.mjs';
import {KIT} from './geometry.mjs';
import {HEIGHT_UNIT} from './daylight-geometry.mjs';
export function indoorRoofFaces(level){
 const cells=new Set(roomLayout(level).filter(r=>r.kind==='indoor').flatMap(r=>[...r.cells]));
 return [...cells].map(id=>{const [x,z]=id.split(',').map(Number),h=KIT.wallHeight/HEIGHT_UNIT;return {vertices:[[x-.5,h,z-.5],[x+.5,h,z-.5],[x+.5,h,z+.5],[x-.5,h,z+.5]]};});
}
export function authoredLights(level){return level.items.filter(i=>i.light).slice(0,4).map(i=>({x:i.x,z:i.z,height:i.light.height??1.8,color:i.light.color||'#ffe0ad',intensity:i.light.intensity??12,range:i.light.range??8}));}
