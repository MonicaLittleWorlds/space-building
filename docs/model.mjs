export const key = (x,z) => `${x},${z}`;
export const nodeKey = p => `${p.level}:${p.x},${p.z}`;
export const edgeKey = e => `${e.axis}:${e.x},${e.z}`;
export const levelOf = (p,id) => p.levels.find(l=>l.id===id);
export function blankProject() {
  return {format:'lw-space-studio',version:1,name:'Untitled LW space',levels:[{id:'floor-1',name:'Ground floor',tiles:{},walls:{},items:[]}],stairs:[],spawn:null};
}
export function demoProject() {
  const p=blankProject(); p.name='The blank-slate workshop';
  p.levels.push({id:'floor-2',name:'Upper floor',tiles:{},walls:{},items:[]});
  for(const [i,l] of p.levels.entries()) {
    l.rooms=[{id:'main-room',name:'Main room',kind:'indoor',x:0,z:0,width:9,depth:7}];
    for(let x=0;x<9;x++) for(let z=0;z<7;z++) {
      if(i===1&&x>2&&x<6&&z>2&&z<5) continue;
      l.tiles[key(x,z)]={walk:true,place:true};
    }
    for(let x=0;x<9;x++) l.walls[edgeKey({axis:'z',x,z:0})]={axis:'z',x,z:0,kind:'wall',collapse:true,mount:true};
    for(let z=0;z<7;z++) l.walls[edgeKey({axis:'x',x:0,z})]={axis:'x',x:0,z,kind:'wall',collapse:true,mount:true};
  }
  p.levels[0].walls['x:4,3']={axis:'x',x:4,z:3,kind:'door',collapse:true,mount:false};
  p.stairs=[{id:'stairs-1',a:{level:'floor-1',x:6,z:1,axis:'x',angle:90},b:{level:'floor-2',x:6,z:1,axis:'x',angle:90}}];
  p.spawn={level:'floor-1',x:2,z:4}; return p;
}
export function triggerCells(end) {return Array.from({length:end.width===1?1:2},(_,i)=>({...end,x:end.x+(end.axis==='x'?i:0),z:end.z+(end.axis==='z'?i:0)}));}
export function stairFlightCells(end){if(!end.style)return [];const sign=end.rise===1?1:-1;return triggerCells(end).flatMap(c=>Array.from({length:end.depth||2},(_,i)=>i+1).map(d=>({...c,x:c.x+(end.axis==='z'?sign*d:0),z:c.z+(end.axis==='x'?sign*d:0)})));}
export function stairSolidAt(p,n){return p.stairs.some(s=>[s.a,s.b].some(e=>stairFlightCells(e).some(c=>nodeKey(c)===nodeKey(n))));}
export function portalAt(p,n) {for(const s of p.stairs) for(const [a,b] of [[s.a,s.b],[s.b,s.a]]) if(triggerCells(a).some(c=>nodeKey(c)===nodeKey(n))) return {id:s.id,from:a,to:b}; return null;}
export function walkable(p,n) {const l=levelOf(p,n.level);return !!l?.tiles[key(n.x,n.z)]?.walk&&!l.items.some(i=>i.x===n.x&&i.z===n.z)&&!stairSolidAt(p,n);}
export function canPlace(p,n) {const l=levelOf(p,n.level);return !!l?.tiles[key(n.x,n.z)]?.place&&!l.items.some(i=>i.x===n.x&&i.z===n.z)&&!portalAt(p,n)&&!stairSolidAt(p,n)&&nodeKey(p.spawn||{})!==nodeKey(n);}
export function blocked(l,a,b) {const e=a.x!==b.x?{axis:'x',x:Math.max(a.x,b.x),z:a.z}:{axis:'z',x:a.x,z:Math.max(a.z,b.z)};const w=l.walls[edgeKey(e)];return ['wall','fence','window'].includes(w?.kind)&&!(w.kind==='fence'&&w.gate===true);}
// Stair bases are graph links. Same-floor routes may cross them; walkRoute
// activates a link when the base is the chosen endpoint. Arrival is stable.
export function transitions(p,n,allowPortals=true) {
  const l=levelOf(p,n.level), result=[];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const next={level:n.level,x:n.x+dx,z:n.z+dz};
    if(!walkable(p,next)||blocked(l,n,next)) continue;
    result.push({node:next});
  }
  const portal=portalAt(p,n);
  if(allowPortals&&portal&&walkable(p,portal.to))result.push({node:{level:portal.to.level,x:portal.to.x,z:portal.to.z},via:n});
  return result;
}
export function route(p,start,goal) {
  if(!start||!walkable(p,start)||!walkable(p,goal)) return null;
  const queue=[start], seen=new Map([[nodeKey(start),null]]);
  for(let i=0;i<queue.length;i++) {
    const current=queue[i];
    if(nodeKey(current)===nodeKey(goal)) {
      const steps=[]; let k=nodeKey(current);
      while(seen.get(k)) {const prev=seen.get(k);steps.unshift(prev.step);k=prev.parent;} return steps;
    }
    for(const step of transitions(p,current,start.level!==goal.level)) {const k=nodeKey(step.node);if(!seen.has(k)) {seen.set(k,{parent:nodeKey(current),step});queue.push(step.node);}}
  } return null;
}
export function walkRoute(p,start,goal) {
  const path=route(p,start,goal);if(!path)return null;
  const portal=portalAt(p,goal);
  if(portal&&nodeKey(start)!==nodeKey(goal)) {
    if(!walkable(p,portal.to))return null;
    path.push({node:{level:portal.to.level,x:portal.to.x,z:portal.to.z},via:goal});
  }
  return path;
}
export function validate(p) {
  const issues=[];
  if(!p.spawn||!walkable(p,p.spawn)) issues.push('Set an entry point on walkable, unoccupied floor.');
  for(const s of p.stairs) for(const e of [s.a,s.b]) if(triggerCells(e).some(c=>!walkable(p,c))) issues.push(`${s.id}: trigger cells need walkable, unoccupied floor.`);
  for(const l of p.levels) for(const i of l.items) if(!l.tiles[key(i.x,i.z)]?.place) issues.push(`${l.name}: a test item is outside a placeable tile.`);
  if(p.spawn&&walkable(p,p.spawn)) {
    const queue=[p.spawn],seen=new Set([nodeKey(p.spawn)]),reached=new Set(seen);
    for(let i=0;i<queue.length;i++) for(const t of transitions(p,queue[i])) {if(t.via)reached.add(nodeKey(t.via));reached.add(nodeKey(t.node));if(!seen.has(nodeKey(t.node))) {seen.add(nodeKey(t.node));queue.push(t.node);}}
    let unreachable=0;
    for(const l of p.levels) for(const k of Object.keys(l.tiles)) {const [x,z]=k.split(',').map(Number),n={level:l.id,x,z};if(walkable(p,n)&&!reached.has(nodeKey(n))) unreachable++;}
    if(unreachable) issues.push(`${unreachable} walkable cells cannot be reached from entry.`);
  }
  return issues;
}
export function parseProject(value) {
  const p=typeof value==='string'?JSON.parse(value):value;
  const fail=()=>{throw new Error('This file is not a valid LW Space Studio v1 project.');};
  const appearance=(v,fields)=>{if(v===undefined)return;if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!fields.includes(k))||Object.values(v).some(c=>typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c)))fail();};
  const pos=n=>n&&Number.isSafeInteger(n.x)&&Number.isSafeInteger(n.z);
  if(!p||p.format!=='lw-space-studio'||p.version!==1||typeof p.name!=='string'||p.name.length>120||!Array.isArray(p.levels)||p.levels.length<1||!Array.isArray(p.stairs)) fail();
  const ids=new Set();
  for(const l of p.levels) {
    if(!l||typeof l.id!=='string'||!/^[-\w]{1,80}$/.test(l.id)||ids.has(l.id)||typeof l.name!=='string'||l.name.length>80||!l.tiles||!l.walls||!Array.isArray(l.items)) fail();
    ids.add(l.id);
    for(const [k,t] of Object.entries(l.tiles)) {const [x,z]=k.split(',').map(Number);if(!pos({x,z})||key(x,z)!==k||!t||typeof t.walk!=='boolean'||typeof t.place!=='boolean') fail();}
    for(const [k,w] of Object.entries(l.walls)) if(!pos(w)||!['x','z'].includes(w.axis)||!['wall','door','fence','window'].includes(w.kind)||typeof w.collapse!=='boolean'||typeof w.mount!=='boolean'||k!==edgeKey(w)) fail();
    for(const i of l.items) if(!pos(i)) fail();
    if(l.rooms!==undefined){
      if(!Array.isArray(l.rooms)||l.rooms.length>1000)fail();const roomIds=new Set();
      for(const r of l.rooms){if(!pos(r)||typeof r.id!=='string'||r.id.length>80||roomIds.has(r.id)||typeof r.name!=='string'||r.name.length>80||!['indoor','outdoor'].includes(r.kind)||!Number.isSafeInteger(r.width)||r.width<1||!Number.isSafeInteger(r.depth)||r.depth<1||!Number.isSafeInteger(r.x+r.width)||!Number.isSafeInteger(r.z+r.depth))fail();roomIds.add(r.id);}
    }
  }
  const sids=new Set(),occupied=new Set();
  for(const s of p.stairs) {if(!s||typeof s.id!=='string'||sids.has(s.id)||s.a?.level===s.b?.level) fail();sids.add(s.id);for(const e of [s.a,s.b]) {if(!pos(e)||!ids.has(e.level)||!['x','z'].includes(e.axis)||![0,90,180,270].includes(e.angle)) fail();appearance(e.appearance,['bodyColor','railColor']);if(e.width!==undefined&&![1,2].includes(e.width))fail();if(e.style!==undefined&&!['basic','masonry','timber','open'].includes(e.style))fail();if(e.depth!==undefined&&![2,3,4].includes(e.depth))fail();if(e.rise!==undefined&&![1,-1].includes(e.rise))fail();for(const c of triggerCells(e)) {if(!pos(c)||occupied.has(nodeKey(c))) fail();occupied.add(nodeKey(c));}}}
  if(p.spawn!==null&&(!pos(p.spawn)||!ids.has(p.spawn.level))) fail();
  if(p.decorGroups!==undefined){if(!Array.isArray(p.decorGroups)||p.decorGroups.length>10000)fail();const groups=new Set();for(const g of p.decorGroups){if(!g||!/^lw_[a-z0-9_]{1,80}$/.test(g.id)||groups.has(g.id)||typeof g.name!=='string'||g.name.length>80||!['floor','wall'].includes(g.kind)||typeof g.editable!=='boolean')fail();if((g.level!==undefined||g.area!==undefined)&&(!p.levels.some(l=>l.id===g.level)||!['inside','outside'].includes(g.area)||(g.area==='outside'&&g.level!==p.levels[0].id)))fail();groups.add(g.id);}for(const l of p.levels)for(const [kind,values] of [['floor',l.tiles],['wall',l.walls]])for(const v of Object.values(values)){if(v.decorGroup&&!p.decorGroups.some(g=>g.id===v.decorGroup&&g.kind===kind&&(!g.level||g.level===l.id)))fail();}}
  for(const l of p.levels)for(const v of [...Object.values(l.tiles),...Object.values(l.walls)]){if(v.material!==undefined&&!/^[a-z-]{1,40}$/.test(v.material))fail();if(v.piece!==undefined&&(typeof v.piece!=='string'||v.piece.length>50))fail();if(v.size!==undefined&&![1,2].includes(v.size))fail();if(v.facing!==undefined&&![1,-1].includes(v.facing))fail();appearance(v.appearance,['frameColor','glassColor']);if(v.doorStyle!==undefined&&!['square','wide','arch'].includes(v.doorStyle))fail();if(v.windowStyle!==undefined&&!['plain','divided','high'].includes(v.windowStyle))fail();if(v.gate!==undefined&&(typeof v.gate!=='boolean'||v.kind!=='fence'))fail();if(v.fenceStyle!==undefined&&!['rail','picket','metal','privacy','slat'].includes(v.fenceStyle))fail();}
  validateExteriorFinishes(p);return structuredClone(p);
}

// Rotate one authored endpoint; the connected floor keeps its own layout.
export function rotatedStairEnd(project,id,side,turn=1){
 const stair=project.stairs.find(s=>s.id===id),end=stair?.[side];
 if(!end||!['a','b'].includes(side)||!end.style)throw Error('Select a placed staircase first.');
 const directions=[['x',-1],['z',1],['x',1],['z',-1]];
 const index=directions.findIndex(([axis,rise])=>axis===end.axis&&rise===(end.rise===1?1:-1));
 const [axis,rise]=directions[(index+(turn===2?2:turn<0?3:1))%4];
 const next={...end,axis,rise,angle:axis==='x'?90:0};
 const other={...project,stairs:project.stairs.filter(s=>s.id!==id)};
 const level=levelOf(project,end.level);
 if(triggerCells(next).some(c=>!walkable(other,c)||portalAt(other,c)||nodeKey(project.spawn||{})===nodeKey(c)))throw Error('The rotated stair base needs free walkable floor.');
 if(stairFlightCells(next).some(c=>portalAt(other,c)||stairSolidAt(other,c)||nodeKey(project.spawn||{})===nodeKey(c)||level.items.some(i=>i.x===c.x&&i.z===c.z)))throw Error('The rotated stairs would overlap another stair, an item, or the entry point.');
 return next;
}

export function validateExteriorFinishes(p){
 for(const l of p.levels)for(const w of Object.values(l.walls)){
  if(w.exteriorMaterial!==undefined&&!/^[a-z-]{1,40}$/.test(w.exteriorMaterial))throw Error('Invalid outside wall finish.');
  if(w.exteriorDecorGroup&&!p.decorGroups?.some(g=>g.id===w.exteriorDecorGroup&&g.kind==='wall'&&g.area==='outside'&&g.level===l.id))throw Error('Invalid outside wall label.');
 }
}
