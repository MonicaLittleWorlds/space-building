// A stable upper-left key light keeps the isometric silhouette readable in every view.
export const surfaceLightMatrix=light=>`${light} 0 0 0 0 0 ${light} 0 0 0 0 0 ${light} 0 0 0 0 0 1 0`;
export function shadeArchitecture(faces,rotation=0){
 return faces.map(f=>{
  const v=f.vertices,attrs=f.attrs||{},part=attrs['data-part']||f.part||'';
  if(/glass|reflection|shade/.test(part)||v.every(p=>Math.abs(p[2]-v[0][2])<1e-6))return f;
  const axis=v.every(p=>Math.abs(p[0]-v[0][0])<1e-6)?'x':v.every(p=>Math.abs(p[1]-v[0][1])<1e-6)?'z':null;
  if(!axis)return f;
  const light=(axis==='x')===(rotation%2===0)?.945:.84;
  const tone=color=>/^#[a-f0-9]{6}$/i.test(color||'')?'#'+color.slice(1).match(/../g).map(n=>Math.round(parseInt(n,16)*light).toString(16).padStart(2,'0')).join(''):color;
  const fill=tone(attrs.fill||f.color);
  return {...f,color:tone(f.color),attrs:{...attrs,fill,...(attrs.stroke&&attrs.stroke!=='none'?{stroke:tone(attrs.stroke)}:{}),...(attrs['data-texture']?{'data-surface-light':light}:{})}};
 });
}
// Nested strips form a soft falloff without per-tile borders or blurred textures.
export function wallContactShadows(level,holes=new Set(),walls=Object.values(level.walls)){
 const faces=[];
 for(const w of walls){
  if(!['wall','window'].includes(w.kind))continue;
  for(const sign of [-1,1]){
   const x=w.x-(w.axis==='x'&&sign<0?1:0),z=w.z-(w.axis==='z'&&sign<0?1:0),cell=`${x},${z}`;
   if(!level.tiles[cell]||holes.has(cell))continue;
   const edge=w.axis==='x'?w.x-.5:w.z-.5,start=w.axis==='x'?w.z-.5:w.x-.5;
   const indoor=(level.rooms||[]).some(r=>r.kind==='indoor'&&x>=r.x&&z>=r.z&&x<r.x+r.width&&z<r.z+r.depth);
   const spread=indoor?.25:.42;
   for(const [fraction,opacity] of [[1,.022],[.75,.028],[.50,.035],[.30,.043],[.15,.06]]){
    const width=spread*fraction;
    const point=(u,d)=>w.axis==='x'?[edge+sign*d,start+u,.015]:[start+u,edge+sign*d,.015];
    let poly=[point(0,0),point(1,0),point(1,width),point(0,width)];
    // Partition inside corners by the nearest wall, so soft bands never stack twice.
    for(const crossWall of Object.values(level.walls)){
     if(crossWall.axis===w.axis||!['wall','window'].includes(crossWall.kind))continue;
     const crossEdge=crossWall.axis==='x'?crossWall.x-.5:crossWall.z-.5;
     const crossCell=crossWall.axis==='x'?crossWall.z:crossWall.x;
     if(crossCell!==(w.axis==='x'?x:z)||![w.axis==='x'?z-.5:x-.5,w.axis==='x'?z+.5:x+.5].includes(crossEdge))continue;
     const distance=p=>Math.abs(p[w.axis==='x'?1:0]-crossEdge)-Math.abs(p[w.axis==='x'?0:1]-edge),out=[];
     for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((n,k)=>n+(b[k]-n)*t));}}poly=out;
    }
    faces.push({vertices:poly,attrs:{fill:'#17212a',opacity,stroke:'none','pointer-events':'none','data-part':'wall-contact-shadow'}});
   }
  }
 }
 return faces;
}

// Ground shading is clipped to existing cells, including upper-floor stair openings.
export function clipGroundShadows(faces,tiles,holes=new Set()){
 const result=[];
 for(const face of faces){
  const xs=face.vertices.map(p=>p[0]),zs=face.vertices.map(p=>p[1]);
  for(let x=Math.floor(Math.min(...xs)+.5);x<=Math.floor(Math.max(...xs)+.5);x++)for(let z=Math.floor(Math.min(...zs)+.5);z<=Math.floor(Math.max(...zs)+.5);z++){
   if(!tiles[`${x},${z}`]||holes.has(`${x},${z}`))continue;
   let poly=face.vertices.map(p=>p.map(n=>Math.round(n*1e9)/1e9));
   for(const [axis,bound,sign]of [[0,x-.5,1],[0,x+.5,-1],[1,z-.5,1],[1,z+.5,-1]]){
    const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-bound)*sign,db=(b[axis]-bound)*sign;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((n,k)=>n+(b[k]-n)*t));}}poly=out;
   }
   poly=poly.filter((p,i)=>{const q=poly[(i+1)%poly.length];return Math.hypot(p[0]-q[0],p[1]-q[1])>1e-8;});
   const area=Math.abs(poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+a[0]*b[1]-b[0]*a[1];},0));
   if(area>1e-9)result.push({...face,vertices:poly});
  }
 }
 return result;
}
