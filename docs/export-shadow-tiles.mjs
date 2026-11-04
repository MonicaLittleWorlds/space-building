import {splitFace} from './face-order.mjs';
// Bound each shadow's four-view atlas without changing its world-space gradient.
export function splitExportShadow(face, span=6){
 let pieces=[face];
 for(const axis of [0,1]){
  const values=face.vertices.map(v=>v[axis]),lo=Math.min(...values),hi=Math.max(...values);
  for(let cut=Math.floor(lo/span)*span+span;cut<hi-1e-7;cut+=span){
   const normal=axis===0?[1,0,0]:[0,1,0];
   pieces=pieces.flatMap(p=>{const s=splitFace(p,{normal,d:cut});return [s.same,s.front,s.back].filter(Boolean);});
  }
 }
 return pieces;
}
