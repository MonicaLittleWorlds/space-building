// An exact square fundamental domain for a 4:1 herringbone parquet.
// Individual plank UVs are independent of the floor cell/export tile borders.
export function herringbonePlanks(){
 const result=[],L=4,period=8;
 for(let i=-4;i<=4;i++)for(let j=-16;j<=16;j++)for(const [dx,dy,w,h]of [[0,0,L,1],[L,1-L,1,L]]){
  const x=i*L+j+dx,y=-i*L+j+dy;
  if(x<period&&y<period&&x+w>0&&y+h>0)result.push({x,y,w,h,key:[((x%period)+period)%period,((y%period)+period)%period,w,h].join(',')});
 }
 return result;
}
export function herringboneSVG(grainData,size=256){
 const fragments=herringbonePlanks().map(p=>{
  const k=p.key.split(',').slice(0,2).map(Number),crop=[[2,2,32,250],[112,2,30,182],[221,2,30,250]][(k[0]+k[1])%3];
  const image=`<svg width="1" height="4" viewBox="${crop.join(' ')}" preserveAspectRatio="none"><image href="data:image/png;base64,${grainData}" width="256" height="256"/></svg>`;
  const wood=p.w===4?`<g transform="translate(0 1) rotate(-90)">${image}</g>`:image;
  const tone=(k[0]*13+k[1]*7)%5;
  return `<g transform="translate(${p.x} ${p.y})">${wood}<rect width="${p.w}" height="${p.h}" fill="${tone<2?'#603c1e':'#fff0cb'}" fill-opacity="${tone<2?.025:.012}" stroke="#5d4027" stroke-opacity=".6" stroke-width=".016"/></g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 8 8"><rect width="8" height="8" fill="#b48852"/>${fragments}</svg>`;
}
