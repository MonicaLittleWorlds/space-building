// The narrow physical wall cap is glass too, with mortar breaks and a
// recessed centre. These are native geometry faces, shared by both renderers.
export function glassBlockCaps(faces,material){
 return faces.flatMap(face=>{
  const attrs=face.attrs||{};
  if((material!=='lw-glass'&&!attrs['data-glass'])||face.vertices.length!==4)return [face];
  const part=attrs['data-part']||face.part;
  if(part==='end'){
   const [a,b,c,d]=face.vertices,expand=(p,q)=>p.map((v,i)=>v+(v-q[i])*.6);
   return [{...face,vertices:[expand(a,b),expand(b,a),expand(c,d),expand(d,c)],attrs:{...attrs,'stroke-width':1.2,'stroke-linejoin':'round'}}];
  }
  if(part!=='cap')return [face];
  let [a,b,c,d]=face.vertices;
  // Close over both raised glass rims, rather than leaving a thin timber-width cap.
  const old=[a,b,c,d];a=old[0].map((v,i)=>v+(v-old[3][i])*.6);b=old[1].map((v,i)=>v+(v-old[2][i])*.6);c=old[2].map((v,i)=>v+(v-old[1][i])*.6);d=old[3].map((v,i)=>v+(v-old[0][i])*.6);
  const point=(u,v)=>a.map((n,i)=>(n+(b[i]-n)*u)*(1-v)+(d[i]+(c[i]-d[i])*u)*v);
  const span=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.round(span/.5)),result=[];
  const add=(lo,hi,bottom,top,color)=>result.push({...face,color,vertices:[point(lo,bottom),point(hi,bottom),point(hi,top),point(lo,top)],attrs:{...attrs,fill:color,stroke:'none','data-part':'glass-cap','data-texture':undefined}});
  add(0,1,0,1,'#a4b5af');Object.assign(result[0].attrs,{stroke:'#a4b5af','stroke-width':1.2,'stroke-linejoin':'round'});
  for(let i=0;i<count;i++){
   const lo=(i+.025)/count,hi=(i+.975)/count;
   add(lo,hi,.05,.95,'#d9e5e0');add(lo+.035/count,hi-.035/count,.2,.8,'#6b8780');
   add(lo+.05/count,hi-.05/count,.23,.43,'#c2d8cf');add(lo+.08/count,hi-.08/count,.44,.67,'#8ea99f');
  }
  return result;
 });
}

export function glassBlockRelief(faces,material,rotation=0){
 if(material!=='lw-glass')return faces;
 const output=[],step=274.342851/8;
 for(const face of faces){
  const attrs=face.attrs||{},part=attrs['data-part']||face.part||'';
  if(attrs['data-texture']!=='lw-glass'||/cap|end/.test(part)){output.push(face);continue;}
  const axis=face.vertices.every(p=>Math.abs(p[0]-face.vertices[0][0])<1e-6)?0:1,along=1-axis,plane=face.vertices[0][axis];
  const sign=(axis===0?[1,1,-1,-1]:[1,-1,-1,1])[rotation%4],poly=face.vertices.map(p=>[p[along],p[2]]);
  // Cutaway profiles are concave where the slope meets the low wall. A
  // half-plane clip against that whole outline removes the low section.
  // Split only those outlines into convex vertical strips first.
  const turns=poly.map((p,i)=>{const q=poly[(i+1)%poly.length],r=poly[(i+2)%poly.length];return Math.sign((q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]));}).filter(Boolean);
  let clips=[poly];
  if(turns.some(t=>t!==turns[0])){
   const us=[...new Set(poly.map(p=>p[0]))].sort((a,b)=>a-b);clips=[];
   for(let n=1;n<us.length;n++){
    const left=us[n-1],right=us[n],mid=(left+right)/2;
    const crossings=poly.flatMap((a,i)=>{const b=poly[(i+1)%poly.length];if(mid<=Math.min(a[0],b[0])||mid>=Math.max(a[0],b[0]))return [];const h=u=>a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0]);return [{h,at:h(mid)}];}).sort((a,b)=>a.at-b.at);
    for(let i=0;i+1<crossings.length;i+=2){const low=crossings[i].h,high=crossings[i+1].h;clips.push([[left,low(left)],[right,low(right)],[right,high(right)],[left,high(left)]]);}
   }
  }
  const clip=(polygon,poly)=>{for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],area=poly.reduce((sum,p,j)=>sum+p[0]*poly[(j+1)%poly.length][1]-poly[(j+1)%poly.length][0]*p[1],0),sense=Math.sign(area),next=[];
   const dist=p=>sense*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
   for(let j=0;j<polygon.length;j++){const p=polygon[j],q=polygon[(j+1)%polygon.length],dp=dist(p),dq=dist(q);if(dp>=-1e-7)next.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);next.push(p.map((n,k)=>n+(q[k]-n)*t));}}
   polygon=next;if(polygon.length<3)break;
  }return polygon;};
  const add=(points,color,texture=false)=>{for(const outline of clips){const clipped=clip(points,outline);if(clipped.length<3)continue;output.push({...face,vertices:clipped.map(([u,h,depth])=>axis===0?[plane+sign*depth,u,h]:[u,plane+sign*depth,h]),attrs:{...attrs,fill:color,stroke:color,'stroke-width':.25,'data-part':'glass-block-relief','data-texture':texture?'lw-glass':undefined}});}};
  const minU=Math.min(...poly.map(p=>p[0])),maxU=Math.max(...poly.map(p=>p[0])),minH=Math.min(...poly.map(p=>p[1])),maxH=Math.max(...poly.map(p=>p[1]));

  for(let col=Math.floor((minU+.5)/.5);col<Math.ceil((maxU+.5)/.5);col++)for(let row=Math.floor(minH/step);row<Math.ceil(maxH/step);row++){
   const left=col*.5-.5+.012,right=(col+1)*.5-.5-.012,bottom=row*step+1,top=(row+1)*step-1,lo=left+.065,hi=right-.065,low=bottom+5,high=top-5;
   // Mortar is a ring, never an opaque plane across the recessed opening.
   for(const [l,r,b,t]of [[left-.012,left,bottom-1,top+1],[right,right+.012,bottom-1,top+1],[left,right,bottom-1,bottom],[left,right,top,top+1]])add([[l,b,0],[r,b,0],[r,t,0],[l,t,0]],'#8c9f97');
   // Four thick bevels surround a physically recessed glass face.
   add([[left,bottom,.065],[right,bottom,.065],[hi,low,-.035],[lo,low,-.035]],'#b5c9be');
   add([[left,top,.065],[left,bottom,.065],[lo,low,-.035],[lo,high,-.035]],'#557369');
   add([[right,bottom,.065],[right,top,.065],[hi,high,-.035],[hi,low,-.035]],'#c7dcd2');
   add([[right,top,.065],[left,top,.065],[lo,high,-.035],[hi,high,-.035]],'#e1eee7');
   add([[lo,low,-.035],[hi,low,-.035],[hi,high,-.035],[lo,high,-.035]],'#69877b',true);
   const first=output.length;add([[left,bottom,.072],[right,bottom,.072],[right,top,.072],[left,top,.072]],'#ffffff',true);for(const pane of output.slice(first))Object.assign(pane.attrs,{opacity:.38,stroke:'none','data-part':'glass-front-reflection'});
  }
 }
 return output;
}
