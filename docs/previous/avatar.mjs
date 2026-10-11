// LittleWorlds preview animation, measured in unzoomed scene pixels.
export const AVATAR_HEIGHT=180;
const FRAME_WIDTH=192,FRAME_HEIGHT=256,COLUMNS=13,ROWS=8;
const atlasUrl=new URL('./assets/lw-builder-avatar.png',import.meta.url).href;
export function avatarFrame(direction,phase=0,moving=false){
 const angle=Math.atan2(direction.y,direction.x);
 const row=((Math.round(angle/(Math.PI/4))+1)%ROWS+ROWS)%ROWS;
 const elapsed=Math.max(0,Number.isFinite(phase)?phase:0)/Math.PI*240;
 return {row,column:moving?1+Math.floor(elapsed/125)%12:0};
}
export function drawBuilderAvatar(add,direction,phase,moving){
 const {row,column}=avatarFrame(direction,phase,moving);
 const frame=add('svg',{x:-96,y:-232,width:FRAME_WIDTH,height:FRAME_HEIGHT,viewBox:`${column*FRAME_WIDTH} ${row*FRAME_HEIGHT} ${FRAME_WIDTH} ${FRAME_HEIGHT}`,overflow:'hidden','pointer-events':'none','data-avatar-frame':`${row}:${column}`});
 const image=document.createElementNS('http://www.w3.org/2000/svg','image');
 for(const [key,value] of Object.entries({href:atlasUrl,width:FRAME_WIDTH*COLUMNS,height:FRAME_HEIGHT*ROWS}))image.setAttribute(key,value);
 frame.append(image);
}
