export function ensureDecor(p){
  p.decorGroups??=[{id:'lw_floor_interior',name:'Interior floors',kind:'floor',editable:true},{id:'lw_floor_outdoor',name:'Outdoor ground',kind:'floor',editable:true},{id:'lw_wall_interior',name:'Interior walls',kind:'wall',editable:true}];
  return p;
}
export function decorManifest(p){
  ensureDecor(p);
  return {format:'lw-studio-decor-mapping',version:1,projectName:p.name,status:'authoring-manifest-needs-game-importer',pieces:p.levels.flatMap(l=>['window','stair'].flatMap(kind=>decorPieces(p,l.id,kind).map(t=>({level:l.id,kind,slot:t.id,style:kind==='window'?(t.value.windowStyle||'divided'):t.value.style,appearance:t.value.appearance||{}})))),groups:p.decorGroups.map(g=>({...g,persistenceKey:g.id,physicalSlots:p.levels.flatMap(l=>Object.entries(g.kind==='floor'?l.tiles:l.walls).filter(([,v])=>v.decorGroup===g.id).map(([id,v])=>({level:l.id,slot:`${l.id}:${g.kind}:${id}`,material:v.material||'blank'})))}))};
}
export function assignDecor(p,level,kind,id,group){const l=p.levels.find(l=>l.id===level);const target=(kind==='floor'?l.tiles:l.walls)[id];if(!target)return false;if(group&&!p.decorGroups.some(g=>g.id===group&&g.kind===kind))return false;target.decorGroup=group||null;return true;}

export function decorPieces(p,level,kind){
 const l=p.levels.find(l=>l.id===level);if(!l)return [];
 if(kind==='window')return Object.entries(l.walls).filter(([,w])=>w.kind==='window').map(([id,value])=>({id,label:`Window · ${value.x}, ${value.z} · ${value.axis.toUpperCase()} edge`,value}));
 return p.stairs.flatMap(s=>['a','b'].filter(side=>s[side].level===level&&s[side].style).map(side=>({id:s.id+':'+side,label:`Stair · ${s[side].x}, ${s[side].z} · ${s[side].width===1?'single':'double'}`,value:s[side]})));
}
export function applyPieceDecor(p,level,kind,id,style,appearance){
 const piece=decorPieces(p,level,kind).find(t=>t.id===id);if(!piece)return false;
 const styles=kind==='window'?['plain','divided','high']:['basic','masonry','timber','open'];
 const fields=kind==='window'?['frameColor','glassColor']:['bodyColor','railColor'];
 if(!styles.includes(style)||!appearance||Object.keys(appearance).some(k=>!fields.includes(k))||Object.values(appearance).some(c=>!/^#[0-9a-f]{6}$/i.test(c)))return false;
 piece.value[kind==='window'?'windowStyle':'style']=style;piece.value.appearance={...appearance};return true;
}
