const ends=w=>w.axis==='x'?[[w.x-.5,w.z-.5],[w.x-.5,w.z+.5]]:[[w.x-.5,w.z-.5],[w.x+.5,w.z-.5]];
const eps=1e-8;
export function hedgeJoins(w,walls){
 return ends(w).map(p=>walls.filter(o=>o!==w&&o.kind==='fence'&&o.fenceStyle==='hedge').flatMap(o=>{
  const e=ends(o),i=e.findIndex(q=>Math.abs(q[0]-p[0])<eps&&Math.abs(q[1]-p[1])<eps);
  return i<0?[]:[[e[1-i][0]-p[0],e[1-i][1]-p[1]]];
 }));
}
function clip(poly,plane){
 const out=[],distance=p=>(p[0]-plane.p[0])*plane.n[0]+(p[1]-plane.p[1])*plane.n[1];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);
  if(da>=-eps)out.push(a);
  if((da>eps&&db< -eps)||(da< -eps&&db>eps)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
 }
 return out.filter((p,i)=>!i||Math.hypot(p[0]-out[i-1][0],p[1]-out[i-1][1])>eps);
}
export function hedgeFootprint(w,joins=[[],[]]){
 const [a,b]=ends(w),d=[b[0]-a[0],b[1]-a[1]],n=[-d[1],d[0]],t=.13;
 const point=(u,v)=>[a[0]+d[0]*u+n[0]*v,a[1]+d[1]*u+n[1]*v];
 const lo=joins[0]?.length?-t:0,hi=joins[1]?.length?1+t:1;
 let polygon=[point(lo,-t),point(hi,-t),point(hi,t),point(lo,t)];
 const planes=joins.flatMap((neighbors,i)=>neighbors.map(other=>({p:i?b:a,n:[d[0]*(i?-1:1)-other[0],d[1]*(i?-1:1)-other[1]]})));
 for(const plane of planes)polygon=clip(polygon,plane);
 return {polygon,planes};
}
// At joins each segment owns its nearest part of the shared footprint. This
// produces a closed miter instead of two overlapping boxes and internal caps.
export function hedgeFaces(w,rotation=0,joins=[[],[]]){
 const {polygon,planes}=hedgeFootprint(w,joins),h=132,sx=[1,1,-1,-1][rotation%4],sz=[1,-1,-1,1][rotation%4];
 const material=w.hedgeMaterial||'legacy-hedge',faces=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dz=b[1]-a[1];
  if(Math.hypot(dx,dz)<eps||dz*sx-dx*sz<=eps)continue;
  if(planes.some(p=>[a,b].every(v=>Math.abs((v[0]-p.p[0])*p.n[0]+(v[1]-p.p[1])*p.n[1])<eps)))continue;
  faces.push({part:'hedge-side',color:'#345a26',vertices:[[...a,0],[...b,0],[...b,h],[...a,h]],attrs:{fill:'#345a26','data-texture':material}});
 }
 faces.push({part:'hedge-top',color:'#4a7336',vertices:polygon.map(p=>[...p,h]),attrs:{fill:'#4a7336','data-texture':material}});
 return faces;
}
