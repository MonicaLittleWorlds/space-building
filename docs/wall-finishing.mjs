import {surfaceMaterial,wallEndTextureBasis} from './material-surfaces.mjs';

// Give each approved building finish real material on its thickness, including
// sloped cutaways. Basis vectors lie on the cap plane, never the upright wall.
export function capTextureBasis(w,vertices,material){
 const axis=w.axis==='x'?0:1,along=1-axis,period=material.period||2;
 const lo=vertices.reduce((a,b)=>a[along]<b[along]?a:b),hi=vertices.reduce((a,b)=>a[along]>b[along]?a:b);
 const span=hi[along]-lo[along],slope=span>1e-9?(hi[2]-lo[2])/span:0;
 const fixed=w[axis===0?'x':'z']-.5;
 const point=(u,v)=>{const p=[0,0,lo[2]+(u-lo[along])*slope];p[along]=u;p[axis]=v;return p};
 // A natural 2-cell material samples a narrow continuous strip across the
 // wall thickness. It is not squeezed into a whole-image ribbon per segment.
 return [point(-.5,fixed-.06),point(-.5+period,fixed-.06),point(-.5,fixed-.06+period)];
}
export function finishWallSurfaces(faces,wall,rotation=0,materialId){
 return faces.map(face=>{
  const w=face.wall||wall,attrs=face.attrs||{},id=materialId||attrs['data-material']||attrs['data-texture'];
  const m=surfaceMaterial(id),part=attrs['data-part']||face.part;
  if(!w||!m?.wrapSurfaces||!['cap','end'].includes(part))return face;
  return {...face,attrs:{...attrs,'data-texture':id,'data-material':id,
   'data-texture-basis':part==='cap'?capTextureBasis(w,face.vertices,m):wallEndTextureBasis(w,face.vertices,rotation,m)}};
 });
}
