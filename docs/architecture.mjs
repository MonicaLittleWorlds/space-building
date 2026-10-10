import {KIT,wallSurfaceEnds,wallRenderHeight,wallEnds,wallEndVisible,wallEndExposed,wallFacing,wallCapEnds,windowLayout} from './geometry.mjs';
import {cutProfile} from './rooms.mjs';

export function wallFaces(w,{level,rotation=0,corners=[],collapsed=false,paint={back:false,fill:'#d3d7c9',opacity:1},cutSelection=new Set()}={}){
 const active=level.id,faces=[],polygon=(vertices,attrs)=>faces.push({vertices,attrs}),collapsedWall=()=>collapsed,wallPaint=()=>paint;
function draw(w,corners=[]){const [a,b]=wallSurfaceEnds(w,rotation,corners),collapsed=collapsedWall(w),h=wallRenderHeight(w,collapsed);const {back,fill,opacity}=wallPaint(w);
  const attrs={'data-kind':w.kind,'data-level':active,'data-collapsed':collapsed,'data-wall-x':w.x,'data-wall-z':w.z,'data-wall-axis':w.axis,'data-face':back?'back':'front',opacity,'pointer-events':'none'};
  const panel=(u,v,low,high,color=fill,overrides={})=>{const p=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u],q=[a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v];polygon([[...p,low],[...q,low],[...q,high],[...p,high]],{fill:color,stroke:back?'none':color,'stroke-width':.8,...attrs,...overrides});};
  if(w.kind==='fence')return;
  if(collapsed){
    const profile=cutProfile(w,level.walls,cutSelection),t=KIT.wallThickness/2;
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
    for(const [i,p] of wallEnds(w).entries())if(wallEndVisible(w,i,rotation)&&wallEndExposed(w,i,level.walls)){
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
    const normal=w.axis==='x'?[1,0]:[0,1],sign=wallFacing(w,level.tiles);
    const sill=(u,d)=>[a[0]+(b[0]-a[0])*u+normal[0]*d*sign,a[1]+(b[1]-a[1])*u+normal[1]*d*sign,B+5];
    polygon([sill(L-.045,0),sill(R+.045,0),sill(R+.045,.1),sill(L-.045,.1)],{fill:frame,...attrs,'data-part':'window-sill'});
  }
  else panel(0,1,0,h);
  const t=KIT.wallThickness/2,offset=w.axis==='x'?[t,0]:[0,t],quad=(p,q,low,high)=>[[p[0]-offset[0],p[1]-offset[1],low],[q[0]+offset[0],q[1]+offset[1],low],[q[0]+offset[0],q[1]+offset[1],high],[p[0]-offset[0],p[1]-offset[1],high]];
  const [capA,capB]=wallCapEnds(w,corners);
  polygon([[capA[0]-offset[0],capA[1]-offset[1],h],[capB[0]-offset[0],capB[1]-offset[1],h],[capB[0]+offset[0],capB[1]+offset[1],h],[capA[0]+offset[0],capA[1]+offset[1],h]],{fill:back?'#263e35':'#e2e7d9',...attrs,'data-part':'cap'});
  for(const [i,p] of wallEnds(w).entries())if(wallEndVisible(w,i,rotation)&&wallEndExposed(w,i,level.walls))polygon(quad(p,p,0,h),{fill:back?'#172c26':'#86958a',...attrs,'data-part':'end'});
}
 draw(w,corners);return faces;
}
