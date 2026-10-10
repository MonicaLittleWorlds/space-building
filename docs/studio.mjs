import {drawBuilderAvatar,AVATAR_HEIGHT} from './avatar.mjs';
import {requireCurrentVersion} from './version-gate.mjs';
import {roomLayout,roomCutaway,cutProfile,roomWallOpacity} from './rooms.mjs';
import {requireUniversalCode} from './access.mjs';
import {ProjectLibrary} from './projects.mjs';
import {initWebApp} from './pwa.mjs';
import {buildSpace,openSpaceFile} from './build.mjs';
import {orderFaces} from './face-order.mjs';
import {cameraGridPosition,inverseCameraGridPosition,gridToScreen} from './native-coordinate.mjs';
import {key,nodeKey,edgeKey,levelOf,blankProject,demoProject,triggerCells,rotatedStairEnd,stairFlightCells,stairSolidAt,portalAt,walkable,canPlace,walkRoute,validate,unreachableCells,parseProject} from './model.mjs';
import kit from './kit.mjs';
import {KIT,wallUsesBackShadow,wallFacing,wallSurfaceEnds,wallEndVisible,stairLevels,stairwell,itemFaces,fencePostOwners,tintColor,stairArrow,fenceFaces,windowLayout,brushCells,wallEnds,wallSide,wallEndExposed,wallRenderHeight,wallCorners,wallCornerFaces,wallCapEnds,visibleLevelObjects,stairFaces} from './geometry.mjs';
import {ensureDecor,decorField,decorGroupsFor,decorManifest,assignDecor,decorPieces,applyPieceDecor} from './decor.mjs';
import {joinReview,stairReview,doorReview,roomReview,fenceReview} from './review.mjs';
const versionGate=await requireCurrentVersion();
await requireUniversalCode({checkUpdates:versionGate.check});
const $=id=>document.getElementById(id), svg=$('canvas'), NS='http://www.w3.org/2000/svg';
let project=demoProject(), savedMessage='Sample loaded. Your edits autosave locally.';
const reviewType=new URLSearchParams(location.search).get('review'),reviewMode=['joins','stairs','doors','rooms','fences'].includes(reviewType);
let library=null;
if(!reviewMode)try{
 library=new ProjectLibrary(localStorage,sessionStorage,navigator.locks);
 let recovery=null;try{const raw=sessionStorage.getItem('lw-update-recovery');if(raw)recovery=parseProject(raw);}catch{}
 const opened=await library.start(project,recovery);project=opened.project;sessionStorage.removeItem('lw-update-recovery');savedMessage=opened.copied?'Opened a separate tab copy.':'Your independent project session is ready.';
}catch{library=null;savedMessage='Local storage unavailable. Save project files to keep your work.';}

if(reviewMode){project=reviewType==='fences'?fenceReview():reviewType==='rooms'?roomReview():reviewType==='stairs'?stairReview():reviewType==='doors'?doorReview():joinReview();savedMessage='Join review sample · your draft is unchanged.';}
ensureDecor(project);
let active=project.levels[0].id,rotation=0,tool='floor',pending=null,playing=false,avatar=null,undo=[],redo=[],drag=false,painted=new Set(),timer=null,pan={x:0,y:0},panStart=null,panMode=false;
let issueFocus=null;
let decorRemoving=false,avatarHeading={x:0,z:1},avatarPhase=0,avatarMoving=false;
let roomStart=null,roomCache=new WeakMap(),cutSelection=new Set();
const tools=[['select','↖','Select / edit'],['room','▧','Room area'],['floor','◇','Floor'],['wall','▱','Wall'],['door','Π','Doorway'],['window','⊞','Window wall'],['fence','╫','Fence'],['gate','⊏⊐','Fence gate'],['face','↔','Flip wall face'],['stairs','▤','Stairs'],['item','▣','Test item'],['spawn','⚑','Entry'],['erase','⌫','Erase']];
const clone=()=>structuredClone(project);
function status(s){$('status').textContent=s;}
function persist(){if(reviewMode)return;try{if(!library)throw Error('Storage unavailable');library.save(project);}catch{status('Browser storage unavailable. Use Save project to keep this design.');}}
function history(){undo.push(clone());if(undo.length>80)undo.shift();redo=[];}
function changed(){ensureDecor(project);roomCache=new WeakMap();persist();render();}
let renderParent=null,viewMetrics=null,placementPointer=null,previewDrawing=false,previewFrame=null;
function element(tag,attrs={},parent=renderParent||svg){const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);parent.append(el);return el;}
function text(x,y,value,attrs={}){const el=element('text',{x,y,'text-anchor':'middle','font-family':'system-ui','font-size':11,'pointer-events':'none',...attrs});el.textContent=value;return el;}
function scale(){return viewMetrics?.scale??(+$('zoom').value/100*Math.min(1,svg.clientWidth/780,svg.clientHeight/720));}
function projection(x,z,h=0){const c=cameraGridPosition(x,z,rotation,{pivotX:4,pivotZ:3}),p=gridToScreen(c.rx-4,c.rz-3);const s=scale();return [(viewMetrics?.width??svg.clientWidth)/2+pan.x+p.sx*s,(viewMetrics?.height??svg.clientHeight)*.62+pan.y+(p.sy-h)*s];}
function gridAt(px,py){const s=scale(),sx=(px-svg.clientWidth/2-pan.x)/s,sy=(py-svg.clientHeight*.62-pan.y)/s;return inverseCameraGridPosition((sx/64+sy/32)/2+4,(sy/32-sx/64)/2+3,rotation,{pivotX:4,pivotZ:3});}
function unproject(e){const r=svg.getBoundingClientRect();return gridAt(e.clientX-r.left,e.clientY-r.top);}
function onScreen(x,z,height=0){const p=projection(x,z);return p[0]>-150&&p[0]<(viewMetrics?.width??svg.clientWidth)+150&&p[1]>-100&&p[1]-height*scale()<(viewMetrics?.height??svg.clientHeight)+100;}
function points(coords){return coords.map(p=>projection(...p).join(',')).join(' ');}
function diamond(x,z){return [[x-.5,z-.5],[x+.5,z-.5],[x+.5,z+.5],[x-.5,z+.5]];}
function tile(x,z,fill,stroke='#80968e',extra={}){return element('polygon',{points:points(diamond(x,z)),fill,stroke,'stroke-width':.65,...extra});}
function endpoints(w){return w.axis==='x'?[[w.x-.5,w.z-.5],[w.x-.5,w.z+.5]]:[[w.x-.5,w.z-.5],[w.x+.5,w.z-.5]];}
function decorColor(id){if($('overlay').value==='decor'&&$('decor-group').value)return id===$('decor-group').value?'#9ceacb':'#667b75';const i=project.decorGroups.findIndex(g=>g.id===id);return i<0?'#596968':`hsl(${(i*83+35)%360} 38% 62%)`;}
function facingWall(w){return {...w,facing:wallFacing(w,levelOf(project,active).tiles)};}
function wallPaint(w){const exterior=wallSide(facingWall(w),rotation)==='back',material=exterior?(w.exteriorMaterial||w.material):w.material;const back=wallUsesBackShadow(facingWall(w),rotation),mount=$('overlay').value==='mount'&&w.mount;let fill=kit.wallMaterials.find(m=>m.id===material)?.color||'#d3d7c9';if(mount)fill='#75b6d3';if($('overlay').value==='decor')fill=decorColor(w[decorField('wall',$('decor-area').value)]);if(back)fill='#142e2a';return {back,fill,opacity:previewDrawing?1:roomWallOpacity(w,cutSelection,$('wall-view').value,+$('wall-opacity').value/100,back)};}
let faceQueue=null;
function polygon(vertices,attrs){if(tool==='decor'&&$('decor-kind').value==='wall'&&attrs['data-wall-axis'])attrs={...attrs,'pointer-events':'visiblePainted','data-decor-edge':`${attrs['data-wall-axis']}:${attrs['data-wall-x']},${attrs['data-wall-z']}`};if(tool==='select'&&!playing&&attrs['data-kind']==='window'&&attrs['data-wall-axis'])attrs={...attrs,'pointer-events':'visiblePainted','data-piece-kind':'window','data-piece-id':`${attrs['data-wall-axis']}:${attrs['data-wall-x']},${attrs['data-wall-z']}`};if(faceQueue){faceQueue.push({vertices,attrs});return;}element('polygon',{points:points(vertices),...attrs});}
function drawCorner(corner){for(const face of wallCornerFaces(corner,rotation)){const {back,fill,opacity}=wallPaint(face.wall);const capBack=corner.walls.every(w=>wallUsesBackShadow(facingWall(w),rotation));polygon(face.vertices,{fill:face.part==='cap'?(capBack?'#263e35':'#e2e7d9'):fill,opacity:face.part==='cap'?Math.max(...corner.walls.map(w=>wallPaint(w).opacity)):opacity,'pointer-events':'none','data-kind':'wall-corner','data-corner-id':corner.id,'data-level':active,'data-part':face.part,'data-material':face.wall.material||'blank'});}}
function collapsedWall(w){return !previewDrawing&&['auto','cut'].includes($('wall-view').value)&&cutSelection.has(edgeKey(w));}
function drawWall(w,corners=[]){const [a,b]=wallSurfaceEnds(w,rotation,corners),collapsed=collapsedWall(w),h=wallRenderHeight(w,collapsed);const {back,fill,opacity}=wallPaint(w);
  const attrs={'data-kind':w.kind,'data-level':active,'data-collapsed':collapsed,'data-wall-x':w.x,'data-wall-z':w.z,'data-wall-axis':w.axis,'data-face':back?'back':'front',opacity,'pointer-events':'none'};
  const panel=(u,v,low,high,color=fill,overrides={})=>{const p=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u],q=[a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v];polygon([[...p,low],[...q,low],[...q,high],[...p,high]],{fill:color,stroke:back?'none':color,'stroke-width':.8,...attrs,...overrides});};
  if(w.kind==='fence')return;
  if(collapsed){
    const profile=cutProfile(w,levelOf(project,active).walls,cutSelection),t=KIT.wallThickness/2;
    const normal=w.axis==='x'?[1,0]:[0,1],side=w.axis==='x'?[1,1,-1,-1][rotation]:[1,-1,-1,1][rotation];
    const at=(u,height,across=0)=>[a[0]+(b[0]-a[0])*u+normal[0]*across,a[1]+(b[1]-a[1])*u+normal[1]*across,height];
    const heightAt=u=>{for(let i=1;i<profile.length;i++)if(u<=profile[i][0]){const [v,h]=profile[i-1],[q,k]=profile[i];return h+(k-h)*(u-v)/(q-v);}return profile.at(-1)[1];};
    const ranges=w.kind==='door'?[[0,.16],[.84,1]]:[[0,1]];
    for(const [lo,hi] of ranges){
      const top=[[lo,heightAt(lo)],...profile.filter(([u])=>u>lo&&u<hi),[hi,heightAt(hi)]];
      polygon([at(lo,0),at(hi,0),...top.slice().reverse().map(([u,h])=>at(u,h))],{fill,stroke:fill,'stroke-width':.3,...attrs,'data-part':'room-cut'});
      for(let i=1;i<top.length;i++){const [u,h]=top[i-1],[v,k]=top[i];polygon([at(u,h),at(v,k),at(v,k,-side*2*t),at(u,h,-side*2*t)],{fill:back?'#263e35':'#e2e7d9',...attrs,'data-part':'cap'});}
      for(const [u,h] of [top[0],top.at(-1)])if(u>0&&u<1)polygon([at(u,0),at(u,0,-side*2*t),at(u,h,-side*2*t),at(u,h)],{fill:back?'#172c26':'#86958a',...attrs,'data-part':'end'});
    }
    for(const [i,p] of wallEnds(w).entries())if(wallEndVisible(w,i,rotation)&&wallEndExposed(w,i,levelOf(project,active).walls)){
      const h=heightAt(i);polygon([[p[0]-normal[0]*t,p[1]-normal[1]*t,0],[p[0]+normal[0]*t,p[1]+normal[1]*t,0],[p[0]+normal[0]*t,p[1]+normal[1]*t,h],[p[0]-normal[0]*t,p[1]-normal[1]*t,h]],{fill:back?'#172c26':'#86958a',...attrs,'data-part':'end'});
    }
    return;
  }


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
    panel(L,R,B,T,glass,{opacity:opacity*(back?.4:.22),stroke:'none','data-part':'window-glass'});
    panel(L+.04,R-.04,B+8,B+(T-B)*.42,'#d9f2f3',{opacity:opacity*(back?.13:.09),stroke:'none','data-part':'window-reflection'});
    panel(L+.08,L+.13,B+12,T-12,'#ffffff',{opacity:opacity*(back?.27:.25),stroke:'none','data-part':'window-reflection'});
    panel(L+.17,L+.19,B+12,T-12,'#ffffff',{opacity:opacity*(back?.17:.15),stroke:'none','data-part':'window-reflection'});
    panel(L-.025,L+.035,B-5,T+5,frame);panel(R-.035,R+.025,B-5,T+5,frame);
    panel(L-.025,R+.025,T-5,T+5,frame);panel(L-.035,R+.035,B-6,B+4,frame);
    if(divided){panel(.485,.515,B+4,T-4,frame);panel(L,R,(B+T)/2-2,(B+T)/2+2,frame);}
    // A shallow sill projects from the front face of the wall.
    const normal=w.axis==='x'?[1,0]:[0,1],sign=wallFacing(w,levelOf(project,active).tiles);
    const sill=(u,d)=>[a[0]+(b[0]-a[0])*u+normal[0]*d*sign,a[1]+(b[1]-a[1])*u+normal[1]*d*sign,B+5];
    polygon([sill(L-.045,0),sill(R+.045,0),sill(R+.045,.1),sill(L-.045,.1)],{fill:frame,...attrs,'data-part':'window-sill'});
  }
  else panel(0,1,0,h);
  const t=KIT.wallThickness/2,offset=w.axis==='x'?[t,0]:[0,t],quad=(p,q,low,high)=>[[p[0]-offset[0],p[1]-offset[1],low],[q[0]+offset[0],q[1]+offset[1],low],[q[0]+offset[0],q[1]+offset[1],high],[p[0]-offset[0],p[1]-offset[1],high]];
  const [capA,capB]=wallCapEnds(w,corners);
  polygon([[capA[0]-offset[0],capA[1]-offset[1],h],[capB[0]-offset[0],capB[1]-offset[1],h],[capB[0]+offset[0],capB[1]+offset[1],h],[capA[0]+offset[0],capA[1]+offset[1],h]],{fill:back?'#263e35':'#e2e7d9',...attrs,'data-part':'cap'});
  for(const [i,p] of wallEnds(w).entries())if(wallEndVisible(w,i,rotation)&&wallEndExposed(w,i,levelOf(project,active).walls))polygon(quad(p,p,0,h),{fill:back?'#172c26':'#86958a',...attrs,'data-part':'end'});
}
function drawItem(i){const x=i.x,z=i.z;for(const [a,b,fill] of [[[x-.3,z+.3],[x+.3,z+.3],'#728b83'],[[x+.3,z-.3],[x+.3,z+.3],'#506b63']])element('polygon',{points:points([[...a,0],[...b,0],[...b,35],[...a,35]]),fill,stroke:'#bfd3c3','pointer-events':'none'});element('polygon',{points:points([[x-.3,z-.3,35],[x+.3,z-.3,35],[x+.3,z+.3,35],[x-.3,z+.3,35]]),fill:'#a9c1b3',stroke:'#bfd3c3','pointer-events':'none'});}
function render(){
  // Measure once before SVG writes; per-face layout reads make rotation and walking stall.
  const width=svg.clientWidth,height=svg.clientHeight;viewMetrics={width,height,scale:+$('zoom').value/100*Math.min(1,width/780,height/720)};
  const l=levelOf(project,active);if(!roomCache.has(l))roomCache.set(l,roomLayout(l));const cutaway=roomCutaway(l,{avatar:playing?avatar:null,rotation,mode:$('wall-view').value,rooms:roomCache.get(l)});cutSelection=cutaway.selected;svg.replaceChildren();const nativeBackground=$('background-view').value==='native';svg.style.background=nativeBackground?'linear-gradient(#9BECFC,#00C4F5)':'';svg.parentElement.classList.toggle('native-background',nativeBackground);
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
  if(tool==='room'&&!playing)for(const room of l.rooms||[]){const x=room.x-.5,z=room.z-.5;polygon([[x,z],[x+room.width,z],[x+room.width,z+room.depth],[x,z+room.depth]],{fill:room.kind==='indoor'?'#76c5a5':'#d9b774','fill-opacity':.13,stroke:'#c6efd9','stroke-dasharray':'5 4','pointer-events':'none'});}
  if(roomStart?.level===active)tile(roomStart.x,roomStart.z,'#dfbd69','#fff0b8');
  if(pending?.level===active)for(const c of triggerCells(pending))tile(c.x,c.z,'#dfbd69','#fff0b8');
  if(project.spawn?.level===active){const [x,y]=projection(project.spawn.x,project.spawn.z);text(x,y-5,'⚑',{fill:'#426c58','font-size':28});}
  const visible=visibleLevelObjects(project,active);
  const joins=wallCorners(l.walls,collapsedWall);
  faceQueue=[];
  for(const w of visible.walls.filter(w=>w.kind!=='fence'&&onScreen(w.x,w.z,KIT.wallHeight)))drawWall(w,joins);
  for(const corner of joins)if(onScreen(corner.x,corner.z,corner.height))drawCorner(corner);
  const mesh=(faces,attrs)=>{for(const face of faces)polygon(face.vertices,{fill:face.color,stroke:face.color,'stroke-width':.25,'pointer-events':'none','data-part':face.part,...attrs});};
  for(const w of visible.walls.filter(w=>w.kind==='fence'&&onScreen(w.x,w.z,KIT.fenceHeight))){
    const posts=fencePostOwners(w,visible.walls);
    mesh(fenceFaces({...w,gateOpen:!!(w.gate&&playing&&avatar?.level===active&&Math.hypot(avatar.x-w.x,avatar.z-w.z)<1.8)},rotation,posts),{'data-kind':'fence','data-wall-x':w.x,'data-wall-z':w.z,'data-wall-axis':w.axis,'data-level':active,'data-fence-style':w.fenceStyle,'data-gate':!!w.gate,...($('overlay').value==='decor'?{fill:decorColor(w[decorField('wall',$('decor-area').value)]),stroke:decorColor(w[decorField('wall',$('decor-area').value)])}:{})});
  }
  for(const stair of project.stairs)for(const end of [stair.a,stair.b])if(end.level===active&&end.style&&stairLevels(project,stair).lower===end)mesh(stairFaces(end,rotation),{'data-kind':'stair','data-level':active,'data-stair-width':end.width,'data-stair-style':end.style,...(tool==='select'&&!playing?{'pointer-events':'visiblePainted','data-piece-kind':'stair','data-piece-id':stair.id+':'+(end===stair.a?'a':'b')}:{})});
  for(const i of l.items)mesh(itemFaces(i,rotation),{'data-kind':'item','data-level':active});
  if(playing&&avatar?.level===active){
    const sx=[1,1,-1,-1][rotation],sz=[1,-1,-1,1][rotation],point=(u,h)=>[avatar.x+sz*u,avatar.z-sx*u,h];
    faceQueue.push({vertices:[point(-.7,-16),point(.7,-16),point(.7,AVATAR_HEIGHT+8),point(-.7,AVATAR_HEIGHT+8)],draw:()=>{const [x,y]=projection(avatar.x,avatar.z),d=cameraGridPosition(avatarHeading.x,avatarHeading.z,rotation,{pivotX:0,pivotZ:0}),direction={x:(d.rx-d.rz)*64,y:(d.rx+d.rz)*32},parent=renderParent;renderParent=element('g',{transform:`translate(${x} ${y}) scale(${scale()})`,'data-kind':'test-avatar','data-moving':avatarMoving,'data-height':AVATAR_HEIGHT,'pointer-events':'none'});drawBuilderAvatar((tag,attrs)=>element(tag,attrs),direction,avatarPhase,avatarMoving);renderParent=parent;}});
  }
  const architecturalFaces=faceQueue;faceQueue=null;let clipIndex=0;
  for(const face of orderFaces(architecturalFaces,rotation)){
    if(face.draw){const id='actor-clip-'+clipIndex++,clip=element('clipPath',{id});element('polygon',{points:points(face.vertices)},clip);renderParent=element('g',{'clip-path':`url(#${id})`});face.draw();renderParent=null;}
    else polygon(face.vertices,face.attrs);
  }
  if(tool==='select'&&!playing&&$('piece-kind').value==='stair'){const t=decorPieces(project,active,'stair').find(t=>t.id===$('piece-target').value);if(t)for(const c of triggerCells(t.value))tile(c.x,c.z,'none','#ffe0a0',{'stroke-width':3,'pointer-events':'none','data-kind':'selected-stair-base'});}
  $('name').value=project.name;
  $('levels').replaceChildren();for(const level of project.levels){const b=document.createElement('button');b.className=level.id===active?'active':'';b.textContent=level.name;const small=document.createElement('small');small.textContent=`${Object.keys(level.tiles).length} floor tiles`;b.append(small);b.onclick=()=>{active=level.id;render();};b.ondblclick=()=>{if(playing)return;const name=prompt('Floor name',level.name);if(name?.trim()){history();level.name=name.trim().slice(0,80);changed();}};$('levels').append(b);}
  $('stairs').replaceChildren();for(const s of project.stairs){const row=document.createElement('div');row.className='stair-row';row.textContent=`${levelOf(project,s.a.level).name} ↔ ${levelOf(project,s.b.level).name}`;const b=document.createElement('button');b.textContent='×';b.ariaLabel=`Remove ${s.id}`;b.disabled=playing;b.onclick=()=>{history();project.stairs=project.stairs.filter(t=>t.id!==s.id);changed();};row.append(b);$('stairs').append(row);}
  if(!project.stairs.length)$('stairs').textContent='No stairs connected yet.';
  $('cancel-stair').hidden=!pending;
  $('room-list').replaceChildren();for(const room of l.rooms||[]){const row=document.createElement('div');row.className='stair-row';row.textContent=room.name+' · '+room.kind;const remove=document.createElement('button');remove.textContent='×';remove.ariaLabel='Remove room area '+room.name;remove.disabled=playing;remove.onclick=()=>{history();l.rooms=l.rooms.filter(r=>r.id!==room.id);changed();};row.append(remove);$('room-list').append(row);}
  $('active-room').textContent=playing?'Walking area: '+(cutaway.room?.name||'Outside'):'Closed rooms are detected automatically. Mark open-plan rooms with Room area.';
  $('checks').replaceChildren();const issues=validate(project);for(const issue of issues.length?issues:['Entry and reachable floor checks pass.']){const el=document.createElement('div');el.className=`check ${issues.length?'':'good'}`;el.textContent=(issues.length?'• ':'✓ ')+issue;$('checks').append(el);}
  refreshToolSettings();refreshSimpleView();refreshPieces();
  $('counts').textContent=`${project.levels.length} floors · ${Object.keys(l.tiles).length} tiles · ${joins.length} auto corners · ${project.stairs.length} stair links`;
  $('view-label').textContent=l.name.toUpperCase()+' · '+['NORTH','EAST','SOUTH','WEST'][rotation]+' VIEW';
  renderIssueLocations();
  $('hint').textContent=panMode?'Drag to pan · click Pan again to return to '+(playing?'walking':'building'):playing?'Click floor to walk. End on a stair base to change floors; crossing it is safe.':pending?'Stair base selected. Choose another floor, then click its single or double landing.':({select:'Click a placed stair or window to edit it. Rotate stairs with the left/right buttons; the other floor stays unchanged.',room:roomStart?'Click the opposite floor corner to finish the room area':'Click two opposite floor corners to mark a room area',floor:'Drag to paint floor • Right-drag or Option-drag to pan',wall:'Drag along grid edges to build walls',door:'Click a grid edge to add an open doorway',window:'Click a grid edge to add a window wall',fence:'Drag along grid edges to build a fence',gate:'Click a fence edge to replace it with a matching gate · gates open automatically while walking',face:'Click a wall edge to reverse its finished face and back shadow',decor:decorRemoving?'Click or drag over highlighted surfaces to remove them from this label':'Click or drag to add surfaces to the selected décor label · finish in the Décor panel',stairs:'Choose Single or Double width, place a base, then its destination on another floor',item:'Click a placeable tile to add a solid test item',spawn:'Click a walkable tile to set the entry point',erase:'Click to remove an item or stair; near an edge removes a wall; otherwise removes floor'})[tool];
  document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.disabled=playing;});
  [...$('views').children].forEach((b,i)=>b.classList.toggle('active',i===rotation));
  $('wall-opacity-value').textContent=$('wall-opacity').value+'% visible';
  $('pan').classList.toggle('active',panMode);$('pan').setAttribute('aria-pressed',String(panMode));svg.style.cursor=panStart?'grabbing':panMode?'grab':'';
  refreshDecor();$('undo').disabled=!undo.length||playing;$('redo').disabled=!redo.length||playing;$('add-level').disabled=playing;$('play').textContent=playing?'■ End walk test':'▶ Walk test';drawPlacementPreview();viewMetrics=null;
}
function showUnreachable(index=0){
 const cells=unreachableCells(project);if(!cells.length){issueFocus=null;render();return;}
 stopPlay();pending=null;roomStart=null;placementPointer=null;panMode=false;tool='select';
 issueFocus=cells[(index+cells.length)%cells.length];active=issueFocus.level;
 $('zoom').value=Math.max(100,+$('zoom').value);pan={x:0,y:0};
 const [x,y]=projection(issueFocus.x,issueFocus.z);pan={x:svg.clientWidth/2-x,y:svg.clientHeight/2-y};
 $('sidebar-tab-finish')?.click();render();
 status(`Unreachable tile · ${levelOf(project,active).name} · X ${issueFocus.x}, Z ${issueFocus.z}. Add a route, doorway or stair connection, or turn off walking for this tile.`);
}
function renderIssueLocations(){
 const cells=unreachableCells(project),panel=$('checks');
 if(!cells.length){if(issueFocus){issueFocus=null;status('All walkable tiles can now be reached from entry.');}return;}
 const button=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;panel.append(b);return b;};
 if(!issueFocus){button(`Show unreachable tiles (${cells.length})`,()=>showUnreachable());return;}
 let index=cells.findIndex(c=>nodeKey(c)===nodeKey(issueFocus));
 if(index<0){issueFocus=null;button(`Show remaining unreachable tiles (${cells.length})`,()=>showUnreachable());return;}
 const note=document.createElement('p');note.className='muted';note.textContent=`Tile ${index+1} of ${cells.length} · ${levelOf(project,issueFocus.level).name} · X ${issueFocus.x}, Z ${issueFocus.z}. Red tiles have no walking route from entry. Check surrounding walls, items, gaps and stair connections.`;panel.append(note);
 button('Previous problem tile',()=>showUnreachable(index-1)).disabled=cells.length<2;
 button('Next problem tile',()=>showUnreachable(index+1)).disabled=cells.length<2;
 button('Hide problem highlights',()=>{issueFocus=null;render();});
 for(const cell of cells.filter(c=>c.level===active))tile(cell.x,cell.z,'#ff50504d','#ff6868',{'stroke-width':3,'pointer-events':'none','data-kind':'unreachable-tile'});
 if(issueFocus.level===active){tile(issueFocus.x,issueFocus.z,'#ff505066','#fff3a4',{'stroke-width':5,'pointer-events':'none'});const [x,y]=projection(issueFocus.x,issueFocus.z);text(x,y-22,`Problem ${index+1} · X ${issueFocus.x}, Z ${issueFocus.z}`,{fill:'#fff3a4',stroke:'#172525','stroke-width':4,'paint-order':'stroke','font-weight':700});}
}
function nearestEdge(p){const x=Math.round(p.wx),z=Math.round(p.wz),dx=p.wx-x,dz=p.wz-z;return Math.abs(dx)>Math.abs(dz)?{axis:'x',x:x+(dx>0?1:0),z}:{axis:'z',x,z:z+(dz>0?1:0)};}
function stairBrush(n){return {...n,axis:$('axis').value,angle:$('axis').value==='x'?90:0,width:+$('stair-width').value,style:$('stair-style').value,depth:+$('stair-depth').value,rise:+$('stair-rise').value};}
function stairPlacementProblem(end){
 const l=levelOf(project,end.level);
 if(triggerCells(end).some(c=>!walkable(project,c)||portalAt(project,c)||nodeKey(project.spawn||{})===nodeKey(c)))return 'The stair base needs free walkable floor, away from entry and other stairs.';
 if(stairFlightCells(end).some(c=>portalAt(project,c)||stairSolidAt(project,c)||nodeKey(project.spawn||{})===nodeKey(c)||l.items.some(i=>i.x===c.x&&i.z===c.z)))return 'The stair flight overlaps entry, another stair, or an item.';
 if(pending?.level===end.level)return 'Choose a different floor to finish this connection.';
 return '';
}
function drawPlacementPreview(){
 svg.querySelector('#placement-preview')?.remove();
 if(!placementPointer||playing||panMode||panStart||!['floor','wall','door','window','fence','gate','stairs','item','spawn','room'].includes(tool))return;
 const p=unproject(placementPointer),x=Math.round(p.wx),z=Math.round(p.wz),n={level:active,x,z},l=levelOf(project,active),edge=nearestEdge(p);
 if(!Number.isSafeInteger(x)||!Number.isSafeInteger(z))return;
 const end=tool==='stairs'?stairBrush(n):null;
 const invalid=tool==='stairs'?!!stairPlacementProblem(end):tool==='item'?!canPlace(project,n):tool==='spawn'?(!walkable(project,n)||!!portalAt(project,n)):tool==='room'?!l.tiles[key(x,z)]:false;
 const border=invalid?'#ff7777':'#b6ffe1';
 const oldParent=renderParent;previewDrawing=true;
 renderParent=element('g',{id:'placement-preview',opacity:.48,'pointer-events':'none','data-tool':tool,'data-valid':!invalid,'aria-hidden':'true'});
 const footprint=c=>tile(c.x,c.z,invalid?'#be4141':'#83d9b3',border,{'fill-opacity':.2,'stroke-width':2,'pointer-events':'none'});
 const mesh=faces=>{for(const f of orderFaces(faces,rotation))polygon(f.vertices,{fill:f.color,stroke:f.color,'stroke-width':.3,'pointer-events':'none','data-part':f.part});};
 try{
  if(tool==='floor'){
   const cells=brushCells(x,z,+$('floor-size').value),size=+$('floor-size').value,c=cells[0],center=projection(c.x+(size-1)/2,c.z+(size-1)/2),s=scale();
   element('image',{href:`assets/floor-${$('floor-material').value}-${size}x${size}.png`,x:center[0]-64*size*s,y:center[1]-32*size*s,width:128*size*s,height:64*size*s});cells.forEach(footprint);
  }else if(['wall','door','window','fence','gate'].includes(tool)){
   const existing=l.walls[edgeKey(edge)];
   const w=tool==='gate'&&existing?.kind==='fence'?{...existing,gate:true}:{...edge,kind:tool==='gate'?'fence':tool,gate:tool==='gate',material:$('wall-material').value,doorStyle:$('door-style').value,windowStyle:$('window-style').value,fenceStyle:$('fence-style').value,...($('facing').value==='auto'?{}:{facing:+$('facing').value})};
   if(w.kind==='fence')mesh(fenceFaces(w,rotation));else{const walls={...l.walls,[edgeKey(w)]:w},corners=wallCorners(walls).filter(c=>c.walls.includes(w));drawWall(w,corners);for(const corner of corners)drawCorner(corner);}
   const [a,b]=wallEnds(w);polygon([[...a,1],[...b,1]],{fill:'none',stroke:border,'stroke-width':4});
  }else if(tool==='stairs'){
   let well=null;if(pending){const connection={a:pending,b:end};if(stairLevels(project,connection).upper===end)well=stairwell(project,connection,rotation);}
   if(well){polygon(well.opening,{fill:'#3b665d',stroke:border,'stroke-width':2});mesh(well.faces);}else mesh(stairFaces(end,rotation));
   [...stairFlightCells(end),...triggerCells(end)].forEach(footprint);polygon(stairArrow(end),{fill:border,stroke:'#264f43','stroke-width':1});
  }else if(tool==='item'){mesh(itemFaces(n,rotation));footprint(n);}
  else if(tool==='spawn'){footprint(n);const [px,py]=projection(x,z);text(px,py-5,'⚑',{fill:border,'font-size':28});}
  else if(tool==='room'){
   const start=roomStart?.level===active?roomStart:n,x0=Math.min(start.x,x)-.5,x1=Math.max(start.x,x)+.5,z0=Math.min(start.z,z)-.5,z1=Math.max(start.z,z)+.5;
   polygon([[x0,z0],[x1,z0],[x1,z1],[x0,z1]],{fill:'#83d9b3','fill-opacity':.25,stroke:border,'stroke-width':2,'stroke-dasharray':'6 4'});
  }
 }finally{previewDrawing=false;renderParent=oldParent;}
}
function queuePlacementPreview(){if(previewFrame!==null)return;previewFrame=requestAnimationFrame(()=>{previewFrame=null;drawPlacementPreview();});}
function edit(e){const p=unproject(e),x=Math.round(p.wx),z=Math.round(p.wz),n={level:active,x,z},l=levelOf(project,active),edge=nearestEdge(p);if(!Number.isSafeInteger(x)||!Number.isSafeInteger(z))return;const hitEdge=tool==='decor'&&$('decor-kind').value==='wall'?document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-decor-edge]')?.dataset.decorEdge:null;const stamp=tool+(hitEdge||(['wall','door','window','fence','gate','face'].includes(tool)||(tool==='decor'&&$('decor-kind').value==='wall')?edgeKey(edge):key(x,z)));if(painted.has(stamp))return;painted.add(stamp);
  const groupFor=kind=>project.decorGroups.some(g=>g.id===$('decor-group').value&&g.kind===kind&&g.level===active&&g.area===$('decor-area').value)?$('decor-group').value:null;
  if(tool==='room'){
    if(!l.tiles[key(x,z)]){status('Choose a floor tile for each room corner.');return;}
    if(!roomStart||roomStart.level!==active){roomStart={level:active,x,z};render();return;}
    l.rooms??=[];l.rooms.push({id:crypto.randomUUID(),name:($('room-name').value.trim()||'Room '+(l.rooms.length+1)).slice(0,80),kind:$('room-kind').value,x:Math.min(x,roomStart.x),z:Math.min(z,roomStart.z),width:Math.abs(x-roomStart.x)+1,depth:Math.abs(z-roomStart.z)+1});roomStart=null;changed();return;
  }
  if(tool==='floor')for(const c of brushCells(x,z,+$('floor-size').value))l.tiles[key(c.x,c.z)]={walk:$('walk').checked,place:$('place').checked,material:$('floor-material').value,piece:c.piece,size:c.size,decorGroup:groupFor('floor')};
  if(tool==='gate'&&l.walls[edgeKey(edge)]?.kind==='fence')l.walls[edgeKey(edge)]={...l.walls[edgeKey(edge)],gate:true};
  else if(['wall','door','window','fence','gate'].includes(tool))l.walls[edgeKey(edge)]={...edge,kind:tool==='gate'?'fence':tool,...(tool==='gate'?{gate:true}:{}),...(tool==='door'?{doorStyle:$('door-style').value}:{}),...(tool==='window'?{windowStyle:$('window-style').value}:{}),collapse:$('collapse').checked,mount:tool==='wall'&&$('mount').checked,material:$('wall-material').value,...($('facing').value==='auto'?{}:{facing:+$('facing').value}),fenceStyle:$('fence-style').value,[decorField('wall',$('decor-area').value)]:groupFor('wall')};
  if(tool==='face'){const w=l.walls[edgeKey(edge)];if(w&&w.kind!=='fence')w.facing=-wallFacing(w,l.tiles);}
  if(tool==='decor'){const kind=$('decor-kind').value,group=$('decor-group').value;if(!group)return;const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-decor-edge]');const id=kind==='floor'?key(x,z):(hit?.dataset.decorEdge||edgeKey(edge)),target=(kind==='floor'?l.tiles:l.walls)[id];if(!decorRemoving||target?.[decorField(kind,$('decor-area').value)]===group)assignDecor(project,active,kind,id,decorRemoving?null:group,$('decor-area').value);}
  if(tool==='item'){if(!canPlace(project,n)){status('This tile is not available for item placement.');return;}l.items.push({x,z});}
  if(tool==='spawn'){if(!walkable(project,n)||portalAt(project,n)){status('Entry needs walkable floor outside the stairs.');return;}project.spawn=n;}
  if(tool==='stairs'){
    const end=stairBrush(n),problem=stairPlacementProblem(end);if(problem){status(problem);return;}
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
  let i=0,start=null,from={...avatar};avatarMoving=path.length>0;
  const frame=now=>{
   if(!playing)return;
   if(i>=path.length){timer=null;avatarMoving=false;render();return;}
   const step=path[i];
   if(step.via){avatar={...step.node};active=avatar.level;status(`Stair transfer → ${levelOf(project,active).name}`);i++;from={...avatar};start=null;render();timer=requestAnimationFrame(frame);return;}
   start??=now;const t=Math.min(1,(now-start)/240),dx=step.node.x-from.x,dz=step.node.z-from.z;
   if(dx||dz)avatarHeading={x:dx,z:dz};avatar={level:from.level,x:from.x+dx*t,z:from.z+dz*t};avatarPhase=(i+t)*Math.PI;
   if(t===1){avatar={...step.node};i++;from={...avatar};start=null;status(`Walking · X ${avatar.x}, Z ${avatar.z}`);}
   render();timer=requestAnimationFrame(frame);
  };timer=requestAnimationFrame(frame);
}
svg.addEventListener('contextmenu',e=>e.preventDefault());
svg.addEventListener('pointerdown',e=>{placementPointer={clientX:e.clientX,clientY:e.clientY};if((e.button===0&&panMode)||e.button===1||e.button===2||e.altKey){e.preventDefault();drag=false;svg.style.cursor='grabbing';panStart={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};svg.setPointerCapture(e.pointerId);drawPlacementPreview();return;}if(e.button!==0)return;if(playing){walkTo(e);return;}if(tool==='select'){selectPieceAt(e);return;}history();drag=true;painted.clear();svg.setPointerCapture(e.pointerId);edit(e);});
svg.addEventListener('pointermove',e=>{placementPointer={clientX:e.clientX,clientY:e.clientY};queuePlacementPreview();const p=unproject(e);$('coords').textContent=`X ${Math.round(p.wx)} · Z ${Math.round(p.wz)}`;if(panStart){pan={x:panStart.px+e.clientX-panStart.x,y:panStart.py+e.clientY-panStart.y};render();}else if(drag&&['floor','wall','fence','decor','erase'].includes(tool))edit(e);});
svg.addEventListener('pointerleave',()=>{placementPointer=null;drawPlacementPreview();});
svg.addEventListener('pointercancel',()=>{placementPointer=null;drawPlacementPreview();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(event,()=>{drag=false;panStart=null;svg.style.cursor=panMode?'grab':'';queuePlacementPreview();});
$('pan').onclick=()=>{panMode=!panMode;drag=false;panStart=null;render();};
for(const [id,icon,label] of tools){const b=document.createElement('button');b.dataset.tool=id;const glyph=document.createElement('b');glyph.textContent=icon;b.append(glyph,label);b.onclick=()=>{tool=id;if(id!=='room')roomStart=null;if(id!=='stairs')pending=null;render();$('tool-settings').scrollIntoView({block:'nearest',behavior:'smooth'});};$('tools').append(b);}
['N','E','S','W'].forEach((v,i)=>{const b=document.createElement('button');b.textContent=v;b.ariaLabel=`${['North','East','South','West'][i]} view`;b.onclick=()=>{rotation=i;render();};$('views').append(b);});
function travelHistory(from,to){if(!from.length||playing)return;to.push(clone());project=ensureDecor(from.pop());refreshDecor();if(!levelOf(project,active))active=project.levels[0].id;pending=null;changed();}
$('undo').onclick=()=>travelHistory(undo,redo);$('redo').onclick=()=>travelHistory(redo,undo);
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();return;}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)$('redo').click();else $('undo').click();}if(e.key==='Escape'){pending=null;roomStart=null;render();}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const d=e.shiftKey?640:180;if(e.key==='ArrowLeft')pan.x+=d;if(e.key==='ArrowRight')pan.x-=d;if(e.key==='ArrowUp')pan.y+=d;if(e.key==='ArrowDown')pan.y-=d;render();}});
let editingName=false;
$('name').onfocus=()=>{editingName=false;};
$('name').oninput=()=>{if(!editingName){history();editingName=true;}project.name=$('name').value.slice(0,120);persist();};
$('name').onchange=()=>{project.name=$('name').value.trim().slice(0,120)||'Untitled LW space';changed();};
for(const id of ['floor-size','floor-material','wall-material','door-style','window-style','facing','fence-style','stair-width','stair-style','stair-depth','stair-rise','axis'])$(id).addEventListener('input',queuePlacementPreview);
for(const id of ['overlay','wall-view','wall-opacity','zoom','show-grid','background-view'])$(id).oninput=render;
$('fit').onclick=()=>{pan={x:0,y:0};const l=levelOf(project,active),coords=Object.keys(l.tiles).map(k=>k.split(',').map(Number));if(coords.length){const raw=coords.map(([x,z])=>{const c=cameraGridPosition(x,z,rotation,{pivotX:4,pivotZ:3});return gridToScreen(c.rx-4,c.rz-3);}),x0=Math.min(...raw.map(p=>p.sx))-64,x1=Math.max(...raw.map(p=>p.sx))+64,y0=Math.min(...raw.map(p=>p.sy))-KIT.wallHeight-32,y1=Math.max(...raw.map(p=>p.sy))+32;const base=Math.min(1,svg.clientWidth/780,svg.clientHeight/720);$('zoom').value=Math.max(15,Math.min(160,100*Math.min((svg.clientWidth-60)/(x1-x0),(svg.clientHeight-80)/(y1-y0))/base));pan={x:-(x0+x1)*scale()/2,y:svg.clientHeight*(.5-.62)-(y0+y1)*scale()/2};}render();};
$('cancel-stair').onclick=()=>{pending=null;render();};
$('add-level').onclick=()=>{history();const id=`floor-${crypto.randomUUID()}`;project.levels.push({id,name:`Floor ${project.levels.length+1}`,tiles:{},walls:{},items:[]});active=id;changed();};
function stopPlay(){cancelAnimationFrame(timer);avatarMoving=false;timer=null;playing=false;avatar=null;}
$('play').onclick=()=>{if(playing)stopPlay();else{if(!project.spawn||!walkable(project,project.spawn)){status('Set a valid entry point before starting the walk test.');return;}playing=true;avatar={...project.spawn};active=avatar.level;pending=null;}render();};
function replace(p){issueFocus=null;undo=[];redo=[];stopPlay();project=ensureDecor(p);refreshDecor();active=p.levels[0].id;pending=null;roomStart=null;pan={x:0,y:0};changed();}
async function openAsNew(p){if(library){library.save(project);const result=await library.create(p);p=result.project;}replace(p);refreshProjects();}
$('new').onclick=()=>openAsNew(blankProject()).catch(e=>status(e.message));
$('new-top').onclick=()=>$('new').click();
$('demo').onclick=()=>openAsNew(demoProject()).catch(e=>status(e.message));
async function saveData(data,name,kind='project'){if(window.lwDesktop){const saved=await window.lwDesktop.saveProject(name,JSON.stringify(data,null,2),kind);status(saved?'File saved.':'Save cancelled.');return;}const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(name.replace(/[^a-z0-9]+/gi,'-')||'lw-space')+({project:'.lwspace.json',decor:'.lwdecor.json',build:'.lwbuild.json'}[kind]);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('File downloaded.');}
$('export-build').onclick=()=>{try{if(pending)throw Error('Finish or cancel the pending stair connection before building.');saveData(buildSpace(project),project.name,'build').catch(e=>status(e.message));}catch(e){if(!pending&&unreachableCells(project).length)showUnreachable();else status(e.message);}};
$('save').onclick=()=>saveData(project,project.name).catch(e=>status(e.message));
$('load').onclick=async()=>{if(window.lwDesktop){try{const raw=await window.lwDesktop.openProject();if(raw){await openAsNew(openSpaceFile(raw));status('Project loaded.');}}catch(e){status(e.message);}}else $('file').click();};$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{if(f.size>32_000_000)throw Error('Project is too large (maximum 32 MB).');const p=openSpaceFile(await f.text());await openAsNew(p);status('Project loaded.');}catch(e){status(e.message);}$('file').value='';};
for(const [id,materials] of [['floor-material',kit.floorMaterials],['wall-material',kit.wallMaterials]])for(const m of materials){const o=document.createElement('option');o.value=m.id;o.textContent=m.name;$(id).append(o);}
$('kit-count').textContent=`${kit.assets.length} original sprites · ${kit.floorMaterials.length} floor materials · ${kit.wallMaterials.length} wall finishes · 5 fence styles · single/double stairs`;
function refreshDecor(){
 const area=$('decor-area');area.querySelector('[value="outside"]').disabled=active!==project.levels[0].id;if(active!==project.levels[0].id&&area.value==='outside')area.value='inside';
 $('decor-scope').textContent=(area.value==='outside'?'Outside · ':'Inside · ')+(levelOf(project,active)?.name||'');
 const old=$('decor-group').value;$('decor-group').replaceChildren();const none=document.createElement('option');none.value='';none.textContent='Fixed material (not linked)';$('decor-group').append(none);
 for(const g of decorGroupsFor(project,active,area.value,$('decor-kind').value)){const o=document.createElement('option');o.value=g.id;o.textContent=g.name;$('decor-group').append(o);}
 if([...$('decor-group').options].some(o=>o.value===old))$('decor-group').value=old;
 const group=project.decorGroups.find(g=>g.id===$('decor-group').value);$('decor-editable').disabled=!group||playing;$('decor-editable').checked=!!group?.editable;
 if(document.activeElement!==$('decor-label-name'))$('decor-label-name').value=group?.name||'';
 for(const id of ['decor-label-name','rename-decor','paint-decor','remove-decor','decor-finish','apply-decor-finish'])$(id).disabled=!group||playing;
 for(const id of ['decor-new-name','add-decor'])$(id).disabled=playing;
 const members=group?Object.values(group.kind==='floor'?levelOf(project,active).tiles:levelOf(project,active).walls).filter(v=>v[decorField(group.kind,group.area)]===group.id).length:0;
 const finish=$('decor-finish'),finishOld=finish.value;finish.replaceChildren();for(const m of ($('decor-kind').value==='floor'?kit.floorMaterials:kit.wallMaterials)){const o=document.createElement('option');o.value=m.id;o.textContent=m.name||m.id;finish.append(o);}if([...finish.options].some(o=>o.value===finishOld))finish.value=finishOld;
 $('decor-members').textContent=group?`${group.name}: ${members} ${group.kind==='floor'?'floor tiles':'wall pieces'} assigned. Saved with this project.`:'Create or choose a label to start selecting surfaces.';
 $('done-decor').hidden=tool!=='decor';$('paint-decor').classList.toggle('active',tool==='decor'&&!decorRemoving);$('remove-decor').classList.toggle('active',tool==='decor'&&decorRemoving);
 $('decor-selection-help').textContent=tool==='decor'?(decorRemoving?'Click or drag over highlighted surfaces to remove them.':'Click or drag across as many tiles or walls as you want. Mint green surfaces belong to this label.'):'Labels are saved in your project, for the selected floor and surface type.';
}
$('decor-area').onchange=render;$('decor-group').onchange=()=>{$('overlay').value='decor';render();};
$('decor-editable').onchange=()=>{const g=project.decorGroups.find(g=>g.id===$('decor-group').value);if(!g||playing)return;history();g.editable=$('decor-editable').checked;changed();};
$('decor-kind').onchange=render;
function startDecorSelection(remove=false){if(playing||!$('decor-group').value)return;decorRemoving=remove;tool='decor';$('overlay').value='decor';pending=null;render();}
$('paint-decor').onclick=()=>startDecorSelection();$('remove-decor').onclick=()=>startDecorSelection(true);
$('done-decor').onclick=()=>{tool='select';$('overlay').value='none';render();status('Décor labels and their surfaces are saved with this project.');};
$('add-decor').onclick=()=>{if(playing)return;const name=$('decor-new-name').value.trim();if(!name){$('decor-new-name').focus();status('Type a décor label name above Create label.');return;}history();const g={id:'lw_'+crypto.randomUUID().replaceAll('-',''),name:name.slice(0,80),kind:$('decor-kind').value,editable:true,level:active,area:$('decor-area').value};project.decorGroups.push(g);refreshDecor();$('decor-group').value=g.id;$('decor-new-name').value='';changed();startDecorSelection();};
$('rename-decor').onclick=()=>{const g=project.decorGroups.find(g=>g.id===$('decor-group').value),name=$('decor-label-name').value.trim();if(playing||!g||!name)return;history();g.name=name.slice(0,80);changed();status('Décor label renamed.');};
$('apply-decor-finish').onclick=()=>{const g=project.decorGroups.find(g=>g.id===$('decor-group').value);if(!g||playing)return;history();const l=levelOf(project,active),field=decorField(g.kind,g.area);for(const v of Object.values(g.kind==='floor'?l.tiles:l.walls))if(v[field]===g.id)v[g.kind==='wall'&&g.area==='outside'?'exteriorMaterial':'material']=$('decor-finish').value;changed();status('Finish applied to this label’s surfaces.');};
$('export-decor').onclick=()=>saveData(decorManifest(project),project.name+'-decor-mapping','decor').catch(e=>status(e.message));
const toolFields={
 floor:['floor-size','floor-material','walk','place'],
 wall:['wall-material','facing','collapse','mount'],
 door:['door-style','wall-material','facing','collapse'],
 window:['window-style','wall-material','facing','collapse'],
 fence:['fence-style'],gate:['fence-style'],
 stairs:['stair-width','stair-style','stair-depth','stair-rise','axis']
};
function setupRightPanel(){
 const right=document.querySelector('aside.right'),tabs=document.createElement('div');tabs.className='sidebar-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Space settings');
 const panels={};
 for(const [id,label,help] of [['floors','Floors','Choose which floor to build on. Add another floor when you need one.'],['view','View','Change how you see your space while building or walking.'],['decor','Décor','Optional: choose which surfaces players can redecorate after game import.'],['finish','Finish','Walk around to check your layout, then save your project.']]){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.id='sidebar-tab-'+id;button.setAttribute('role','tab');button.setAttribute('aria-controls','sidebar-panel-'+id);
  const panel=document.createElement('section');panel.id='sidebar-panel-'+id;panel.className='sidebar-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
  const intro=document.createElement('p');intro.className='muted';intro.textContent=help;panel.append(intro);panels[id]=panel;right.append(panel);
  button.onclick=()=>{for(const b of tabs.children){const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));}for(const [key,p] of Object.entries(panels))p.hidden=key!==id;};
  tabs.append(button);
 }
 const move=(id,panel)=>panels[panel].append($(id).closest('.section'));
 const floorHeading=$('levels').previousElementSibling;panels.floors.append(floorHeading,$('levels'),$('add-level'));
 move('wall-view','view');move('decor-area','decor');move('stairs','floors');move('checks','finish');
 const notes=right.querySelector('details');if(notes)panels.finish.append(notes);
 const finishActions=document.createElement('div');finishActions.className='finish-actions';
 for(const [label,target] of [['Walk around my space','play'],['Save my project','save']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>$(target).click();finishActions.append(b);}
 const exportBuild=$('export-build'),buildNote=exportBuild.nextElementSibling;finishActions.append(exportBuild,buildNote);panels.finish.insertBefore(finishActions,panels.finish.children[1]);
 const advanced=document.createElement('details');advanced.className='section';const summary=document.createElement('summary');summary.textContent='Advanced checks';advanced.append(summary,$('overlay').closest('label'));panels.finish.append(advanced);
 const mapping=document.createElement('details');const mappingTitle=document.createElement('summary');mappingTitle.textContent='Advanced: export décor mapping';mapping.append(mappingTitle,$('export-decor'));panels.decor.append(mapping);
 right.replaceChildren(tabs,...Object.values(panels));tabs.firstElementChild.click();
 $('overlay').closest('label').firstChild.textContent='Highlight on the floor ';
 const names={none:'Normal appearance',walk:'Where players can walk',place:'Where items can go',mount:'Where wall items can go',decor:'Redecoratable surface groups'};for(const option of $('overlay').options)option.textContent=names[option.value];
 $('wall-view').closest('label').firstChild.textContent='Walls while walking ';
 for(const [value,label] of Object.entries({auto:'Lower walls around me','auto-fade':'Make walls around me transparent',full:'Keep walls at full height',cut:'Show cutaway walls'}))$('wall-view').querySelector(`option[value="${value}"]`).textContent=label;
 $('decor-kind').closest('label').firstChild.textContent='2. What can change? ';
 $('decor-area').closest('label').firstChild.textContent='1. Choose an area ';
 $('decor-area').closest('.section').querySelector('.eyebrow').textContent='PLAYER DECORATING';
 const decorHelp=$('paint-decor').nextElementSibling;if(decorHelp?.tagName==='P')decorHelp.textContent='Choose or add a group, enable editing, then click Choose surfaces and paint the floors or walls that should change together. Your choices save with the project. Game import is still being connected.';
 $('decor-group').closest('label').firstChild.textContent='3. Choose a décor label ';
 $('paint-decor').textContent='Add tiles / walls to label';$('add-decor').textContent='Create label & select surfaces';$('export-build').textContent='Export space build';
 const viewSection=$('wall-view').closest('.section');viewSection.querySelector('.eyebrow').textContent='DISPLAY OPTIONS';
 const explanations=[...viewSection.querySelectorAll('p')];if(explanations[0])explanations[0].textContent='Lower values make the walls easier to see through.';if(explanations[1])explanations[1].textContent='Use Walk test above the canvas to try these wall settings.';
 const stairHelp=$('stairs').closest('.section').querySelector('p');if(stairHelp)stairHelp.textContent='These stairs link your floors. In Walk test, click the arrow at the stair base to travel to the other floor.';
 $('wall-opacity').closest('label').dataset.fadeSetting='true';if(explanations[0])explanations[0].dataset.fadeSetting='true';
}
function refreshSimpleView(){for(const el of document.querySelectorAll('[data-fade-setting]'))el.hidden=$('wall-view').value!=='auto-fade';}
function setupToolSettings(){
 const panel=$('tool-settings');
 for(const [control,id] of [['room-name','room-tool-settings'],['piece-kind','piece-tool-settings']]){const section=$(control).closest('.section');section.id=id;panel.append(section);}
 $('building-help').hidden=true;
}
function refreshToolSettings(){
 const fields=toolFields[tool]||[];
 for(const id of new Set(Object.values(toolFields).flat()))$(id).closest('label').hidden=!fields.includes(id);
 $('room-tool-settings').hidden=tool!=='room';$('piece-tool-settings').hidden=tool!=='select';
 const name=tools.find(t=>t[0]===tool)?.[2]||'Décor';$('tool-settings-title').textContent=name+' options';
 const help={floor:'Choose a size and finish, then move over the grid to preview. Click or drag to place.',wall:'Choose a finish and facing. A transparent wall snaps to the nearest floor edge.',door:'Choose the doorway shape, then preview it on a floor edge.',window:'Choose the window style, then preview it on a floor edge.',fence:'Choose a fence style, then move over an edge to preview. Click or drag to build.',gate:'Preview a gate on a floor edge. Placing over a fence keeps its existing style.',stairs:'Choose width, style and direction. Preview the flight, click its base, then switch floors and place the linked landing. Red marks a blocked position.',room:'Name the area and choose its type. Click two corners to outline it.',select:'Click a placed stair or window to edit it below. Stair rotation affects only the current floor.',face:'Click a wall edge to swap its finished face and back shadow.',item:'Preview a test item on a placeable tile. Red marks a blocked position.',spawn:'Preview the entry flag on a free walkable tile. The flag is only an editor marker.',erase:'Click an item or stair base to remove it. Near an edge, removes the wall; otherwise removes floor.',decor:'Choose a floor or wall group under Décor editor links, then paint its surfaces.'};
 $('tool-settings-help').textContent=help[tool]||'';
}
let pieceSelection='';
function refreshPieces(){
 const kind=$('piece-kind').value,list=decorPieces(project,active,kind),old=$('piece-target').value;
 $('piece-target').replaceChildren();for(const t of list){const o=document.createElement('option');o.value=t.id;o.textContent=t.label;$('piece-target').append(o);}if(list.some(t=>t.id===old))$('piece-target').value=old;
 const token=active+':'+kind+':'+$('piece-target').value+':'+JSON.stringify(list.find(t=>t.id===$('piece-target').value)?.value);
 if(token!==pieceSelection){pieceSelection=token;loadPieceControls();}
 $('piece-rotation').hidden=kind!=='stair';for(const id of ['rotate-piece-left','rotate-piece-right','rotate-piece-reverse'])$(id).disabled=playing||!list.length;
 for(const id of ['piece-target','piece-style','piece-color','piece-accent','apply-piece','reset-piece'])$(id).disabled=playing||!list.length;
 $('piece-note').textContent=list.length?'Style edits keep the footprint. Rotation changes only this floor’s stair direction; its linked destination stays unchanged.':kind==='stair'?'No styled stairs on this floor. Place a staircase to edit it.':'No windows on this floor. Place a window wall to edit it.';
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
function selectPieceAt(e){
 const hit=e.target.closest('[data-piece-id]');let kind=hit?.dataset.pieceKind,id=hit?.dataset.pieceId;
 if(!id){const p=unproject(e),x=Math.round(p.wx),z=Math.round(p.wz);
  const stair=decorPieces(project,active,'stair').find(t=>[...triggerCells(t.value),...stairFlightCells(t.value)].some(c=>c.x===x&&c.z===z));
  if(stair){kind='stair';id=stair.id;}else{const edge=nearestEdge(p);if(levelOf(project,active).walls[edgeKey(edge)]?.kind==='window'){kind='window';id=edgeKey(edge);}}
 }
 if(!id){status('Click a staircase or window, or choose a piece in the right-hand editor.');return;}
 $('piece-kind').value=kind;refreshPieces();$('piece-target').value=id;pieceSelection='';refreshPieces();
 $('piece-target').scrollIntoView({block:'nearest',behavior:'smooth'});status('Selected '+kind+'. Use the controls below Select / edit to change it.');render();
}
function rotatePiece(turn){
 if(playing||$('piece-kind').value!=='stair')return;
 const id=$('piece-target').value,stair=project.stairs.find(s=>id===s.id+':a'||id===s.id+':b');if(!stair)return;
 const side=id===stair.id+':a'?'a':'b';
 try{const next=rotatedStairEnd(project,stair.id,side,turn);history();stair[side]=next;changed();status('Stairs rotated. The connection and the other floor’s landing are unchanged.');}catch(e){status(e.message);}
}
$('rotate-piece-reverse').onclick=()=>rotatePiece(2);
$('rotate-piece-left').onclick=()=>rotatePiece(-1);$('rotate-piece-right').onclick=()=>rotatePiece(1);
$('piece-kind').onchange=()=>{pieceSelection='';refreshPieces();};$('piece-target').onchange=()=>{pieceSelection='';refreshPieces();};
$('apply-piece').onclick=()=>{if(playing)return;const kind=$('piece-kind').value,id=$('piece-target').value;if(!id)return;history();const appearance=kind==='window'?{frameColor:$('piece-color').value,glassColor:$('piece-accent').value}:{bodyColor:$('piece-color').value,railColor:$('piece-accent').value};applyPieceDecor(project,active,kind,id,$('piece-style').value,appearance);changed();status('Style and colors updated on the selected '+kind+'.');};
$('reset-piece').onclick=()=>{if(playing)return;const t=decorPieces(project,active,$('piece-kind').value).find(t=>t.id===$('piece-target').value);if(!t)return;history();delete t.value.appearance;changed();status('Default colors restored.');};
setupToolSettings();setupRightPanel();refreshDecor();
new ResizeObserver(render).observe(svg);render();status(savedMessage);

function saveForUpdate(){if(reviewMode)return;if(pending)throw Error('Finish or cancel your stair connection first.');project.name=$('name').value.trim().slice(0,120)||'Untitled LW space';const data=JSON.stringify(project);sessionStorage.setItem('lw-update-recovery',data);if(!library)throw Error('Save your project file before updating.');library.save(project);}
versionGate.setProjectActions({pause:()=>{stopPlay();drag=false;panStart=null;render();},save:saveForUpdate,backup:()=>saveData(project,project.name)});
initWebApp(saveForUpdate);

function refreshProjects(){
 const picker=$('project-picker'),deleted=$('deleted-project-picker'),selected=picker.value;picker.replaceChildren();deleted.replaceChildren();
 const rows=library?.list()||[],trash=library?.deleted()||[];
 for(const [items,select] of [[rows,picker],[trash,deleted]])for(const r of items){const o=document.createElement('option');o.value=r.id;o.textContent=(r.project.name||'Untitled LW space')+' · '+new Date(r.updated).toLocaleString();select.append(o);}
 picker.value=rows.some(r=>r.id===selected)?selected:library?.current||'';
 picker.disabled=!rows.length;deleted.disabled=!trash.length;$('open-project').disabled=!rows.length;$('delete-project').disabled=!rows.length;$('restore-project').disabled=!trash.length;
}
$('delete-project').onclick=async()=>{
 if(!library)return;try{const id=$('project-picker').value,r=library.get(id),current=id===library.current;
 if(!confirm(`Delete “${r.project.name}” saved ${new Date(r.updated).toLocaleString()}?\nYou can restore it from Deleted projects on this device.${current?' A blank project will open in its place.':''}`))return;
 if(current)library.save(project);await library.trash(id);
 if(current){const result=await library.create(blankProject());replace(result.project);}
 refreshProjects();status(`“${r.project.name}” moved to Deleted projects. You can restore it below the saved-project list.`);
 }catch(e){status(e.message);}
};
$('restore-project').onclick=()=>{if(!library)return;try{const r=library.restore($('deleted-project-picker').value);refreshProjects();$('project-picker').value=r.id;status(`“${r.project.name}” restored. Choose Open selected project to edit it.`);}catch(e){status(e.message);}};
$('open-project').onclick=async()=>{if(!library)return;try{const id=$('project-picker').value;library.save(project);const result=await library.open(id);replace(result.project);refreshProjects();status(result.copied?'That project is open elsewhere. You are editing an independent tab copy.':'Project opened in this tab.');}catch(e){status(e.message);}};
$('refresh-projects').onclick=refreshProjects;
window.addEventListener('storage',e=>{if(e.key?.startsWith('lw-studio-project:')||e.key?.startsWith('lw-studio-trash:'))refreshProjects();});
$('name').addEventListener('change',refreshProjects);
refreshProjects();
