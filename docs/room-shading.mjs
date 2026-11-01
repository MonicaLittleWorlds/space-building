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
// Gradients are defined in the surface plane, then projected by each renderer.
// Their falloff stays perpendicular to the wall even in an isometric view.
export function ambientGradientSVG(id,g,project){
 const [o,u,v]=[g.origin,g.u,g.v].map(project);
 const matrix=[u[0]-o[0],u[1]-o[1],v[0]-o[0],v[1]-o[1],...o];
 return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${g.axis==='u'?1:0}" y2="${g.axis==='u'?0:1}" gradientTransform="matrix(${matrix.join(' ')})">${[[0,1],[.18,.64],[.42,.30],[.7,.08],[1,0]].map(([t,a])=>`<stop offset="${t}" stop-color="#101b21" stop-opacity="${a*g.alpha}"/>`).join('')}</linearGradient>`;
}
const gradientFace=(vertices,origin,u,v,axis,alpha,part)=>({vertices,attrs:{fill:'#101b21',stroke:'none','pointer-events':'none','data-part':part,'data-ambient-gradient':{origin,u,v,axis,alpha}}});
const normalAxis=w=>w.axis==='x'?0:1;
const alongAxis=w=>1-normalAxis(w);
const centreline=w=>w.axis==='x'?w.x-.5:w.z-.5;
function cornerInFront(c,wall,side){
 const axis=normalAxis(wall);
 return c?.walls?.some(other=>other.axis!==wall.axis&&other.kind!=='door'&&
  ((axis===0?other.x:other.z)-centreline(wall))*side>1e-6);
}
export function wallFaceAmbientShadows(faces,wall,corners=[]){
 const normal=normalAxis(wall),along=alongAxis(wall),ends=wall.axis==='x'?[wall.z-.5,wall.z+.5]:[wall.x-.5,wall.x+.5],shadows=[];
 for(const face of faces){
  const part=face.attrs?.['data-part']||face.part||'';
  if(part&&!['room-cut'].includes(part))continue;
  if(!face.vertices?.length||!face.vertices.every(p=>Math.abs(p[normal]-face.vertices[0][normal])<1e-6))continue;
  const side=Math.sign(face.vertices[0][normal]-centreline(wall));
  const origin=face.vertices[0].slice();origin[2]=0;origin[along]=ends[0];
  const u=origin.slice();u[along]+=1;const v=origin.slice();v[2]=53;
  shadows.push(gradientFace(face.vertices,origin,u,v,'v',.23,'wall-base-ambient'));
  for(let end=0;end<2;end++){
   const c=corners.find(c=>c[normal===0?'x':'z']===centreline(wall)&&c[along===0?'x':'z']===ends[end]);
   if(!cornerInFront(c,wall,side))continue;
   const o=origin.slice();o[along]=ends[end];const a=o.slice();a[along]+=(end===0?1:-1)*.52;const b=o.slice();b[2]=53;
   shadows.push(gradientFace(face.vertices,o,a,b,'u',.29,'wall-corner-ambient'));
  }
 }
 return shadows;
}
export function wallCornerAmbientShadows(faces,corner){
 const shadows=[];
 for(const face of faces){
  const part=face.part||face.attrs?.['data-part'];if(!/^side-/.test(part||''))continue;
  const normal=part==='side-x'?0:1,along=1-normal,wall=corner.walls.find(w=>normalAxis(w)===normal),side=Math.sign(face.vertices[0][normal]-corner[normal===0?'x':'z']);
  const o=face.vertices[0].slice();o[2]=0;const u=o.slice();u[along]+=1;const v=o.slice();v[2]=53;
  shadows.push(gradientFace(face.vertices,o,u,v,'v',.23,'wall-base-ambient'));
  if(wall&&cornerInFront(corner,wall,side))shadows.push({vertices:face.vertices,attrs:{fill:'#101b21',opacity:.25,stroke:'none','data-part':'wall-corner-ambient'}});
 }
 return shadows;
}
export function wallContactShadows(level,holes=new Set(),walls=Object.values(level.walls)){
 const faces=[];
 for(const w of walls){
  if(!['wall','window'].includes(w.kind))continue;
  for(const sign of [-1,1]){
   const x=w.x-(w.axis==='x'&&sign<0?1:0),z=w.z-(w.axis==='z'&&sign<0?1:0),cell=`${x},${z}`;
   if(!level.tiles[cell]||holes.has(cell))continue;
   const edge=centreline(w),start=w.axis==='x'?w.z-.5:w.x-.5,spread=.44;
   const point=(u,d)=>w.axis==='x'?[edge+sign*(.055+d),start+u,.015]:[start+u,edge+sign*(.055+d),.015];
   // Shared segment boundaries meet exactly; translucent strips must not overlap.
   let poly=[point(0,0),point(1,0),point(1,spread),point(0,spread)];
   for(const crossWall of Object.values(level.walls)){
    if(crossWall.axis===w.axis||!['wall','window'].includes(crossWall.kind))continue;
    const crossEdge=centreline(crossWall),crossCell=crossWall.axis==='x'?crossWall.z:crossWall.x;
    if(crossCell!==(w.axis==='x'?x:z)||![w.axis==='x'?z-.5:x-.5,w.axis==='x'?z+.5:x+.5].includes(crossEdge))continue;
    const distance=p=>Math.abs(p[alongAxis(w)]-crossEdge)-Math.abs(p[normalAxis(w)]-edge),out=[];
    for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((n,k)=>n+(b[k]-n)*t));}}poly=out;
   }
   if(poly.length>=3){const f=gradientFace(poly,point(0,0),point(1,0),point(0,spread),'v',.35,'wall-contact-shadow');f.run=`${w.axis}:${edge}:${sign}`;faces.push(f);}
  }
 }
 // Join coplanar segments before rasterizing. A long wall gets one continuous
 // floor gradient instead of a stack of independently anti-aliased strips.
 const equal=(a,b)=>a.every((n,k)=>Math.abs(n-b[k])<1e-8);
 for(let a=0;a<faces.length;a++)for(let b=a+1;b<faces.length;b++){
  if(faces[a].run!==faces[b].run)continue;
  const A=faces[a].vertices,B=faces[b].vertices;let joined=false;
  for(let i=0;i<A.length&&!joined;i++)for(let j=0;j<B.length;j++){
   if(!equal(A[i],B[(j+1)%B.length])||!equal(A[(i+1)%A.length],B[j]))continue;
   faces[a].vertices=[...Array.from({length:A.length},(_,k)=>A[(i+1+k)%A.length]),...Array.from({length:B.length-2},(_,k)=>B[(j+2+k)%B.length])];
   faces.splice(b,1);b=a;joined=true;break;
  }
 }
 return faces.map(({run,...face})=>face);
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
