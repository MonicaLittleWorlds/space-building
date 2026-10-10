export function ensureDecor(p){
 p.decorGroups??=[];
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
 return p;
}
export function decorGroupsFor(p,level,area,kind){return p.decorGroups.filter(g=>g.level===level&&g.area===area&&g.kind===kind&&(area!=='outside'||p.levels[0]?.id===level));}
export function decorManifest(p,{legacy=false}={}){
 if(legacy)return {format:'lw-studio-decor-mapping',version:1,projectName:p.name,status:'authoring-manifest-needs-game-importer',pieces:p.levels.flatMap(l=>['window','stair'].flatMap(kind=>decorPieces(p,l.id,kind).map(t=>({level:l.id,kind,slot:t.id,style:kind==='window'?(t.value.windowStyle||'divided'):t.value.style,appearance:t.value.appearance||{}})))),groups:p.decorGroups.map(g=>({...g,persistenceKey:g.id,physicalSlots:p.levels.flatMap(l=>Object.entries(g.kind==='floor'?l.tiles:l.walls).filter(([,v])=>v.decorGroup===g.id).map(([id,v])=>({level:l.id,slot:`${l.id}:${g.kind}:${id}`,material:v.material||'blank'})))}))};
 ensureDecor(p);
 return {format:'lw-studio-decor-mapping',version:2,projectName:p.name,status:'authoring-manifest-needs-game-importer',pieces:p.levels.flatMap(l=>['window','stair'].flatMap(kind=>decorPieces(p,l.id,kind).map(t=>({level:l.id,kind,slot:t.id,style:kind==='window'?(t.value.windowStyle||'divided'):t.value.style,appearance:t.value.appearance||{}})))),groups:p.decorGroups.map(g=>({...g,levelName:p.levels.find(l=>l.id===g.level)?.name,persistenceKey:g.id,physicalSlots:p.levels.filter(l=>l.id===g.level).flatMap(l=>Object.entries(g.kind==='floor'?l.tiles:l.walls).flatMap(([id,v])=>[...(v.decorGroup===g.id?[{level:l.id,area:g.area,slot:`${l.id}:${g.kind}:${id}`,material:v.material||'blank'}]:[]),...(g.kind==='wall'&&v.exteriorDecorGroup===g.id?[{level:l.id,area:'outside',face:'outside',slot:`${l.id}:wall:${id}:outside`,material:v.exteriorMaterial||v.material||'blank'}]:[])]))}))};
}
export function decorField(kind,area){return kind==='wall'&&area==='outside'?'exteriorDecorGroup':'decorGroup';}
export function assignDecor(p,level,kind,id,group,area='inside'){const l=p.levels.find(l=>l.id===level);if(!l)return false;const target=(kind==='floor'?l.tiles:l.walls)[id];if(!target)return false;if(group&&!p.decorGroups.some(g=>g.id===group&&g.kind===kind&&g.level===level&&(g.area!=='outside'||level===p.levels[0]?.id)))return false;const selected=p.decorGroups.find(g=>g.id===group);target[decorField(kind,selected?.area||area)]=group||null;return true;}

export function decorPieces(p,level,kind){
 const l=p.levels.find(l=>l.id===level);if(!l)return [];
 if(kind==='window')return Object.entries(l.walls).filter(([,w])=>w.kind==='window').map(([id,value])=>({id,label:`Window · ${value.x}, ${value.z} · ${value.axis.toUpperCase()} edge`,value}));
 return p.stairs.flatMap(s=>['a','b'].filter(side=>s[side].level===level&&s[side].style).map(side=>({id:s.id+':'+side,label:`Stair · ${s[side].x}, ${s[side].z} · ${s[side].width===1?'single':'double'}`,value:s[side]})));
}
export function applyPieceDecor(p,level,kind,id,style,appearance){
 const piece=decorPieces(p,level,kind).find(t=>t.id===id);if(!piece)return false;
 const styles=kind==='window'?['plain','divided','high','casement','colonial']:['basic','masonry','timber','open','classic','iron'];
 const fields=kind==='window'?['frameColor','glassColor']:['bodyColor','railColor'];
 if(!styles.includes(style)||!appearance||Object.keys(appearance).some(k=>!fields.includes(k))||Object.values(appearance).some(c=>!/^#[0-9a-f]{6}$/i.test(c)))return false;
 piece.value[kind==='window'?'windowStyle':'style']=style;piece.value.appearance={...appearance};return true;
}

export function createDecorGroup(p,{name,kind,level,area,id}){
 ensureDecor(p);name=String(name||'').trim().slice(0,80);
 if(!name)throw Error('Give this editable area a name first.');
 if(!p.levels.some(l=>l.id===level)||!['floor','wall'].includes(kind)||!['inside','outside'].includes(area)||(area==='outside'&&p.levels[0].id!==level))throw Error('Choose a valid floor and surface type.');
 if(p.decorGroups.some(g=>g.level===level&&g.area===area&&g.kind===kind&&g.name.toLowerCase()===name.toLowerCase()))throw Error('An editable area with this name already exists here. Choose it from the list.');
 const group={id:id||'lw_'+crypto.randomUUID().replaceAll('-',''),name,kind,level,area,editable:true};p.decorGroups.push(group);return group;
}
export function deleteDecorGroup(p,id){
 const group=p.decorGroups.find(g=>g.id===id);if(!group)return false;
 for(const l of p.levels)for(const value of Object.values(group.kind==='floor'?l.tiles:l.walls))for(const field of ['decorGroup','exteriorDecorGroup'])if(value[field]===id)value[field]=null;
 p.decorGroups=p.decorGroups.filter(g=>g.id!==id);return true;
}

export const DECOR_COLORS=['#e2ad54','#67b9dc','#d785a8','#92c577','#b19bdf','#e58c6b','#58c4b3','#d2c35c'];
export function decorHighlight(p,id){const index=p.decorGroups.findIndex(g=>g.id===id);return index<0?null:p.decorGroups[index].color||DECOR_COLORS[index%DECOR_COLORS.length];}
export function assignDecorSafely(p,level,kind,id,group,area='inside',replace=false){
 const target=(kind==='floor'?p.levels.find(l=>l.id===level)?.tiles:p.levels.find(l=>l.id===level)?.walls)?.[id];
 const owner=target?.[decorField(kind,area)];
 if(group&&owner&&owner!==group&&!replace)return {ok:false,owner};
 return {ok:assignDecor(p,level,kind,id,group,area),owner};
}

export function toggleDecorSelection(p,level,kind,id,group,area='inside',replace=false){
 const l=p.levels.find(l=>l.id===level),target=(kind==='floor'?l?.tiles:l?.walls)?.[id];
 if(!group||!target)return {ok:false};
 if(target[decorField(kind,area)]===group)return {ok:assignDecor(p,level,kind,id,null,area),removed:true};
 return assignDecorSafely(p,level,kind,id,group,area,replace);
}
