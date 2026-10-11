import catalog from './assets/fence-models/catalog.mjs';
export const modelFenceStyles=['natural-picket','heritage-iron'];
export const isModelFence=style=>modelFenceStyles.includes(style);
export const modelFenceThumbnail=style=>`assets/fence-models/${style}-fence-0.png`;
// Sprite basis survives BSP clipping; every placement shares the same source images.
export function modelFenceFaces(w,rotation,posts=[true,true]){
 const a=[w.x-.5,w.z-.5],du=w.axis==='x'?[0,1]:[1,0],normal=w.axis==='x'?[1,0]:[0,1];
 const base=(u,v,h)=>[a[0]+du[0]*u+normal[0]*v,a[1]+du[1]*u+normal[1]*v,h];
 const directions=[[1,1],[1,-1],[-1,-1],[-1,1]],camera=directions[rotation%4];
 function part(name,point){
  const o=point(0,0,0),u=point(1,0,0),v=point(0,1,0),sign=p=>Math.sign((p[0]-o[0])*camera[0]+(p[1]-o[1])*camera[1]);
  const r=directions.findIndex(d=>d[0]===sign(u)&&d[1]===sign(v));
  const f=catalog[w.fenceStyle+'-'+name][r];
  // The image rectangle is camera-facing, not the physical fence surface.
  // Move it along view rays onto that surface: pixels stay fixed, BSP depth does not.
  const tangent=[u[0]-o[0],u[1]-o[1]],n=[-tangent[1],tangent[0]];
  const denominator=n[0]*camera[0]+n[1]*camera[1];
  const vertices=f.vertices.map(p=>{
   const q=point(...p),distance=((o[0]-q[0])*n[0]+(o[1]-q[1])*n[1])/denominator;
   return [q[0]+camera[0]*distance,q[1]+camera[1]*distance,q[2]+64*distance];
  });
  return {part:name==='post'?'post-model':'model-leaf',vertices,color:'none',attrs:{fill:'none','data-sprite':f.image,'data-sprite-basis':[vertices[0],vertices[1],vertices[3]]}};
 }
 const result=[];
 for(let i=0;i<2;i++)if(posts[i])result.push(part('post',(u,v,h)=>base(u+i,v,h)));
 if(w.gate&&Number.isFinite(w.gateProgress)){result.push(part('swing'+Math.round(Math.max(0,Math.min(1,w.gateProgress))*8),base));return result;}
 const leaf=w.gate?((u,v,h)=>w.gateOpen?base(.07-v,.86*u,h+2):base(.07+.86*u,v,h+2)):base;
 result.push(part(w.gate?'gate':'fence',leaf));return result;
}
