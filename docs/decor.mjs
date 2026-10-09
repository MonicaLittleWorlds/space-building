export function ensureDecor(p){
 p.decorGroups??=[{id:'lw_floor_interior',name:'Interior floors',kind:'floor',editable:true},{id:'lw_floor_outdoor',name:'Outdoor ground',kind:'floor',editable:true},{id:'lw_wall_interior',name:'Interior walls',kind:'wall',editable:true}];
 const original=[...p.decorGroups],ground=p.levels[0]?.id;
 for(const g of original){
  if(g.level)continue;
  const outdoor=g.id==='lw_floor_outdoor';
  g.level=ground;g.area=outdoor?'outside':'inside';
  for(const [index,l] of p.levels.entries()){
   if(index===0)continue;
   const members=Object.values(g.kind==='floor'?l.tiles:l.walls).filter(v=>v.decorGroup===g.id);
   if(!members.length)continue;
   let id=g.id.slice(0,60)+'_level_'+(index+1);while(p.decorGroups.some(v=>v.id===id))id+='x';
   const copy={...g,id,level:l.id,area:'inside'};p.decorGroups.push(copy);for(const v of members)v.decorGroup=id;
  }
 }
 for(const [i,l] of p.levels.entries())for(const area of i===0?['inside','outside']:['inside'])for(const kind of ['floor','wall']){
  if(p.decorGroups.some(g=>g.level===l.id&&g.area===area&&g.kind===kind))continue;
  let id=`lw_${kind}_${area}_${i+1}`;while(p.decorGroups.some(g=>g.id===id))id+='x';
  p.decorGroups.push({id,name:kind==='floor'?'Floor finishes':'Wall finishes',kind,editable:true,level:l.id,area});
 }
 return p;
}
export function decorGroupsFor(p,level,area,kind){return p.decorGroups.filter(g=>g.level===level&&g.area===area&&g.kind===kind&&(area!=='outside'||p.levels[0]?.id===level));}
export function decorManifest(p,{legacy=false}={}){
 if(legacy)return {format:'lw-studio-decor-mapping',version:1,projectName:p.name,status:'authoring-manifest-needs-game-importer',pieces:p.levels.flatMap(l=>['window','stair'].flatMap(kind=>decorPieces(p,l.id,kind).map(t=>({level:l.id,kind,slot:t.id,style:kind==='window'?(t.value.windowStyle||'divided'):t.value.style,appearance:t.value.appearance||{}})))),groups:p.decorGroups.map(g=>({...g,persistenceKey:g.id,physicalSlots:p.levels.flatMap(l=>Object.entries(g.kind==='floor'?l.tiles:l.walls).filter(([,v])=>v.decorGroup===g.id).map(([id,v])=>({level:l.id,slot:`${l.id}:${g.kind}:${id}`,material:v.material||'blank'})))}))};
 ensureDecor(p);
 return {format:'lw-studio-decor-mapping',version:2,projectName:p.name,status:'authoring-manifest-needs-game-importer',pieces:p.levels.flatMap(l=>['window','stair'].flatMap(kind=>decorPieces(p,l.id,kind).map(t=>({level:l.id,kind,slot:t.id,style:kind==='window'?(t.value.windowStyle||'divided'):t.value.style,appearance:t.value.appearance||{}})))),groups:p.decorGroups.map(g=>({...g,levelName:p.levels.find(l=>l.id===g.level)?.name,persistenceKey:g.id,physicalSlots:p.levels.filter(l=>l.id===g.level).flatMap(l=>Object.entries(g.kind==='floor'?l.tiles:l.walls).filter(([,v])=>v.decorGroup===g.id).map(([id,v])=>({level:l.id,area:g.area,slot:`${l.id}:${g.kind}:${id}`,material:v.material||'blank'})))}))};
}
export function assignDecor(p,level,kind,id,group){const l=p.levels.find(l=>l.id===level);if(!l)return false;const target=(kind==='floor'?l.tiles:l.walls)[id];if(!target)return false;if(group&&!p.decorGroups.some(g=>g.id===group&&g.kind===kind&&g.level===level&&(g.area!=='outside'||level===p.levels[0]?.id)))return false;target.decorGroup=group||null;return true;}

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
