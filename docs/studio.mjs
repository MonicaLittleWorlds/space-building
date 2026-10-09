import {ProjectLibrary} from './projects.mjs';
import {initWebApp} from './pwa.mjs';
import {buildSpace,openSpaceFile} from './build.mjs';
import {orderFaces} from './face-order.mjs';
import {cameraGridPosition,inverseCameraGridPosition,gridToScreen} from './native-coordinate.mjs';
import {key,nodeKey,edgeKey,levelOf,blankProject,demoProject,triggerCells,stairFlightCells,stairSolidAt,portalAt,walkable,canPlace,walkRoute,validate,parseProject} from './model.mjs';
import kit from './kit.mjs';
import {KIT,stairLevels,stairwell,itemFaces,fencePostOwners,tintColor,stairArrow,fenceFaces,windowLayout,brushCells,wallEnds,wallSide,wallEndExposed,wallRenderHeight,wallCorners,wallCornerFaces,wallCapEnds,visibleLevelObjects,stairFaces} from './geometry.mjs';
import {ensureDecor,decorManifest,assignDecor,decorPieces,applyPieceDecor} from './decor.mjs';
import {joinReview,stairReview,doorReview} from './review.mjs';
const $=id=>document.getElementById(id), svg=$('canvas'), NS='http://www.w3.org/2000/svg';
let project=demoProject(), savedMessage='Sample loaded. Your edits autosave locally.';
const reviewType=new URLSearchParams(location.search).get('review'),reviewMode=['joins','stairs','doors'].includes(reviewType);
let library=null;
if(!reviewMode)try{
 library=new ProjectLibrary(localStorage,sessionStorage,navigator.locks);
 let recovery=null;try{const raw=sessionStorage.getItem('lw-update-recovery');if(raw)recovery=parseProject(raw);}catch{}
 const opened=await library.start(project,recovery);project=opened.project;sessionStorage.removeItem('lw-update-recovery');savedMessage=opened.copied?'Opened a separate tab copy.':'Your independent project session is ready.';
}catch{library=null;savedMessage='Local storage unavailable. Save project files to keep your work.';}

if(reviewMode){project=reviewType==='stairs'?stairReview():reviewType==='doors'?doorReview():joinReview();savedMessage='Join review sample · your draft is unchanged.';}
ensureDecor(project);
let active=project.levels[0].id,rotation=0,tool='floor',pending=null,playing=false,avatar=null,undo=[],redo=[],drag=false,painted=new Set(),timer=null,pan={x:0,y:0},panStart=null;
const tools=[['floor','◇','Floor'],['wall','▱','Wall'],['door','Π','Doorway'],['window','⊞','Window wall'],['fence','╫','Fence'],['stairs','▤','Stairs'],['item','▣','Test item'],['spawn','⚑','Entry'],['erase','⌫','Erase']];
const clone=()=>structuredClone(project);
function status(s){$('status').textContent=s;}
function persist(){if(reviewMode)return;try{if(!library)throw Error('Storage unavailable');library.save(project);}catch{status('Browser storage unavailable. Use Save project to keep this design.');}}
function history(){undo.push(clone());if(undo.length>80)undo.shift();redo=[];}
function changed(){persist();render();}
let renderParent=null;
function element(tag,attrs={},parent=renderParent||svg){const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);parent.append(el);return el;}
function text(x,y,value,attrs={}){const el=element('text',{x,y,'text-anchor':'middle','font-family':'system-ui','font-size':11,'pointer-events':'none',...attrs});el.textContent=value;return el;}
function scale(){return +$('zoom').value/100*Math.min(1,svg.clientWidth/780,svg.clientHeight/720);}
function projection(x,z,h=0){const c=cameraGridPosition(x,z,rotation,{pivotX:4,pivotZ:3}),p=gridToScreen(c.rx-4,c.rz-3);const s=scale();return [svg.clientWidth/2+pan.x+p.sx*s,svg.clientHeight*.62+pan.y+(p.sy-h)*s];}
function gridAt(px,py){const s=scale(),sx=(px-svg.clientWidth/2-pan.x)/s,sy=(py-svg.clientHeight*.62-pan.y)/s;return inverseCameraGridPosition((sx/64+sy/32)/2+4,(sy/32-sx/64)/2+3,rotation,{pivotX:4,pivotZ:3});}
function unproject(e){const r=svg.getBoundingClientRect();return gridAt(e.clientX-r.left,e.clientY-r.top);}
function onScreen(x,z,height=0){const p=projection(x,z);return p[0]>-150&&p[0]<svg.clientWidth+150&&p[1]>-100&&p[1]-height*scale()<svg.clientHeight+100;}
function points(coords){return coords.map(p=>projection(...p).join(',')).join(' ');}
function diamond(x,z){return [[x-.5,z-.5],[x+.5,z-.5],[x+.5,z+.5],[x-.5,z+.5]];}
function tile(x,z,fill,stroke='#80968e',extra={}){return element('polygon',{points:points(diamond(x,z)),fill,stroke,'stroke-width':.65,...extra});}
function endpoints(w){return w.axis==='x'?[[w.x-.5,w.z-.5],[w.x-.5,w.z+.5]]:[[w.x-.5,w.z-.5],[w.x+.5,w.z-.5]];}
function decorColor(id){const i=project.decorGroups.findIndex(g=>g.id===id);return i<0?'#596968':`hsl(${(i*83+35)%360} 38% 62%)`;}
function wallPaint(w){const back=wallSide(w,rotation)==='back',mount=$('overlay').value==='mount'&&w.mount;let fill=kit.wallMaterials.find(m=>m.id===w.material)?.color||'#d3d7c9';if(mount)fill='#75b6d3';if($('overlay').value==='decor')fill=decorColor(w.decorGroup);if(back)fill='#142e2a';return {back,fill};}
let faceQueue=null;
function polygon(vertices,attrs){if(faceQueue){faceQueue.push({vertices,attrs});return;}element('polygon',{points:points(vertices),...attrs});}
function drawCorner(corner){for(const face of wallCornerFaces(corner,rotation)){const {back,fill}=wallPaint(face.wall);const capBack=corner.walls.every(w=>wallSide(w,rotation)==='back');polygon(face.vertices,{fill:face.part==='cap'?(capBack?'#263e35':'#e2e7d9'):fill,opacity:(face.part==='cap'?capBack:back)?.3:1,'pointer-events':'none','data-kind':'wall-corner','data-corner-id':corner.id,'data-level':active,'data-part':face.part,'data-material':face.wall.material||'blank'});}}
function drawWall(w,corners=[]){const [a,b]=wallEnds(w),collapsed=$('wall-view').value==='cut'&&w.collapse,h=wallRenderHeight(w,$('wall-view').value==='cut');const {back,fill}=wallPaint(w);
  const attrs={'data-kind':w.kind,'data-level':active,'data-face':back?'back':'front',opacity:back?.3:1,'pointer-events':'none'};
  const panel=(u,v,low,high,color=fill,overrides={})=>{const p=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u],q=[a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v];polygon([[...p,low],[...q,low],[...q,high],[...p,high]],{fill:color,stroke:back?'none':color,'stroke-width':.8,...attrs,...overrides});};
  if(w.kind==='fence')return;

  if(w.kind==='door'){
    const wide=w.doorStyle==='wide',L=wide?.07:.16,R=1-L,top=h*.78;
    panel(0,L,0,h);panel(R,1,0,h);
    if(!collapsed){
      if(w.doorStyle==='arch'){
        const at=(u,y)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,y];
        const arch=u=>h*.66+Math.sqrt(Math.max(0,1-((u-.5)/(.5-L))**2))*h*.17;
        for(let i=0;i<16;i++){const u=L+(R-L)*i/16,v=L+(R-L)*(i+1)/16;polygon([at(u,arch(u)),at(v,arch(v)),at(v,h),at(u,h)],{fill,...attrs});polygon([at(u,arch(u)),at(v,arch(v)),at(v,arch(v)+5),at(u,arch(u)+5)],{fill:back?fill:'#e8e2d2',...attrs});}
      }else{panel(L,R,top,h);panel(L-.025,R+.025,top-4,top+5,back?fill:'#e8e2d2');}
      panel(L-.035,L,0,w.doorStyle==='arch'?h*.66:top,back?fill:'#b3b7a9');panel(R,R+.035,0,w.doorStyle==='arch'?h*.66:top,back?fill:'#e8e2d2');
    }
  }
  else if(w.kind==='window'&&!collapsed){
    const {left:L,right:R,low,high,divided}=windowLayout(w.windowStyle),B=low*h,T=high*h;
    panel(0,L,0,h);panel(R,1,0,h);panel(L,R,0,B);panel(L,R,T,h);
    const frame=back?fill:(w.appearance?.frameColor||'#e9e2d1'),glass=w.appearance?.glassColor||'#668b94';
    // No opaque backing: outdoor geometry remains visible through the pane.
    panel(L,R,B,T,glass,{opacity:back?.12:.22,stroke:'none','data-part':'window-glass'});
    panel(L+.04,R-.04,B+8,B+(T-B)*.42,'#d9f2f3',{opacity:back?.04:.09,stroke:'none','data-part':'window-reflection'});
    panel(L+.08,L+.13,B+12,T-12,'#ffffff',{opacity:back?.08:.25,stroke:'none','data-part':'window-reflection'});
    panel(L+.17,L+.19,B+12,T-12,'#ffffff',{opacity:back?.05:.15,stroke:'none','data-part':'window-reflection'});
    panel(L-.025,L+.035,B-5,T+5,frame);panel(R-.035,R+.025,B-5,T+5,frame);
    panel(L-.025,R+.025,T-5,T+5,frame);panel(L-.035,R+.035,B-6,B+4,frame);
    if(divided){panel(.485,.515,B+4,T-4,frame);panel(L,R,(B+T)/2-2,(B+T)/2+2,frame);}
    // A shallow sill projects from the front face of the wall.
    const normal=w.axis==='x'?[1,0]:[0,1],sign=w.facing===-1?-1:1;
    const sill=(u,d)=>[a[0]+(b[0]-a[0])*u+normal[0]*d*sign,a[1]+(b[1]-a[1])*u+normal[1]*d*sign,B+5];
    polygon([sill(L-.045,0),sill(R+.045,0),sill(R+.045,.1),sill(L-.045,.1)],{fill:frame,...attrs,'data-part':'window-sill'});
  }
  else panel(0,1,0,h);
  const t=KIT.wallThickness/2,offset=w.axis==='x'?[t,0]:[0,t],quad=(p,q,low,high)=>[[p[0]-offset[0],p[1]-offset[1],low],[q[0]+offset[0],q[1]+offset[1],low],[q[0]+offset[0],q[1]+offset[1],high],[p[0]-offset[0],p[1]-offset[1],high]];
  const [capA,capB]=wallCapEnds(w,corners);
  polygon([[capA[0]-offset[0],capA[1]-offset[1],h],[capB[0]-offset[0],capB[1]-offset[1],h],[capB[0]+offset[0],capB[1]+offset[1],h],[capA[0]+offset[0],capA[1]+offset[1],h]],{fill:back?'#263e35':'#e2e7d9',...attrs,'data-part':'cap'});
  for(const [i,p] of [a,b].entries())if(wallEndExposed(w,i,levelOf(project,active).walls))polygon(quad(p,p,0,h),{fill:back?'#172c26':'#86958a',...attrs,'data-part':'end'});
}
function drawItem(i){const x=i.x,z=i.z;for(const [a,b,fill] of [[[x-.3,z+.3],[x+.3,z+.3],'#728b83'],[[x+.3,z-.3],[x+.3,z+.3],'#506b63']])element('polygon',{points:points([[...a,0],[...b,0],[...b,35],[...a,35]]),fill,stroke:'#bfd3c3','pointer-events':'none'});element('polygon',{points:points([[x-.3,z-.3,35],[x+.3,z-.3,35],[x+.3,z+.3,35],[x-.3,z+.3,35]]),fill:'#a9c1b3',stroke:'#bfd3c3','pointer-events':'none'});}
function render(){
  const l=levelOf(project,active);svg.replaceChildren();const nativeBackground=$('background-view').value==='native';svg.style.background=nativeBackground?'linear-gradient(#9BECFC,#00C4F5)':'';svg.parentElement.classList.toggle('native-background',nativeBackground);
  const corners=[[0,0],[svg.clientWidth,0],[0,svg.clientHeight],[svg.clientWidth,svg.clientHeight]].map(([x,y])=>gridAt(x,y));
  const minX=Math.floor(Math.min(...corners.map(p=>p.wx)))-1,maxX=Math.ceil(Math.max(...corners.map(p=>p.wx)))+1,minZ=Math.floor(Math.min(...corners.map(p=>p.wz)))-1,maxZ=Math.ceil(Math.max(...corners.map(p=>p.wz)))+1;
  if(!nativeBackground)for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++)tile(x,z,'transparent','#49615b',{'stroke-opacity':.35,'data-cell':key(x,z)});
  const wells=project.stairs.filter(s=>stairLevels(project,s).upper.level===active).map(s=>stairwell(project,s,rotation)).filter(Boolean);
  const holes=new Set(wells.flatMap(w=>w.cells.map(c=>key(c.x,c.z))));
  const largePieces=new Map();
  for(const t of Object.values(l.tiles)){if(t.size!==2||!/^2:-?\d+,-?\d+$/.test(t.piece||''))continue;const [ox,oz]=t.piece.slice(2).split(',').map(Number);if([0,1,2,3].every(i=>{const c=l.tiles[key(ox+i%2,oz+Math.floor(i/2))];return !holes.has(key(ox+i%2,oz+Math.floor(i/2)))&&c?.piece===t.piece&&c.material===t.material;}))largePieces.set(t.piece,{x:ox+.5,z:oz+.5,material:t.material||'blank'});}
  for(const [k,t] of Object.entries(l.tiles)){const [x,z]=k.split(',').map(Number);if(holes.has(k)||!onScreen(x,z))continue;const overlay=$('overlay').value;let fill=kit.floorMaterials.find(m=>m.id===t.material)?.color||'#c1c7b7';if(overlay==='walk')fill=walkable(project,{level:active,x,z})?'#73b79f':'#b86f70';if(overlay==='place')fill=canPlace(project,{level:active,x,z})?'#79aebb':'#a16f68';if(overlay==='decor')fill=decorColor(t.decorGroup);tile(x,z,fill,fill,{'data-floor':k,'data-level':active});if((overlay==='none'||overlay==='mount')&&!largePieces.has(t.piece)){const [px,py]=projection(x,z),s=scale();element('image',{href:`assets/floor-${kit.floorMaterials.some(m=>m.id===t.material)?t.material:'blank'}-1x1.png`,x:px-64*s,y:py-32*s,width:128*s,height:64*s,'pointer-events':'none'});}const corners=diamond(x,z);for(const [i,[dx,dz]] of [[0,-1],[1,0],[0,1],[-1,0]].entries()){const neighbor=l.tiles[key(x+dx,z+dz)];if($('show-grid').checked&&(!t.piece||neighbor?.piece!==t.piece)){const a=projection(...corners[i]),b=projection(...corners[(i+1)%4]);element('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#6f8577','stroke-width':.6,opacity:.5,'pointer-events':'none'});}}}
  if(['none','mount'].includes($('overlay').value))for(const piece of largePieces.values()){const [px,py]=projection(piece.x,piece.z),s=scale();element('image',{href:`assets/floor-${kit.floorMaterials.some(m=>m.id===piece.material)?piece.material:'blank'}-2x2.png`,x:px-128*s,y:py-64*s,width:256*s,height:128*s,'pointer-events':'none','data-piece-size':'2'});}
  for(const [index,well] of wells.entries()){
    const clipId=`stairwell-${index}`,clip=element('clipPath',{id:clipId});
    element('polygon',{points:points(well.opening)},clip);
    renderParent=element('g',{'clip-path':`url(#${clipId})`,'data-kind':'stairwell','data-level':active});
    polygon(well.opening,{fill:'#35453f','pointer-events':'none'});
    const below=levelOf(project,well.lower.level),screenOpening=well.opening.map(p=>projection(...p));
    const bounds={left:Math.min(...screenOpening.map(p=>p[0])),right:Math.max(...screenOpening.map(p=>p[0])),top:Math.min(...screenOpening.map(p=>p[1])),bottom:Math.max(...screenOpening.map(p=>p[1]))};
    for(const [id,t] of Object.entries(below.tiles)){
      const [x,z]=id.split(',').map(Number),vertices=diamond(x,z).map(([a,b])=>well.belowPoint(a,b));
      const screen=vertices.map(p=>projection(...p));
      if(Math.max(...screen.map(p=>p[0]))<bounds.left||Math.min(...screen.map(p=>p[0]))>bounds.right||Math.max(...screen.map(p=>p[1]))<bounds.top||Math.min(...screen.map(p=>p[1]))>bounds.bottom)continue;
      const fill=kit.floorMaterials.find(m=>m.id===t.material)?.color||'#c1c7b7';
      polygon(vertices,{fill,stroke:fill,'stroke-width':.5,'data-kind':'floor-below','pointer-events':'none'});
    }
    const faces=well.faces.map(f=>({...f,attrs:{fill:f.color,stroke:f.color,'stroke-width':.25,'data-kind':'stairs-down','data-part':f.part,'pointer-events':'none'}}));
    const origin=well.belowPoint(0,0),bx=well.belowPoint(1,0),bz=well.belowPoint(0,1),sx=[1,1,-1,-1][rotation],sz=[1,-1,-1,1][rotation];
    const lowerSX=Math.sign((bx[0]-origin[0])*sx+(bx[1]-origin[1])*sz),lowerSZ=Math.sign((bz[0]-origin[0])*sx+(bz[1]-origin[1])*sz);
    const lowerRotation=[0,1,2,3].find(r=>[1,1,-1,-1][r]===lowerSX&&[1,-1,-1,1][r]===lowerSZ);
    for(const item of below.items)for(const face of itemFaces(item,lowerRotation))faces.push({vertices:face.vertices.map(p=>well.belowPoint(...p)),attrs:{fill:face.color,'data-kind':'item-below','pointer-events':'none'}});
    for(const face of orderFaces(faces,rotation))polygon(face.vertices,face.attrs);
    renderParent=null;
    // A thin floor edge defines the cutout without covering the landing tread.
    polygon(well.opening,{fill:'none',stroke:'#75877b','stroke-width':1.5,'pointer-events':'none','data-kind':'stairwell-edge'});
  }
  for(const s of project.stairs)for(const end of [s.a,s.b])if(end.level===active)element('polygon',{points:points(stairArrow(end)),fill:'#f4f4dc',stroke:'#586a62','stroke-width':.65,opacity:.45,'pointer-events':'none','data-kind':'stair-arrow'});
  if(pending?.level===active)for(const c of triggerCells(pending))tile(c.x,c.z,'#dfbd69','#fff0b8');
  if(project.spawn?.level===active){const [x,y]=projection(project.spawn.x,project.spawn.z);text(x,y-5,'⚑',{fill:'#426c58','font-size':28});}
  const visible=visibleLevelObjects(project,active);
  const joins=wallCorners(l.walls,$('wall-view').value==='cut');
  faceQueue=[];
  for(const w of visible.walls.filter(w=>w.kind!=='fence'&&onScreen(w.x,w.z,KIT.wallHeight)))drawWall(w,joins);
  for(const corner of joins)if(onScreen(corner.x,corner.z,corner.height))drawCorner(corner);
  const mesh=(faces,attrs)=>{for(const face of faces)polygon(face.vertices,{fill:face.color,stroke:face.color,'stroke-width':.25,'pointer-events':'none','data-part':face.part,...attrs});};
  for(const w of visible.walls.filter(w=>w.kind==='fence'&&onScreen(w.x,w.z,KIT.fenceHeight))){
    const posts=fencePostOwners(w,visible.walls);
    mesh(fenceFaces(w,rotation,posts),{'data-kind':'fence','data-level':active,'data-fence-style':w.fenceStyle});
  }
  for(const stair of project.stairs)for(const end of [stair.a,stair.b])if(end.level===active&&end.style&&stairLevels(project,stair).lower===end)mesh(stairFaces(end,rotation),{'data-kind':'stair','data-level':active,'data-stair-width':end.width,'data-stair-style':end.style});
  for(const i of l.items)mesh(itemFaces(i,rotation),{'data-kind':'item','data-level':active});
  if(playing&&avatar?.level===active){
    const sx=[1,1,-1,-1][rotation],sz=[1,-1,-1,1][rotation],point=(u,h)=>[avatar.x+sz*u,avatar.z-sx*u,h];
    faceQueue.push({vertices:[point(-.3,-8),point(.3,-8),point(.3,68),point(-.3,68)],draw:()=>{const [x,y]=projection(avatar.x,avatar.z);element('ellipse',{cx:x,cy:y,rx:12*scale(),ry:6*scale(),fill:'#162f2b',opacity:.4});element('line',{x1:x,y1:y-5*scale(),x2:x,y2:y-39*scale(),stroke:'#d99466','stroke-width':15*scale(),'stroke-linecap':'round'});element('circle',{cx:x,cy:y-52*scale(),r:10*scale(),fill:'#ffe1bb'});}});
  }
  const architecturalFaces=faceQueue;faceQueue=null;let clipIndex=0;
  for(const face of orderFaces(architecturalFaces,rotation)){
    if(face.draw){const id='actor-clip-'+clipIndex++,clip=element('clipPath',{id});element('polygon',{points:points(face.vertices)},clip);renderParent=element('g',{'clip-path':`url(#${id})`});face.draw();renderParent=null;}
    else polygon(face.vertices,face.attrs);
  }
  $('name').value=project.name;
  $('levels').replaceChildren();for(const level of project.levels){const b=document.createElement('button');b.className=level.id===active?'active':'';b.textContent=level.name;const small=document.createElement('small');small.textContent=`${Object.keys(level.tiles).length} tiles · ${Object.keys(level.walls).length} wall edges`;b.append(small);b.onclick=()=>{active=level.id;render();};b.ondblclick=()=>{if(playing)return;const name=prompt('Floor name',level.name);if(name?.trim()){history();level.name=name.trim().slice(0,80);changed();}};$('levels').append(b);}
  $('stairs').replaceChildren();for(const s of project.stairs){const row=document.createElement('div');row.className='stair-row';row.textContent=`${levelOf(project,s.a.level).name} ↔ ${levelOf(project,s.b.level).name}`;const b=document.createElement('button');b.textContent='×';b.ariaLabel=`Remove ${s.id}`;b.disabled=playing;b.onclick=()=>{history();project.stairs=project.stairs.filter(t=>t.id!==s.id);changed();};row.append(b);$('stairs').append(row);}
  if(!project.stairs.length)$('stairs').textContent='No stairs connected yet.';
  $('cancel-stair').hidden=!pending;
  $('checks').replaceChildren();const issues=validate(project);for(const issue of issues.length?issues:['Entry and reachable floor checks pass.']){const el=document.createElement('div');el.className=`check ${issues.length?'':'good'}`;el.textContent=(issues.length?'• ':'✓ ')+issue;$('checks').append(el);}
  refreshPieces();
  $('counts').textContent=`${project.levels.length} floors · ${Object.keys(l.tiles).length} tiles · ${joins.length} auto corners · ${project.stairs.length} stair links`;
  $('view-label').textContent=l.name.toUpperCase()+' · '+['NORTH','EAST','SOUTH','WEST'][rotation]+' VIEW';
  $('hint').textContent=playing?'Click floor to walk. End on a stair base to change floors; crossing it is safe.':pending?'Stair base selected. Choose another floor, then click its single or double landing.':({floor:'Drag to paint floor • Right-drag or Option-drag to pan',wall:'Drag along grid edges to build walls',door:'Click a grid edge to add an open doorway',window:'Click a grid edge to add a window wall',fence:'Drag along grid edges to build a fence',decor:'Click or drag over surfaces to assign the selected décor group',stairs:'Choose Single or Double width, place a base, then its destination on another floor',item:'Click a placeable tile to add a solid test item',spawn:'Click a walkable tile to set the entry point',erase:'Click to remove an item or stair; near an edge removes a wall; otherwise removes floor'})[tool];
  document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.disabled=playing;});
  [...$('views').children].forEach((b,i)=>b.classList.toggle('active',i===rotation));
  $('undo').disabled=!undo.length||playing;$('redo').disabled=!redo.length||playing;$('add-level').disabled=playing;$('play').textContent=playing?'■ End walk test':'▶ Walk test';
}
function nearestEdge(p){const x=Math.round(p.wx),z=Math.round(p.wz),dx=p.wx-x,dz=p.wz-z;return Math.abs(dx)>Math.abs(dz)?{axis:'x',x:x+(dx>0?1:0),z}:{axis:'z',x,z:z+(dz>0?1:0)};}
function edit(e){const p=unproject(e),x=Math.round(p.wx),z=Math.round(p.wz),n={level:active,x,z},l=levelOf(project,active),edge=nearestEdge(p);if(!Number.isSafeInteger(x)||!Number.isSafeInteger(z))return;const stamp=tool+(['wall','door','window','fence'].includes(tool)?edgeKey(edge):key(x,z));if(painted.has(stamp))return;painted.add(stamp);
  const groupFor=kind=>project.decorGroups.some(g=>g.id===$('decor-group').value&&g.kind===kind)?$('decor-group').value:null;
  if(tool==='floor')for(const c of brushCells(x,z,+$('floor-size').value))l.tiles[key(c.x,c.z)]={walk:$('walk').checked,place:$('place').checked,material:$('floor-material').value,piece:c.piece,size:c.size,decorGroup:groupFor('floor')};
  if(['wall','door','window','fence'].includes(tool))l.walls[edgeKey(edge)]={...edge,kind:tool,...(tool==='door'?{doorStyle:$('door-style').value}:{}),...(tool==='window'?{windowStyle:$('window-style').value}:{}),collapse:$('collapse').checked,mount:tool==='wall'&&$('mount').checked,material:$('wall-material').value,facing:+$('facing').value,fenceStyle:$('fence-style').value,decorGroup:groupFor('wall')};
  if(tool==='decor'){const kind=$('decor-kind').value;assignDecor(project,active,kind,kind==='floor'?key(x,z):edgeKey(edge),$('decor-group').value);}
  if(tool==='item'){if(!canPlace(project,n)){status('This tile is not available for item placement.');return;}l.items.push({x,z});}
  if(tool==='spawn'){if(!walkable(project,n)||portalAt(project,n)){status('Entry needs walkable floor outside the stairs.');return;}project.spawn=n;}
  if(tool==='stairs'){
    const end={...n,axis:$('axis').value,angle:$('axis').value==='x'?90:0,width:+$('stair-width').value,style:$('stair-style').value,depth:+$('stair-depth').value,rise:+$('stair-rise').value};
    if(triggerCells(end).some(c=>!walkable(project,c)||portalAt(project,c)||nodeKey(project.spawn||{})===nodeKey(c))){status('The stair base needs free walkable floor, away from entry and other stairs.');return;}
    if(stairFlightCells(end).some(c=>portalAt(project,c)||stairSolidAt(project,c)||nodeKey(project.spawn||{})===nodeKey(c)||l.items.some(i=>i.x===c.x&&i.z===c.z))){status('The stair flight overlaps entry, another stair, or an item.');return;}
    if(!pending){pending=end;status('Now select another floor and place the matching stair base.');}
    else if(pending.level===active){status('Choose a different floor to finish this connection.');return;}
    else{project.stairs.push({id:`stairs-${crypto.randomUUID()}`,a:pending,b:end});pending=null;status('Two-way stair connection created.');}
  }
  if(tool==='erase'){
    const item=l.items.findIndex(i=>i.x===x&&i.z===z),portal=portalAt(project,n);
    if(item>=0)l.items.splice(item,1);
    else if(portal)project.stairs=project.stairs.filter(s=>s.id!==portal.id);
    else if(l.walls[edgeKey(edge)]&&Math.max(Math.abs(p.wx-x),Math.abs(p.wz-z))>.28)delete l.walls[edgeKey(edge)];
    else{delete l.tiles[key(x,z)];if(nodeKey(project.spawn||{})===nodeKey(n))project.spawn=null;}
  }
  changed();
}
function walkTo(e){if(timer)return;const p=unproject(e),goal={level:active,x:Math.round(p.wx),z:Math.round(p.wz)};
  const path=walkRoute(project,avatar,goal);if(!path){status('No walkable route. Check walls, floor permissions and stair links.');return;}
  let i=0;timer=setInterval(()=>{if(i>=path.length){clearInterval(timer);timer=null;return;}const step=path[i++];avatar=step.node;active=avatar.level;if(step.via)status(`Stair transfer → ${levelOf(project,active).name}`);else status(`Walking · X ${avatar.x}, Z ${avatar.z}`);render();},110);
}
svg.addEventListener('contextmenu',e=>e.preventDefault());
svg.addEventListener('pointerdown',e=>{if((e.button===1||e.button===2||e.altKey)){e.preventDefault();panStart={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};svg.setPointerCapture(e.pointerId);return;}if(e.button!==0)return;if(playing){walkTo(e);return;}history();drag=true;painted.clear();svg.setPointerCapture(e.pointerId);edit(e);});
svg.addEventListener('pointermove',e=>{const p=unproject(e);$('coords').textContent=`X ${Math.round(p.wx)} · Z ${Math.round(p.wz)}`;if(panStart){pan={x:panStart.px+e.clientX-panStart.x,y:panStart.py+e.clientY-panStart.y};render();}else if(drag&&['floor','wall','fence','decor','erase'].includes(tool))edit(e);});
for(const event of ['pointerup','pointercancel'])svg.addEventListener(event,()=>{drag=false;panStart=null;});
for(const [id,icon,label] of tools){const b=document.createElement('button');b.dataset.tool=id;const glyph=document.createElement('b');glyph.textContent=icon;b.append(glyph,label);b.onclick=()=>{tool=id;if(id!=='stairs')pending=null;render();};$('tools').append(b);}
['N','E','S','W'].forEach((v,i)=>{const b=document.createElement('button');b.textContent=v;b.ariaLabel=`${['North','East','South','West'][i]} view`;b.onclick=()=>{rotation=i;render();};$('views').append(b);});
function travelHistory(from,to){if(!from.length||playing)return;to.push(clone());project=ensureDecor(from.pop());refreshDecor();if(!levelOf(project,active))active=project.levels[0].id;pending=null;changed();}
$('undo').onclick=()=>travelHistory(undo,redo);$('redo').onclick=()=>travelHistory(redo,undo);
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();return;}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)$('redo').click();else $('undo').click();}if(e.key==='Escape'){pending=null;render();}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const d=e.shiftKey?640:180;if(e.key==='ArrowLeft')pan.x+=d;if(e.key==='ArrowRight')pan.x-=d;if(e.key==='ArrowUp')pan.y+=d;if(e.key==='ArrowDown')pan.y-=d;render();}});
let editingName=false;
$('name').onfocus=()=>{editingName=false;};
$('name').oninput=()=>{if(!editingName){history();editingName=true;}project.name=$('name').value.slice(0,120);persist();};
$('name').onchange=()=>{project.name=$('name').value.trim().slice(0,120)||'Untitled LW space';changed();};
for(const id of ['overlay','wall-view','zoom','show-grid','background-view'])$(id).oninput=render;
$('fit').onclick=()=>{pan={x:0,y:0};const l=levelOf(project,active),coords=Object.keys(l.tiles).map(k=>k.split(',').map(Number));if(coords.length){const raw=coords.map(([x,z])=>{const c=cameraGridPosition(x,z,rotation,{pivotX:4,pivotZ:3});return gridToScreen(c.rx-4,c.rz-3);}),x0=Math.min(...raw.map(p=>p.sx))-64,x1=Math.max(...raw.map(p=>p.sx))+64,y0=Math.min(...raw.map(p=>p.sy))-KIT.wallHeight-32,y1=Math.max(...raw.map(p=>p.sy))+32;const base=Math.min(1,svg.clientWidth/780,svg.clientHeight/720);$('zoom').value=Math.max(15,Math.min(160,100*Math.min((svg.clientWidth-60)/(x1-x0),(svg.clientHeight-80)/(y1-y0))/base));pan={x:-(x0+x1)*scale()/2,y:svg.clientHeight*(.5-.62)-(y0+y1)*scale()/2};}render();};
$('cancel-stair').onclick=()=>{pending=null;render();};
$('add-level').onclick=()=>{history();const id=`floor-${crypto.randomUUID()}`;project.levels.push({id,name:`Floor ${project.levels.length+1}`,tiles:{},walls:{},items:[]});active=id;changed();};
function stopPlay(){clearInterval(timer);timer=null;playing=false;avatar=null;}
$('play').onclick=()=>{if(playing)stopPlay();else{if(!project.spawn||!walkable(project,project.spawn)){status('Set a valid entry point before starting the walk test.');return;}playing=true;avatar={...project.spawn};active=avatar.level;pending=null;}render();};
function replace(p){undo=[];redo=[];stopPlay();project=ensureDecor(p);refreshDecor();active=p.levels[0].id;pending=null;pan={x:0,y:0};changed();}
async function openAsNew(p){if(library){library.save(project);const result=await library.create(p);p=result.project;}replace(p);refreshProjects();}
$('new').onclick=()=>openAsNew(blankProject()).catch(e=>status(e.message));
$('demo').onclick=()=>openAsNew(demoProject()).catch(e=>status(e.message));
async function saveData(data,name,kind='project'){if(window.lwDesktop){const saved=await window.lwDesktop.saveProject(name,JSON.stringify(data,null,2),kind);status(saved?'File saved.':'Save cancelled.');return;}const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(name.replace(/[^a-z0-9]+/gi,'-')||'lw-space')+({project:'.lwspace.json',decor:'.lwdecor.json',build:'.lwbuild.json'}[kind]);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('File downloaded.');}
$('export-build').onclick=()=>{try{if(pending)throw Error('Finish or cancel the pending stair connection before building.');saveData(buildSpace(project),project.name,'build').catch(e=>status(e.message));}catch(e){status(e.message);}};
$('save').onclick=()=>saveData(project,project.name).catch(e=>status(e.message));
$('load').onclick=async()=>{if(window.lwDesktop){try{const raw=await window.lwDesktop.openProject();if(raw){await openAsNew(openSpaceFile(raw));status('Project loaded.');}}catch(e){status(e.message);}}else $('file').click();};$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{if(f.size>32_000_000)throw Error('Project is too large (maximum 32 MB).');const p=openSpaceFile(await f.text());await openAsNew(p);status('Project loaded.');}catch(e){status(e.message);}$('file').value='';};
for(const [id,materials] of [['floor-material',kit.floorMaterials],['wall-material',kit.wallMaterials]])for(const m of materials){const o=document.createElement('option');o.value=m.id;o.textContent=m.name;$(id).append(o);}
$('kit-count').textContent=`${kit.assets.length} original sprites · ${kit.floorMaterials.length} floor materials · ${kit.wallMaterials.length} wall finishes · 5 fence styles · single/double stairs`;
function refreshDecor(){const old=$('decor-group').value;$('decor-group').replaceChildren();const none=document.createElement('option');none.value='';none.textContent='Fixed material (not linked)';$('decor-group').append(none);for(const g of project.decorGroups.filter(g=>g.kind===$('decor-kind').value)){const o=document.createElement('option');o.value=g.id;o.textContent=g.name;$('decor-group').append(o);}if([...$('decor-group').options].some(o=>o.value===old))$('decor-group').value=old;}
$('decor-kind').onchange=refreshDecor;
$('paint-decor').onclick=()=>{if(playing)return;tool='decor';$('overlay').value='decor';pending=null;render();};
$('add-decor').onclick=()=>{if(playing)return;const name=prompt('Name this décor group');if(!name?.trim())return;history();const g={id:'lw_'+crypto.randomUUID().replaceAll('-',''),name:name.trim().slice(0,80),kind:$('decor-kind').value,editable:true};project.decorGroups.push(g);refreshDecor();$('decor-group').value=g.id;changed();};
$('export-decor').onclick=()=>saveData(decorManifest(project),project.name+'-decor-mapping','decor').catch(e=>status(e.message));
let pieceSelection='';
function refreshPieces(){
 const kind=$('piece-kind').value,list=decorPieces(project,active,kind),old=$('piece-target').value;
 $('piece-target').replaceChildren();for(const t of list){const o=document.createElement('option');o.value=t.id;o.textContent=t.label;$('piece-target').append(o);}if(list.some(t=>t.id===old))$('piece-target').value=old;
 const token=active+':'+kind+':'+$('piece-target').value+':'+JSON.stringify(list.find(t=>t.id===$('piece-target').value)?.value);
 if(token!==pieceSelection){pieceSelection=token;loadPieceControls();}
 for(const id of ['piece-target','piece-style','piece-color','piece-accent','apply-piece','reset-piece'])$(id).disabled=playing||!list.length;
 $('piece-note').textContent=list.length?'Edits affect this piece on this floor. Position, footprint, and stair links stay the same.':kind==='stair'?'No styled stairs on this floor. Place a staircase to edit it.':'No windows on this floor. Place a window wall to edit it.';
}
function loadPieceControls(){
 const kind=$('piece-kind').value,t=decorPieces(project,active,kind).find(t=>t.id===$('piece-target').value),v=t?.value;
 $('piece-style').replaceChildren();const styles=kind==='window'?[['plain','Plain glass'],['divided','Divided panes'],['high','High window']]:[['masonry','Solid masonry'],['timber','Timber with risers + rails'],['open','Open timber + rails']];
 if(v?.style==='basic')styles.unshift(['basic','Basic solid steps']);for(const [id,name] of styles){const o=document.createElement('option');o.value=id;o.textContent=name;$('piece-style').append(o);}
 if(v)$('piece-style').value=kind==='window'?(v.windowStyle||'divided'):v.style;
 $('piece-color-label').textContent=kind==='window'?'Window frame':'Steps and body';$('piece-accent-label').textContent=kind==='window'?'Glass tint':'Handrails and supports';
 $('piece-color').value=kind==='window'?(v?.appearance?.frameColor||'#e9e2d1'):(v?.appearance?.bodyColor||(['open','timber'].includes(v?.style)?'#8d7354':'#aeb2a6'));
 $('piece-accent').value=kind==='window'?(v?.appearance?.glassColor||'#668b94'):(v?.appearance?.railColor||'#70624f');
}
$('piece-kind').onchange=()=>{pieceSelection='';refreshPieces();};$('piece-target').onchange=()=>{pieceSelection='';refreshPieces();};
$('apply-piece').onclick=()=>{if(playing)return;const kind=$('piece-kind').value,id=$('piece-target').value;if(!id)return;history();const appearance=kind==='window'?{frameColor:$('piece-color').value,glassColor:$('piece-accent').value}:{bodyColor:$('piece-color').value,railColor:$('piece-accent').value};applyPieceDecor(project,active,kind,id,$('piece-style').value,appearance);changed();status('Style and colors updated on the selected '+kind+'.');};
$('reset-piece').onclick=()=>{if(playing)return;const t=decorPieces(project,active,$('piece-kind').value).find(t=>t.id===$('piece-target').value);if(!t)return;history();delete t.value.appearance;changed();status('Default colors restored.');};
refreshDecor();
new ResizeObserver(render).observe(svg);render();status(savedMessage);

initWebApp(()=>{if(reviewMode)return;if(pending)throw Error('Finish or cancel your stair connection first.');project.name=$('name').value.trim().slice(0,120)||'Untitled LW space';const data=JSON.stringify(project);sessionStorage.setItem('lw-update-recovery',data);if(!library)throw Error('Save your project file before updating.');library.save(project);});

function refreshProjects(){const picker=$('project-picker');picker.replaceChildren();if(!library){picker.disabled=true;$('open-project').disabled=true;return;}for(const r of library.list()){const o=document.createElement('option');o.value=r.id;o.textContent=(r.project.name||'Untitled LW space')+' · '+new Date(r.updated).toLocaleString();picker.append(o);}picker.value=library.current;}
$('open-project').onclick=async()=>{if(!library)return;try{const id=$('project-picker').value;library.save(project);const result=await library.open(id);replace(result.project);refreshProjects();status(result.copied?'That project is open elsewhere. You are editing an independent tab copy.':'Project opened in this tab.');}catch(e){status(e.message);}};
$('refresh-projects').onclick=refreshProjects;
window.addEventListener('storage',e=>{if(e.key?.startsWith('lw-studio-project:'))refreshProjects();});
$('name').addEventListener('change',refreshProjects);
refreshProjects();
