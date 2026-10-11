import kit from './kit.mjs';
import {wallCorners,wallCornerFaces,wallSide,fenceFaces,fencePostOwners} from './geometry.mjs';
import {shadeArchitecture} from './room-shading.mjs';
import {surfaceMaterial} from './material-surfaces.mjs';
import {meshBuilder,KIT,wallSurfaceEnds,wallRenderHeight,wallEnds,wallEndVisible,wallEndExposed,wallFacing,wallCapEnds,windowLayout,tintColor} from './geometry.mjs';
import {cutProfile} from './rooms.mjs';

export function wallFaces(w,{level,rotation=0,corners=[],collapsed=false,paint={back:false,fill:'#d3d7c9',opacity:1},cutSelection=new Set()}={}){
 const active=level.id,faces=[],polygon=(vertices,attrs)=>faces.push({vertices,attrs}),collapsedWall=()=>collapsed,wallPaint=()=>paint;
function draw(w,corners=[]){const [a,b]=wallSurfaceEnds(w,rotation,w.kind==='door'?[]:corners),collapsed=collapsedWall(w),h=wallRenderHeight(w,collapsed);const {back,fill,opacity}=wallPaint(w),material=paint.material||w.material;
  const attrs={'data-kind':w.kind,'data-level':active,'data-collapsed':collapsed,'data-wall-x':w.x,'data-wall-z':w.z,'data-wall-axis':w.axis,'data-face':back?'back':'front',opacity,'pointer-events':'none'};
  const at=(u,y,d=0)=>{const side=w.axis==='x'?[1,1,-1,-1][rotation]:[1,-1,-1,1][rotation];return [a[0]+(b[0]-a[0])*u+(w.axis==='x'?side*d:0),a[1]+(b[1]-a[1])*u+(w.axis==='z'?side*d:0),y];};
  const flat=(u,v,low,high,color,overrides={})=>polygon([at(u,low),at(v,low),at(v,high),at(u,high)],{fill:color,stroke:back?'none':color,'stroke-width':.35,...attrs,...overrides});
  const panel=(u,v,low,high,color=fill,overrides={})=>{
    flat(u,v,low,high,color,{...(!back&&color===fill&&surfaceMaterial(material)?{'data-texture':material}:{}),...overrides});
    if(back||color!==fill||Object.keys(overrides).length||!['brick','stone','wood','panel'].includes(material))return;
    const patch=(x0,x1,y0,y1,tone,part)=>{x0=Math.max(u,x0);x1=Math.min(v,x1);y0=Math.max(low,y0);y1=Math.min(high,y1);if(x1>x0&&y1>y0)flat(x0,x1,y0,y1,tintColor(fill,tone),{'data-part':part,stroke:'none'});};
    const motif=(points,tone,part)=>{
      let poly=points;
      for(const [axis,limit,sign] of [[0,u,1],[0,v,-1],[1,low,1],[1,high,-1]]){
        const clipped=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-limit)*sign,db=(b[axis]-limit)*sign;if(da>=0)clipped.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);clipped.push(a.map((n,k)=>n+(b[k]-n)*t));}}poly=clipped;
      }
      if(poly.length>=3)polygon(poly.map(([x,y])=>at(x,y)),{...attrs,fill:tintColor(fill,tone),'data-part':part});
    };
    if(['brick','stone'].includes(material)){
      const step=material==='brick'?18:38,span=material==='brick'?.5:1;
      for(let row=Math.floor(low/step);row*step<high;row++){
        const shift=(row%2)*span/2;
        for(let c=-1;c<3;c++){const x=c*span+shift,y=row*step;
          const variation=1+Math.sin(row*2.73+c*4.17)*.075;
          patch(x+.012,x+span-.012,y+1,y+step-1,variation,'masonry-face');
          patch(x,x+span,y,y+2.2,.63,'mortar');patch(x,x+.02,y,y+step,.67,'mortar');
          motif([[x+.02,y+step-1],[x+span-.025,y+step-1],[x+span-.065,y+step-4],[x+.075,y+step-3]],variation*1.16,'masonry-bevel');
          motif([[x+.02,y+2],[x+span-.02,y+2],[x+span-.035,y+5],[x+.07,y+4]],variation*.81,'masonry-undercut');
          for(let fleck=0;fleck<5;fleck++){
            const fx=x+.06+(span-.12)*((Math.sin(row*7+c*3+fleck*4)+1)/2),fy=y+6+(step-12)*((Math.cos(row*3+fleck*7)+1)/2);
            motif([[fx-.017,fy],[fx+.023,fy-1],[fx+.032,fy+1.6],[fx-.011,fy+2.2]],variation*(fleck%2?.94:1.055),'masonry-grain');
          }
          if(material==='stone'){
            motif([[x+.035,y+7],[x+span*.40,y+step*.55],[x+span*.72,y+step*.46],[x+span-.03,y+step*.74],[x+span*.70,y+step*.51],[x+span*.38,y+step*.59]],variation*.9,'stone-vein');
            motif([[x+span-.02,y+step-1],[x+span-.085,y+step-1],[x+span-.052,y+step-7],[x+span-.02,y+step-9]],variation*.75,'stone-chip');
          }

        }
      }
    }else if(material==='wood'){
      for(let i=0;i<4;i++){
        const x=i/4;patch(x,x+.25,0,h,1+(i%3-1)*.065,'timber-board');patch(x,x+.011,0,h,.51,'board-joint');patch(x+.012,x+.027,0,h,1.19,'board-bevel');
        for(let k=0;k<5;k++){
          const points=[],center=x+.052+k*.037;
          for(let y=0;y<=h+8;y+=8)points.push([center+Math.sin(y*.04+i+k)*.008,y]);
          for(let y=Math.ceil(h/8)*8;y>=0;y-=8)points.push([center+Math.sin(y*.04+i+k)*.008+.006,y]);
          motif(points,.77+k*.033,'timber-grain');
        }
        const ky=70+i*39,kx=x+.12;
        for(const radius of [1,.6]){
          const points=[];for(let j=0;j<=16;j++){const a=j*Math.PI/8;points.push([kx+Math.cos(a)*.045*radius,ky+Math.sin(a)*12*radius]);}
          for(let j=16;j>=0;j--){const a=j*Math.PI/8;points.push([kx+Math.cos(a)*(.045*radius-.006),ky+Math.sin(a)*(12*radius-1.5)]);}
          motif(points,.64,'timber-knot');
        }
      }

    }else{
      for(const [x0,x1,y0,y1] of [[.065,.935,22,99],[.065,.935,118,h-25]]){
        patch(x0,x1,y0,y1,.92,'panel-recess');patch(x0,x0+.026,y0,y1,.78,'panel-moulding');patch(x0,x1,y1-5,y1,1.1,'panel-moulding');patch(x1-.026,x1,y0,y1,1.13,'panel-moulding');patch(x0,x1,y0,y0+4,.81,'panel-moulding');
      }
      patch(0,1,0,9,.87,'skirting');patch(0,1,9,12,1.12,'skirting');
    }
  };
  // Shallow extrusions give casings a real side face and a lit top edge.
  const moulding=(u,v,low,high,color,depth=.035,part='casing')=>{
    if(back)return;
    polygon([at(u,low,depth),at(v,low,depth),at(v,high,depth),at(u,high,depth)],{...attrs,fill:color,'data-part':part});
    polygon([at(u,high),at(v,high),at(v,high,depth),at(u,high,depth)],{...attrs,fill:tintColor(color,1.12),'data-part':part+'-top'});
    for(const x of [u,v])polygon([at(x,low),at(x,low,depth),at(x,high,depth),at(x,high)],{...attrs,fill:tintColor(color,.72),'data-part':part+'-edge'});
  };
  if(w.kind==='fence')return;
  if(collapsed){
    const profile=cutProfile(w,level.walls,cutSelection),t=KIT.wallThickness/2;
    const normal=w.axis==='x'?[1,0]:[0,1],side=w.axis==='x'?[1,1,-1,-1][rotation]:[1,-1,-1,1][rotation];
    const at=(u,height,across=0)=>[a[0]+(b[0]-a[0])*u+normal[0]*across,a[1]+(b[1]-a[1])*u+normal[1]*across,height];
    const heightAt=u=>{for(let i=1;i<profile.length;i++)if(u<=profile[i][0]){const [v,h]=profile[i-1],[q,k]=profile[i];return h+(k-h)*(u-v)/(q-v);}return profile.at(-1)[1];};
    if(w.kind==='door')return;
    const ranges=[[0,1]];
    for(const [lo,hi] of ranges){
      const top=[[lo,heightAt(lo)],...profile.filter(([u])=>u>lo&&u<hi),[hi,heightAt(hi)]];
      polygon([at(lo,0),at(hi,0),...top.slice().reverse().map(([u,h])=>at(u,h))],{fill,stroke:fill,'stroke-width':.3,...attrs,'data-part':'room-cut',...(!back&&surfaceMaterial(material)?{'data-texture':material}:{})});
      for(let i=1;i<top.length;i++){const [u,h]=top[i-1],[v,k]=top[i];polygon([at(u,h),at(v,k),at(v,k,-side*2*t),at(u,h,-side*2*t)],{fill:tintColor(fill,1.10),...attrs,'data-part':'cap'});}
      for(const [u,h] of [top[0],top.at(-1)])if(u>0&&u<1)polygon([at(u,0),at(u,0,-side*2*t),at(u,h,-side*2*t),at(u,h)],{fill:tintColor(fill,.70),...attrs,'data-part':'end'});
    }
    for(const [i,p] of wallEnds(w).entries())if(wallEndVisible(w,i,rotation)&&wallEndExposed(w,i,level.walls)){
      const h=heightAt(i);polygon([[p[0]-normal[0]*t,p[1]-normal[1]*t,0],[p[0]+normal[0]*t,p[1]+normal[1]*t,0],[p[0]+normal[0]*t,p[1]+normal[1]*t,h],[p[0]-normal[0]*t,p[1]-normal[1]*t,h]],{fill:tintColor(fill,.70),...attrs,'data-part':'end'});
    }
    return;
  }


  if(w.kind==='door'){
    const L=0,R=1,top=h*(w.doorStyle==='wide'?.88:.78);
    if(!collapsed){
      if(w.doorStyle==='arch'){
        const at=(u,y)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,y];
        const arch=u=>h*.66+Math.sqrt(Math.max(0,1-((u-.5)/(.5-L))**2))*h*.17;
        for(let i=0;i<16;i++){const u=L+(R-L)*i/16,v=L+(R-L)*(i+1)/16;polygon([at(u,arch(u)),at(v,arch(v)),at(v,h),at(u,h)],{fill,...attrs,...(!back&&surfaceMaterial(material)?{'data-texture':material}:{})});polygon([at(u,arch(u)),at(v,arch(v)),at(v,arch(v)+5),at(u,arch(u)+5)],{fill:back?fill:'#e8e2d2',...attrs});}
      }else{panel(L,R,top,h);panel(L-.025,R+.025,top-4,top+5,back?fill:'#e8e2d2');}
      panel(L-.035,L,0,w.doorStyle==='arch'?h*.66:top,back?fill:'#b3b7a9');panel(R,R+.035,0,w.doorStyle==='arch'?h*.66:top,back?fill:'#e8e2d2');
      const trim=back?fill:'#e5decb',reveal=back?fill:'#8e9285';
      const jambTop=w.doorStyle==='arch'?h*.66:top;
      for(const [u,v] of [[L-.042,L-.007],[R+.007,R+.042]]){
        moulding(u,v,0,jambTop,trim,.035,'door-casing');
        moulding(u<0?u-.009:u,u<0?v:v+.009,0,15,tintColor(trim,.92),.045,'door-plinth');
      }
      if(w.doorStyle!=='arch')moulding(L-.05,R+.05,top+1,top+8,trim,.04,'door-header');

      if(w.doorStyle==='craftsman'){
        for(const [u,v] of [[-.076,-.062],[1.062,1.076]])moulding(u,v,20,top+3,tintColor(trim,.88),.052,'casing-flute');
        moulding(-.11,1.11,top+19,top+22,tintColor(trim,1.07),.065,'casing-crown');
        panel(L-.065,L-.015,0,top+9,trim);panel(R+.015,R+.065,0,top+9,trim);
        panel(L-.09,R+.09,top+6,top+15,trim);panel(L-.105,R+.105,top+15,top+19,back?fill:'#f0e8d6');
        for(const u of [L-.065,R+.015]){panel(u,u+.05,0,18,reveal);panel(u+.009,u+.041,23,top-7,back?fill:'#c9c3b3');}
      }else if(w.doorStyle==='stone'){
        for(let i=0;i<7;i++)for(const [u,v] of [[L-.08,L],[R,R+.08]])panel(u,v,i*top/7+1,(i+1)*top/7-1,back?fill:i%2?'#bbb8a8':'#d4d0bd');
        panel(L-.09,R+.09,top,top+16,trim);
        for(let i=0;i<5;i++)panel(L+(R-L)*i/5+.004,L+(R-L)*(i+1)/5-.004,top+1,top+15,back?fill:i%2?'#bcb8a8':'#d4d0bd');
      }

      if(w.doorStyle==='craftsman'){
        const normal=w.axis==='x'?[1,0]:[0,1],sign=wallFacing(w,level.tiles);
        const leafPoint=(u,v,y)=>[a[0]+(b[0]-a[0])*u+normal[0]*v*sign,a[1]+(b[1]-a[1])*u+normal[1]*v*sign,y];
        const pal={top:'#a47747',side:'#604026',end:'#805333'},leaf=meshBuilder(leafPoint,rotation,pal);
        leaf.box(-.072,-.032,.015,.94,0,top-4,0,top-4,'door-leaf');
        for(const side of [-1,1])for(const [lo,hi] of [[.08,.43],[.50,.86]])for(const [bottom,upper] of [[12,top*.28],[top*.34,top*.65],[top*.71,top-14]]){
          const x=side<0?-.082:-.022;
          leaf.box(x-.007,x+.007,lo,hi,bottom,upper,bottom,upper,'raised-door-panel');
          for(const v of [lo-.008,hi])leaf.box(x-.012,x+.012,v,v+.015,bottom-2,upper+2,bottom-2,upper+2,'panel-bead');
          for(const y of [bottom-2,upper])leaf.box(x-.012,x+.012,lo-.008,hi+.015,y,y+2,y,y+2,'panel-bead');
        }
        const brass={top:'#d0b36b',side:'#756034',end:'#ad8c45'};
        leaf.box(-.10,-.085,.82,.85,top*.44,top*.51,top*.44,top*.51,'door-hardware',brass);
        for(const f of leaf.faces)polygon(f.vertices,{...attrs,fill:f.color,'data-part':f.part,...(f.part==='raised-door-panel'?{'data-texture':'cc0-wood-cabinet-worn-long'}:{})});
      }

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
    if(divided){if(w.windowStyle!=='colonial')panel(.485,.515,B+4,T-4,frame);panel(L,R,(B+T)/2-2,(B+T)/2+2,frame);}
    // Recessed inner beads and a separate outer casing give the frame depth.
    panel(L+.032,L+.045,B+5,T-5,tintColor(frame,.72));panel(R-.045,R-.032,B+5,T-5,tintColor(frame,1.09));
    panel(L-.035,R+.035,T+5,T+9,tintColor(frame,1.06));panel(L-.04,R+.04,B-10,B-6,tintColor(frame,.78));
    if(w.windowStyle==='colonial')for(const u of [L+(R-L)/3,L+2*(R-L)/3])panel(u-.009,u+.009,B+4,T-4,frame);
    if(w.windowStyle==='casement'){
      panel(.487,.513,B+4,T-4,frame);
      for(const u of [L+.02,R-.035])for(const y of [B+12,T-16])panel(u,u+.015,y,y+6,back?fill:'#626d63');
      panel(.46,.478,(B+T)/2-6,(B+T)/2+6,back?fill:'#767960');
    }

    for(const [u,v] of [[L-.027,L+.003],[R-.003,R+.027]])moulding(u,v,B-4,T+5,frame,.035,'window-casing');
    moulding(L-.035,R+.035,T+4,T+10,frame,.045,'window-header');
    moulding(L-.045,R+.045,B-9,B-3,tintColor(frame,.93),.08,'sill-apron');
    if(w.windowStyle!=='colonial'){
      for(const [u,v] of [[L-.049,L-.029],[R+.029,R+.049]])moulding(u,v,B-10,T+10,tintColor(frame,.94),.055,'window-outer-casing');
      moulding(L-.058,R+.058,T+9,T+13,tintColor(frame,1.04),.065,'window-drip-cap');
      for(const [u,v] of [[L+.036,L+.052],[R-.052,R-.036]])moulding(u,v,B+4,T-4,tintColor(frame,.77),.014,'recessed-glazing-bead');
      if(w.windowStyle==='divided')moulding(L+.04,R-.04,(B+T)/2-2,(B+T)/2+2,frame,.04,'meeting-rail');
      if(w.windowStyle==='casement')for(const u of [.459,.533])moulding(u,u+.015,(B+T)/2-5,(B+T)/2+5,'#968052',.065,'casement-handle');
      if(w.windowStyle==='high')for(const u of [L+.06,R-.08])moulding(u,u+.022,T-8,T-3,tintColor(frame,.60),.045,'transom-hinge');
    }
    if(w.windowStyle==='colonial'){
      for(const [u,v] of [[L-.052,L-.037],[R+.037,R+.052]])moulding(u,v,B-12,T+12,tintColor(frame,.94),.055,'outer-window-bead');
      moulding(L-.065,R+.065,T+10,T+14,tintColor(frame,1.05),.065,'window-cornice');
      moulding(L+.018,R-.018,(B+T)/2-3,(B+T)/2+3,frame,.025,'sash-rail');
      for(const u of [.44,.55])moulding(u,u+.025,(B+T)/2+4,(B+T)/2+7,'#8d825c',.035,'sash-lock');
    }
    // A shallow sill projects from the front face of the wall.
    const normal=w.axis==='x'?[1,0]:[0,1],sign=wallFacing(w,level.tiles);
    const sill=(u,d)=>[a[0]+(b[0]-a[0])*u+normal[0]*d*sign,a[1]+(b[1]-a[1])*u+normal[1]*d*sign,B+5];
    polygon([sill(L-.045,0),sill(R+.045,0),sill(R+.045,.1),sill(L-.045,.1)],{fill:frame,...attrs,'data-part':'window-sill'});
  }
  else panel(0,1,0,h);
  const t=KIT.wallThickness/2,offset=w.axis==='x'?[t,0]:[0,t],quad=(p,q,low,high)=>[[p[0]-offset[0],p[1]-offset[1],low],[q[0]+offset[0],q[1]+offset[1],low],[q[0]+offset[0],q[1]+offset[1],high],[p[0]-offset[0],p[1]-offset[1],high]];
  const [capA,capB]=wallCapEnds(w,corners);
  polygon([[capA[0]-offset[0],capA[1]-offset[1],h],[capB[0]-offset[0],capB[1]-offset[1],h],[capB[0]+offset[0],capB[1]+offset[1],h],[capA[0]+offset[0],capA[1]+offset[1],h]],{fill:tintColor(fill,1.10),...attrs,'data-part':'cap'});
  for(const [i,p] of wallEnds(w).entries())if(wallEndVisible(w,i,rotation)&&wallEndExposed(w,i,level.walls))polygon(quad(p,p,w.kind==='door'?h*(w.doorStyle==='wide'?.88:w.doorStyle==='arch'?.83:.78):0,h),{fill:tintColor(fill,.70),...attrs,'data-part':'end'});
}
 draw(w,corners);return shadeArchitecture(faces,rotation);
}

// Static architecture seen through a stair opening belongs to the lower floor.
// Both renderers clip these faces to the upstairs opening after projection.
export function stairwellWallFaces(well,below,rotation=0){
 const origin=well.belowPoint(0,0),bx=well.belowPoint(1,0),bz=well.belowPoint(0,1),sx=[1,1,-1,-1][rotation],sz=[1,-1,-1,1][rotation];
 const lowerSX=Math.sign((bx[0]-origin[0])*sx+(bx[1]-origin[1])*sz),lowerSZ=Math.sign((bz[0]-origin[0])*sx+(bz[1]-origin[1])*sz);
 const lowerRotation=[0,1,2,3].find(r=>[1,1,-1,-1][r]===lowerSX&&[1,-1,-1,1][r]===lowerSZ);
 const walls=Object.values(below.walls),corners=wallCorners(below.walls),faces=[];
 const materialFor=w=>wallSide({...w,facing:wallFacing(w,below.tiles)},lowerRotation)==='back'?(w.exteriorMaterial||w.material):w.material;
 for(const w of walls){
  if(w.kind==='fence'){faces.push(...fenceFaces(w,lowerRotation,fencePostOwners(w,walls)));continue;}
  const material=materialFor(w),fill=kit.wallMaterials.find(m=>m.id===material)?.color||'#d3d7c9';
  faces.push(...wallFaces(w,{level:below,rotation:lowerRotation,corners,paint:{material,fill,opacity:1}}));
 }
 for(const c of corners)faces.push(...shadeArchitecture(wallCornerFaces(c,lowerRotation).map(f=>{
  const material=materialFor(f.wall),fill=kit.wallMaterials.find(m=>m.id===material)?.color||'#d3d7c9';
  return {...f,color:fill,attrs:{fill,...(f.part!=='cap'&&surfaceMaterial(material)?{'data-texture':material}:{})}};
 }),lowerRotation));
 return faces.map(f=>{
  const attrs={fill:f.color,...f.attrs,'data-kind':'wall-below','pointer-events':'none'},transform=p=>well.belowPoint(...p);
  if(attrs['data-texture']&&!attrs['data-texture-basis']){
   const v=f.vertices,alongX=Math.max(...v.map(p=>p[0]))-Math.min(...v.map(p=>p[0]))>Math.max(...v.map(p=>p[1]))-Math.min(...v.map(p=>p[1])),fixed=v[0][alongX?1:0];
   attrs['data-texture-basis']=alongX?[[-.5,fixed,256],[1.5,fixed,256],[-.5,fixed,0]]:[[fixed,-.5,256],[fixed,1.5,256],[fixed,-.5,0]];
  }
  for(const k of ['data-texture-basis','data-sprite-basis'])if(attrs[k])attrs[k]=attrs[k].map(transform);
  return {...f,vertices:f.vertices.map(transform),attrs};
 });
}
