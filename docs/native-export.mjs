import * as geo from './geometry.mjs';
import * as model from './model.mjs';
import {openSpaceFile,buildSpace} from './build.mjs';
import {orderFaces} from './face-order.mjs';
import {cameraGridPosition,gridToScreen} from './native-coordinate.mjs';
import kit from './kit.mjs';
import {wallFaces} from './architecture.mjs';
import {roomLayout} from './rooms.mjs';
import {splitFace} from './face-order.mjs';
export const NATIVE_ORIGIN={x:.165,z:-.1356};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const hash=async (text,encoding)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoding==='base64'?Uint8Array.from(atob(text),c=>c.charCodeAt(0)):new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
export async function createNativePackage(input,{loadFloorImage,rasterize,onProgress=()=>{}}){
const project=openSpaceFile(input),build=buildSpace(project),name='@MODEL@',prefix=`spaces/models/${name}/`,files={};
const put=(name,content,encoding='utf8')=>{files[name]={encoding,content};};
const cache=new Map();
const rooms=project.levels.map(l=>roomLayout(l).map(r=>({...r,cells:[...r.cells],boundaries:r.boundaries.map(b=>({edge:model.edgeKey(b.wall),outward:b.outward}))})));
const coverage=[];
const levelOffsets=[];let bottom=0;for(const l of build.scene.levels){levelOffsets.push(bottom-l.bounds.minZ);bottom+=l.bounds.maxZ-l.bounds.minZ+12;}

const projectPoint=(v,rotation,origin)=>{const c=cameraGridPosition(v[0]-origin[0]+NATIVE_ORIGIN.x,v[1]-origin[1]+NATIVE_ORIGIN.z,rotation,{pivotX:0,pivotZ:0}),p=gridToScreen(c.rx,c.rz);return [p.sx,p.sy-(v[2]||0)];};
let serial=0;const instances=new Map(),zones=[],manifest=[];
async function sprite({id,anchor,level,faces,box,kind='visual',walk=false,place=false,collapse=false,layer='main',floorImage=null,decorGroup=null,exteriorDecorGroup=null,clip=null,edge=null,join=null}){
 const placeAsset=assetId=>{if(!instances.has(assetId))instances.set(assetId,new Map());const layers=instances.get(assetId);if(!layers.has(layer))layers.set(layer,[]);layers.get(layer).push(`<i studioLevel="${level}" studioEdge="${edge||''}" studioJoin="${join?.join('|')||''}" x="${anchor[0]}" z="${anchor[1]+levelOffsets[level]}" a="0"/>`);};
 let cacheKey=floorImage?JSON.stringify([floorImage,walk,place,decorGroup]):null;
 if(cacheKey&&cache.has(cacheKey)){const cached=cache.get(cacheKey);placeAsset(cached.id);manifest.push({...cached,anchor,level,edge,join});return;}

 const states=collapse?['Up','Down']:['Up'],frames=[];let fw=1,fh=1;
 for(const state of states)for(let r=0;r<4;r++){
  const polygons=faces?faces(r,state).map(f=>({...f,screen:f.vertices.map(v=>projectPoint(v,r,anchor))})):[];
  const pts=polygons.flatMap(f=>f.screen),center=projectPoint([...anchor,0],r,anchor);if(floorImage)pts.push([center[0]-65,center[1]-33],[center[0]+65,center[1]+33]);
  const x0=Math.floor(Math.min(0,...pts.map(p=>p[0])))-2,y0=Math.floor(Math.min(0,...pts.map(p=>p[1])))-2;
  const w=Math.ceil(Math.max(0,...pts.map(p=>p[0])))-x0+2,h=Math.ceil(Math.max(0,...pts.map(p=>p[1])))-y0+2;fw=Math.max(fw,w);fh=Math.max(fh,h);
  frames.push({r,state,x0,y0,w,h,polygons,center});
 }
 if(!cacheKey){cacheKey=JSON.stringify({kind,box,walk,place,collapse,decorGroup,exteriorDecorGroup,clip:clip?.map(v=>v.map((n,i)=>i<2?n-anchor[i]:n)),frames:frames.map(f=>({r:f.r,state:f.state,polygons:f.polygons.map(p=>({screen:p.screen.map(v=>v.map(n=>Math.round(n*1e6)/1e6)),attrs:Object.fromEntries(Object.entries(p.attrs||{fill:p.color,stroke:p.color,'stroke-width':.4}).filter(([k])=>!k.startsWith('data-')&&k!=='pointer-events'))}))}))});
 if(cache.has(cacheKey)){const cached=cache.get(cacheKey);placeAsset(cached.id);manifest.push({...cached,anchor,level,edge,join});return;}}
 const svgFrames=[];const imageData=floorImage?await loadFloorImage(floorImage):null;
 for(let i=0;i<frames.length;i++){
  const f=frames[i];const floorColor=kit.floorMaterials.find(m=>floorImage?.endsWith(`floor-${m.id}-1x1.png`))?.color||'#c1c5b8';let body=floorImage?`<g transform="translate(${f.center.join(' ')})"><polygon points="-64,0 0,-32 64,0 0,32" fill="${floorColor}" stroke="${floorColor}" stroke-width="1"/><image href="data:image/png;base64,${imageData}" x="-64" y="-32" width="128" height="64"/></g>`:'';
  body+=f.polygons.map(p=>`<polygon points="${p.screen.map(p=>p.join(',')).join(' ')}" ${Object.entries(p.attrs||{fill:p.color,stroke:p.color,'stroke-width':.4}).filter(([k])=>!k.startsWith('data-')&&k!=='pointer-events').map(([k,v])=>`${k}="${escape(v)}"`).join(' ')}/>`).join('');
  if(clip){const points=clip.map(v=>projectPoint(v,f.r,anchor));body=`<defs><clipPath id="clip${i}"><polygon points="${points.map(p=>p.join(',')).join(' ')}"/></clipPath></defs><g clip-path="url(#clip${i})">${body}</g>`;}
  svgFrames.push(`<g transform="translate(${(i%4)*fw-f.x0} ${Math.floor(i/4)*fh-f.y0})">${body}</g>`);
 }
 const atlas=`<svg xmlns="http://www.w3.org/2000/svg" width="${fw*4}" height="${fh*states.length}">${svgFrames.join('')}</svg>`;
 put(id+'.png',await rasterize(atlas),'base64');
 if(box)box=box.map(p=>[p[0]+NATIVE_ORIGIN.x,p[1],p[2]+NATIVE_ORIGIN.z]);
 const texture=['wall','join','opening'].includes(kind)?'wall_front':'body',boxXml=box?`<box min="${box[0].join(',')}" max="${box[1].join(',')}"/>`:'';
 const layers=states.map((state,row)=>`<layer id="${state==='Up'?'front':'low'}" texture="${texture}">${frames.filter(f=>f.state===state).map(f=>`<view angle="${45+f.r*90}" col="${f.r}" row="${row}" x="${f.x0}" y="${f.y0}"/>`).join('')}</layer>`).join('');
 const frameXml=states.map(s=>`<frame id="${s}"><layerref id="${s==='Up'?'front':'low'}"/></frame>`).join('');
 const xml=`<item.SpriteItem id="${id}" name="LW Studio ${kind}" gridActive="${walk||kind==='solid'}" ${['wall','join','opening'].includes(kind)?'dropTargetType="wall"':place?'dropTargetType="floor" placement="floor"':''}><volume>${boxXml}</volume><data><entry key="studioKind" value="${kind}"/>${kind==='wall'&&box?'<entry key="gridEdge" value="true"/>':''}</data><textures><texture id="${texture}" source="${prefix+id}.png" cols="4" rows="${states.length}"/></textures><nodes><node id="Node" x="0" y="0" z="0">${boxXml}<layers>${layers}</layers><frames>${frameXml}</frames><animations><animation id="default"><frameref id="Up"/></animation>${states.map(s=>`<animation id="${s}"><frameref id="${s}"/></animation>`).join('')}</animations></node></nodes></item.SpriteItem>`;
 put(id+'.xml',xml);placeAsset(id);manifest.push({id,kind,level,anchor,box,frames:frames.map(({r,state,x0,y0})=>({r,state,x0,y0})),fw,fh,decorGroup,exteriorDecorGroup,edge,join});if(cacheKey)cache.set(cacheKey,manifest.at(-1));onProgress(manifest.length);
}
for(const [li,l]of project.levels.entries()){
 const wells=project.stairs.filter(s=>geo.stairLevels(project,s).upper.level===l.id).map(s=>geo.stairwell(project,s,0)).filter(Boolean);
 const holes=new Set(wells.flatMap(w=>w.cells.map(c=>model.key(c.x,c.z))));
 coverage.push({level:l.id,floorCells:Object.keys(l.tiles).filter(k=>!holes.has(k)),openings:[...holes]});
 for(const [k,t]of Object.entries(l.tiles)){
  if(holes.has(k))continue;
  const [x,z]=k.split(',').map(Number),n={level:l.id,x,z};
  await sprite({id:`floor_${serial++}`,anchor:[x,z],level:li,kind:'floor',walk:model.walkable(project,n),place:t.place,layer:model.walkable(project,n)?'ground':'noaccess',box:[[-.5,-.01,-.5],[.5,0,.5]],decorGroup:t.decorGroup||null,floorImage:`assets/floor-${t.material||'blank'}-1x1.png`});
 }
 for(const w of Object.values(l.walls).filter(w=>w.kind==='fence'))await sprite({id:`shadow_${serial++}`,anchor:[w.x,w.z],level:li,kind:'shadow',layer:'ground',faces:()=>geo.fenceShadowFaces({...w,gateOpen:!!w.gate},geo.fencePostOwners(w,Object.values(l.walls)))});
 const corners=geo.wallCorners(l.walls);
 for(const w of Object.values(l.walls)){
  const [a,b]=geo.wallEnds(w),x=w.x,z=w.z;
  const gate=w.kind==='door'||w.gate;
  const box=gate?null:[[Math.min(a[0],b[0])-x-.04,0,Math.min(a[1],b[1])-z-.04],[Math.max(a[0],b[0])-x+.04,w.kind==='fence'?1.1:3.5,Math.max(a[1],b[1])-z+.04]];
  await sprite({id:`${w.kind}_${serial++}`,anchor:[x,z],level:li,kind:gate?(w.kind==='door'?'opening':'gate'):'wall',box,edge:model.edgeKey(w),decorGroup:w.decorGroup||null,exteriorDecorGroup:w.exteriorDecorGroup||null,collapse:w.collapse&&w.kind!=='fence',faces:(r,state)=>{
   if(w.kind==='fence')return geo.fenceFaces({...w,gateOpen:!!w.gate},r,geo.fencePostOwners(w,Object.values(l.walls)));
   const faces=[],polygon=(vertices,attrs)=>faces.push({vertices,attrs});
   const paint=()=>{const exterior=geo.wallSide({...w,facing:geo.wallFacing(w,l.tiles)},r)==='back',material=exterior?(w.exteriorMaterial||w.material):w.material;return{back:false,opacity:1,fill:kit.wallMaterials.find(m=>m.id===material)?.color||'#d3d7c9'};};
   const sx=[1,1,-1,-1][r],sz=[1,-1,-1,1][r],selection=new Set(rooms[li].filter(room=>room.kind==='indoor').flatMap(room=>room.boundaries.filter(b=>{const wall=l.walls[b.edge];return wall?.collapse&&b.outward*(wall.axis==='x'?sx:sz)>0;}).map(b=>b.edge)));
   faces.push(...wallFaces(w,{level:l,rotation:r,corners,paint:paint(),collapsed:state==='Down',cutSelection:selection}));
   return orderFaces(faces,r);
  }});
 }
 for(const c of corners)await sprite({id:`corner_${serial++}`,anchor:[c.x,c.z],level:li,kind:'join',join:c.walls.map(model.edgeKey),box:[[-geo.KIT.wallThickness/2,0,-geo.KIT.wallThickness/2],[geo.KIT.wallThickness/2,c.height/64,geo.KIT.wallThickness/2]],collapse:c.walls.some(w=>w.collapse),faces:(r,state)=>geo.wallCornerFaces({...c,height:state==='Down'?26:c.height},r).map(f=>{const w=f.wall,exterior=geo.wallSide({...w,facing:geo.wallFacing(w,l.tiles)},r)==='back';return {...f,color:f.part==='cap'?'#e2e7d9':kit.wallMaterials.find(m=>m.id===(exterior?(w.exteriorMaterial||w.material):w.material))?.color||'#d3d7c9'};})});
 for(const s of project.stairs){const end=[s.a,s.b].find(e=>e.level===l.id);if(!end)continue;const levels=geo.stairLevels(project,s),lower=levels.lower===end;
  if(lower){
   const views=Array.from({length:4},(_,r)=>geo.stairFaces(end,r)),all=views.flat().flatMap(f=>f.vertices);
   const minX=Math.floor(Math.min(...all.map(v=>v[0]))+.5),maxX=Math.floor(Math.max(...all.map(v=>v[0]))+.5),minZ=Math.floor(Math.min(...all.map(v=>v[1]))+.5),maxZ=Math.floor(Math.max(...all.map(v=>v[1]))+.5);
   for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
    const parts=views.map(faces=>clipFacesToCell(faces,x,z));if(!parts.some(p=>p.length))continue;
    const vertices=parts.flat().flatMap(f=>f.vertices),h=Math.max(...vertices.map(v=>v[2]))/64;
    await sprite({id:`stair_${serial++}`,anchor:[x,z],level:li,faces:r=>orderFaces(parts[r],r),kind:'stair',box:[[-.5,Math.min(...vertices.map(v=>v[2]))/64,-.5],[.5,h,.5]]});
   }
  }else{
   const well=geo.stairwell(project,s,0);if(!well)continue;
   const below=model.levelOf(project,well.lower.level);
   await sprite({id:`well_${serial++}`,anchor:[end.x,end.z],level:li,kind:'well',layer:'ground',clip:well.opening,faces:r=>{
    const w=geo.stairwell(project,s,r),faces=Object.entries(below.tiles).map(([k,t])=>{const [x,z]=k.split(',').map(Number);return{color:kit.floorMaterials.find(m=>m.id===(t.material||'blank'))?.color||'#c1c5b8',vertices:[[x-.5,z-.5],[x+.5,z-.5],[x+.5,z+.5],[x-.5,z+.5]].map(p=>w.belowPoint(...p))};});
    return [...faces,...orderFaces(w.faces,r)];
   }});
  }
 }
 for(const item of l.items)await sprite({id:`item_${serial++}`,anchor:[item.x,item.z],level:li,kind:'solid',box:[[-.3,0,-.3],[.3,35/64,.3]],faces:r=>geo.itemFaces(item,r)});
 const bounds=build.scene.levels[li].bounds;zones.push(`<zone id="lw_level_${li}" type="room" bounds="${bounds.minX-.5},${bounds.minZ+levelOffsets[li]-.5},${bounds.maxX-bounds.minX+1},${bounds.maxZ-bounds.minZ+1}"/>`);
}
const landings={};
for(const [i,s]of project.stairs.entries())for(const [a,b,side,other]of [[s.a,s.b,'a','b'],[s.b,s.a,'b','a']]){
 const li=project.levels.findIndex(l=>l.id===a.level),sign=a.rise===1?1:-1;
 landings[`lw_stair_${i}_${side}`]=Array.from({length:a.width===1?1:2},(_,n)=>({x:a.x+(a.axis==='x'?n:-sign),z:a.z+levelOffsets[li]+(a.axis==='z'?n:-sign)}));
 zones.push(`<zone id="lw_stair_${i}_${side}" type="portal" link="lw_stair_${i}_${other}" bounds="${a.x-.45},${a.z+levelOffsets[li]-.45},${a.axis==='x'?(a.width||2)-.1:.9},${a.axis==='z'?(a.width||2)-.1:.9}" angle="${a.angle||0}"/>`);
}
const spawn=project.spawn,si=project.levels.findIndex(l=>l.id===spawn.level);
const contract={version:2,origin:NATIVE_ORIGIN,levelOffsets,rooms,landings,levels:project.levels.map(l=>({id:l.id,walls:l.walls})),decor:build.decor};
const xml=`<space.Space id="@MODEL_ID@" studioFormat="2" name="${escape(project.name)}" desc="LittleWorlds Space Studio test import" diagonal="true" spawn="${spawn.x},0,${spawn.z+levelOffsets[si]}" spawnAngle="90"><studio>${escape(JSON.stringify(contract))}</studio><layers><layer id="main" sortMethod="accurate" gridValue="9"/><layer id="ground" gridValue="1"/><layer id="noaccess" gridValue="0"/></layers><sprites>${[...instances].map(([id,layers])=>`<sprite source="${prefix+id}.xml"><instances>${[...layers].map(([layer,placements])=>`<layerref id="${layer}">${placements.join('')}</layerref>`).join('')}</instances></sprite>`).join('')}</sprites><zones>${zones.join('')}</zones></space.Space>`;
put('model.xml',xml);
const native={format:'lw-native-assets',version:2,origin:NATIVE_ORIGIN,levelOffsets,rooms,coverage,gateBehavior:'open-passage',manifest,files};
for(const file of Object.values(files))file.sha256=await hash(file.content,file.encoding);
return {...build,version:2,requires:'lw-studio-game-importer-v2',native};
}

export function clipFacesToCell(faces,x,z){
 let out=faces;
 for(const [normal,d,side]of [[[1,0,0],x-.5,'front'],[[1,0,0],x+.5,'back'],[[0,1,0],z-.5,'front'],[[0,1,0],z+.5,'back']])out=out.flatMap(f=>{const split=splitFace(f,{normal,d});return split.same?[split.same]:split[side]?[split[side]]:[];});
 return out;
}
export const browserRasterizer={
 async loadFloorImage(path){const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw Error(`Missing floor texture: ${path}`);return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;response.blob().then(blob=>reader.readAsDataURL(blob),reject);});},
 async rasterize(svg){const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Could not render an export asset.'));image.src=url;});const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);return canvas.toDataURL('image/png').split(',')[1];}finally{URL.revokeObjectURL(url);}},
};
