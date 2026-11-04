import {surfaceLightMatrix} from './room-shading.mjs';
import kit from './kit.mjs';
export const surfaceMaterial=id=>[...kit.wallMaterials,...kit.floorMaterials].find(m=>m.id===id&&m.texture);
export function textureAnchorPhase(anchor,materials){
 const periods=[...new Set(materials.filter(m=>m?.texture).map(m=>(m.period||2)*(m.mirror?2:1)))].sort((a,b)=>a-b);
 return periods.map(period=>[period,...anchor.map(n=>{const phase=Math.round((((n%period)+period)%period)*1e6)/1e6;return Math.abs(phase-period)<1e-6?0:phase;})]);
}
export function floorImagePath(id,x=0,z=0,rotation=0,size=1){
 const m=kit.floorMaterials.find(m=>m.id===id);id=m?.id||'blank';
 return `assets/floor-${id}-${size}x${size}.png`;
}
// A fixed world-plane UV basis keeps split faces, openings and adjacent walls aligned.
export function wallPattern(vertices,project,basis,material){
 if(basis){const [a,b,c]=basis.map(project);return [b[0]-a[0],b[1]-a[1],c[0]-a[0],c[1]-a[1],...a];}
 if(vertices.every(v=>Math.abs(v[2]-vertices[0][2])<1e-7)){const h=vertices[0][2],period=material?.period||2,a=project([-.5,-.5,h]),b=project([-.5+period,-.5,h]),c=project([-.5,-.5+period,h]);return [b[0]-a[0],b[1]-a[1],c[0]-a[0],c[1]-a[1],...a];}
 const xs=vertices.map(v=>v[0]),zs=vertices.map(v=>v[1]);
 const alongX=Math.max(...xs)-Math.min(...xs)>Math.max(...zs)-Math.min(...zs);
 const fixed=vertices[0][alongX?1:0];
 const point=(u,h)=>project(alongX?[u,fixed,h]:[fixed,u,h]);
 // Natural materials can repeat in world units instead of being stretched to
 // the wallpaper sheet height. Keep existing wallpaper mapping unchanged.
 const worldHeight=Math.sqrt(2*64**2)*Math.cos(Math.PI/6);
 const height=Number.isFinite(material?.verticalPeriod)&&material.verticalPeriod>0?material.verticalPeriod*worldHeight:material?.fullHeight?3.5*worldHeight:256;
 // A single continuous coordinate around intersecting wall planes. Resetting
 // U independently to world X/Z makes the corner trim slice another repeat.
 const start=material?.fullHeight?-fixed-1:-.5;
 const a=point(start,height),b=point(start+(material?.period||2),height),c=point(start,0);
 return [b[0]-a[0],b[1]-a[1],c[0]-a[0],c[1]-a[1],...a];
}
export function wallPatternSVG(id,matrix,href,tint,contrast,light=1,material={}){
 const mirror=material.mirror, floor=mirror&&!material.fullHeight;
 // Mirrored SVG image edges are independently antialiased. Their coverage
 // does not sum to opaque at fractional pixels, leaving a vertical hairline.
 // Underpaint a tiny gutter, then draw the exact UV image over it; this keeps
 // the pattern scale/phase unchanged while making internal joins opaque.
 const image=transform=>{
  const tag=href.startsWith('#')?'use':'image',base=`filter="url(#${id}-light)" href="${href}" preserveAspectRatio="none"`;
  const gutter=mirror?`<${tag} ${base} transform="translate(-.015625 ${floor?'-.015625':'0'}) scale(1.03125 ${floor?'1.03125':'1'})" width="1" height="1"/>`:'';
  return `<g${transform?` transform="${transform}"`:''}>${gutter}<${tag} ${base} width="1" height="1"/></g>`;
 };
 return `<filter id="${id}-light" color-interpolation-filters="sRGB"><feColorMatrix values="${surfaceLightMatrix(light)}"/></filter><pattern id="${id}" patternUnits="userSpaceOnUse" width="${mirror?2:1}" height="${floor?2:1}" patternTransform="matrix(${matrix.join(' ')})">${image('')}${mirror?image('translate(2 0) scale(-1 1)'):''}${floor?image('translate(0 2) scale(1 -1)')+image('translate(2 2) scale(-1 -1)'):''}</pattern>`;
}

// Continue wallpaper around its exposed thickness from the visible wall face.
// The old generic mapping reset U to the perpendicular world axis on end caps.
export function wallEndTextureBasis(w,vertices,rotation,material={}){
 const axis=w.axis==='x'?0:1,along=1-axis;
 const side=(axis===0?[1,1,-1,-1]:[1,-1,-1,1])[rotation%4];
 const end=vertices[0][along],centre=w.axis==='x'?w.z:w.x;
 const turn=end>=centre?1:-1,dir=-side*turn;
 const visible=side>0?Math.max(...vertices.map(v=>v[axis])):Math.min(...vertices.map(v=>v[axis]));
 const period=material?.period||2,repeat=period*(material?.mirror?2:1);
 const faceFixed=(axis===0?w.x:w.z)-.5+side*.06;
 const startPhase=material?.fullHeight?end+faceFixed+1:end+.5;
 const phase=((startPhase%repeat)+repeat)%repeat;
 const worldHeight=Math.sqrt(2*64**2)*Math.cos(Math.PI/6);
 const H=Number.isFinite(material?.verticalPeriod)&&material.verticalPeriod>0?material.verticalPeriod*worldHeight:material?.fullHeight?3.5*worldHeight:256;
 const point=(u,h)=>{const p=[0,0,h];p[axis]=visible+(u-phase)*dir;p[along]=end;return p};
 return [point(0,H),point(period,H),point(0,0)];
}
