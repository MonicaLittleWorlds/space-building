// Original LW kit dimensions expressed in the game's logical grid.
export const KIT={halfWidth:64,halfHeight:32,wallHeight:3.5*Math.sqrt(2*64**2)*Math.cos(Math.PI/6),wallThickness:.12,fenceHeight:92};
export const MATERIALS=['blank','grass','pavement','stone'];
export function brushCells(x,z,size=2){const ox=Math.floor(x/size)*size,oz=Math.floor(z/size)*size;return Array.from({length:size*size},(_,i)=>({x:ox+i%size,z:oz+Math.floor(i/size),piece:`${size}:${ox},${oz}`,size}));}
export function wallEnds(w){return w.axis==='x'?[[w.x-.5,w.z-.5],[w.x-.5,w.z+.5]]:[[w.x-.5,w.z-.5],[w.x+.5,w.z-.5]];}
export function wallFacing(w,tiles={}){
  if(w.facing===1||w.facing===-1)return w.facing;
  const positive=!!tiles[`${w.x},${w.z}`],negative=!!tiles[`${w.x-(w.axis==='x'?1:0)},${w.z-(w.axis==='z'?1:0)}`];
  if(positive!==negative)return positive?1:-1;
  return 1;
}
export function wallSide(w,rotation){
  const view=((rotation%4)+4)%4,normal=w.axis==='x'?[1,1,-1,-1][view]:[1,-1,-1,1][view];
  return normal*(w.facing===-1?-1:1)>0?'front':'back';
}
export function wallSurfaceEnds(w,rotation,corners=[]){
  const view=((rotation%4)+4)%4,side=w.axis==='x'?[1,1,-1,-1][view]:[1,-1,-1,1][view],t=KIT.wallThickness/2;
  return wallCapEnds(w,corners).map(([x,z])=>[x+(w.axis==='x'?side*t:0),z+(w.axis==='z'?side*t:0)]);
}
export function wallEndVisible(w,index,rotation){
  const view=((rotation%4)+4)%4,tangent=w.axis==='x'?[1,-1,-1,1][view]:[1,1,-1,-1][view];
  return tangent*(index===0?-1:1)>0;
}
export function wallEndExposed(w,end,walls){const p=wallEnds(w)[end];return !Object.values(walls).some(other=>other!==w&&(other.kind==='fence')===(w.kind==='fence')&&wallEnds(other).some(q=>q[0]===p[0]&&q[1]===p[1]));}
export function wallRenderHeight(w,cut=false){return w.kind==='fence'?KIT.fenceHeight:(typeof cut==='function'?cut(w):cut)&&w.collapse?26:KIT.wallHeight;}
// Corner pieces are derived per floor, so drawing, erasing, undo, and loading
// cannot leave an orphaned corner. Straight runs never produce a corner.
export function wallCorners(walls,cut=false){
  const ends=new Map();
  for(const wall of Object.values(walls)){
    if(wall.kind==='fence')continue;
    for(const [x,z] of wallEnds(wall)){const id=`${x},${z}`;if(!ends.has(id))ends.set(id,{id,x,z,walls:[]});ends.get(id).walls.push(wall);}
  }
  return [...ends.values()].filter(p=>new Set(p.walls.map(w=>w.axis)).size===2).map(p=>({...p,height:Math.max(...p.walls.map(w=>wallRenderHeight(w,cut))),walls:p.walls.sort((a,b)=>a.axis.localeCompare(b.axis)||a.x-b.x||a.z-b.z)}));
}
export function wallCornerFaces(corner,rotation=0){
  const t=KIT.wallThickness/2,{x,z,height:h}=corner;
  // Camera-visible sides of the square joining column. Each physical face
  // inherits the connected wall on its own axis (including its decor group).
  const sx=[1,1,-1,-1][rotation%4],sz=[1,-1,-1,1][rotation%4];
  const owner=axis=>corner.walls.filter(w=>w.axis===axis).sort((a,b)=>wallRenderHeight(b)-wallRenderHeight(a))[0];
  return [
    {part:'side-x',wall:owner('x'),vertices:[[x+sx*t,z-t,0],[x+sx*t,z+t,0],[x+sx*t,z+t,h],[x+sx*t,z-t,h]]},
    {part:'side-z',wall:owner('z'),vertices:[[x-t,z+sz*t,0],[x+t,z+sz*t,0],[x+t,z+sz*t,h],[x-t,z+sz*t,h]]},
    {part:'cap',wall:corner.walls[0],vertices:[[x-t,z-t,h],[x+t,z-t,h],[x+t,z+t,h],[x-t,z+t,h]]},
  ];
}
export function wallCapEnds(w,corners){const ends=wallEnds(w),t=KIT.wallThickness/2;return ends.map((p,i)=>{if(!corners.some(c=>c.x===p[0]&&c.z===p[1]))return p;const q=ends[1-i];return [p[0]+Math.sign(q[0]-p[0])*t,p[1]+Math.sign(q[1]-p[1])*t];});}
export function visibleLevelObjects(project,id){const l=project.levels.find(l=>l.id===id);return l?{walls:Object.values(l.walls),items:l.items}: {walls:[],items:[]};}
// Volumetric construction parts, authored directly in LW grid units.
function meshBuilder(point,rotation,palette){
  const faces=[],sx=[1,1,-1,-1][rotation%4],sz=[1,-1,-1,1][rotation%4];
  const o=point(0,0,0),u=point(1,0,0),v=point(0,1,0);
  const visible=(axis,sign)=>((axis==='u'?u[0]-o[0]:v[0]-o[0])*sx+(axis==='u'?u[1]-o[1]:v[1]-o[1])*sz)*sign>0;
  const face=(vertices,color,part)=>faces.push({vertices:vertices.map(p=>point(...p)),color,part});
  const box=(u0,u1,v0,v1,b0,t0,b1=b0,t1=t0,part='body',colors=palette)=>{
    if(visible('u',-1))face([[u0,v0,b0],[u0,v1,b1],[u0,v1,t1],[u0,v0,t0]],colors.side,part);
    if(visible('u',1))face([[u1,v0,b0],[u1,v1,b1],[u1,v1,t1],[u1,v0,t0]],colors.side,part);
    if(visible('v',-1))face([[u0,v0,b0],[u1,v0,b0],[u1,v0,t0],[u0,v0,t0]],colors.end,part);
    if(visible('v',1))face([[u0,v1,b1],[u1,v1,b1],[u1,v1,t1],[u0,v1,t1]],colors.end,part);
    face([[u0,v0,t0],[u1,v0,t0],[u1,v1,t1],[u0,v1,t1]],colors.top,part);
  };
  return {faces,box};
}
export function fenceFaces(w,rotation=0,posts=[true,true]){
  const [a,b]=wallEnds(w),normal=w.axis==='x'?[1,0]:[0,1];
  const point=(u,v,h)=>[a[0]+(b[0]-a[0])*u+normal[0]*v,a[1]+(b[1]-a[1])*u+normal[1]*v,h];
  const style=w.fenceStyle||'rail';
  const palette=style==='metal'?{top:'#62706e',side:'#303d3d',end:'#44514f'}:style==='picket'?{top:'#e4dfcc',side:'#a9ac9d',end:'#c9cbb9'}:{top:'#a99983',side:'#625648',end:'#887762'};
  const {faces,box}=meshBuilder(point,rotation,palette);
  if(style==='slat')for(const y of [22,40,58,76,94]){box(0,1,-.038,.038,y-13,y,y-13,y,'slat');box(0,1,.038,.04,y-3,y-2,y-3,y-2,'grain',{...palette,end:tintColor(palette.end,.88)});}
  else {
    for(const y of [25,70])box(0,1,-.045,.045,y-9,y,y-9,y,'rail');
    if(style==='rail'){const brace=(u,v,h)=>point(u,v,h);for(const v of [-.035,.035])faces.push({part:'brace',color:palette.side,vertices:[brace(.06,v,23),brace(.94,v,61),brace(.94,v,68),brace(.06,v,30)]});faces.push({part:'brace',color:palette.top,vertices:[brace(.06,-.035,30),brace(.94,-.035,68),brace(.94,.035,68),brace(.06,.035,30)]});}
    if(style==='privacy'){for(let i=0;i<6;i++){const u=i/6,color=tintedPalette(tintColor(palette.end,1+(i%3-1)*.035));box(u+.004,u+1/6-.004,-.082,-.018,4,91,4,91,'board',color);for(const g of [.03,.10])box(u+g,u+g+.006,-.084,-.082,13,81,13,81,'grain',{...color,side:tintColor(color.side,.94),end:tintColor(color.end,.93)});}box(0,1,-.1,.01,91,96,91,96,'coping');}
    if(style==='picket')for(let i=0;i<4;i++){const u=.08+i*.24;box(u,u+.12,-.075,-.018,5,79,5,79,'picket');
      // Two roof facets form the pointed board cap.
      for(const [lo,hi,left,right] of [[u,u+.06,79,87],[u+.06,u+.12,87,79]]){
        const p=(x,v,h)=>point(x,v,h);
        faces.push({part:'tip',color:palette.end,vertices:[p(lo,-.075,79),p(hi,-.075,79),p(hi,-.075,right),p(lo,-.075,left)]},{part:'tip',color:palette.end,vertices:[p(lo,-.018,79),p(hi,-.018,79),p(hi,-.018,right),p(lo,-.018,left)]},{part:'tip',color:palette.top,vertices:[p(lo,-.075,left),p(hi,-.075,right),p(hi,-.018,right),p(lo,-.018,left)]});
      }
    }
    if(style==='metal')for(const u of [.15,.38,.61,.84]){box(u,u+.022,-.018,.018,8,89,8,89,'baluster');for(const v of [-.019,.019])faces.push({part:'spear',color:palette.end,vertices:[point(u-.015,v,88),point(u+.037,v,88),point(u+.011,v,98)]});}
  }
  for(const [i,show] of posts.entries())if(show){const t=style==='metal'?.045:.075;box(i-t,i+t,-t,t,0,98,0,98,'post');box(i-t-.009,i+t+.009,-t-.009,t+.009,97,99,97,99,'post-cap');for(const [dx,dz,ex,ez] of [[-t,-t,t,-t],[t,-t,t,t],[t,t,-t,t],[-t,t,-t,-t]])faces.push({part:'post-cap',color:palette.top,vertices:[point(i+dx,dz,99),point(i+ex,ez,99),point(i,0,104)]});}
  return faces;
}
export function stairFaces(end,rotation=0){
  const width=end.width===1?1:2,sign=end.rise===1?1:-1,depth=end.depth||2;
  const point=(u,v,h)=>end.axis==='x'?[end.x-.5+u,end.z+sign*(.5+v),h]:[end.x+sign*(.5+v),end.z-.5+u,h];
  const timber=['timber','open'].includes(end.style),open=end.style==='open';
  const palette=end.appearance?.bodyColor?tintedPalette(end.appearance.bodyColor):timber?{top:'#b29976',side:'#6c5640',end:'#8d7354'}:{top:'#d3d0c2',side:'#90958b',end:'#aeb2a6'};
  const railPalette=end.appearance?.railColor?tintedPalette(end.appearance.railColor):{top:'#8d7b61',side:'#4f493d',end:'#70624f'};
  const {faces,box}=meshBuilder(point,rotation,palette),count=12,totalHeight=KIT.wallHeight,rise=totalHeight/count,run=depth/count;
  for(let i=0;i<count;i++){
    const h=(i+1)*rise,a=i*run,b=(i+1)*run;
    // Solid risers or visibly separated thick treads on sloped stringers.
    box(.05,width-.05,a,b,open?h-7:timber?Math.max(0,i*rise-6):0,h-4,open?h-7:timber?Math.max(0,i*rise-6):0,h-4,'step');
    box(.035,width-.035,Math.max(0,a-.025),b,h-4,h,h-4,h,'tread');
    if(timber)box(.06,width-.06,a+.035,a+.045,h,h+.2,h,h+.2,'board-joint',railPalette);
  }
  if(timber&&!open)box(.09,width-.09,0,depth,0,10,totalHeight-rise-10,totalHeight-rise,'underside');
  if(timber){
    for(const u of [.09,width-.09]){
      box(u-.04,u+.04,0,depth,0,18,totalHeight-27,totalHeight-12,'stringer',railPalette);
      for(let i=0;i<=count;i+=2){const v=Math.min(depth-.05,i*run+.04),h=Math.min(totalHeight,(i+1)*rise);box(u-.025,u+.025,v-.025,v+.025,h,h+43,h,h+43,'baluster',railPalette);}
      box(u-.045,u+.045,0,depth,rise+39,rise+45,totalHeight+39,totalHeight+45,'handrail',railPalette);
    }
  }
  // The landing reaches the floor above; only railing geometry is clipped.
  return faces.map(face=>{const vertices=[];for(let i=0;i<face.vertices.length;i++){
    const a=face.vertices[i],b=face.vertices[(i+1)%face.vertices.length],inside=a[2]<=KIT.wallHeight;
    if(inside)vertices.push(a);
    if(inside!==(b[2]<=KIT.wallHeight)){const t=(KIT.wallHeight-a[2])/(b[2]-a[2]);vertices.push(a.map((v,k)=>v+(b[k]-v)*t));}
  }return {...face,vertices};}).filter(f=>f.vertices.length>=3);
}

// Original architectural proportions; no external sprite or reference artwork.
export function windowLayout(style='divided') {
  const low=style==='high'?.65:.43, high=style==='high'?.83:.75;
  return {left:.09,right:.91,low,high,divided:style==='divided'};
}

export function stairArrow(end){
  const width=end.width===1?1:2,sign=end.rise===1?1:-1;
  return [[-.07,-.31],[.07,-.31],[.07,.06],[.19,.06],[0,.34],[-.19,.06],[-.07,.06]].map(([u,v])=>end.axis==='x'?[end.x+(width-1)/2+u,end.z+sign*v,1]:[end.x+sign*v,end.z+(width-1)/2+u,1]);
}

export function tintColor(hex,factor){return '#'+hex.slice(1).match(/../g).map(c=>Math.max(0,Math.min(255,Math.round(parseInt(c,16)*factor))).toString(16).padStart(2,'0')).join('');}
function tintedPalette(base){return {top:tintColor(base,1.13),side:tintColor(base,.69),end:base};}

export function fencePostOwners(w,walls){return wallEnds(w).map(p=>{
 const incident=walls.filter(o=>o.kind==='fence'&&wallEnds(o).some(q=>q[0]===p[0]&&q[1]===p[1]));
 const id=o=>`${o.axis}:${o.x},${o.z}`;if(incident.map(id).sort()[0]!==id(w))return false;
 if(incident.length!==2||incident[0].axis!==incident[1].axis||incident[0].fenceStyle!==incident[1].fenceStyle)return true;
 const along=w.axis==='x'?p[1]:p[0];return (Math.floor(along)+1)%2===0;
});}

export function itemFaces(item,rotation=0){const b=meshBuilder((u,v,h)=>[item.x+u,item.z+v,h],rotation,{top:'#a9c1b3',side:'#506b63',end:'#728b83'});b.box(-.3,.3,-.3,.3,0,35);return b.faces;}

// Floor order determines which endpoint is the upstairs landing, even when
// the connection was authored from upstairs first.
export function stairLevels(project,stair){
  return project.levels.findIndex(l=>l.id===stair.a.level)<project.levels.findIndex(l=>l.id===stair.b.level)
    ?{lower:stair.a,upper:stair.b}:{lower:stair.b,upper:stair.a};
}
export function stairwell(project,stair,rotation=0){
  const {lower,upper}=stairLevels(project,stair);
  if(!upper.style)return null;
  const width=upper.width===1?1:2,depth=upper.depth||2,sign=upper.rise===1?1:-1;
  const point=(u,v,h=0)=>upper.axis==='x'?[upper.x-.5+u,upper.z+sign*(.5+v),h]:[upper.x+sign*(.5+v),upper.z-.5+u,h];
  const opening=[point(0,0),point(width,0),point(width,depth),point(0,depth)];
  // Reverse an ascending flight: its highest tread meets this landing, and
  // its foot lies at the far end one storey below.
  const foot={...upper,rise:-sign,
    x:upper.x+(upper.axis==='z'?sign*(depth+1):0),z:upper.z+(upper.axis==='x'?sign*(depth+1):0)};
  const faces=stairFaces(foot,rotation).map(f=>({...f,vertices:f.vertices.map(([x,z,h])=>[x,z,h-KIT.wallHeight])}));
  for(let i=0;i<4;i++){const a=opening[i],b=opening[(i+1)%4];faces.push({part:'floor-cut-edge',color:i%2?'#839084':'#a0ab9c',vertices:[a,b,[b[0],b[1],-10],[a[0],a[1],-10]]});}
  const cells=Array.from({length:width*depth},(_,i)=>({x:upper.x+(upper.axis==='x'?i%width:sign*(1+Math.floor(i/width))),z:upper.z+(upper.axis==='z'?i%width:sign*(1+Math.floor(i/width)))}));
  // Map the connected room into the landing's local frame. Endpoints may
  // have different positions and orientations in their authored floor plans.
  const belowPoint=(x,z,h=0)=>{
    const lowerSign=lower.rise===1?1:-1;
    const u=lower.axis==='x'?x-lower.x+.5:z-lower.z+.5;
    const v=(lower.axis==='x'?z-lower.z:x-lower.x)*lowerSign-.5;
    return point(u*width/(lower.width===1?1:2),depth-v*depth/(lower.depth||2),h-KIT.wallHeight);
  };
  return {lower,upper,opening,cells,faces,belowPoint};
}

// Preview-only visibility: collision and the saved collapse flag are unchanged.
export function wallCollapseAt(w,{mode='auto',avatar=null,level,rotation=0}={}){
  if(!w.collapse||w.kind==='fence'||mode==='full')return false;
  if(mode==='cut')return true;
  if(!avatar||avatar.level!==level)return false;
  const [a,b]=wallEnds(w),dx=b[0]-a[0],dz=b[1]-a[1];
  const along=Math.max(0,Math.min(1,((avatar.x-a[0])*dx+(avatar.z-a[1])*dz)/(dx*dx+dz*dz)));
  if(Math.hypot(avatar.x-a[0]-along*dx,avatar.z-a[1]-along*dz)<=1.5)return true;
  // A camera ray rises 64 pixels for each diagonal grid step. Test the
  // avatar's width and body height so a foreground panel cannot conceal it.
  const sx=[1,1,-1,-1][rotation%4],sz=[1,-1,-1,1][rotation%4];
  for(const offset of [-.3,0,.3]){
    const x=avatar.x+sz*offset,z=avatar.z-sx*offset;
    const t=w.axis==='x'?(a[0]-x)/sx:(a[1]-z)/sz;
    const cross=w.axis==='x'?z+sz*t:x+sx*t;
    const low=w.axis==='x'?a[1]:a[0],high=w.axis==='x'?b[1]:b[0];
    if(t>=0&&cross>=low&&cross<=high&&64*t+8<KIT.wallHeight)return true;
  }
  return false;
}
