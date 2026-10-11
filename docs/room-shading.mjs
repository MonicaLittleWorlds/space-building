// A stable upper-left key light keeps the isometric silhouette readable in every view.
export function shadeArchitecture(faces,rotation=0){

 return faces.flatMap(f=>{
  const v=f.vertices,part=f.attrs?.['data-part']||f.part||'';
  if(/glass|reflection|shade/.test(part)||v.every(p=>Math.abs(p[2]-v[0][2])<1e-6))return[f];
  const axis=v.every(p=>Math.abs(p[0]-v[0][0])<1e-6)?'x':v.every(p=>Math.abs(p[1]-v[0][1])<1e-6)?'z':null;
  if(!axis)return[f];
  const leftFacing=(axis==='x')===(rotation%2===0);
  const amount=leftFacing?.055:.16;
  return[f,{vertices:v,part:'surface-shade',attrs:{fill:'#17212a',opacity:amount*(f.attrs?.opacity??1),stroke:'none','pointer-events':'none','data-part':'surface-shade'}}];
 });
}
// Nested strips form a soft falloff without per-tile borders or blurred textures.
export function wallContactShadows(level,holes=new Set()){
 const faces=[];
 for(const w of Object.values(level.walls)){
  if(!['wall','window'].includes(w.kind))continue;
  for(const sign of [-1,1]){
   const x=w.x-(w.axis==='x'&&sign<0?1:0),z=w.z-(w.axis==='z'&&sign<0?1:0),cell=`${x},${z}`;
   if(!level.tiles[cell]||holes.has(cell))continue;
   const edge=w.axis==='x'?w.x-.5:w.z-.5,start=w.axis==='x'?w.z-.5:w.x-.5;
   for(const [width,opacity] of [[.28,.025],[.21,.03],[.15,.035],[.10,.04],[.065,.05]]){
    const point=(u,d)=>w.axis==='x'?[edge+sign*d,start+u,.015]:[start+u,edge+sign*d,.015];
    faces.push({vertices:[point(0,0),point(1,0),point(1,width),point(0,width)],attrs:{fill:'#17212a',opacity,stroke:'none','pointer-events':'none','data-part':'wall-contact-shadow'}});
   }
  }
 }
 return faces;
}
