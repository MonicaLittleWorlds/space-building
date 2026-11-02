import {surfaceLightMatrix} from './room-shading.mjs';
import kit from './kit.mjs';
export const surfaceMaterial=id=>[...kit.wallMaterials,...kit.floorMaterials].find(m=>m.id===id&&m.texture);
export function floorImagePath(id,x=0,z=0,rotation=0,size=1){
 const m=kit.floorMaterials.find(m=>m.id===id);id=m?.id||'blank';
 return `assets/floor-${id}-${size}x${size}.png`;
}
// A fixed world-plane UV basis keeps split faces, openings and adjacent walls aligned.
export function wallPattern(vertices,project,basis,material){
 if(basis){const [a,b,c]=basis.map(project);return [b[0]-a[0],b[1]-a[1],c[0]-a[0],c[1]-a[1],...a];}
 if(vertices.every(v=>Math.abs(v[2]-vertices[0][2])<1e-7)){const h=vertices[0][2],a=project([-.5,-.5,h]),b=project([1.5,-.5,h]),c=project([-.5,1.5,h]);return [b[0]-a[0],b[1]-a[1],c[0]-a[0],c[1]-a[1],...a];}
 const xs=vertices.map(v=>v[0]),zs=vertices.map(v=>v[1]);
 const alongX=Math.max(...xs)-Math.min(...xs)>Math.max(...zs)-Math.min(...zs);
 const fixed=vertices[0][alongX?1:0];
 const point=(u,h)=>project(alongX?[u,fixed,h]:[fixed,u,h]);
 const height=material?.fullHeight?3.5*Math.sqrt(2*64**2)*Math.cos(Math.PI/6):256;
 const a=point(-.5,height),b=point(-.5+(material?.period||2),height),c=point(-.5,0);
 return [b[0]-a[0],b[1]-a[1],c[0]-a[0],c[1]-a[1],...a];
}
export function wallPatternSVG(id,matrix,href,tint,contrast,light=1,material={}){
 const mirror=material.mirror, floor=mirror&&!material.fullHeight;
 const image=transform=>`<${href.startsWith('#')?'use':'image'} filter="url(#${id}-light)" href="${href}" width="1" height="1" preserveAspectRatio="none"${transform?` transform="${transform}"`:''}/>`;
 return `<filter id="${id}-light" color-interpolation-filters="sRGB"><feColorMatrix values="${surfaceLightMatrix(light)}"/></filter><pattern id="${id}" patternUnits="userSpaceOnUse" width="${mirror?2:1}" height="${floor?2:1}" patternTransform="matrix(${matrix.join(' ')})">${image('')}${mirror?image('translate(2 0) scale(-1 1)'):''}${floor?image('translate(0 2) scale(1 -1)')+image('translate(2 2) scale(-1 -1)'):''}</pattern>`;
}
